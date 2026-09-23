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
    const { userName, email, password, confirmPassword, terms } = req.body;

    // Clean up input
    const cleanUserName = userName?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    // Required fields
    if (!cleanUserName || !cleanEmail || !password || !confirmPassword) {
      return res.render("register", {
        error: "Please fill in all required fields.",
      });
    }

    // Username validation
    if (cleanUserName.length < 2) {
      return res.render("register", {
        error: "Your name must be at least 2 characters long.",
      });
    }

    if (cleanUserName.length > 100) {
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

    // Check whether email or username already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? OR username = ?",
      [cleanEmail, cleanUserName],
    );

    if (existingUsers.length > 0) {
      return res.render("register", {
        error: "Username or email already exists.",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save user
    const [result] = await db.query(
      `INSERT INTO users
       (username, email, password_hash)
       VALUES (?, ?, ?)`,
      [cleanUserName, cleanEmail, passwordHash],
    );

    console.log(`User registered: ${cleanUserName} (${cleanEmail})`);

    // Automatically log in
    req.session.userId = result.insertId;
    req.session.userName = cleanUserName;
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
      SELECT id, title, completed
      FROM tasks
      WHERE id = ?
      AND user_id = ?
      `,
      [taskId, req.session.userId],
    );

    res.json({
      success: true,
      completed: tasks[0].completed,
    });
  } catch (err) {
    console.error("Error toggling task:", err);

    res.status(500).json({
      error: "Something went wrong while updating the task.",
    });
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
