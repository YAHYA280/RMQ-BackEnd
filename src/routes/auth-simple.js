// src/routes/auth-simple.js - Simplified auth routes for testing
const express = require("express");
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePassword,
} = require("../controllers/auth");

const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes - simple routes first
router.post("/login", login);
router.get("/logout", logout);

// Protected routes
router.get("/me", protect, getMe);
router.put("/updateprofile", protect, updateProfile);
router.put("/updatepassword", protect, updatePassword);

// Super admin routes
router.post("/register", protect, authorize("super-admin"), register);

module.exports = router;
