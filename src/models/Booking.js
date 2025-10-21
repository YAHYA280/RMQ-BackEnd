// src/models/Booking.js - REFACTORED: Support sub-day durations + lateness rule
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  calculateChargedDaysWithLatenessRule,
  getLatenessInfo,
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
    // --- Date and Time ---
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
          if (value < this.pickupDate) {
            throw new Error("Return date cannot be before pickup date");
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
    // --- Location ---
    pickupLocation: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    returnLocation: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    // --- Pricing ---
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
        min: 1, // Charged days (always >= 1)
      },
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    // --- Status ---
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
    // --- Admin Tracking ---
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
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
        // Recalculate totals if relevant fields changed
        if (
          booking.changed("dailyRate") ||
          booking.changed("pickupDate") ||
          booking.changed("returnDate") ||
          booking.changed("pickupTime") ||
          booking.changed("returnTime")
        ) {
          const pricing = booking.calculateChargedDays();
          booking.totalDays = pricing.chargedDays;
          booking.totalAmount =
            parseFloat(booking.dailyRate) * pricing.chargedDays;
        }

        // Set timestamps
        if (
          booking.changed("status") &&
          booking.status === "confirmed" &&
          !booking.confirmedAt
        ) {
          booking.confirmedAt = new Date();
        }

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

// --- Instance Methods ---

// Calculate charged days using lateness rule
Booking.prototype.calculateChargedDays = function () {
  if (
    !this.pickupDate ||
    !this.returnDate ||
    !this.pickupTime ||
    !this.returnTime
  ) {
    return {
      chargedDays: 1,
      fullDays: 0,
      latenessMinutes: 0,
      durationMinutes: 0,
    };
  }

  return calculateChargedDaysWithLatenessRule(
    this.pickupDate,
    this.returnDate,
    this.pickupTime,
    this.returnTime
  );
};

// Get lateness info for display
Booking.prototype.getLatenessInfo = function () {
  if (!this.pickupTime || !this.returnTime) return null;

  const pricing = this.calculateChargedDays();
  return getLatenessInfo(this.pickupTime, this.returnTime, pricing.fullDays);
};

// Check if booking is overdue
Booking.prototype.isOverdue = function () {
  if (this.status !== "active") return false;
  const today = new Date();
  const returnDate = new Date(this.returnDate);
  return today > returnDate;
};

// Check if booking can be cancelled
Booking.prototype.canBeCancelled = function () {
  const allowedStatuses = ["pending", "confirmed"];
  return allowedStatuses.includes(this.status);
};

// Check if lateness fee was applied
Booking.prototype.hasLatenessFee = function () {
  const pricing = this.calculateChargedDays();
  return pricing.latenessMinutes >= 90;
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

// Check if this booking conflicts with another
Booking.prototype.conflictsWith = function (otherBooking) {
  if (this.id === otherBooking.id) return false;
  if (this.status === "cancelled" || otherBooking.status === "cancelled") {
    return false;
  }
  if (this.vehicleId !== otherBooking.vehicleId) return false;

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

// Get customer attributes helper
Booking.getCustomerAttributes = function () {
  return [
    "id",
    "firstName",
    "lastName",
    "phone",
    "email",
    "dateOfBirth",
    "address",
    "country",
    "driverLicenseNumber",
    "passportNumber",
    "passportIssuedAt",
    "cinNumber",
  ];
};

// Get vehicle attributes helper
Booking.getVehicleAttributes = function () {
  return ["id", "name", "brand", "year", "licensePlate", "price", "mileage"];
};

// --- Class Methods ---

// Generate booking number
Booking.generateBookingNumber = async function () {
  let bookingNumber;
  let isUnique = false;
  let counter = 1;

  const lastBooking = await Booking.findOne({
    where: {
      bookingNumber: {
        [require("sequelize").Op.like]: "BK%",
      },
    },
    order: [["bookingNumber", "DESC"]],
  });

  if (lastBooking && lastBooking.bookingNumber) {
    const lastNumber = lastBooking.bookingNumber.match(/BK(\d+)/);
    if (lastNumber) {
      counter = parseInt(lastNumber[1]) + 1;
    }
  }

  while (!isUnique) {
    bookingNumber = `BK${String(counter).padStart(3, "0")}`;

    const existingBooking = await Booking.findOne({
      where: { bookingNumber },
    });

    if (!existingBooking) {
      isUnique = true;
    } else {
      counter++;
    }

    if (counter > 999999) {
      throw new Error("Unable to generate unique booking number");
    }
  }

  return bookingNumber;
};

// --- Availability Check (Minute Precision) ---
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

  if (!pickupTime || !returnTime) {
    // Basic date overlap check (legacy)
    const conflictingBookings = existingBookings.filter((booking) => {
      const bookingStart = new Date(booking.pickupDate);
      const bookingEnd = new Date(booking.returnDate);
      const newStart = new Date(pickupDate);
      const newEnd = new Date(returnDate);

      return !(newEnd < bookingStart || newStart > bookingEnd);
    });

    return conflictingBookings.length === 0;
  }

  // Advanced availability check with minute precision
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

// Get detailed availability info
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

// Get booking stats
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
