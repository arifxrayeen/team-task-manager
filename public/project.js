const token = localStorage.getItem("token");
if (!token) window.location.href = "/";

const query = new URLSearchParams(window.location.search);
const projectId = query.get("projectId");

const membersList = document.getElementById("members-list");
const addMemberCard = document.getElementById("add-member-card");
const addMemberForm = document.getElementById("add-member-form");
const memberMsg = document.getElementById("member-msg");
const createTaskCard = document.getElementById("create-task-card");
const taskForm = document.getElementById("task-form");
const taskMsg = document.getElementById("task-msg");
const assigneeSelect = document.getElementById("task-assignee");
const tasksList = document.getElementById("tasks-list");

let currentRole = "member";
let members = [];

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

async function safeJson(response) {
  const data = await response.json();
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/";
    return null;
  }
  return data;
}

async function loadMembers() {
  const response = await fetch(`/api/projects/${projectId}/members`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(response);
  if (!data) return;

  currentRole = data.currentRole;
  members = data.members;

  addMemberCard.style.display = currentRole === "admin" ? "block" : "none";
  createTaskCard.style.display = currentRole === "admin" ? "block" : "none";

  membersList.innerHTML = data.members
    .map(
      (member) => `
      <div class="list-item">
        <strong>${member.name}</strong> (${member.email}) -
        <span class="status-tag">${member.role}</span>
        ${
          currentRole === "admin" && member.role !== "admin"
            ? `<button class="danger" style="margin-top: 8px;" onclick="removeMember(${member.id})">Remove</button>`
            : ""
        }
      </div>
    `
    )
    .join("");

  assigneeSelect.innerHTML =
    `<option value="">Unassigned</option>` +
    data.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join("");
}

async function loadTasks() {
  const response = await fetch(`/api/projects/${projectId}/tasks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(response);
  if (!data) return;

  if (!data.tasks.length) {
    tasksList.innerHTML = `<p class="muted">No tasks in this view.</p>`;
    return;
  }

  tasksList.innerHTML = data.tasks
    .map(
      (task) => `
      <div class="list-item">
        <h3>${task.title}</h3>
        <p class="muted">${task.description || "No description"}</p>
        <p class="muted">Assignee: ${task.assignee_name || "Unassigned"}</p>
        <p class="muted">Due: ${task.due_date || "Not set"}</p>
        <p class="muted">Priority: ${task.priority}</p>
        <p>Status: <span class="status-tag">${task.status}</span></p>
        <div class="row">
          <select id="status-${task.id}">
            <option value="todo" ${task.status === "todo" ? "selected" : ""}>To Do</option>
            <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>In Progress</option>
            <option value="done" ${task.status === "done" ? "selected" : ""}>Done</option>
          </select>
          <button onclick="updateStatus(${task.id})">Update Status</button>
        </div>
      </div>
    `
    )
    .join("");
}

addMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberMsg.textContent = "Adding member...";

  const email = document.getElementById("member-email").value.trim();
  const role = document.getElementById("member-role").value;

  const response = await fetch(`/api/projects/${projectId}/members`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, role })
  });
  const data = await safeJson(response);
  if (!data) return;

  if (!response.ok) {
    memberMsg.textContent = data.message || "Unable to add member";
    return;
  }

  memberMsg.textContent = "Member added successfully";
  addMemberForm.reset();
  await loadMembers();
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  taskMsg.textContent = "Creating task...";

  const payload = {
    title: document.getElementById("task-title").value.trim(),
    description: document.getElementById("task-description").value.trim(),
    dueDate: document.getElementById("task-due-date").value || null,
    priority: document.getElementById("task-priority").value,
    assignedTo: Number(assigneeSelect.value) || null
  };

  const response = await fetch(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await safeJson(response);
  if (!data) return;

  if (!response.ok) {
    taskMsg.textContent = data.message || "Unable to create task";
    return;
  }

  taskMsg.textContent = "Task created successfully";
  taskForm.reset();
  await loadTasks();
});

window.updateStatus = async (taskId) => {
  const newStatus = document.getElementById(`status-${taskId}`).value;
  const response = await fetch(`/api/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status: newStatus })
  });
  const data = await safeJson(response);
  if (!data) return;

  if (!response.ok) {
    alert(data.message || "Unable to update status");
    return;
  }
  await loadTasks();
};

window.removeMember = async (userId) => {
  const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await safeJson(response);
  if (!data) return;

  if (!response.ok) {
    alert(data.message || "Unable to remove member");
    return;
  }

  await loadMembers();
  await loadTasks();
};

window.goBack = () => {
  window.location.href = "/dashboard.html";
};

window.logout = () => {
  localStorage.clear();
  window.location.href = "/";
};

loadMembers();
loadTasks();
