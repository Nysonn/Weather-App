import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";

dotenv.config();

const port = 3000;
const app = express();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Connect to the PostgreSQL database
db.connect();

// Set EJS as the view engine
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Example for register route
app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

// Registration route (POST)
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body; // Ensure email is included

  try {
    // Check if the user already exists
    const existingUser = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    if (existingUser.rows.length > 0) {
      return res.render("register", { error: "User already exists" });
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into the database with email
    await db.query("INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)", [username, email, hashedPassword]);

    res.redirect("/login");
  } catch (error) {
    console.error("Error registering user:", error);
    res.render("register", { error: "Registration failed" });
  }
});

// GET ROUTE FOR LOGIN
app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

// Login route (POST)
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user in the database
    const userResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    if (userResult.rows.length === 0) {
      return res.render("login", { error: "Invalid username or password" });
    }

    const user = userResult.rows[0];

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.render("login", { error: "Invalid username or password" });
    }

    // On successful login, redirect to the dashboard
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Error logging in user:", error);
    res.render("login", { error: "Login failed" });
  }
});

// GET ROUTE FOR DASHBOARD
app.get("/dashboard", (req, res) => {
  res.render("dashboard", { weather: null, error: null });
});

// POST ROUTE FOR OPEN WEATHER API
app.post("/get-weather", async (req, res) => {
  const cityName = req.body.city;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  // Geocode to get coordinates
  const geocodeUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${apiKey}`;

  try {
    const geoResponse = await axios.get(geocodeUrl);
    
    // Ensure city is found before proceeding
    if (geoResponse.data.length === 0) {
      res.render("dashboard", { weather: null, error: "City not found" });
      return;
    }

    const { lat, lon } = geoResponse.data[0];

    // Fetch weather data using coordinates
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const weatherResponse = await axios.get(weatherUrl);
    
    // Log the received weather data
    console.log("Weather data received:", weatherResponse.data);

    const weatherData = weatherResponse.data;

    res.render("dashboard", { weather: weatherData, error: null });
  } catch (error) {
    console.error("Error fetching weather data:", error);
    res.render("dashboard", { weather: null, error: "City not found or error retrieving weather data" });
  }
});

// START THE SERVER
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
