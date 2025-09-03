// src/controllers/vehicles.js
const { Vehicle, Admin } = require("../models");
const { validationResult } = require("express-validator");

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Public
exports.getVehicles = async (req, res, next) => {
  try {
    // Simple query without relations for now
    const vehicles = await Vehicle.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    console.error("GetVehicles error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vehicles",
    });
  }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Public
exports.getVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);

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
    console.error("GetVehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vehicle",
    });
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

    const vehicle = await Vehicle.create(req.body);

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("CreateVehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating vehicle",
    });
  }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private
exports.updateVehicle = async (req, res, next) => {
  try {
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

    await vehicle.update(req.body);

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      data: vehicle,
    });
  } catch (error) {
    console.error("UpdateVehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating vehicle",
    });
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

    // Delete vehicle from database
    await vehicle.destroy();

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("DeleteVehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting vehicle",
    });
  }
};

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/stats
// @access  Private
exports.getVehicleStats = async (req, res, next) => {
  try {
    const totalVehicles = await Vehicle.count();
    const availableVehicles = await Vehicle.count({
      where: { available: true },
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalVehicles,
          availableVehicles,
          rentedVehicles: totalVehicles - availableVehicles,
          averagePrice: 0,
          totalBookings: 0,
          averageRating: 4.5,
        },
      },
    });
  } catch (error) {
    console.error("GetVehicleStats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching stats",
    });
  }
};
