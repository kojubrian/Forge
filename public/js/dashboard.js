function setGreeting() {
  const hour = new Date().getHours();
  let greeting;

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 17) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  document.getElementById("greeting").textContent = greeting;
}

setGreeting();

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
    updateWeeklyBar();
  } catch (err) {
    console.error("Error updating task:", err);

    checkbox.checked = !checkbox.checked;
  }
}

function updateWeeklyBar() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const todayDate = `${year}-${month}-${day}`;

  const todayBar = document.querySelector(
    `.bar-container[data-date="${todayDate}"]`,
  );

  if (!todayBar) return;

  const taskItems = document.querySelectorAll(".task-item");

  const totalTasks = taskItems.length;

  const completedTasks = document.querySelectorAll(
    ".task-item.completed",
  ).length;

  const percentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Update bar height
  const bar = todayBar.querySelector(".bar");

  if (bar) {
    bar.style.height = `${percentage}%`;
  }

  // Update percentage displayed above the bar
  const percentageLabel = todayBar.querySelector(".bar-percentage");

  if (percentageLabel) {
    percentageLabel.textContent = `${percentage}%`;
  }

  // Update tooltip
  const tooltip = todayBar.querySelector(".bar-tooltip");

  if (tooltip) {
    const spans = tooltip.querySelectorAll("span");

    if (spans[0]) {
      spans[0].textContent = `${percentage}% completed`;
    }

    if (spans[1]) {
      spans[1].textContent = `${completedTasks} of ${totalTasks} tasks`;
    }
  }

  // Calculate the 7-day average
  const bars = document.querySelectorAll(".bar-container");

  let totalPercentage = 0;

  bars.forEach((barContainer) => {
    const bar = barContainer.querySelector(".bar");

    if (bar) {
      const height = parseFloat(bar.style.height) || 0;
      totalPercentage += height;
    }
  });

  const weeklyAverage =
    bars.length > 0 ? Math.round(totalPercentage / bars.length) : 0;

  // Update weekly average
  const weeklyAverageElement = document.getElementById("weeklyAverage");

  if (weeklyAverageElement) {
    weeklyAverageElement.textContent = `${weeklyAverage}%`;
  }

  // Update weekly message
  let weeklyMessage;

  if (weeklyAverage === 100) {
    weeklyMessage = "Perfect week. Every task was completed.";
  } else if (weeklyAverage >= 75) {
    weeklyMessage = "Strong consistency. Keep the momentum going.";
  } else if (weeklyAverage >= 50) {
    weeklyMessage = "Solid consistency. Keep executing.";
  } else if (weeklyAverage >= 25) {
    weeklyMessage = "You're getting started. Keep building consistency.";
  } else {
    weeklyMessage = "Keep executing. Consistency starts with showing up.";
  }

  const weeklyMessageElement = document.getElementById("weeklyMessage");

  if (weeklyMessageElement) {
    weeklyMessageElement.textContent = weeklyMessage;
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
