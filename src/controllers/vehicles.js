// src/controllers/vehicles.js - Updated with BYTEA Image Storage
const { Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const asyncHandler = require("../middleware/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const { sequelize } = require("../config/database");

// @desc    Get available brands
// @route   GET /api/vehicles/brands
// @access  Public
const getBrands = asyncHandler(async (req, res, next) => {
  const brands = [
    "Cupra",
    "Dacia",
    "Hyundai",
    "KIA",
    "Mercedes",
    "Opel",
    "Peugeot",
    "Porsche",
    "Renault",
    "SEAT",
    "Volkswagen",
  ];

  res.status(200).json({
    success: true,
    data: brands,
  });
});

// Helper function to process uploaded images and convert to BYTEA
const processImageForStorage = (file) => {
  if (!file) return null;

  return {
    data: file.buffer,
    mimetype: file.mimetype,
    name: file.originalname,
    size: file.size,
  };
};

// Helper function to transform vehicle data for frontend
const transformVehicleForResponse = (vehicle) => {
  const vehicleData = vehicle.toJSON();

  // Convert main image BYTEA to data URL
  if (vehicle.mainImageData && vehicle.mainImageMimetype) {
    vehicleData.image = vehicle.getMainImageDataUrl();
    vehicleData.mainImage = {
      dataUrl: vehicleData.image,
      mimetype: vehicle.mainImageMimetype,
      name: vehicle.mainImageName || "main-image",
    };
  } else {
    vehicleData.image = "/cars/car1.jpg"; // Fallback
  }

  // Convert additional images BYTEA to data URLs
  vehicleData.images = vehicle.getAdditionalImagesDataUrls();

  return vehicleData;
};

// @desc    Get all vehicles with advanced filtering and pagination
// @route   GET /api/vehicles
// @access  Public
const getVehicles = asyncHandler(async (req, res, next) => {
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
    minPrice,
    maxPrice,
    seats,
    search,
    status,
    ...otherFilters
  } = req.query;

  console.log("Search query received:", search); // DEBUG LOG

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

  if (search && search.trim() !== "") {
    const searchTerm = search.trim();
    console.log("Applying search filter for:", searchTerm);

    where[Op.or] = [
      { name: { [Op.iLike]: `%${searchTerm}%` } },
      // FIXED: Cast ENUM to text for PostgreSQL compatibility
      sequelize.where(sequelize.cast(sequelize.col("brand"), "TEXT"), {
        [Op.iLike]: `%${searchTerm}%`,
      }),
      { licensePlate: { [Op.iLike]: `%${searchTerm}%` } },
    ];
  }
  console.log("Final where clause:", JSON.stringify(where, null, 2)); // DEBUG LOG

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

  try {
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

    console.log(`Found ${count} vehicles matching search criteria`); // DEBUG LOG

    // Transform vehicles for frontend (convert BYTEA to data URLs)
    const transformedVehicles = vehicles.map(transformVehicleForResponse);

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
      count: transformedVehicles.length,
      total: count,
      pagination,
      data: transformedVehicles,
    });
  } catch (error) {
    console.error("Database query error:", error);
    return next(new ErrorResponse("Error fetching vehicles", 500));
  }
});

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
const getVehicle = asyncHandler(async (req, res, next) => {
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

  // Transform vehicle data for frontend
  const vehicleData = transformVehicleForResponse(vehicle);

  res.status(200).json({
    success: true,
    data: vehicleData,
  });
});

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (admin/super-admin)
const createVehicle = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse("Validation failed", 400, errors.array()));
  }

  // Add admin to req.body
  req.body.createdById = req.admin.id;

  // Process uploaded images
  let mainImageData = null;
  let mainImageMimetype = null;
  let mainImageName = null;
  let additionalImagesData = [];

  if (req.files) {
    // Handle main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      mainImageData = file.buffer;
      mainImageMimetype = file.mimetype;
      mainImageName = file.originalname;
    }

    // Handle additional images
    if (req.files.additionalImages) {
      additionalImagesData = req.files.additionalImages.map((file) => ({
        data: file.buffer,
        mimetype: file.mimetype,
        name: file.originalname,
      }));
    }
  }

  // Add image data to vehicle data
  if (mainImageData) {
    req.body.mainImageData = mainImageData;
    req.body.mainImageMimetype = mainImageMimetype;
    req.body.mainImageName = mainImageName;
  }

  if (additionalImagesData.length > 0) {
    req.body.additionalImagesData = additionalImagesData;
  }

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

  // Transform for response
  const responseData = transformVehicleForResponse(createdVehicle);

  res.status(201).json({
    success: true,
    message: "Vehicle created successfully",
    data: responseData,
  });
});

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (owner or super-admin)
const updateVehicle = asyncHandler(async (req, res, next) => {
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

  // Process uploaded images if any
  if (req.files) {
    // Handle main image update
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      req.body.mainImageData = file.buffer;
      req.body.mainImageMimetype = file.mimetype;
      req.body.mainImageName = file.originalname;
    }

    // Handle additional images update
    if (req.files.additionalImages) {
      const newImages = req.files.additionalImages.map((file) => ({
        data: file.buffer,
        mimetype: file.mimetype,
        name: file.originalname,
      }));
      req.body.additionalImagesData = newImages;
    }
  }

  // Update vehicle
  await vehicle.update(req.body);

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

  // Transform for response
  const responseData = transformVehicleForResponse(updatedVehicle);

  res.status(200).json({
    success: true,
    message: "Vehicle updated successfully",
    data: responseData,
  });
});

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (owner or super-admin)
const deleteVehicle = asyncHandler(async (req, res, next) => {
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

  // Delete vehicle from database (images are automatically deleted with the record)
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
const uploadVehicleImages = asyncHandler(async (req, res, next) => {
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
    updateData.mainImageData = file.buffer;
    updateData.mainImageMimetype = file.mimetype;
    updateData.mainImageName = file.originalname;
  }

  // Handle additional images
  if (req.files.additionalImages) {
    const images = req.files.additionalImages.map((file) => ({
      data: file.buffer,
      mimetype: file.mimetype,
      name: file.originalname,
    }));

    // Merge with existing images or replace
    updateData.additionalImagesData = [
      ...(vehicle.additionalImagesData || []),
      ...images,
    ];

    // Limit to maximum 10 images total
    if (updateData.additionalImagesData.length > 10) {
      updateData.additionalImagesData =
        updateData.additionalImagesData.slice(-10);
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

  // Transform for response
  const responseData = transformVehicleForResponse(updatedVehicle);

  res.status(200).json({
    success: true,
    message: "Vehicle images uploaded successfully",
    data: responseData,
  });
});

// @desc    Remove vehicle image
// @route   DELETE /api/vehicles/:id/images/:imageIndex
// @access  Private (owner or super-admin)
const removeVehicleImage = asyncHandler(async (req, res, next) => {
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
    !vehicle.additionalImagesData ||
    imageIndexNum >= vehicle.additionalImagesData.length ||
    imageIndexNum < 0
  ) {
    return next(new ErrorResponse("Image not found", 404));
  }

  // Remove image from array
  const updatedImages = vehicle.additionalImagesData.filter(
    (_, index) => index !== imageIndexNum
  );
  await vehicle.update({ additionalImagesData: updatedImages });

  res.status(200).json({
    success: true,
    message: "Image removed successfully",
    data: vehicle,
  });
});

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/stats
// @access  Private (admin)
const getVehicleStats = asyncHandler(async (req, res, next) => {
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

  // Get maintenance due count
  const maintenanceDue = await Vehicle.count({
    where: {
      status: "active",
      nextMaintenanceDue: {
        [Op.lte]: new Date(),
      },
    },
  });

  res.status(200).json({
    success: true,
    data: {
      overview: {
        ...overallStats[0],
        maintenanceDue,
      },
      brandBreakdown: brandStats,
    },
  });
});

// @desc    Get available vehicles for date range
// @route   GET /api/vehicles/availability
// @access  Public
const getAvailableVehicles = asyncHandler(async (req, res, next) => {
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

    // Transform vehicles for response
    const transformedVehicles = availableVehicles.map(
      transformVehicleForResponse
    );

    res.status(200).json({
      success: true,
      count: transformedVehicles.length,
      data: transformedVehicles,
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
const updateVehicleStatus = asyncHandler(async (req, res, next) => {
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

module.exports = {
  getBrands,
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehicleImages,
  removeVehicleImage,
  getVehicleStats,
  getAvailableVehicles,
  updateVehicleStatus,
};
