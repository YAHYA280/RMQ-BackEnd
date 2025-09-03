// src/controllers/vehicles.js
const { Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Public
exports.getVehicles = async (req, res, next) => {
  try {
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
      ...otherFilters
    } = req.query;

    // Build where clause
    const where = {};

    // Add filters
    if (brand) where.brand = brand;
    if (transmission) where.transmission = transmission;
    if (fuelType) where.fuelType = fuelType;
    if (available !== undefined) where.available = available === "true";
    if (location) where.location = location;
    if (seats) where.seats = seats;

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }

    // Other filters (gt, gte, lt, lte)
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

    // Pagination result
    const pagination = {};
    const endIndex = pageNum * limitNum;

    if (endIndex < count) {
      pagination.next = {
        page: pageNum + 1,
        limit: limitNum,
      };
    }

    if (offset > 0) {
      pagination.prev = {
        page: pageNum - 1,
        limit: limitNum,
      };
    }

    res.status(200).json({
      success: true,
      count: vehicles.length,
      total: count,
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

    let vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdById !== req.admin.id &&
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

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: updatedVehicle,
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
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdById !== req.admin.id &&
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
    await vehicle.destroy();

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
    const vehicle = await Vehicle.findByPk(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Make sure admin owns the vehicle or is super-admin
    if (
      vehicle.createdById !== req.admin.id &&
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
  } catch (error) {
    next(error);
  }
};

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/stats
// @access  Private
exports.getVehicleStats = async (req, res, next) => {
  try {
    const { sequelize } = require("../config/database");

    // Get overall stats
    const overallStats = await Vehicle.findAll({
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalVehicles"],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal("CASE WHEN available = true THEN 1 END")
          ),
          "availableVehicles",
        ],
        [
          sequelize.fn(
            "COUNT",
            sequelize.literal("CASE WHEN available = false THEN 1 END")
          ),
          "rentedVehicles",
        ],
        [sequelize.fn("AVG", sequelize.col("price")), "averagePrice"],
        [sequelize.fn("SUM", sequelize.col("bookings")), "totalBookings"],
        [sequelize.fn("AVG", sequelize.col("rating")), "averageRating"],
      ],
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
      group: ["brand"],
      order: [[sequelize.fn("COUNT", sequelize.col("id")), "DESC"]],
      raw: true,
    });

    res.status(200).json({
      success: true,
      data: {
        overview: overallStats[0] || {
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
