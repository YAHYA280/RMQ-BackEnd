// src/models/Vehicle.js
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a vehicle name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    brand: {
      type: String,
      required: [true, "Please add a brand"],
      enum: [
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
      ],
    },
    model: {
      type: String,
      required: [true, "Please add a model"],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, "Please add a year"],
      min: [2000, "Year cannot be less than 2000"],
      max: [new Date().getFullYear() + 1, "Year cannot be in the future"],
    },
    price: {
      type: Number,
      required: [true, "Please add a daily price"],
      min: [0, "Price cannot be negative"],
    },
    transmission: {
      type: String,
      required: [true, "Please select transmission type"],
      enum: ["Manual", "Automatic"],
    },
    fuelType: {
      type: String,
      required: [true, "Please select fuel type"],
      enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
    },
    seats: {
      type: Number,
      required: [true, "Please add number of seats"],
      min: [2, "Must have at least 2 seats"],
      max: [8, "Cannot have more than 8 seats"],
    },
    doors: {
      type: Number,
      required: [true, "Please add number of doors"],
      min: [2, "Must have at least 2 doors"],
      max: [5, "Cannot have more than 5 doors"],
    },
    licensePlate: {
      type: String,
      required: [true, "Please add license plate"],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^\d{5}[A-Z]$/, "License plate must be in format: 12345A"],
    },
    whatsappNumber: {
      type: String,
      required: [true, "Please add WhatsApp number"],
      match: [
        /^(\+212|212|0)[5-7]\d{8}$/,
        "Please add a valid Moroccan phone number",
      ],
    },
    caution: {
      type: Number,
      required: [true, "Please add security deposit amount"],
      min: [0, "Caution cannot be negative"],
    },
    mileage: {
      type: Number,
      default: 0,
      min: [0, "Mileage cannot be negative"],
    },
    available: {
      type: Boolean,
      default: true,
    },
    features: [
      {
        type: String,
        enum: [
          "airConditioning",
          "bluetooth",
          "gps",
          "cruiseControl",
          "parkingSensors",
          "backupCamera",
          "leatherSeats",
          "keylessEntry",
          "electricWindows",
          "abs",
        ],
      },
    ],
    description: {
      type: String,
      maxlength: [500, "Description cannot be more than 500 characters"],
    },
    images: [
      {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        mimetype: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    mainImage: {
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
    location: {
      type: String,
      required: [true, "Please add vehicle location"],
      enum: ["Tangier Airport", "Tangier City Center", "Tangier Port"],
    },
    lastTechnicalVisit: {
      type: Date,
    },
    lastOilChange: {
      type: Date,
    },
    rating: {
      type: Number,
      default: 4.5,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    bookings: {
      type: Number,
      default: 0,
      min: [0, "Bookings cannot be negative"],
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create vehicle slug from name and brand
vehicleSchema.pre("save", function (next) {
  this.slug =
    this.brand.toLowerCase() +
    "-" +
    this.name.toLowerCase().replace(/\s+/g, "-");
  next();
});

// Static method to get average rating and bookings
vehicleSchema.statics.getAverageRating = async function (vehicleId) {
  // This will be used later when we add reviews
  return { averageRating: 4.5, totalBookings: 0 };
};

module.exports = mongoose.model("Vehicle", vehicleSchema);
