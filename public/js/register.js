const form = document.querySelector(".login-form");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

const nameFeedback = document.getElementById("nameFeedback");

const emailFeedback = document.getElementById("emailFeedback");

const passwordFeedback = document.getElementById("passwordFeedback");
const confirmPasswordFeedback = document.getElementById(
  "confirmPasswordFeedback",
);

// Name validation
nameInput.addEventListener("input", () => {
  const name = nameInput.value.trim();

  if (name.length === 0) {
    nameFeedback.textContent = "";
    nameFeedback.className = "validation-message";
    return;
  }

  if (name.length < 2) {
    nameFeedback.textContent = "Name must be at least 2 characters.";
    nameFeedback.className = "validation-message error";
    return;
  }
  nameFeedback.textContent = "Name looks good.";
  nameFeedback.className = "validation-message success";
});

// Email validation + availability check
// Email validation + live availability check
let emailCheckTimeout;

emailInput.addEventListener("input", () => {
  const email = emailInput.value.trim();

  clearTimeout(emailCheckTimeout);

  if (email.length === 0) {
    emailFeedback.textContent = "";
    emailFeedback.className = "validation-message";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    emailFeedback.textContent = "Please enter a valid email address.";

    emailFeedback.className = "validation-message error";

    return;
  }

  emailFeedback.textContent = "Checking email...";

  emailFeedback.className = "validation-message";

  emailCheckTimeout = setTimeout(async () => {
    try {
      const response = await fetch(
        `/check-availability?email=${encodeURIComponent(email)}`,
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.available) {
        emailFeedback.textContent = "Email is available.";

        emailFeedback.className = "validation-message success";
      } else {
        emailFeedback.textContent =
          "An account with this email already exists.";

        emailFeedback.className = "validation-message error";
      }
    } catch (error) {
      console.error("Email availability check failed:", error);

      emailFeedback.textContent = "Could not check email availability.";

      emailFeedback.className = "validation-message error";
    }
  }, 500);
});

// Password validation
passwordInput.addEventListener("input", () => {
  const password = passwordInput.value;

  if (password.length === 0) {
    passwordFeedback.textContent = "Use at least 8 characters.";
    passwordFeedback.className = "validation-message";
    return;
  }

  if (password.length < 8) {
    passwordFeedback.textContent = `${password.length}/8 characters`;
    passwordFeedback.className = "validation-message error";
  } else {
    passwordFeedback.textContent = "Password length is valid.";
    passwordFeedback.className = "validation-message success";
  }

  // Re-check confirmation whenever password changes
  validatePasswordConfirmation();
});

// Confirm password validation
confirmPasswordInput.addEventListener("input", validatePasswordConfirmation);

function validatePasswordConfirmation() {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (confirmPassword.length === 0) {
    confirmPasswordFeedback.textContent = "";
    return;
  }

  if (password !== confirmPassword) {
    confirmPasswordFeedback.textContent = "Passwords do not match.";
    confirmPasswordFeedback.className = "validation-message error";
    return;
  }

  confirmPasswordFeedback.textContent = "Passwords match.";
  confirmPasswordFeedback.className = "validation-message success";
}

// Final client-side check before submission
form.addEventListener("submit", (event) => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (name.length < 2) {
    event.preventDefault();
    nameInput.focus();
    return;
  }

  if (!emailRegex.test(email)) {
    event.preventDefault();
    emailInput.focus();
    return;
  }

  if (password.length < 8) {
    event.preventDefault();
    passwordInput.focus();
    return;
  }

  if (password !== confirmPassword) {
    event.preventDefault();
    confirmPasswordInput.focus();
    return;
  }
});
