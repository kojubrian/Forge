const startDateInput = document.getElementById("start_date");

const targetDateInput = document.getElementById("target_date");

function validateDates() {
  if (
    startDateInput.value &&
    targetDateInput.value &&
    targetDateInput.value < startDateInput.value
  ) {
    alert("Target date cannot be before the start date.");

    targetDateInput.value = "";
  }
}

startDateInput.addEventListener("change", function () {
  targetDateInput.min = this.value;

  validateDates();
});

targetDateInput.addEventListener("change", validateDates);
