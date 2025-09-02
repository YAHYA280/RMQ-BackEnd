// src/controllers/auth.js
const Admin = require("../models/Admin");
const { validationResult } = require("express-validator");

// @desc    Register admin
// @route   POST /api/auth/register
// @access  Private (only super-admin can create new admins)
exports.register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, email, password, role } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists with this email",
      });
    }

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      password,
      role: role || "admin",
    });

    // Create token
    const token = admin.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Check for admin
    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Check if password matches
    const isMatch = await admin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    admin.lastLogin = Date.now();
    await admin.save({ validateBeforeSave: false });

    // Create token
    const token = admin.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in admin
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update admin profile
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
    };

    const admin = await Admin.findByIdAndUpdate(req.admin.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id).select("+password");

    // Check current password
    if (!(await admin.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: "Password is incorrect",
      });
    }

    admin.password = req.body.newPassword;
    admin.passwordChangedAt = Date.now();
    await admin.save();

    const token = admin.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
      token,
    });
  } catch (error) {
    next(error);
  }
};
