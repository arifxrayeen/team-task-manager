const formTitle = document.getElementById("form-title");
const authForm = document.getElementById("auth-form");
const nameWrap = document.getElementById("name-wrap");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submit-btn");
const toggleMode = document.getElementById("toggle-mode");
const toggleLabel = document.getElementById("toggle-label");
const messageEl = document.getElementById("message");

let isSignup = false;

const token = localStorage.getItem("token");
if (token) {
  window.location.href = "/dashboard.html";
}

toggleMode.addEventListener("click", () => {
  isSignup = !isSignup;
  formTitle.textContent = isSignup ? "Sign Up" : "Login";
  submitBtn.textContent = isSignup ? "Create Account" : "Login";
  nameWrap.style.display = isSignup ? "block" : "none";
  toggleLabel.textContent = isSignup ? "Already have an account?" : "New user?";
  toggleMode.textContent = isSignup ? "Login here" : "Create account";
  messageEl.textContent = "";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "Please wait...";

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };
  if (isSignup) {
    payload.name = nameInput.value.trim();
  }

  const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      messageEl.textContent = data.message || "Authentication failed";
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userName", data.user.name);
    window.location.href = "/dashboard.html";
  } catch (error) {
    messageEl.textContent = "Network error, please try again";
  }
});
