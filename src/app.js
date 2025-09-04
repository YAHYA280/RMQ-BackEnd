// src/app.js - Updated CORS configuration for frontend auth
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const path = require("path");

// Import middleware
const errorHandler = require("./middleware/error");
const { protect } = require("./middleware/auth");

// Route files
const auth = require("./routes/auth");
const vehicles = require("./routes/vehicles");
const customers = require("./routes/customers");
const bookings = require("./routes/bookings");

const app = express();

// Trust proxy for production
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS middleware - Updated for frontend auth
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

// Cookie parser middleware
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Body parser middleware
app.use(
  express.json({
    limit: "10mb",
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
    parameterLimit: 1000,
  })
);

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("common"));
}

// Set static folder for file uploads
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    maxAge: process.env.NODE_ENV === "production" ? "1y" : 0,
    etag: true,
  })
);

// Rate limiting for production
if (process.env.NODE_ENV === "production") {
  const rateLimit = require("express-rate-limit");

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      message: "Too many requests from this IP, please try again later.",
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: {
      success: false,
      message: "Too many authentication attempts, please try again later.",
    },
  });

  app.use("/api/", limiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
}

// API Routes
app.use("/api/auth", auth);
app.use("/api/vehicles", vehicles);
app.use("/api/customers", customers);
app.use("/api/bookings", bookings);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  });
});

// API Documentation endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Rental API v1.0",
    documentation: {
      endpoints: {
        auth: {
          login: "POST /api/auth/login",
          logout: "GET /api/auth/logout",
          register: "POST /api/auth/register (super-admin only)",
          profile: "GET /api/auth/me",
          updateProfile: "PUT /api/auth/updateprofile",
          updatePassword: "PUT /api/auth/updatepassword",
        },
        customers: {
          getAll: "GET /api/customers",
          getOne: "GET /api/customers/:id",
          create: "POST /api/customers (admin only)",
          update: "PUT /api/customers/:id (admin only)",
          delete: "DELETE /api/customers/:id (super-admin only)",
          search: "GET /api/customers/search (admin only)",
          stats: "GET /api/customers/stats (admin only)",
        },
        vehicles: {
          getAll: "GET /api/vehicles",
          getOne: "GET /api/vehicles/:id",
          create: "POST /api/vehicles (admin only)",
          update: "PUT /api/vehicles/:id (admin only)",
          delete: "DELETE /api/vehicles/:id (admin only)",
          stats: "GET /api/vehicles/stats (admin only)",
          availability: "GET /api/vehicles/availability",
        },
        bookings: {
          getAll: "GET /api/bookings",
          getOne: "GET /api/bookings/:id",
          create: "POST /api/bookings (admin only)",
          update: "PUT /api/bookings/:id (admin only)",
          delete: "DELETE /api/bookings/:id (super-admin only)",
          confirm: "PUT /api/bookings/:id/confirm (admin only)",
          cancel: "PUT /api/bookings/:id/cancel (admin only)",
          pickup: "PUT /api/bookings/:id/pickup (admin only)",
          return: "PUT /api/bookings/:id/return (admin only)",
          stats: "GET /api/bookings/stats (admin only)",
          availability:
            "GET /api/bookings/availability/:vehicleId (admin only)",
        },
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Handle 404 for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    availableEndpoints: "/api",
  });
});

// Handle 404 for all other routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

module.exports = app;
