// src/controllers/vehicles.js
const Vehicle = require("../models/Vehicle");
const { validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs");

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Public
exports.getVehicles = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filtering
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Vehicle.find(JSON.parse(queryStr));

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Vehicle.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const vehicles = await query.populate("createdBy", "name email");

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total,
      pagination,
      data: vehicles,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
exports.getVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private
exports.createVehicle = async (req, res, next) => {
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

    // Add admin to req.body
    req.body.createdBy = req.admin.id;

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
          path: file.path,
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
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
          });
        });
      }
    }

    // Add images to vehicle data
    if (mainImage) req.body.mainImage = mainImage;
    if (images.length > 0) req.body.images = images;

    const vehicle = await Vehicle.create(req.body);

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    // Clean up uploaded files if vehicle creation fails
    if (req.files) {
      const filesToDelete = [];

      if (req.files.mainImage && req.files.mainImage[0]) {
        filesToDelete.push(req.files.mainImage[0].path);
      }

      if (req.files.additionalImages) {
        req.files.additionalImages.forEach((file) => {
          filesToDelete.push(file.path);
        });
      }

      // Delete files
      filesToDelete.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    next(error);
  }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private
exports.updateVehicle = async (req, res, next) => {
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

    let vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdBy.toString() !== req.admin.id &&
      req.admin.role !== "super-admin"
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this vehicle",
      });
    }

    // Handle file uploads
    if (req.files) {
      // Handle main image update
      if (req.files.mainImage && req.files.mainImage[0]) {
        // Delete old main image
        if (
          vehicle.mainImage &&
          vehicle.mainImage.path &&
          fs.existsSync(vehicle.mainImage.path)
        ) {
          fs.unlinkSync(vehicle.mainImage.path);
        }

        const file = req.files.mainImage[0];
        req.body.mainImage = {
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        };
      }

      // Handle additional images update
      if (req.files.additionalImages) {
        // Delete old additional images
        if (vehicle.images && vehicle.images.length > 0) {
          vehicle.images.forEach((img) => {
            if (img.path && fs.existsSync(img.path)) {
              fs.unlinkSync(img.path);
            }
          });
        }

        const newImages = [];
        req.files.additionalImages.forEach((file) => {
          newImages.push({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
          });
        });
        req.body.images = newImages;
      }
    }

    vehicle = await Vehicle.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private
exports.deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdBy.toString() !== req.admin.id &&
      req.admin.role !== "super-admin"
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this vehicle",
      });
    }

    // Delete associated images
    const imagesToDelete = [];

    if (vehicle.mainImage && vehicle.mainImage.path) {
      imagesToDelete.push(vehicle.mainImage.path);
    }

    if (vehicle.images && vehicle.images.length > 0) {
      vehicle.images.forEach((img) => {
        if (img.path) {
          imagesToDelete.push(img.path);
        }
      });
    }

    // Delete image files
    imagesToDelete.forEach((imagePath) => {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    // Delete vehicle from database
    await Vehicle.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload vehicle images
// @route   PUT /api/vehicles/:id/images
// @access  Private
exports.uploadVehicleImages = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdBy.toString() !== req.admin.id &&
      req.admin.role !== "super-admin"
    ) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this vehicle",
      });
    }

    if (!req.files || (!req.files.mainImage && !req.files.additionalImages)) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }

    const updateData = {};

    // Handle main image
    if (req.files.mainImage && req.files.mainImage[0]) {
      const file = req.files.mainImage[0];
      updateData.mainImage = {
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      };
    }

    // Handle additional images
    if (req.files.additionalImages) {
      const images = [];
      req.files.additionalImages.forEach((file) => {
        images.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        });
      });
      updateData.images = images;
    }

    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Vehicle images uploaded successfully",
      data: updatedVehicle,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/stats
// @access  Private
exports.getVehicleStats = async (req, res, next) => {
  try {
    const stats = await Vehicle.aggregate([
      {
        $group: {
          _id: null,
          totalVehicles: { $sum: 1 },
          availableVehicles: {
            $sum: { $cond: [{ $eq: ["$available", true] }, 1, 0] },
          },
          rentedVehicles: {
            $sum: { $cond: [{ $eq: ["$available", false] }, 1, 0] },
          },
          averagePrice: { $avg: "$price" },
          totalBookings: { $sum: "$bookings" },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    const brandStats = await Vehicle.aggregate([
      {
        $group: {
          _id: "$brand",
          count: { $sum: 1 },
          averagePrice: { $avg: "$price" },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalVehicles: 0,
          availableVehicles: 0,
          rentedVehicles: 0,
          averagePrice: 0,
          totalBookings: 0,
          averageRating: 0,
        },
        brandBreakdown: brandStats,
      },
    });
  } catch (error) {
    next(error);
  }
};
