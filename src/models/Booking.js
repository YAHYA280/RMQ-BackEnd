// src/models/Booking.js - FIXED: Updated for proper booking number generation and validation
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Booking = sequelize.define(
  "Booking",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingNumber: {
      type: DataTypes.STRING(12),
      unique: true,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "customers",
        key: "id",
      },
    },
    vehicleId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "vehicles",
        key: "id",
      },
    },
    // Date and time information
    pickupDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
      },
    },
    returnDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterPickup(value) {
          if (value <= this.pickupDate) {
            throw new Error("Return date must be after pickup date");
          }
        },
      },
    },
    pickupTime: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    returnTime: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
      },
    },
    // Location information
    pickupLocation: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    returnLocation: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    // Pricing information
    dailyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    totalDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    // Booking status and workflow
    status: {
      type: DataTypes.ENUM(
        "pending",
        "confirmed",
        "active",
        "completed",
        "cancelled"
      ),
      defaultValue: "pending",
    },
    source: {
      type: DataTypes.ENUM("website", "admin"),
      defaultValue: "website",
    },
    // Admin tracking
    createdById: {
      type: DataTypes.UUID,
      allowNull: true, // Can be null for website bookings
      references: {
        model: "admins",
        key: "id",
      },
    },
    confirmedAt: {
      type: DataTypes.DATE,
    },
    confirmedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
    },
    cancelledAt: {
      type: DataTypes.DATE,
    },
    cancelledById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
    },
    cancellationReason: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "bookings",
    timestamps: true,
    hooks: {
      // REMOVED beforeCreate hook - we'll handle this manually in controller
      beforeUpdate: async (booking) => {
        // Recalculate totals if relevant fields changed
        if (
          booking.changed("dailyRate") ||
          booking.changed("pickupDate") ||
          booking.changed("returnDate")
        ) {
          const pickupDate = new Date(booking.pickupDate);
          const returnDate = new Date(booking.returnDate);
          const diffTime = Math.abs(returnDate - pickupDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          booking.totalDays = Math.max(1, diffDays);
          booking.totalAmount =
            parseFloat(booking.dailyRate) * booking.totalDays;
        }

        // Set confirmation timestamp
        if (
          booking.changed("status") &&
          booking.status === "confirmed" &&
          !booking.confirmedAt
        ) {
          booking.confirmedAt = new Date();
        }

        // Set cancellation timestamp
        if (
          booking.changed("status") &&
          booking.status === "cancelled" &&
          !booking.cancelledAt
        ) {
          booking.cancelledAt = new Date();
        }
      },
    },
    indexes: [
      {
        fields: ["booking_number"],
        unique: true,
      },
      {
        fields: ["customer_id"],
      },
      {
        fields: ["vehicle_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["pickup_date", "return_date"],
      },
      {
        fields: ["created_by_id"],
      },
    ],
  }
);

// Instance methods
Booking.prototype.getDuration = function () {
  const pickup = new Date(this.pickupDate);
  const returnDate = new Date(this.returnDate);
  const diffTime = Math.abs(returnDate - pickup);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

Booking.prototype.isOverdue = function () {
  if (this.status !== "active") return false;
  const today = new Date();
  const returnDate = new Date(this.returnDate);
  return today > returnDate;
};

Booking.prototype.canBeCancelled = function () {
  const allowedStatuses = ["pending", "confirmed"];
  return allowedStatuses.includes(this.status);
};

// FIXED: Class method for generating booking numbers like BK001, BK002, etc.
Booking.generateBookingNumber = async function () {
  let bookingNumber;
  let isUnique = false;
  let counter = 1;

  // Get the highest booking number to determine next increment
  const lastBooking = await Booking.findOne({
    where: {
      bookingNumber: {
        [require("sequelize").Op.like]: "BK%",
      },
    },
    order: [["bookingNumber", "DESC"]],
  });

  if (lastBooking && lastBooking.bookingNumber) {
    // Extract number from booking number like BK001 -> 001 -> 1
    const lastNumber = lastBooking.bookingNumber.match(/BK(\d+)/);
    if (lastNumber) {
      counter = parseInt(lastNumber[1]) + 1;
    }
  }

  // Keep trying until we find a unique number
  while (!isUnique) {
    // Format as BK001, BK002, etc. (3 digits with leading zeros)
    bookingNumber = `BK${String(counter).padStart(3, "0")}`;

    const existingBooking = await Booking.findOne({
      where: { bookingNumber },
    });

    if (!existingBooking) {
      isUnique = true;
    } else {
      counter++;
    }

    // Safety check to prevent infinite loop
    if (counter > 999999) {
      throw new Error("Unable to generate unique booking number");
    }
  }

  return bookingNumber;
};

Booking.checkVehicleAvailability = async function (
  vehicleId,
  pickupDate,
  returnDate,
  excludeBookingId = null
) {
  const whereClause = {
    vehicleId,
    status: ["confirmed", "active"],
    [require("sequelize").Op.or]: [
      {
        pickupDate: {
          [require("sequelize").Op.between]: [pickupDate, returnDate],
        },
      },
      {
        returnDate: {
          [require("sequelize").Op.between]: [pickupDate, returnDate],
        },
      },
      {
        [require("sequelize").Op.and]: [
          { pickupDate: { [require("sequelize").Op.lte]: pickupDate } },
          { returnDate: { [require("sequelize").Op.gte]: returnDate } },
        ],
      },
    ],
  };

  if (excludeBookingId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeBookingId };
  }

  const conflictingBookings = await Booking.findAll({
    where: whereClause,
  });

  return conflictingBookings.length === 0;
};

Booking.getBookingStats = async function () {
  const { sequelize } = require("../config/database");

  const stats = await Booking.findAll({
    attributes: [
      [sequelize.fn("COUNT", sequelize.col("id")), "totalBookings"],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")
        ),
        "pendingBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'confirmed' THEN 1 END")
        ),
        "confirmedBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'active' THEN 1 END")
        ),
        "activeBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")
        ),
        "completedBookings",
      ],
      [
        sequelize.fn(
          "COUNT",
          sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 END")
        ),
        "cancelledBookings",
      ],
      [sequelize.fn("SUM", sequelize.col("totalAmount")), "totalRevenue"],
      [
        sequelize.fn("AVG", sequelize.col("totalAmount")),
        "averageBookingValue",
      ],
    ],
    raw: true,
  });

  return stats[0];
};

module.exports = Booking;
