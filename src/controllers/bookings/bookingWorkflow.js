// src/controllers/bookings/bookingWorkflow.js - PART 3: Booking Workflow Functions
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
          "city",
          "country",
          "driverLicenseNumber",
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

  // Verify vehicle is still available for these dates
  const isAvailable = await Booking.checkVehicleAvailability(
    booking.vehicleId,
    booking.pickupDate,
    booking.returnDate,
    booking.id // Exclude current booking from check
  );

  if (!isAvailable) {
    return next(
      new ErrorResponse(
        "Vehicle is no longer available for the selected dates",
        400
      )
    );
  }

  // Update booking status
  await booking.update({
    status: "confirmed",
    confirmedById: req.admin.id,
    confirmedAt: new Date(),
  });

  // Update customer and vehicle stats
  const customer = await Customer.findByPk(booking.customerId);
  const vehicle = await Vehicle.findByPk(booking.vehicleId);

  await customer.incrementBookings(booking.totalAmount);
  await vehicle.incrementBookings();

  // Only make vehicle unavailable if booking starts today or in the past
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

  // Generate contract automatically
  try {
    const contractGenerator = new ContractGenerator();
    const contractBuffer = await contractGenerator.generateContract(booking);

    // You can save the contract or send it via email here
    // For now, we'll just include a flag that contract is ready

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
      contractReady: true,
      contractDownloadUrl: `/api/bookings/${booking.id}/contract`,
    });
  } catch (contractError) {
    console.error("Contract generation error:", contractError);
    // Still return success for booking confirmation even if contract fails
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
  const booking = await Booking.findByPk(req.params.id);

  if (!booking) {
    return next(new ErrorResponse("Booking not found", 404));
  }

  if (booking.status !== "active") {
    return next(
      new ErrorResponse("Only active bookings can be completed", 400)
    );
  }

  await booking.update({
    status: "completed",
  });

  // Always make vehicle available again when booking is completed
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  await vehicle.update({ available: true });
  console.log("Vehicle marked as available because booking is completed");

  res.status(200).json({
    success: true,
    message: "Booking completed successfully",
    data: booking,
  });
});
