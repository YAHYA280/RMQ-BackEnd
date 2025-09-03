// src/middleware/error.js - Updated with better error handling
const ErrorResponse = require("../utils/errorResponse");

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for dev
  if (process.env.NODE_ENV === "development") {
    console.error("Error Stack:", err.stack);
  }

  // Sequelize bad ObjectId/UUID
  if (err.name === "SequelizeDatabaseError") {
    const message = "Resource not found";
    error = new ErrorResponse(message, 404);
  }

  // Sequelize duplicate key
  if (err.name === "SequelizeUniqueConstraintError") {
    const message = `Duplicate field value entered: ${err.errors[0].path}`;
    error = new ErrorResponse(message, 400);
  }

  // Sequelize validation error
  if (err.name === "SequelizeValidationError") {
    const message = err.errors.map((val) => val.message).join(", ");
    error = new ErrorResponse(message, 400);
  }

  // Sequelize foreign key constraint error
  if (err.name === "SequelizeForeignKeyConstraintError") {
    const message = "Resource not found or invalid reference";
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = new ErrorResponse(message, 401);
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = new ErrorResponse(message, 401);
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    const message = "File too large";
    error = new ErrorResponse(message, 400);
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    const message = "Too many files uploaded";
    error = new ErrorResponse(message, 400);
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
