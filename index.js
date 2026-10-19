require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcrypt");
const app = express();

const PORT = process.env.PORT || 3000;

//Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

//DB connection test
async function testDatabaseConnection() {
  try {
    const connection = await db.getConnection();

    console.log("Connected to the database successfully!");

    connection.release();
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
}

testDatabaseConnection();

//Session store
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  createDatabaseTable: true,
});

// Set the view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//middleware
app.use(express.urlencoded({ extended: true })); //parse form data
app.use(express.json()); //parse json data

app.use(express.static(path.join(__dirname, "public"))); //serve static files from the public directory
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

app.get("/check-availability", async (req, res) => {
  // Prevent browser caching
  res.set("Cache-Control", "no-store");

  try {
    const { email } = req.query;

    if (!email) {
      return res.json({
        available: false,
        error: "Email is required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return res.json({
        available: false,
        error: "Invalid email.",
      });
    }

    const [users] = await db.query("SELECT id FROM users WHERE email = ?", [
      cleanEmail,
    ]);

    res.json({
      available: users.length === 0,
    });
  } catch (err) {
    console.error("Email availability check error:", err);

    res.status(500).json({
      available: false,
      error: "Unable to check email availability.",
    });
  }
});

//ROUTES

// Home route
app.get("/", (req, res) => {
  res.redirect("/login");
});

//login page
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Login form
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Clean up input
  const cleanEmail = email?.trim().toLowerCase();

  // Server-side validation
  if (!cleanEmail || !password) {
    return res.render("login", {
      error: "Please enter both email and password.",
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    return res.render("login", {
      error: "Please enter a valid email address.",
    });
  }

  try {
    // Find user
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      cleanEmail,
    ]);

    // Don't reveal whether the email exists
    if (users.length === 0) {
      return res.render("login", {
        error: "Invalid email or password.",
      });
    }

    const user = users[0];

    // Compare submitted password with bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.render("login", {
        error: "Invalid email or password.",
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.userName = user.username;
    req.session.email = user.email;

    console.log(`User logged in: ${user.email}`);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error during login:", err);

    res.status(500).render("login", {
      error: "Something went wrong. Please try again.",
    });
  }
});

//register route
app.get("/register", (req, res) => {
  res.render("register", {
    error: null,
  });
});

