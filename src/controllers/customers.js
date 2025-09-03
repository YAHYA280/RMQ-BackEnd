// src/controllers/customers.js - Complete implementation
const { Customer, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all customers with filtering and pagination
// @route   GET /api/customers
// @access  Private (admin)
exports.getCustomers = asyncHandler(async (req, res, next) => {
  const {
    page = 1,
    limit = 25,
    search,
    status,
    sort = "createdAt",
    order = "DESC",
    source,
    tier,
  } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = Array.isArray(status) ? { [Op.in]: status } : status;
  }

  if (source) {
    where.source = Array.isArray(source) ? { [Op.in]: source } : source;
  }

  // Search functionality
  if (search) {
    where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { referralCode: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Filter by customer tier
  if (tier) {
    switch (tier) {
      case "platinum":
        where.totalSpent = { [Op.gte]: 5000 };
        break;
      case "gold":
        where.totalSpent = { [Op.between]: [2000, 4999.99] };
        break;
      case "silver":
        where.totalSpent = { [Op.between]: [500, 1999.99] };
        break;
      case "bronze":
        where.totalSpent = { [Op.lt]: 500 };
        break;
    }
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // Execute query
  const { count, rows: customers } = await Customer.findAndCountAll({
    where,
    limit: limitNum,
    offset,
    order: [[sort, order]],
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  // Build pagination result
  const pagination = {};
  const totalPages = Math.ceil(count / limitNum);

  if (pageNum < totalPages) {
    pagination.next = { page: pageNum + 1, limit: limitNum };
  }

  if (pageNum > 1) {
    pagination.prev = { page: pageNum - 1, limit: limitNum };
  }

  pagination.current = pageNum;
  pagination.totalPages = totalPages;

  res.status(200).json({
    success: true,
    count: customers.length,
    total: count,
    pagination,
    data: customers,
  });
});

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private (admin)
exports.getCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  res.status(200).json({
    success: true,
    data: customer,
  });
});

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private (admin)
exports.createCustomer = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  // Check if customer with email already exists
  const existingCustomer = await Customer.findOne({
    where: { email: req.body.email },
  });

  if (existingCustomer) {
    return next(
      new ErrorResponse("Customer with this email already exists", 400)
    );
  }

  // Handle driver license upload
  let driverLicenseImage = null;
  if (req.file) {
    driverLicenseImage = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/customers/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };
  }

  // Add admin tracking and driver license
  req.body.createdById = req.admin.id;
  req.body.source = "admin";
  if (driverLicenseImage) {
    req.body.driverLicenseImage = driverLicenseImage;
  }

  // Create customer
  const customer = await Customer.create(req.body);

  // Fetch the created customer with associations
  const createdCustomer = await Customer.findByPk(customer.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  res.status(201).json({
    success: true,
    message: "Customer created successfully",
    data: createdCustomer,
  });
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (admin)
exports.updateCustomer = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  let customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  // Check if new email is already taken by another customer
  if (req.body.email && req.body.email !== customer.email) {
    const existingCustomer = await Customer.findOne({
      where: {
        email: req.body.email,
        id: { [Op.ne]: customer.id },
      },
    });

    if (existingCustomer) {
      return next(
        new ErrorResponse("Email is already in use by another customer", 400)
      );
    }
  }

  // Handle driver license upload
  if (req.file) {
    // Delete old driver license image
    if (customer.driverLicenseImage?.filename) {
      try {
        const oldPath = path.join(
          __dirname,
          "../uploads/customers",
          customer.driverLicenseImage.filename
        );
        await fs.unlink(oldPath);
      } catch (error) {
        console.warn(
          "Warning: Could not delete old driver license image:",
          error.message
        );
      }
    }

    // Add new driver license image
    req.body.driverLicenseImage = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/customers/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };
  }

  // Update customer
  await customer.update(req.body);

  // Fetch updated customer with associations
  const updatedCustomer = await Customer.findByPk(req.params.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  res.status(200).json({
    success: true,
    message: "Customer updated successfully",
    data: updatedCustomer,
  });
});

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (super-admin only)
exports.deleteCustomer = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  // Check if customer has active bookings
  const { Booking } = require("../models");
  const activeBookings = await Booking.count({
    where: {
      customerId: customer.id,
      status: ["confirmed", "active"],
    },
  });

  if (activeBookings > 0) {
    return next(
      new ErrorResponse(
        "Cannot delete customer with active bookings. Please complete or cancel all bookings first.",
        400
      )
    );
  }

  // Delete driver license image
  if (customer.driverLicenseImage?.filename) {
    try {
      const imagePath = path.join(
        __dirname,
        "../uploads/customers",
        customer.driverLicenseImage.filename
      );
      await fs.unlink(imagePath);
    } catch (error) {
      console.warn(
        "Warning: Could not delete driver license image:",
        error.message
      );
    }
  }

  // Delete customer from database
  await customer.destroy();

  res.status(200).json({
    success: true,
    message: "Customer deleted successfully",
    data: {},
  });
});

