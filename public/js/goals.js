function openGoalModal() {
  document.getElementById("goalModal").classList.add("active");
}

function closeGoalModal() {
  document.getElementById("goalModal").classList.remove("active");
}

document
  .getElementById("goalModal")
  .addEventListener("click", function (event) {
    if (event.target === this) {
      closeGoalModal();
    }
  });

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeGoalModal();
  }
});
