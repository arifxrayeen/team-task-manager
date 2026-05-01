const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "/";
}

const welcomeText = document.getElementById("welcome-text");
const logoutBtn = document.getElementById("logout-btn");
const projectForm = document.getElementById("project-form");
const projectMsg = document.getElementById("project-msg");
const projectsList = document.getElementById("projects-list");
const tasksPerUserWrap = document.getElementById("tasks-per-user");

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }
  return response.json();
}

async function loadCurrentUser() {
  const data = await api("/api/me");
  if (!data) return;
  welcomeText.textContent = `Welcome, ${data.user.name}`;
}

async function loadProjects() {
  const data = await api("/api/projects");
  if (!data) return;

  if (!data.projects.length) {
    projectsList.innerHTML = `<p class="muted">No projects yet. Create your first project.</p>`;
    return;
  }

  projectsList.innerHTML = data.projects
    .map(
      (project) => `
      <div class="list-item">
        <h3>${project.name}</h3>
        <p class="muted">${project.description || "No description"}</p>
        <p class="muted">Your role: ${project.role}</p>
        <button onclick="openProject(${project.id})">Open Project</button>
      </div>
    `
    )
    .join("");
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  if (!data) return;

  document.getElementById("total-tasks").textContent = data.totalTasks;
  document.getElementById("todo-count").textContent = data.byStatus.todo || 0;
  document.getElementById("progress-count").textContent = data.byStatus.in_progress || 0;
  document.getElementById("done-count").textContent = data.byStatus.done || 0;
  document.getElementById("overdue-count").textContent = data.overdueTasks || 0;

  if (!data.tasksPerUser.length) {
    tasksPerUserWrap.innerHTML = `<p class="muted">No tasks assigned yet.</p>`;
  } else {
    tasksPerUserWrap.innerHTML = data.tasksPerUser
      .map((row) => `<div class="list-item">${row.userName}: ${row.count}</div>`)
      .join("");
  }
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  projectMsg.textContent = "Creating project...";

  const name = document.getElementById("project-name").value.trim();
  const description = document.getElementById("project-description").value.trim();

  const response = await fetch("/api/projects", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, description })
  });
  const data = await response.json();

  if (!response.ok) {
    projectMsg.textContent = data.message || "Unable to create project";
    return;
  }

  projectMsg.textContent = "Project created successfully";
  projectForm.reset();
  await loadProjects();
});

logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/";
});

window.openProject = (projectId) => {
  window.location.href = `/project.html?projectId=${projectId}`;
};

loadCurrentUser();
loadProjects();
loadDashboard();
