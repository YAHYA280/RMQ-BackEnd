// src/models/Booking.js - UPDATED: Minimum 2 days + same-day booking logic
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  calculateRentalDaysWithTimeLogic,
  getTimeExcessInfo,
  checkAdvancedAvailability,
} = require("../utils/bookingUtils");

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

          // UPDATED: Validate minimum 1 days
          const pickup = new Date(this.pickupDate);
          const returnD = new Date(value);
          const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays < 1) {
            throw new Error("Minimum rental period is 2 days");
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
        min: 2, // UPDATED: Minimum 2 days
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
      beforeUpdate: async (booking) => {
        // Recalculate totals if relevant fields changed (now includes time fields)
        if (
          booking.changed("dailyRate") ||
          booking.changed("pickupDate") ||
          booking.changed("returnDate") ||
          booking.changed("pickupTime") ||
          booking.changed("returnTime")
        ) {
          // Use the new time logic calculation
          booking.totalDays = booking.calculateRentalDays();
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

// UPDATED: Calculate rental days with time logic (minimum 1 days)
Booking.prototype.calculateRentalDays = function () {
  if (
    !this.pickupDate ||
    !this.returnDate ||
    !this.pickupTime ||
    !this.returnTime
  ) {
    return 1;
  }

  // Use the utility function with minimum 2 days
  return calculateRentalDaysWithTimeLogic(
    this.pickupDate,
    this.returnDate,
    this.pickupTime,
    this.returnTime
  );
};

// Get time difference info for display
Booking.prototype.getTimeExcessInfo = function () {
  return getTimeExcessInfo(this.pickupTime, this.returnTime);
};

// LEGACY: Original duration method (kept for backward compatibility, minimum 2 days)
Booking.prototype.getDuration = function () {
  const pickup = new Date(this.pickupDate);
  const returnDate = new Date(this.returnDate);
  const diffTime = Math.abs(returnDate - pickup);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(2, days); // UPDATED: Minimum 2 days
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

// Check if booking has time-based extra charges
Booking.prototype.hasTimeExtraCharge = function () {
  const timeInfo = this.getTimeExcessInfo();
  return timeInfo && timeInfo.hasExcess;
};

// Get formatted time display
Booking.prototype.getFormattedTimes = function () {
  return {
    pickup: this.pickupTime || "00:00",
    return: this.returnTime || "00:00",
    pickupDateTime:
      this.pickupDate && this.pickupTime
        ? `${this.pickupDate} ${this.pickupTime}`
        : null,
    returnDateTime:
      this.returnDate && this.returnTime
        ? `${this.returnDate} ${this.returnTime}`
        : null,
  };
};

// NEW: Check if this booking conflicts with another booking using same-day logic
Booking.prototype.conflictsWith = function (otherBooking) {
  // Skip if same booking
  if (this.id === otherBooking.id) return false;

  // Skip if either booking is cancelled
  if (this.status === "cancelled" || otherBooking.status === "cancelled") {
    return false;
  }

  // Different vehicles = no conflict
  if (this.vehicleId !== otherBooking.vehicleId) return false;

  // Use advanced availability check
  const availabilityCheck = checkAdvancedAvailability(
    [otherBooking],
    this.pickupDate,
    this.returnDate,
    this.pickupTime,
    this.returnTime,
    this.id
  );

  return !availabilityCheck.isAvailable;
};

// Define default customer attributes to include (simplified to match your new structure)
Booking.getCustomerAttributes = function () {
  return [
    "id",
    "firstName",
    "lastName",
    "phone",
    "email",
    "dateOfBirth",
    "address", // Single address field
    "country",
    "driverLicenseNumber",
    "passportNumber",
    "passportIssuedAt",
    "cinNumber",
  ];
};

// Define default vehicle attributes to include
Booking.getVehicleAttributes = function () {
  return ["id", "name", "brand", "year", "licensePlate", "price", "mileage"];
};

// Class methods

// Class method for generating booking numbers like BK001, BK002, etc.
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

// UPDATED: Enhanced vehicle availability check with same-day logic
Booking.checkVehicleAvailability = async function (
  vehicleId,
  pickupDate,
  returnDate,
  excludeBookingId = null,
  pickupTime = null,
  returnTime = null
) {
  const whereClause = {
    vehicleId,
    status: ["confirmed", "active"],
  };

  if (excludeBookingId) {
    whereClause.id = { [require("sequelize").Op.ne]: excludeBookingId };
  }

  const existingBookings = await Booking.findAll({
    where: whereClause,
  });

  // If no times provided, use basic date overlap check
  if (!pickupTime || !returnTime) {
    const conflictingBookings = existingBookings.filter((booking) => {
      const bookingStart = new Date(booking.pickupDate);
      const bookingEnd = new Date(booking.returnDate);
      const newStart = new Date(pickupDate);
      const newEnd = new Date(returnDate);

      return !(newEnd < bookingStart || newStart > bookingEnd);
    });

    return conflictingBookings.length === 0;
  }

  // Use advanced availability check with same-day logic
  const availabilityCheck = checkAdvancedAvailability(
    existingBookings,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    excludeBookingId
  );

  return availabilityCheck.isAvailable;
};

// NEW: Get detailed availability info for a vehicle
Booking.getVehicleAvailabilityDetails = async function (
  vehicleId,
  pickupDate,
  returnDate,
  pickupTime = null,
  returnTime = null,
  excludeBookingId = null
) {
  const existingBookings = await Booking.findAll({
    where: {
      vehicleId,
      status: ["confirmed", "active"],
      ...(excludeBookingId && {
        id: { [require("sequelize").Op.ne]: excludeBookingId },
      }),
    },
    include: [
      {
        model: require("./Customer"),
        as: "customer",
        attributes: ["firstName", "lastName"],
      },
    ],
  });

  if (!pickupTime || !returnTime) {
    // Basic availability check
    const conflicts = existingBookings.filter((booking) => {
      const bookingStart = new Date(booking.pickupDate);
      const bookingEnd = new Date(booking.returnDate);
      const newStart = new Date(pickupDate);
      const newEnd = new Date(returnDate);

      return !(newEnd < bookingStart || newStart > bookingEnd);
    });

    return {
      isAvailable: conflicts.length === 0,
      conflictingBookings: conflicts,
      sameDayConflicts: [],
      message:
        conflicts.length === 0
          ? "Vehicle is available for selected dates"
          : `Vehicle has ${conflicts.length} conflicting booking(s)`,
    };
  }

  // Advanced availability check
  const availabilityCheck = checkAdvancedAvailability(
    existingBookings,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    excludeBookingId
  );

  let message = "";
  if (availabilityCheck.isAvailable) {
    message = "Vehicle is available for selected dates and times";
  } else {
    const conflictTypes = [];
    if (availabilityCheck.details.hasDateConflicts) {
      conflictTypes.push(
        `${availabilityCheck.conflictingBookings.length} date conflict(s)`
      );
    }
    if (availabilityCheck.details.hasSameDayConflicts) {
      conflictTypes.push(
        `${availabilityCheck.sameDayConflicts.length} same-day time conflict(s)`
      );
    }
    message = `Vehicle not available: ${conflictTypes.join(", ")}`;
  }

  return {
    ...availabilityCheck,
    message,
  };
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