// Register form
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, terms } = req.body;

    // Clean up input
    const cleanFullName = fullName?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    // Required fields
    if (!cleanFullName || !cleanEmail || !password || !confirmPassword) {
      return res.render("register", {
        error: "Please fill in all required fields.",
      });
    }

    // Username validation
    if (cleanFullName.length < 2) {
      return res.render("register", {
        error: "Your name must be at least 2 characters long.",
      });
    }

    if (cleanFullName.length > 100) {
      return res.render("register", {
        error: "Your name is too long.",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return res.render("register", {
        error: "Please enter a valid email address.",
      });
    }

    // Password length
    if (password.length < 8) {
      return res.render("register", {
        error: "Password must be at least 8 characters long.",
      });
    }

    // Confirm password
    if (password !== confirmPassword) {
      return res.render("register", {
        error: "Passwords do not match.",
      });
    }

    // Terms
    if (!terms) {
      return res.render("register", {
        error: "You must accept the terms and conditions.",
      });
    }

    // Check whether user already exists using email
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [cleanEmail],
    );

    if (existingUsers.length > 0) {
      return res.render("register", {
        error: "An account with this email already exists.",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save user
    const [result] = await db.query(
      `INSERT INTO users
       (full_name, email, password_hash)
       VALUES (?, ?, ?)`,
      [cleanFullName, cleanEmail, passwordHash],
    );

    console.log(`User registered: ${cleanFullName} (${cleanEmail})`);

    // Automatically log in
    req.session.userId = result.insertId;
    req.session.userName = cleanFullName;
    req.session.email = cleanEmail;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Registration error:", err);

    // Handle database duplicate errors as a final safeguard
    if (err.code === "ER_DUP_ENTRY") {
      return res.render("register", {
        error: "Username or email already exists.",
      });
    }

    res.status(500).render("register", {
      error: "Something went wrong. Please try again.",
    });
  }
});

//dashboard route
app.get("/dashboard", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    // Get today's tasks
    const [tasks] = await db.query(
      `
      SELECT id, title, completed
      FROM tasks
      WHERE user_id = ?
      AND task_date = CURDATE()
      AND goal_id IS NULL
      ORDER BY created_at ASC
      `,
      [req.session.userId],
    );

    // Today's statistics
    const totalTasks = tasks.length;

    const completedTasks = tasks.filter((task) => task.completed === 1).length;

    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const executionScore = progress;

    // Get the last 7 days of task statistics
    const [weeklyStats] = await db.query(
      `
      SELECT
        DATE_FORMAT(task_date, '%Y-%m-%d') AS task_date,
        COUNT(*) AS total_tasks,
        SUM(completed) AS completed_tasks
      FROM tasks
      WHERE user_id = ?
      AND task_date >= CURDATE() - INTERVAL 6 DAY
      AND task_date <= CURDATE()
       AND goal_id IS NULL
      GROUP BY task_date
      ORDER BY task_date ASC
      `,
      [req.session.userId],
    );

    // Create a lookup for the days returned by MySQL
    const weeklyLookup = {};

    weeklyStats.forEach((day) => {
      const dateKey = new Date(day.task_date).toISOString().split("T")[0];

      weeklyLookup[dateKey] = {
        totalTasks: Number(day.total_tasks),
        completedTasks: Number(day.completed_tasks),
      };
    });

    // Build all 7 days
    const weeklyPerformance = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();

      date.setDate(date.getDate() - i);

      const dateKey = date.toISOString().split("T")[0];

      const dayStats = weeklyLookup[dateKey];

      const total = dayStats ? dayStats.totalTasks : 0;
      const completed = dayStats ? dayStats.completedTasks : 0;

      const percentage =
        total === 0 ? 0 : Math.round((completed / total) * 100);

      weeklyPerformance.push({
        date: dateKey,
        totalTasks: total,
        completedTasks: completed,
        percentage: percentage,
      });
    }

    // Calculate weekly average
    const weeklyAverage =
      weeklyPerformance.length === 0
        ? 0
        : Math.round(
            weeklyPerformance.reduce((sum, day) => sum + day.percentage, 0) /
              weeklyPerformance.length,
          );

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

    // Get historical daily task statistics
    const [dailyStats] = await db.query(
      `
      SELECT
        DATE_FORMAT(task_date, '%Y-%m-%d') AS task_date,
        COUNT(*) AS total_tasks,
        SUM(completed) AS completed_tasks
      FROM tasks
      WHERE user_id = ?
       AND goal_id IS NULL
      GROUP BY task_date
      ORDER BY task_date DESC
      `,
      [req.session.userId],
    );

    // Create a lookup object for each day
    const dailyPerformance = {};

    dailyStats.forEach((day) => {
      dailyPerformance[day.task_date] = {
        total: Number(day.total_tasks),
        completed: Number(day.completed_tasks),
      };
    });

    // Calculate current streak
    let currentStreak = 0;

    const today = new Date();

    // Check today first
    const todayKey = today.toISOString().split("T")[0];
    const todayStats = dailyPerformance[todayKey];

    if (
      todayStats &&
      todayStats.total > 0 &&
      todayStats.completed === todayStats.total
    ) {
      currentStreak = 1;
    }

    // Start checking previous days
    const checkDate = new Date(today);
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);

    while (true) {
      const dateKey = checkDate.toISOString().split("T")[0];
      const dayStats = dailyPerformance[dateKey];

      if (
        !dayStats ||
        dayStats.total === 0 ||
        dayStats.completed !== dayStats.total
      ) {
        break;
      }

      currentStreak++;

      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    res.render("dashboard", {
      userName: req.session.userName,
      tasks: tasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: progress,
      executionScore: executionScore,
      currentStreak: currentStreak,
      weeklyStats: weeklyStats,
      weeklyPerformance: weeklyPerformance,
      weeklyAverage: weeklyAverage,
      weeklyMessage: weeklyMessage,
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);

    res.status(500).send("Something went wrong loading the dashboard.");
  }
});

app.post("/tasks", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.redirect("/dashboard");
  }

  try {
    await db.query(
      `INSERT INTO tasks (user_id, title, task_date) VALUES (?, ?, CURDATE())
      `,
      [req.session.userId, title.trim()],
    );

    console.log("Task added:", title);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error adding task:", err);
    res.status(500).send("Something went wrong. Please try again.");
  }
});