// @desc    Update customer status
// @route   PUT /api/customers/:id/status
// @access  Private (admin)
exports.updateCustomerStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  if (!["active", "inactive", "blocked"].includes(status)) {
    return next(new ErrorResponse("Invalid status", 400));
  }

  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  await customer.update({ status });

  res.status(200).json({
    success: true,
    message: `Customer status updated to ${status}`,
    data: customer,
  });
});

// @desc    Upload customer driver license
// @route   PUT /api/customers/:id/driver-license
// @access  Private (admin)
exports.uploadDriverLicense = asyncHandler(async (req, res, next) => {
  const customer = await Customer.findByPk(req.params.id);

  if (!customer) {
    return next(new ErrorResponse("Customer not found", 404));
  }

  if (!req.file) {
    return next(new ErrorResponse("Please upload a driver license image", 400));
  }

  // Delete old driver license image
  if (customer.driverLicenseImage?.filename) {
    try {
      const oldPath = path.join(
        __dirname,
        "../uploads/customers",
        customer.driverLicenseImage.filename
      );
      await fs.unlink(oldPath);
    } catch (error) {
      console.warn(
        "Warning: Could not delete old driver license image:",
        error.message
      );
    }
  }

  // Save new driver license image
  const driverLicenseImage = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/customers/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype,
  };

  await customer.update({ driverLicenseImage });

  res.status(200).json({
    success: true,
    message: "Driver license uploaded successfully",
    data: customer,
  });
});

// @desc    Get customer statistics
// @route   GET /api/customers/stats
// @access  Private (admin)
exports.getCustomerStats = asyncHandler(async (req, res, next) => {
  const stats = await Customer.getCustomerStats();

  // Get registration trends (last 12 months)
  const { sequelize } = require("../config/database");

  const registrationTrends = await Customer.findAll({
    attributes: [
      [
        sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")),
        "month",
      ],
      [sequelize.fn("COUNT", sequelize.col("id")), "registrations"],
    ],
    where: {
      createdAt: {
        [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 12)),
      },
    },
    group: [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt"))],
    order: [
      [sequelize.fn("DATE_TRUNC", "month", sequelize.col("createdAt")), "DESC"],
    ],
    raw: true,
  });

  // Get customer tier distribution
  const tierDistribution = await Customer.findAll({
    attributes: [
      [
        sequelize.literal(`
          CASE 
            WHEN total_spent >= 5000 THEN 'platinum'
            WHEN total_spent >= 2000 THEN 'gold'  
            WHEN total_spent >= 500 THEN 'silver'
            ELSE 'bronze'
          END
        `),
        "tier",
      ],
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    group: [
      sequelize.literal(`
        CASE 
          WHEN total_spent >= 5000 THEN 'platinum'
          WHEN total_spent >= 2000 THEN 'gold'
          WHEN total_spent >= 500 THEN 'silver'
          ELSE 'bronze'
        END
      `),
    ],
    raw: true,
  });

  res.status(200).json({
    success: true,
    data: {
      overview: stats,
      registrationTrends,
      tierDistribution,
    },
  });
});

// @desc    Search customers
// @route   GET /api/customers/search
// @access  Private (admin)
exports.searchCustomers = asyncHandler(async (req, res, next) => {
  const { q, limit = 10, offset = 0 } = req.query;

  if (!q || q.trim().length < 2) {
    return next(
      new ErrorResponse("Search query must be at least 2 characters", 400)
    );
  }

  const result = await Customer.searchCustomers(q.trim(), {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    count: result.rows.length,
    total: result.count,
    data: result.rows,
  });
});
