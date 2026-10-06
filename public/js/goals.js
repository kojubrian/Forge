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

function confirmComplete() {
  return confirm("Mark this goal as completed?");
}

function confirmArchive() {
  return confirm(
    "Archive this goal? You can no longer work on it as an active goal.",
  );
}

const startDateInput = document.getElementById("start_date");

const targetDateInput = document.getElementById("target_date");

startDateInput.addEventListener("change", function () {
  targetDateInput.min = this.value;
});

targetDateInput.addEventListener("change", function () {
  if (startDateInput.value && this.value && this.value < startDateInput.value) {
    alert("Target date cannot be before the start date.");

    this.value = "";
  }
});
