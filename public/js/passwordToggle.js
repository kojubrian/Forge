function initializePasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const wrapper = button.closest(".password-input-wrapper");
      const input = wrapper.querySelector("input");
      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";
      button.setAttribute("aria-pressed", String(isHidden));
      button.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password",
      );
    });
  });
}

document.addEventListener("DOMContentLoaded", initializePasswordToggles);

// Disable submit button on form submission to prevent multiple submissions
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".login-form").forEach((form) => {
    form.addEventListener("submit", () => {
      const button = form.querySelector('button[type="submit"]');

      if (!button || button.disabled) {
        return;
      }

      button.disabled = true;

      const label = button.querySelector("span:not(.arrow)");

      if (label) {
        label.textContent = form.action.endsWith("/login")
          ? "Logging in..."
          : "Creating account...";
      }
    });
  });
});
