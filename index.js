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

//routes

// Home route
app.get("/", (req, res) => {
  res.redirect("/login");
});

//login page
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

//login form
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render("login", {
      error: "Please enter both email and password.",
    });
  }

  try {
    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.render("login", {
        error: "Invalid email or password.",
      });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compareSync(
      password,
      user.password_hash,
    );
    if (!passwordMatch) {
      return res.render("login", {
        error: "Invalid email or password.",
      });
    }

    //Create a session for the user
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

app.post("/register", async (req, res) => {
  try {
    const { userName, email, password, confirmPassword, terms } = req.body;

    // Basic validation
    if (!userName || !email || !password || !confirmPassword) {
      return res.render("register", {
        error: "Please fill in all required fields.",
      });
    }

    if (password !== confirmPassword) {
      return res.render("register", {
        error: "Passwords do not match.",
      });
    }

    if (!terms) {
      return res.render("register", {
        error: "You must accept the terms and conditions.",
      });
    }

    // Check if username or email already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ? OR username = ?",
      [email, userName],
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
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [userName, email, passwordHash],
    );

    console.log(`User registered: ${userName} (${email})`);

    // Automatically log in
    req.session.userId = result.insertId;
    req.session.userName = userName;
    req.session.email = email;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Registration error:", err);

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

    //calculate today's stats
    const totalTasks = tasks.length;

    const completedTasks = tasks.filter((task) => task.completed === 1).length;

    const progress =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    res.render("dashboard", {
      userName: req.session.userName,
      tasks: tasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: progress,
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    res.status(500).send("Something went wrong. Please try again.");
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
