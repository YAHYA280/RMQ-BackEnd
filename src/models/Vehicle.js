// src/models/Vehicle.js - Updated with WhatsApp validation and no location field
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Vehicle = sequelize.define(
  "Vehicle",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    brand: {
      type: DataTypes.ENUM(
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
        "Volkswagen"
      ),
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2000,
        max: new Date().getFullYear() + 1,
      },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    transmission: {
      type: DataTypes.ENUM("manual", "automatic"),
      allowNull: false,
    },
    fuelType: {
      type: DataTypes.ENUM("petrol", "diesel", "electric", "hybrid"),
      allowNull: false,
    },
    seats: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2,
        max: 8,
      },
    },
    doors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2,
        max: 5,
      },
    },
    licensePlate: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true,
      validate: {
        is: /^\d{5}[A-Z]$/,
      },
    },
    whatsappNumber: {
      type: DataTypes.STRING(15),
      allowNull: false,
      validate: {
        // Updated to match 06 XX XX XX XX format (10 digits starting with 06 or 07)
        is: /^0[67]\d{8}$/,
      },
    },
    caution: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    mileage: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 4.5,
      validate: {
        min: 0,
        max: 5,
      },
    },
    totalBookings: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    description: {
      type: DataTypes.TEXT,
    },
    features: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      validate: {
        isValidFeatures(value) {
          const validFeatures = [
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
          ];

          if (!Array.isArray(value)) {
            throw new Error("Features must be an array");
          }

          for (const feature of value) {
            if (!validFeatures.includes(feature)) {
              throw new Error(`Invalid feature: ${feature}`);
            }
          }
        },
      },
    },
    mainImage: {
      type: DataTypes.JSONB,
      defaultValue: null,
    },
    images: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      defaultValue: [],
    },
    lastTechnicalVisit: {
      type: DataTypes.DATEONLY,
    },
    lastOilChange: {
      type: DataTypes.DATEONLY,
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "admins",
        key: "id",
      },
    },
    // Maintenance tracking
    nextMaintenanceDue: {
      type: DataTypes.DATEONLY,
    },
    status: {
      type: DataTypes.ENUM("active", "maintenance", "inactive"),
      defaultValue: "active",
    },
  },
  {
    tableName: "vehicles",
    timestamps: true,
    hooks: {
      beforeSave: async (vehicle) => {
        // Auto-calculate next maintenance due date
        if (vehicle.changed("lastTechnicalVisit")) {
          const lastVisit = new Date(vehicle.lastTechnicalVisit);
          const nextDue = new Date(lastVisit);
          nextDue.setFullYear(nextDue.getFullYear() + 1); // Technical visit every year
          vehicle.nextMaintenanceDue = nextDue.toISOString().split("T")[0];
        }
      },
    },
    indexes: [
      {
        fields: ["brand"],
      },
      {
        fields: ["available"],
      },
      {
        fields: ["price"],
      },
      {
        fields: ["created_by_id"],
      },
    ],
  }
);

// Instance methods
Vehicle.prototype.isMaintenanceDue = function () {
  if (!this.nextMaintenanceDue) return false;
  const today = new Date();
  const dueDate = new Date(this.nextMaintenanceDue);
  return today >= dueDate;
};

Vehicle.prototype.incrementBookings = async function () {
  await this.increment("totalBookings");
  await this.reload();
  return this;
};

Vehicle.prototype.updateRating = async function (newRating) {
  // Simple rating update - in production, you'd calculate average from all ratings
  const currentRating = parseFloat(this.rating) || 0;
  const bookingCount = this.totalBookings || 1;
  const updatedRating =
    (currentRating * (bookingCount - 1) + newRating) / bookingCount;

  await this.update({ rating: Math.round(updatedRating * 10) / 10 });
  return this;
};

// Class methods
Vehicle.getAvailableForDateRange = async function (
  startDate,
  endDate,
  excludeVehicleId = null
) {
  const { Booking } = require("./index");

  // Get all vehicles that don't have conflicting bookings
  const whereClause = { available: true, status: "active" };
  if (excludeVehicleId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeVehicleId };
  }

  const availableVehicles = await Vehicle.findAll({
    where: whereClause,
    include: [
      {
        model: Booking,
        as: "vehicleBookings", // Using the correct association alias
        where: {
          status: ["confirmed", "active"],
          [require("sequelize").Op.or]: [
            {
              pickupDate: {
                [require("sequelize").Op.between]: [startDate, endDate],
              },
            },
            {
              returnDate: {
                [require("sequelize").Op.between]: [startDate, endDate],
              },
            },
            {
              [require("sequelize").Op.and]: [
                { pickupDate: { [require("sequelize").Op.lte]: startDate } },
                { returnDate: { [require("sequelize").Op.gte]: endDate } },
              ],
            },
          ],
        },
        required: false,
      },
    ],
  });

  // Filter out vehicles with conflicting bookings
  return availableVehicles.filter(
    (vehicle) =>
      !vehicle.vehicleBookings || vehicle.vehicleBookings.length === 0
  );
};

module.exports = Vehicle;
