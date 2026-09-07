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

    updateDashboardStats();
  } catch (err) {
    console.error("Error updating task:", err);

    checkbox.checked = !checkbox.checked;
  }
}

function updateDashboardStats() {
  const taskItems = document.querySelectorAll(".task-item");

  const totalTasks = taskItems.length;

  const completedTasks = document.querySelectorAll(
    ".task-item.completed",
  ).length;

  const progress =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  document.getElementById("progressValue").textContent = `${progress}%`;

  document.getElementById("progressFill").style.width = `${progress}%`;

  document.getElementById("taskCount").innerHTML =
    `${completedTasks} <span class="stat-small">/ ${totalTasks}</span>`;

  document.getElementById("scoreValue").textContent = progress;
}
