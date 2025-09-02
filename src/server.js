// src/server.js
const dotenv = require("dotenv");
const colors = require("colors");

// Load env vars
dotenv.config();

// Import dependencies
const connectDB = require("./config/database");
const app = require("./app");
const Admin = require("./models/Admin");

// Connect to database
connectDB();

// Create default super admin if not exists
const createDefaultAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ role: "super-admin" });

    if (!adminExists) {
      const defaultAdmin = await Admin.create({
        name: "Super Admin",
        email: process.env.ADMIN_EMAIL || "admin@melhorquenada.com",
        password: process.env.ADMIN_PASSWORD || "AdminPassword123!",
        role: "super-admin",
      });

      console.log("Default super admin created:".green.bold);
      console.log(`Email: ${defaultAdmin.email}`.yellow);
      console.log(
        `Password: ${process.env.ADMIN_PASSWORD || "AdminPassword123!"}`.yellow
      );
      console.log("Please change the password after first login!".red.bold);
    }
  } catch (error) {
    console.error("Error creating default admin:", error.message);
  }
};

// Create default admin
createDefaultAdmin();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold
  );
  console.log(`API Documentation: http://localhost:${PORT}/api/health`.cyan);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`.red);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
  });
});
