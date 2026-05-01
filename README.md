# Team Task Manager (Full-Stack)

A simple full-stack Team Task Management web app built with:

- Node.js + Express (backend APIs)
- SQLite (database)
- Plain HTML/CSS/JavaScript (frontend)
- JWT authentication

This project supports:

- User signup/login
- Project creation and team member management
- Task creation and assignment
- Task status updates
- Dashboard stats
- Role-based access (Admin/Member)

## 1) Features

### Authentication
- Signup with name, email, password
- Login with email/password
- JWT-based protected APIs

### Project Management
- Create project (creator is Admin)
- Add/remove project members (Admin only)
- Members can see projects they belong to

### Task Management
- Create tasks with:
  - title
  - description
  - due date
  - priority
  - assigned user
- Update task status:
  - `todo`
  - `in_progress`
  - `done`

### Dashboard
- Total tasks
- Tasks by status
- Tasks per user
- Overdue tasks

### Role-Based Access
- **Admin**:
  - manage members
  - create tasks
  - update any task status
- **Member**:
  - view only assigned tasks
  - update status only for assigned tasks

---

## 2) Folder Structure

```
team-task-manager/
├─ middleware/
│  └─ auth.js
├─ public/
│  ├─ index.html
│  ├─ main.js
│  ├─ dashboard.html
│  ├─ dashboard.js
│  ├─ project.html
│  ├─ project.js
│  └─ styles.css
├─ db.js
├─ server.js
├─ package.json
├─ .env.example
└─ README.md
```

---

## 3) Local Setup

### Prerequisites
- Node.js 18+ installed
- npm installed

### Steps

1. Install dependencies
   ```bash
   npm install
   ```

2. Create `.env` file from `.env.example`
   ```env
   PORT=5000
   JWT_SECRET=change_this_to_a_long_random_secret
   DB_PATH=./data.sqlite
   ```

3. Run the app
   ```bash
   npm start
   ```

4. Open browser:
   - [http://localhost:5000](http://localhost:5000)

---

## 4) API Endpoints (Important)

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`

### Projects
- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:projectId/members`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`

### Tasks
- `POST /api/projects/:projectId/tasks`
- `GET /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId/status`

### Dashboard
- `GET /api/dashboard`

All protected APIs require:
`Authorization: Bearer <token>`

---

## 5) Railway Deployment (Mandatory)

1. Push project to GitHub.
2. Go to [Railway](https://railway.app/) and create a new project.
3. Select **Deploy from GitHub repo**.
4. Set environment variables in Railway:
   - `JWT_SECRET` = strong random secret
   - `PORT` (optional, Railway injects this automatically)
   - `DB_PATH=./data.sqlite`
5. Railway build/start:
   - Build command: `npm install`
   - Start command: `npm start`
6. Deploy and open generated public URL.

> Note: SQLite data may reset on redeploy unless persistent storage is configured.

---

## 6) Demo Video Checklist (2-5 minutes)

Show:
- Signup and login
- Create project
- Add member
- Create tasks and assign users
- Update task status
- Dashboard metrics
- Role difference (admin vs member)

---

## 7) Submission Checklist

- Live app URL (Railway)
- GitHub repository link
- README with setup + deployment
- 2-5 minute demo video
