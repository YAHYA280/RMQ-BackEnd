// src/controllers/vehicles.js - Complete and Fixed Implementation
const { Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs").promises;
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Get all vehicles with advanced filtering and pagination
// @route   GET /api/vehicles
// @access  Public
exports.getVehicles = asyncHandler(async (req, res, next) => {
  // Extract query parameters
  const {
    select,
    sort,
    page = 1,
    limit = 25,
    brand,
    transmission,
    fuelType,
    available,
    location,
    minPrice,
    maxPrice,
    seats,
    search,
    status,
    ...otherFilters
  } = req.query;

  // Build where clause
  const where = {};

  // Add basic filters
  if (brand) {
    where.brand = Array.isArray(brand) ? { [Op.in]: brand } : brand;
  }
  if (transmission) {
    where.transmission = Array.isArray(transmission)
      ? { [Op.in]: transmission }
      : transmission;
  }
  if (fuelType) {
    where.fuelType = Array.isArray(fuelType) ? { [Op.in]: fuelType } : fuelType;
  }
  if (available !== undefined) {
    where.available = available === "true";
  }
  if (location) {
    where.location = Array.isArray(location) ? { [Op.in]: location } : location;
  }
  if (seats) {
    where.seats = Array.isArray(seats) ? { [Op.in]: seats } : seats;
  }
  if (status) {
    where.status = status;
  } else {
    // Default to active vehicles only
    where.status = "active";
  }

  // Price range filter
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
    if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
  }

  // Search functionality
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { brand: { [Op.iLike]: `%${search}%` } },
      { model: { [Op.iLike]: `%${search}%` } },
      { licensePlate: { [Op.iLike]: `%${search}%` } },
    ];
  }

  // Handle other filters (for future extensions)
  Object.keys(otherFilters).forEach((key) => {
    const value = otherFilters[key];
    if (typeof value === "string" && value.includes("[")) {
      // Handle operators like price[gte]=100
      const matches = value.match(/(.+)\[(\w+)\]/);
      if (matches) {
        const [, field, operator] = matches;
        if (!where[field]) where[field] = {};
        where[field][Op[operator]] = otherFilters[key];
      }
    }
  });

  // Build order clause
  let order = [["createdAt", "DESC"]];
  if (sort) {
    const sortFields = sort.split(",").map((field) => {
      if (field.startsWith("-")) {
        return [field.substring(1), "DESC"];
      }
      return [field, "ASC"];
    });
    order = sortFields;
  }

  // Build attributes (select)
  let attributes;
  if (select) {
    attributes = select.split(",");
  }

  // Pagination
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  // Execute query
  const { count, rows: vehicles } = await Vehicle.findAndCountAll({
    where,
    attributes,
    order,
    limit: limitNum,
    offset,
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
    pagination.next = {
      page: pageNum + 1,
      limit: limitNum,
    };
  }

  if (pageNum > 1) {
    pagination.prev = {
      page: pageNum - 1,
      limit: limitNum,
    };
  }

  pagination.current = pageNum;
  pagination.totalPages = totalPages;

  res.status(200).json({
    success: true,
    count: vehicles.length,
    total: count,
    pagination,
    data: vehicles,
  });
});

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
exports.getVehicle = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findByPk(req.params.id, {
    include: [
      {
        model: Admin,
        as: "createdBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  res.status(200).json({
    success: true,
    data: vehicle,
  });
});

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (admin/super-admin)
exports.createVehicle = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  // Add admin to req.body
  req.body.createdById = req.admin.id;

  // Handle file uploads
  const images = [];
  let mainImage = null;

  if (req.files) {
    // Handle main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      mainImage = {
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/vehicles/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
      };
    }

    // Handle additional images
    if (req.files.additionalImages) {
      req.files.additionalImages.forEach((file) => {
        images.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/vehicles/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype,
        });
      });
    }
  }

  // Add images to vehicle data
  if (mainImage) req.body.mainImage = mainImage;
  if (images.length > 0) req.body.images = images;

  // Create vehicle
  const vehicle = await Vehicle.create(req.body);

  // Fetch the created vehicle with associations
  const createdVehicle = await Vehicle.findByPk(vehicle.id, {
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
    message: "Vehicle created successfully",
    data: createdVehicle,
  });
});

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (owner or super-admin)
exports.updateVehicle = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  let vehicle = await Vehicle.findByPk(req.params.id);

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Make sure admin owns the vehicle or is super-admin
  if (
    vehicle.createdById !== req.admin.id &&
    req.admin.role !== "super-admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 401)
    );
  }

  // Handle file uploads
  const oldImages = {
    mainImage: vehicle.mainImage,
    images: vehicle.images || [],
  };

  if (req.files) {
    // Handle main image update
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      req.body.mainImage = {
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/vehicles/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
      };
    }

    // Handle additional images update
    if (req.files.additionalImages) {
      const newImages = [];
      req.files.additionalImages.forEach((file) => {
        newImages.push({
          filename: file.filename,
          originalName: file.originalname,
          path: `/uploads/vehicles/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype,
        });
      });
      req.body.images = newImages;
    }
  }

  // Update vehicle
  await vehicle.update(req.body);

  // Clean up old images if new ones were uploaded
  try {
    if (req.files?.mainImage && oldImages.mainImage?.filename) {
      const oldPath = path.join(
        __dirname,
        "../uploads/vehicles",
        oldImages.mainImage.filename
      );
      await fs.unlink(oldPath).catch(() => {}); // Ignore errors
    }

    if (req.files?.additionalImages && oldImages.images?.length > 0) {
      for (const img of oldImages.images) {
        if (img.filename) {
          const oldPath = path.join(
            __dirname,
            "../uploads/vehicles",
            img.filename
          );
          await fs.unlink(oldPath).catch(() => {}); // Ignore errors
        }
      }
    }
  } catch (error) {
    console.warn("Warning: Could not delete old images:", error.message);
  }

  // Fetch updated vehicle with associations
  const updatedVehicle = await Vehicle.findByPk(req.params.id, {
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
    message: "Vehicle updated successfully",
    data: updatedVehicle,
  });
});

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (owner or super-admin)
exports.deleteVehicle = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findByPk(req.params.id);

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Make sure admin owns the vehicle or is super-admin
  if (
    vehicle.createdById !== req.admin.id &&
    req.admin.role !== "super-admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to delete this vehicle", 401)
    );
  }

  // Check if vehicle has active bookings
  const { Booking } = require("../models");
  const activeBookings = await Booking.count({
    where: {
      vehicleId: vehicle.id,
      status: ["confirmed", "active"],
    },
  });

  if (activeBookings > 0) {
    return next(
      new ErrorResponse(
        "Cannot delete vehicle with active bookings. Please complete or cancel all bookings first.",
        400
      )
    );
  }

  // Delete associated images
  const imagesToDelete = [];

  if (vehicle.mainImage && vehicle.mainImage.filename) {
    imagesToDelete.push(vehicle.mainImage.filename);
  }

  if (vehicle.images && vehicle.images.length > 0) {
    vehicle.images.forEach((img) => {
      if (img.filename) {
        imagesToDelete.push(img.filename);
      }
    });
  }

  // Delete image files
  for (const filename of imagesToDelete) {
    try {
      const imagePath = path.join(__dirname, "../uploads/vehicles", filename);
      await fs.unlink(imagePath);
    } catch (error) {
      console.warn(
        `Warning: Could not delete image ${filename}:`,
        error.message
      );
    }
  }

  // Delete vehicle from database
  await vehicle.destroy();

  res.status(200).json({
    success: true,
    message: "Vehicle deleted successfully",
    data: {},
  });
});

// @desc    Upload vehicle images
// @route   PUT /api/vehicles/:id/images
// @access  Private (owner or super-admin)
exports.uploadVehicleImages = asyncHandler(async (req, res, next) => {
  const vehicle = await Vehicle.findByPk(req.params.id);

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Make sure admin owns the vehicle or is super-admin
  if (
    vehicle.createdById !== req.admin.id &&
    req.admin.role !== "super-admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 401)
    );
  }

  if (!req.files || (!req.files.mainImage && !req.files.additionalImages)) {
    return next(new ErrorResponse("Please upload at least one image", 400));
  }

  const updateData = {};

  // Handle main image
  if (req.files.mainImage && req.files.mainImage[0]) {
    const file = req.files.mainImage[0];
    updateData.mainImage = {
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/vehicles/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };

    // Delete old main image
    if (vehicle.mainImage?.filename) {
      try {
        const oldPath = path.join(
          __dirname,
          "../uploads/vehicles",
          vehicle.mainImage.filename
        );
        await fs.unlink(oldPath);
      } catch (error) {
        console.warn(
          "Warning: Could not delete old main image:",
          error.message
        );
      }
    }
  }

  // Handle additional images
  if (req.files.additionalImages) {
    const images = [];
    req.files.additionalImages.forEach((file) => {
      images.push({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/vehicles/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype,
      });
    });

    updateData.images = [...(vehicle.images || []), ...images];

    // Limit to maximum 10 images total
    if (updateData.images.length > 10) {
      updateData.images = updateData.images.slice(-10);
    }
  }

  await vehicle.update(updateData);

  const updatedVehicle = await Vehicle.findByPk(req.params.id, {
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
    message: "Vehicle images uploaded successfully",
    data: updatedVehicle,
  });
});

// @desc    Remove vehicle image
// @route   DELETE /api/vehicles/:id/images/:imageIndex
// @access  Private (owner or super-admin)
exports.removeVehicleImage = asyncHandler(async (req, res, next) => {
  const { id, imageIndex } = req.params;
  const imageIndexNum = parseInt(imageIndex);

  const vehicle = await Vehicle.findByPk(id);

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Make sure admin owns the vehicle or is super-admin
  if (
    vehicle.createdById !== req.admin.id &&
    req.admin.role !== "super-admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 401)
    );
  }

  if (
    !vehicle.images ||
    imageIndexNum >= vehicle.images.length ||
    imageIndexNum < 0
  ) {
    return next(new ErrorResponse("Image not found", 404));
  }

  const imageToDelete = vehicle.images[imageIndexNum];

  // Delete physical file
  try {
    if (imageToDelete.filename) {
      const imagePath = path.join(
        __dirname,
        "../uploads/vehicles",
        imageToDelete.filename
      );
      await fs.unlink(imagePath);
    }
  } catch (error) {
    console.warn("Warning: Could not delete image file:", error.message);
  }

  // Remove image from array
  const updatedImages = vehicle.images.filter(
    (_, index) => index !== imageIndexNum
  );
  await vehicle.update({ images: updatedImages });

  res.status(200).json({
    success: true,
    message: "Image removed successfully",
    data: vehicle,
  });
});

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/stats
// @access  Private (admin)
exports.getVehicleStats = asyncHandler(async (req, res, next) => {
  const { sequelize } = require("../config/database");

  // Get overall stats
  const overallStats = await Vehicle.findAll({
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "totalVehicles"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal(
            "CASE WHEN available = true AND status = 'active' THEN 1 END"
          )
        ),
        "availableVehicles",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal(
            "CASE WHEN available = false AND status = 'active' THEN 1 END"
          )
        ),
        "rentedVehicles",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'maintenance' THEN 1 END")
        ),
        "maintenanceVehicles",
      ],
      [sequelize.fn("AVG", sequelize.col("price")), "averagePrice"],
      [sequelize.fn("SUM", sequelize.col("totalBookings")), "totalBookings"],
      [sequelize.fn("AVG", sequelize.col("rating")), "averageRating"],
    ],
    where: { status: ["active", "maintenance"] },
    raw: true,
  });

  // Get brand stats
  const brandStats = await Vehicle.findAll({
    attributes: [
      "brand",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      [sequelize.fn("AVG", sequelize.col("price")), "averagePrice"],
      [sequelize.fn("AVG", sequelize.col("rating")), "averageRating"],
    ],
    where: { status: "active" },
    group: ["brand"],
    order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
    raw: true,
  });

  // Get location stats
  const locationStats = await Vehicle.findAll({
    attributes: [
      "location",
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN available = true THEN 1 END")
        ),
        "available",
      ],
    ],
    where: { status: "active" },
    group: ["location"],
    raw: true,
  });

  // Get maintenance due count
  const maintenanceDue = await Vehicle.count({
    where: {
      status: "active",
      nextMaintenanceDue: {
        [Op.lte]: new Date(),
      },
    },
  });

  // Calculate revenue (you'd need booking data for accurate revenue)
  const monthlyRevenue = 0; // Placeholder - implement when bookings are ready

  res.status(200).json({
    success: true,
    data: {
      overview: {
        ...overallStats[0],
        maintenanceDue,
        monthlyRevenue,
      },
      brandBreakdown: brandStats,
      locationBreakdown: locationStats,
    },
  });
});

// @desc    Get available vehicles for date range
// @route   GET /api/vehicles/availability
// @access  Public
exports.getAvailableVehicles = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, location } = req.query;

  if (!startDate || !endDate) {
    return next(new ErrorResponse("Start date and end date are required", 400));
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    return next(new ErrorResponse("End date must be after start date", 400));
  }

  if (start < new Date()) {
    return next(new ErrorResponse("Start date cannot be in the past", 400));
  }

  try {
    let availableVehicles = await Vehicle.getAvailableForDateRange(
      startDate,
      endDate
    );

    // Filter by location if specified
    if (location) {
      availableVehicles = availableVehicles.filter(
        (vehicle) => vehicle.location === location
      );
    }

    res.status(200).json({
      success: true,
      count: availableVehicles.length,
      data: availableVehicles,
      searchCriteria: {
        startDate,
        endDate,
        location: location || "All locations",
      },
    });
  } catch (error) {
    return next(new ErrorResponse("Error checking availability", 500));
  }
});

// @desc    Update vehicle status
// @route   PUT /api/vehicles/:id/status
// @access  Private (admin)
exports.updateVehicleStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  if (!["active", "maintenance", "inactive"].includes(status)) {
    return next(new ErrorResponse("Invalid status", 400));
  }

  const vehicle = await Vehicle.findByPk(req.params.id);

  if (!vehicle) {
    return next(new ErrorResponse("Vehicle not found", 404));
  }

  // Make sure admin owns the vehicle or is super-admin
  if (
    vehicle.createdById !== req.admin.id &&
    req.admin.role !== "super-admin"
  ) {
    return next(
      new ErrorResponse("Not authorized to update this vehicle", 401)
    );
  }

  // If setting to maintenance, make unavailable
  if (status === "maintenance") {
    await vehicle.update({ status, available: false });
  } else if (status === "active") {
    await vehicle.update({ status, available: true });
  } else {
    await vehicle.update({ status, available: false });
  }

  res.status(200).json({
    success: true,
    message: `Vehicle status updated to ${status}`,
    data: vehicle,
  });
});
