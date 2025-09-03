// src/controllers/auth.js - Complete implementation
const { Admin } = require("../models/index");
const { validationResult } = require("express-validator");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Register admin
// @route   POST /api/auth/register
// @access  Private (only super-admin can create new admins)
exports.register = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const { name, email, password, role } = req.body;

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({ where: { email } });
  if (existingAdmin) {
    return next(new ErrorResponse("Admin already exists with this email", 400));
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
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    },
  });
});

// @desc    Login admin
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  const { email, password } = req.body;

  // Check for admin with password included
  const admin = await Admin.scope("withPassword").findOne({
    where: { email },
  });

  if (!admin) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  // Check if admin is active
  if (!admin.isActive) {
    return next(
      new ErrorResponse(
        "Your account has been deactivated. Please contact support.",
        401
      )
    );
  }

  // Check if password matches
  const isMatch = await admin.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  // Update last login
  await admin.update({ lastLogin: new Date() });

  // Create token
  const token = admin.getSignedJwtToken();

  // Set cookie options
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res
    .status(200)
    .cookie("token", token, options)
    .json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        lastLogin: admin.lastLogin,
      },
    });
});

// @desc    Logout admin
// @route   GET /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
    data: {},
  });
});

// @desc    Get current logged in admin
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const admin = await Admin.findByPk(req.admin.id);

  if (!admin) {
    return next(new ErrorResponse("Admin not found", 404));
  }

  res.status(200).json({
    success: true,
    data: admin,
  });
});

// @desc    Update admin profile
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { name, email } = req.body;

  // Check if new email is already taken by another admin
  if (email && email !== req.admin.email) {
    const existingAdmin = await Admin.findOne({
      where: {
        email,
        id: { [require("sequelize").Op.ne]: req.admin.id },
      },
    });

    if (existingAdmin) {
      return next(new ErrorResponse("Email is already in use", 400));
    }
  }

  const fieldsToUpdate = {};
  if (name) fieldsToUpdate.name = name;
  if (email) fieldsToUpdate.email = email;

  const admin = await Admin.findByPk(req.admin.id);
  await admin.update(fieldsToUpdate);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: admin,
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(
      new ErrorResponse("Please provide current and new password", 400)
    );
  }

  const admin = await Admin.scope("withPassword").findByPk(req.admin.id);

  // Check current password
  const isMatch = await admin.matchPassword(currentPassword);
  if (!isMatch) {
    return next(new ErrorResponse("Current password is incorrect", 401));
  }

  // Update password
  await admin.update({
    password: newPassword,
  });

  const token = admin.getSignedJwtToken();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
    token,
  });
});

// @desc    Get all admins (super-admin only)
// @route   GET /api/auth/admins
// @access  Private (super-admin)
exports.getAdmins = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, search } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = {};
  if (search) {
    whereClause = {
      [require("sequelize").Op.or]: [
        { name: { [require("sequelize").Op.iLike]: `%${search}%` } },
        { email: { [require("sequelize").Op.iLike]: `%${search}%` } },
      ],
    };
  }

  const { count, rows: admins } = await Admin.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [["createdAt", "DESC"]],
  });

  res.status(200).json({
    success: true,
    count: admins.length,
    total: count,
    data: admins,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(count / limit),
    },
  });
});

// @desc    Update admin status (super-admin only)
// @route   PUT /api/auth/admins/:id/status
// @access  Private (super-admin)
exports.updateAdminStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const admin = await Admin.findByPk(id);
  if (!admin) {
    return next(new ErrorResponse("Admin not found", 404));
  }

  // Prevent deactivating the last super-admin
  if (!isActive && admin.role === "super-admin") {
    const superAdminCount = await Admin.count({
      where: {
        role: "super-admin",
        isActive: true,
      },
    });

    if (superAdminCount <= 1) {
      return next(
        new ErrorResponse("Cannot deactivate the last super admin", 400)
      );
    }
  }

  await admin.update({ isActive });

  res.status(200).json({
    success: true,
    message: `Admin ${isActive ? "activated" : "deactivated"} successfully`,
    data: admin,
  });
});

// @desc    Delete admin (super-admin only)
// @route   DELETE /api/auth/admins/:id
// @access  Private (super-admin)
exports.deleteAdmin = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const admin = await Admin.findByPk(id);
  if (!admin) {
    return next(new ErrorResponse("Admin not found", 404));
  }

  // Prevent deleting yourself
  if (admin.id === req.admin.id) {
    return next(new ErrorResponse("You cannot delete yourself", 400));
  }

  // Prevent deleting the last super-admin
  if (admin.role === "super-admin") {
    const superAdminCount = await Admin.count({
      where: { role: "super-admin" },
    });

    if (superAdminCount <= 1) {
      return next(new ErrorResponse("Cannot delete the last super admin", 400));
    }
  }

  await admin.destroy();

  res.status(200).json({
    success: true,
    message: "Admin deleted successfully",
    data: {},
  });
});
