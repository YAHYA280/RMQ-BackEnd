// src/controllers/bookings/bookingWorkflow.js - REFACTORED: Update to use charged days calculation
const { Booking, Customer, Vehicle, Admin } = require("../../models");
const asyncHandler = require("../../middleware/asyncHandler");
const ErrorResponse = require("../../utils/errorResponse");
const ContractGenerator = require("../../services/contractGenerator");

// @desc    Confirm booking
// @route   PUT /api/bookings/:id/confirm
// @access  Private (admin)
exports.confirmBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id, {
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: [
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
        ],
      },
      {
        model: Vehicle,
        as: "vehicle",
        attributes: [
          "id",
          "name",
          "brand",
          "year",
          "licensePlate",
          "price",
          "mileage",
        ],
      },
      {
        model: Admin,
        as: "confirmedBy",
        attributes: ["id", "name", "email"],
      },
    ],
  });

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "pending") {
    return next(
      new ErrorResponse("Only pending bookings can be confirmed", 400)
    );
  }

  // --- Availability Check ---
  const isAvailable = await Booking.checkVehicleAvailability(
    booking.vehicleId,
    booking.pickupDate,
    booking.returnDate,
    booking.id,
    booking.pickupTime,
    booking.returnTime
  );

  if (!isAvailable) {
    return next(
      new ErrorResponse(
        "Vehicle is no longer available for the selected dates",
        400
      )
    );
  }

  // --- Update Status ---
  await booking.update({
    status: "confirmed",
    confirmedById: req.admin.id,
    confirmedAt: new Date(),
  });

  // --- Update Stats ---
  const customer = await Customer.findByPk(booking.customerId);
  const vehicle = await Vehicle.findByPk(booking.vehicleId);

  await customer.incrementBookings(booking.totalAmount);
  await vehicle.incrementBookings();

  // Make vehicle unavailable if booking starts today or in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pickupDate = new Date(booking.pickupDate);
  pickupDate.setHours(0, 0, 0, 0);

  if (pickupDate <= today) {
    await vehicle.update({ available: false });
    console.log(
      "Vehicle marked as unavailable because booking starts today or earlier"
    );
  } else {
    console.log(
      "Vehicle remains available because booking starts in the future"
    );
  }

  // --- Generate Contract ---
  try {
    const contractGenerator = new ContractGenerator();
    const contractBuffer = await contractGenerator.generateContract(booking);

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
      contractReady: true,
      contractDownloadUrl: `/api/bookings/${booking.id}/contract`,
    });
  } catch (contractError) {
    console.error("Contract generation error:", contractError);
    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully (contract generation failed)",
      data: booking,
      contractReady: false,
    });
  }
});

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private (admin)
exports.cancelBooking = asyncHandler(async (req, res, next) => {
  const { cancellationReason } = req.body;
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (!booking.canBeCancelled()) {
    return next(new ErrorResponse("This booking cannot be cancelled", 400));
  }

  await booking.update({
    status: "cancelled",
    cancelledById: req.admin.id,
    cancelledAt: new Date(),
    cancellationReason: cancellationReason || "Cancelled by admin",
  });

  // Make vehicle available again
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });

  res.status(200).json({
    success: true,
    message: "Booking cancelled successfully",
    data: booking,
  });
});

// @desc    Mark booking as active (vehicle picked up)
// @route   PUT /api/bookings/:id/pickup
// @access  Private (admin)
exports.pickupVehicle = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "confirmed") {
    return next(
      new ErrorResponse("Only confirmed bookings can be picked up", 400)
    );
  }

  await booking.update({
    status: "active",
  });

  // Make vehicle unavailable
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: false });

  res.status(200).json({
    success: true,
    message: "Booking marked as active (vehicle picked up)",
    data: booking,
  });
});

// @desc    Complete booking (vehicle returned)
// @route   PUT /api/bookings/:id/return
// @access  Private (admin)
exports.returnVehicle = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findByPk(req.params.id, {
    include: [
      {
        model: Vehicle,
        as: "vehicle",
        attributes: ["id", "name", "brand", "price"],
      },
    ],
  });

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "active") {
    return next(
      new ErrorResponse("Only active bookings can be completed", 400)
    );
  }

  // --- Calculate Final Charges (if late return) ---
  const now = new Date();
  const scheduledReturn = new Date(
    `${booking.returnDate}T${booking.returnTime}:00`
  );

  let finalChargedDays = booking.totalDays;
  let lateReturnFee = 0;
  let wasLateReturn = false;

  // Check if returned late
  if (now > scheduledReturn) {
    const actualReturnDate = now.toISOString().split("T")[0];
    const actualReturnTime = `${String(now.getHours()).padStart(
      2,
      "0"
    )}:${String(now.getMinutes()).padStart(2, "0")}`;

    const pricing = booking.calculateChargedDays();
    const {
      calculateChargedDaysWithLatenessRule,
    } = require("../../utils/bookingUtils");

    const actualPricing = calculateChargedDaysWithLatenessRule(
      booking.pickupDate,
      actualReturnDate,
      booking.pickupTime,
      actualReturnTime
    );

    if (actualPricing.chargedDays > booking.totalDays) {
      finalChargedDays = actualPricing.chargedDays;
      lateReturnFee =
        (finalChargedDays - booking.totalDays) *
        parseFloat(booking.vehicle.price);
      wasLateReturn = true;

      console.log("Late return detected:", {
        scheduled: scheduledReturn,
        actual: now,
        originalChargedDays: booking.totalDays,
        finalChargedDays: finalChargedDays,
        lateReturnFee: lateReturnFee,
      });
    }
  }

  // --- Complete Booking ---
  await booking.update({
    status: "completed",
    totalDays: finalChargedDays,
    totalAmount: parseFloat(booking.dailyRate) * finalChargedDays,
  });

  // Always make vehicle available again when booking is completed
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });
  console.log("Vehicle marked as available because booking is completed");

  res.status(200).json({
    success: true,
    message: wasLateReturn
      ? "Booking completed successfully with late return fee applied"
      : "Booking completed successfully",
    data: booking,
    lateReturnInfo: wasLateReturn
      ? {
          wasLate: true,
          originalChargedDays:
            booking.totalDays - (finalChargedDays - booking.totalDays),
          finalChargedDays: finalChargedDays,
          lateReturnFee: lateReturnFee,
          originalAmount:
            parseFloat(booking.dailyRate) *
            (booking.totalDays - (finalChargedDays - booking.totalDays)),
          finalAmount: booking.totalAmount,
        }
      : {
          wasLate: false,
        },
  });
});
