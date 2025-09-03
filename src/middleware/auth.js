// src/middleware/auth.js - Updated with better error handling
const jwt = require("jsonwebtoken");
const { Admin } = require("../models/index");
const asyncHandler = require("./asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

// Protect routes - Check if user is authenticated
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Check for token in cookies
  else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse("Not authorized to access this route", 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get admin from database
    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return next(
        new ErrorResponse("Not authorized to access this route", 401)
      );
    }

    // Check if admin is active
    if (!admin.isActive) {
      return next(new ErrorResponse("Your account has been deactivated", 401));
    }

    // Check if admin changed password after the token was issued
    if (admin.changedPasswordAfter(decoded.iat)) {
      return next(
        new ErrorResponse(
          "Admin recently changed password! Please log in again",
          401
        )
      );
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Auth protect error:", error);

    if (error.name === "JsonWebTokenError") {
      return next(new ErrorResponse("Invalid token", 401));
    } else if (error.name === "TokenExpiredError") {
      return next(new ErrorResponse("Token expired", 401));
    }

    return next(new ErrorResponse("Not authorized to access this route", 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return next(
        new ErrorResponse(
          `Admin role ${req.admin.role} is not authorized to access this route`,
          403
        )
      );
    }
    next();
  };
};

// Optional authentication - doesn't require token but populates req.admin if valid token exists
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);

    if (admin && admin.isActive && !admin.changedPasswordAfter(decoded.iat)) {
      req.admin = admin;
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log("Optional auth failed:", error.message);
  }

  next();
});
