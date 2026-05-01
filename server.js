require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { initDb, run, get, all } = require("./db");
const { requireAuth } = require("./middleware/auth");

const app = express();
const BASE_PORT = Number(process.env.PORT) || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_change_in_production";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function getProjectRole(projectId, userId) {
  const membership = await get(
    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, userId]
  );
  return membership ? membership.role : null;
}

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await get("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name.trim(), email.toLowerCase(), passwordHash]
    );

    const user = await get("SELECT id, name, email FROM users WHERE id = ?", [result.id]);
    const token = createToken(user);
    return res.status(201).json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await get("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const safeUser = { id: user.id, name: user.name, email: user.email };
    const token = createToken(safeUser);
    return res.json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await get("SELECT id, name, email FROM users WHERE id = ?", [req.user.id]);
  return res.json({ user });
});

app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const projectResult = await run(
      "INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)",
      [name.trim(), description || "", req.user.id]
    );

    await run(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'admin')",
      [projectResult.id, req.user.id]
    );

    const project = await get("SELECT * FROM projects WHERE id = ?", [projectResult.id]);
    return res.status(201).json({ project });
  } catch (error) {
    return res.status(500).json({ message: "Project creation failed", error: error.message });
  }
});

app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const projects = await all(
      `
      SELECT p.*, pm.role
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );
    return res.json({ projects });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch projects", error: error.message });
  }
});

app.get("/api/projects/:projectId/members", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const role = await getProjectRole(projectId, req.user.id);
    if (!role) return res.status(403).json({ message: "Access denied" });

    const members = await all(
      `
      SELECT u.id, u.name, u.email, pm.role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.role DESC, u.name ASC
      `,
      [projectId]
    );

    return res.json({ members, currentRole: role });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch members", error: error.message });
  }
});

app.post("/api/projects/:projectId/members", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { email, role = "member" } = req.body;

    const currentRole = await getProjectRole(projectId, req.user.id);
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can add members" });
    }
    if (!email) return res.status(400).json({ message: "Member email is required" });
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await get("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]);
    if (!user) return res.status(404).json({ message: "User not found" });

    await run(
      "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
      [projectId, user.id, role]
    );

    return res.status(201).json({ message: "Member added successfully" });
  } catch (error) {
    if (error.message.includes("UNIQUE")) {
      return res.status(409).json({ message: "User already in project" });
    }
    return res.status(500).json({ message: "Unable to add member", error: error.message });
  }
});

app.delete("/api/projects/:projectId/members/:userId", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const userId = Number(req.params.userId);

    const currentRole = await getProjectRole(projectId, req.user.id);
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can remove members" });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Admin cannot remove self" });
    }

    await run("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [projectId, userId]);
    return res.json({ message: "Member removed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to remove member", error: error.message });
  }
});

app.post("/api/projects/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const currentRole = await getProjectRole(projectId, req.user.id);
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can create tasks" });
    }

    const { title, description, dueDate, priority = "medium", assignedTo } = req.body;
    if (!title) return res.status(400).json({ message: "Task title is required" });
    if (!["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    if (assignedTo) {
      const isMember = await get(
        "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, assignedTo]
      );
      if (!isMember) return res.status(400).json({ message: "Assignee must be project member" });
    }

    const taskResult = await run(
      `
      INSERT INTO tasks (project_id, title, description, due_date, priority, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [projectId, title.trim(), description || "", dueDate || null, priority, assignedTo || null, req.user.id]
    );

    const task = await get("SELECT * FROM tasks WHERE id = ?", [taskResult.id]);
    return res.status(201).json({ task });
  } catch (error) {
    return res.status(500).json({ message: "Unable to create task", error: error.message });
  }
});

app.get("/api/projects/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const currentRole = await getProjectRole(projectId, req.user.id);
    if (!currentRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    let query = `
      SELECT t.*, u.name AS assignee_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
    `;
    const params = [projectId];

    if (currentRole === "member") {
      query += " AND t.assigned_to = ?";
      params.push(req.user.id);
    }
    query += " ORDER BY t.created_at DESC";

    const tasks = await all(query, params);
    return res.json({ tasks, role: currentRole });
  } catch (error) {
    return res.status(500).json({ message: "Unable to fetch tasks", error: error.message });
  }
});

app.patch("/api/tasks/:taskId/status", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { status } = req.body;
    if (!["todo", "in_progress", "done"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const task = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const currentRole = await getProjectRole(task.project_id, req.user.id);
    if (!currentRole) return res.status(403).json({ message: "Access denied" });

    const canUpdate = currentRole === "admin" || task.assigned_to === req.user.id;
    if (!canUpdate) {
      return res.status(403).json({ message: "Only assigned user or admin can update task status" });
    }

    await run("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, taskId]);
    return res.json({ message: "Task status updated" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update status", error: error.message });
  }
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    const memberProjects = await all(
      "SELECT project_id FROM project_members WHERE user_id = ?",
      [req.user.id]
    );
    const projectIds = memberProjects.map((row) => row.project_id);
    if (projectIds.length === 0) {
      return res.json({
        totalTasks: 0,
        byStatus: { todo: 0, in_progress: 0, done: 0 },
        tasksPerUser: [],
        overdueTasks: 0
      });
    }

    const inClause = projectIds.map(() => "?").join(",");

    const total = await get(
      `SELECT COUNT(*) as count FROM tasks WHERE project_id IN (${inClause})`,
      projectIds
    );

    const statusRows = await all(
      `
      SELECT status, COUNT(*) as count
      FROM tasks
      WHERE project_id IN (${inClause})
      GROUP BY status
      `,
      projectIds
    );

    const byStatus = { todo: 0, in_progress: 0, done: 0 };
    statusRows.forEach((row) => {
      byStatus[row.status] = row.count;
    });

    const tasksPerUser = await all(
      `
      SELECT COALESCE(u.name, 'Unassigned') AS userName, COUNT(*) AS count
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id IN (${inClause})
      GROUP BY t.assigned_to
      ORDER BY count DESC
      `,
      projectIds
    );

    const overdue = await get(
      `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE project_id IN (${inClause})
        AND due_date IS NOT NULL
        AND date(due_date) < date('now')
        AND status != 'done'
      `,
      projectIds
    );

    return res.json({
      totalTasks: total.count,
      byStatus,
      tasksPerUser,
      overdueTasks: overdue.count
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load dashboard", error: error.message });
  }
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(port) {
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
      return;
    }
    // eslint-disable-next-line no-console
    console.error("Server failed to start:", error);
    process.exit(1);
  });
}

initDb()
  .then(() => {
    startServer(BASE_PORT);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize DB:", error);
    process.exit(1);
  });
