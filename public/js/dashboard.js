function openTaskForm() {
  document.getElementById("taskModal").classList.add("active");
}

function closeTaskForm() {
  document.getElementById("taskModal").classList.remove("active");
}

// Close modal when clicking outside it
document
  .getElementById("taskModal")
  .addEventListener("click", function (event) {
    if (event.target === this) {
      closeTaskForm();
    }
  });

async function toggleTask(taskId, checkbox) {
  try {
    const response = await fetch(`/tasks/${taskId}/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to update task");
    }

    const data = await response.json();

    const taskItem = checkbox.closest(".task-item");

    if (data.completed) {
      taskItem.classList.add("completed");
    } else {
      taskItem.classList.remove("completed");
    }
  } catch (err) {
    console.error("Error updating task:", err);

    // Undo the checkbox if the database update failed
    checkbox.checked = !checkbox.checked;
  }
}