app.post("/tasks/:id/toggle", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "Not authenticated",
    });
  }

  const taskId = req.params.id;

  try {
    const [result] = await db.query(
      `
      UPDATE tasks
      SET completed = NOT completed
      WHERE id = ?
      AND user_id = ?
      `,
      [taskId, req.session.userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const [tasks] = await db.query(
      `
      SELECT id, title, completed, goal_id
      FROM tasks
      WHERE id = ?
      AND user_id = ?
      `,
      [taskId, req.session.userId],
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    const task = tasks[0];

    // Dashboard JavaScript requests JSON.
    // Goal details HTML forms request a redirect.
    const wantsJson = req.get("Accept")?.includes("application/json");

    if (wantsJson) {
      return res.json({
        success: true,
        completed: Boolean(task.completed),
      });
    }

    // Return to the page where the task was completed.
    if (task.goal_id !== null) {
      return res.redirect(`/goals/${task.goal_id}`);
    }

    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Error toggling task:", err);

    return res.status(500).json({
      error: "Something went wrong while updating the task.",
    });
  }
});

function validateGoal({
  title,
  description,
  category,
  start_date,
  target_date,
}) {
  const errors = [];

  // Title
  if (!title || !title.trim()) {
    errors.push("Goal title is required.");
  } else if (title.trim().length > 255) {
    errors.push("Goal title must be 255 characters or less.");
  }

  // Description
  if (description && description.length > 2000) {
    errors.push("Goal description must be 2000 characters or less.");
  }

  // Category
  const allowedCategories = [
    "Learning",
    "Career",
    "Personal",
    "Health",
    "Finance",
    "Other",
  ];

  if (category && !allowedCategories.includes(category)) {
    errors.push("Invalid goal category.");
  }

  // Start date
  if (!start_date) {
    errors.push("Start date is required.");
  }

  // Target date
  if (target_date && start_date) {
    const start = new Date(start_date);
    const target = new Date(target_date);

    if (Number.isNaN(start.getTime())) {
      errors.push("Invalid start date.");
    }

    if (Number.isNaN(target.getTime())) {
      errors.push("Invalid target date.");
    }

    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(target.getTime()) &&
      target < start
    ) {
      errors.push("Target date cannot be before the start date.");
    }
  }

  return errors;
}

app.get("/goals", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const [goals] = await db.execute(
      `SELECT *
       FROM goals
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.session.userId],
    );

    res.render("goals", {
      goals,
      userName: req.session.userName,
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).send("Failed to load goals.");
  }
});

app.post("/goals", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { title, description, category, start_date, target_date } = req.body;

  const errors = validateGoal({
    title,
    description,
    category,
    start_date,
    target_date,
  });

  if (errors.length > 0) {
    return res.status(400).send(errors.join("<br>"));
  }

  try {
    await db.execute(
      `INSERT INTO goals
       (user_id, title, description, category, start_date, target_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        title.trim(),
        description ? description.trim() : null,
        category || null,
        start_date,
        target_date || null,
      ],
    );

    res.redirect("/goals");
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).send("Failed to create goal.");
  }
});

app.post("/goals/:id/complete", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;

  try {
    const [result] = await db.execute(
      `UPDATE goals
       SET status = 'completed'
       WHERE id = ?
       AND user_id = ?
       AND status = 'active'`,
      [id, req.session.userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Active goal not found.");
    }

    res.redirect("/goals");
  } catch (error) {
    console.error("Error completing goal:", error);
    res.status(500).send("Failed to complete goal.");
  }
});

app.post("/goals/:id/archive", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;

  try {
    const [result] = await db.execute(
      `UPDATE goals
       SET status = 'archived'
       WHERE id = ?
       AND user_id = ?
       AND status = 'active'`,
      [id, req.session.userId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Active goal not found.");
    }

    res.redirect("/goals");
  } catch (error) {
    console.error("Error archiving goal:", error);
    res.status(500).send("Failed to archive goal.");
  }
});

app.get("/goals/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;

  try {
    // Fetch this goal, ensuring it belongs to the logged-in user
    const [goals] = await db.execute(
      `SELECT *
       FROM goals
       WHERE id = ?
       AND user_id = ?`,
      [id, req.session.userId],
    );

    if (goals.length === 0) {
      return res.status(404).send("Goal not found.");
    }

    const goal = goals[0];

    // Fetch tasks associated with this goal
    const [tasks] = await db.execute(
      `SELECT id, title, completed, task_date, created_at
       FROM tasks
       WHERE goal_id = ?
       AND user_id = ?
       ORDER BY created_at ASC`,
      [goal.id, req.session.userId],
    );

    // Calculate task-based progress
    const totalTasks = tasks.length;

    const completedTasks = tasks.filter((task) =>
      Boolean(task.completed),
    ).length;

    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(goal.start_date);
    startDate.setHours(0, 0, 0, 0);

    const targetDate = goal.target_date ? new Date(goal.target_date) : null;

    if (targetDate) {
      targetDate.setHours(0, 0, 0, 0);
    }

    let timeProgress = 0;

    if (targetDate && targetDate > startDate) {
      const totalDuration = targetDate - startDate;
      const elapsedDuration = today - startDate;

      timeProgress = Math.round(
        Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100)),
      );
    }

    const paceDifference = progress - timeProgress;

    let paceStatus = "On track";

    if (paceDifference > 5) {
      paceStatus = "Ahead of schedule";
    } else if (paceDifference < -5) {
      paceStatus = "Behind schedule";
    }

    if (!targetDate) {
      paceStatus = "No target date";
    } else if (targetDate < today && goal.status !== "completed") {
      paceStatus = "Past target date";
    }

    res.render("goal-details", {
      goal,
      tasks,
      totalTasks,
      completedTasks,
      progress,
      userName: req.session.userName,
      timeProgress,
      paceDifference,
      paceStatus,
    });
  } catch (error) {
    console.error("Error loading goal details:", error);
    res.status(500).send("Failed to load goal details.");
  }
});

app.post("/goals/:id/tasks", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";

  if (!title) {
    return res.status(400).send("Task title is required.");
  }

  if (title.length > 255) {
    return res.status(400).send("Task title cannot exceed 255 characters.");
  }

  try {
    // Verify the goal belongs to this user and is still active
    const [goals] = await db.execute(
      `SELECT id
       FROM goals
       WHERE id = ?
       AND user_id = ?
       AND status = 'active'`,
      [id, req.session.userId],
    );

    if (goals.length === 0) {
      return res.status(404).send("Active goal not found.");
    }

    // Create a task linked to this goal
    await db.execute(
      `INSERT INTO tasks (user_id, goal_id, title, task_date)
       VALUES (?, ?, ?, CURDATE())`,
      [req.session.userId, goals[0].id, title],
    );

    res.redirect(`/goals/${id}`);
  } catch (error) {
    console.error("Error creating goal task:", error);
    res.status(500).send("Failed to create task.");
  }
});

app.get("/goals/:id/edit", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;

  try {
    const [goals] = await db.execute(
      `SELECT *
       FROM goals
       WHERE id = ?
       AND user_id = ?
       AND status = 'active'`,
      [id, req.session.userId],
    );

    if (goals.length === 0) {
      return res.status(404).send("Active goal not found.");
    }

    res.render("edit-goal", {
      goal: goals[0],
      userName: req.session.userName,
    });
  } catch (error) {
    console.error("Error loading goal:", error);
    res.status(500).send("Failed to load goal.");
  }
});

app.post("/goals/:id/edit", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { id } = req.params;

  const { title, description, category, start_date, target_date } = req.body;

  const errors = validateGoal({
    title,
    description,
    category,
    start_date,
    target_date,
  });

  if (errors.length > 0) {
    return res.status(400).send(errors.join("<br>"));
  }

  try {
    const [result] = await db.execute(
      `UPDATE goals
       SET
         title = ?,
         description = ?,
         category = ?,
         start_date = ?,
         target_date = ?
       WHERE id = ?
       AND user_id = ?
       AND status = 'active'`,
      [
        title.trim(),
        description ? description.trim() : null,
        category || null,
        start_date,
        target_date || null,
        id,
        req.session.userId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Active goal not found.");
    }

    res.redirect("/goals");
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).send("Failed to update goal.");
  }
});

//LOGOUT route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error occurred while logging out.");
    }
    res.redirect("/login");
  });
});

//404 handler
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

//start the server
app.listen(PORT, () => {
  console.log(`
        Server is running on: http://localhost:${PORT} Environment: ${process.env.NODE_ENV || "development"}
        `);
});
