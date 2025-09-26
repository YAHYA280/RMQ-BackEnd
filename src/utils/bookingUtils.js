// src/utils/bookingUtils.js - UPDATED: Minimum 2 days + same-day logic
/**
 * Calculate rental days with time logic (MINIMUM 2 DAYS)
 * @param {string} pickupDate - Date in YYYY-MM-DD format
 * @param {string} returnDate - Date in YYYY-MM-DD format
 * @param {string} pickupTime - Time in HH:MM format
 * @param {string} returnTime - Time in HH:MM format
 * @returns {number} Number of rental days (minimum 2)
 */
const calculateRentalDaysWithTimeLogic = (
  pickupDate,
  returnDate,
  pickupTime,
  returnTime
) => {
  try {
    // Calculate basic day difference
    const pickupDateObj = new Date(pickupDate);
    const returnDateObj = new Date(returnDate);
    const basicDays = Math.ceil(
      (returnDateObj.getTime() - pickupDateObj.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Convert times to minutes for easier comparison
    const [pickupHour, pickupMin] = pickupTime.split(":").map(Number);
    const [returnHour, returnMin] = returnTime.split(":").map(Number);

    const pickupMinutes = pickupHour * 60 + pickupMin;
    const returnMinutes = returnHour * 60 + returnMin;

    // Your logic: if return time is more than 1 hour after pickup time, add 1 day
    const timeDifference = returnMinutes - pickupMinutes;
    const oneHourInMinutes = 60;

    let rentalDays = basicDays;

    // If return time exceeds pickup time by more than 1 hour, add extra day
    if (timeDifference > oneHourInMinutes) {
      rentalDays += 1;
    }

    // UPDATED: Minimum 2 days instead of 1
    return Math.max(2, rentalDays);
  } catch (error) {
    console.error("Error calculating rental days:", error);
    // Fallback to basic calculation with minimum 2 days
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(2, diffDays); // UPDATED: Minimum 2 days
  }
};

/**
 * Get time difference info for display
 * @param {string} pickupTime - Time in HH:MM format
 * @param {string} returnTime - Time in HH:MM format
 * @returns {object} Time excess information
 */
const getTimeExcessInfo = (pickupTime, returnTime) => {
  if (!pickupTime || !returnTime) {
    return null;
  }

  const [pickupHour, pickupMin] = pickupTime.split(":").map(Number);
  const [returnHour, returnMin] = returnTime.split(":").map(Number);

  const pickupMinutes = pickupHour * 60 + pickupMin;
  const returnMinutes = returnHour * 60 + returnMin;

  const timeDifference = returnMinutes - pickupMinutes;
  const oneHourInMinutes = 60;

  if (timeDifference > oneHourInMinutes) {
    const excessMinutes = timeDifference - oneHourInMinutes;
    const excessHours = Math.floor(excessMinutes / 60);
    const remainingMinutes = excessMinutes % 60;

    return {
      hasExcess: true,
      excessHours,
      excessMinutes: remainingMinutes,
      totalExcessMinutes: excessMinutes,
      message: `Return time exceeds pickup time by ${excessHours}h ${remainingMinutes}m (1 day grace period exceeded)`,
    };
  }

  return {
    hasExcess: false,
    message: "Within 1-hour grace period",
  };
};

/**
 * Validate booking dates (UPDATED: minimum 2 days)
 * @param {string} pickupDate
 * @param {string} returnDate
 * @returns {object}
 */
const validateBookingDates = (pickupDate, returnDate) => {
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (pickup < today) {
    return { isValid: false, error: "Pickup date cannot be in the past" };
  }

  if (returnD <= pickup) {
    return { isValid: false, error: "Return date must be after pickup date" };
  }

  // UPDATED: Check minimum 2 days
  const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 2) {
    return {
      isValid: false,
      error: "Minimum rental period is 2 days",
    };
  }

  return { isValid: true };
};

/**
 * NEW: Check if a new booking can start on the same day as another booking ends
 * @param {string} existingEndDate - End date of existing booking (YYYY-MM-DD)
 * @param {string} existingEndTime - End time of existing booking (HH:MM)
 * @param {string} newStartDate - Start date of new booking (YYYY-MM-DD)
 * @param {string} newStartTime - Start time of new booking (HH:MM)
 * @returns {object} Validation result
 */
const validateSameDayBooking = (
  existingEndDate,
  existingEndTime,
  newStartDate,
  newStartTime
) => {
  // If not the same date, no conflict
  if (existingEndDate !== newStartDate) {
    return { isValid: true };
  }

  // Same date: check if new start time > existing end time
  const [existingHour, existingMin] = existingEndTime.split(":").map(Number);
  const [newHour, newMin] = newStartTime.split(":").map(Number);

  const existingEndMinutes = existingHour * 60 + existingMin;
  const newStartMinutes = newHour * 60 + newMin;

  if (newStartMinutes <= existingEndMinutes) {
    return {
      isValid: false,
      error: `New booking must start after ${existingEndTime} on ${existingEndDate}`,
      conflictType: "same_day_time_conflict",
    };
  }

  return {
    isValid: true,
    message: `Same-day booking allowed (starts at ${newStartTime}, after ${existingEndTime})`,
  };
};

/**
 * NEW: Advanced availability check considering same-day bookings
 * @param {Array} existingBookings - Array of existing bookings
 * @param {string} newPickupDate - New booking pickup date
 * @param {string} newReturnDate - New booking return date
 * @param {string} newPickupTime - New booking pickup time
 * @param {string} newReturnTime - New booking return time
 * @param {string} excludeBookingId - Booking ID to exclude (for updates)
 * @returns {object} Detailed availability result
 */
const checkAdvancedAvailability = (
  existingBookings,
  newPickupDate,
  newReturnDate,
  newPickupTime,
  newReturnTime,
  excludeBookingId = null
) => {
  const conflictingBookings = [];
  const sameDayConflicts = [];

  for (const booking of existingBookings) {
    // Skip if it's the same booking (for updates)
    if (excludeBookingId && booking.id === excludeBookingId) continue;

    // Skip non-active bookings
    if (!["confirmed", "active"].includes(booking.status)) continue;

    // Check for date range overlaps
    const bookingStart = new Date(booking.pickupDate);
    const bookingEnd = new Date(booking.returnDate);
    const newStart = new Date(newPickupDate);
    const newEnd = new Date(newReturnDate);

    // Standard date overlap check
    const hasDateOverlap = !(newEnd < bookingStart || newStart > bookingEnd);

    if (hasDateOverlap) {
      // Check if it's a same-day scenario that might be allowed
      if (newPickupDate === booking.returnDate) {
        // New booking starts on same day existing booking ends
        const sameDayCheck = validateSameDayBooking(
          booking.returnDate,
          booking.returnTime,
          newPickupDate,
          newPickupTime
        );

        if (!sameDayCheck.isValid) {
          sameDayConflicts.push({
            booking,
            reason: sameDayCheck.error,
            type: "same_day_start",
          });
        }
      } else if (newReturnDate === booking.pickupDate) {
        // New booking ends on same day existing booking starts
        const sameDayCheck = validateSameDayBooking(
          newReturnDate,
          newReturnTime,
          booking.pickupDate,
          booking.pickupTime
        );

        if (!sameDayCheck.isValid) {
          sameDayConflicts.push({
            booking,
            reason: sameDayCheck.error,
            type: "same_day_end",
          });
        }
      } else {
        // Real date overlap
        conflictingBookings.push(booking);
      }
    }
  }

  const totalConflicts = conflictingBookings.length + sameDayConflicts.length;

  return {
    isAvailable: totalConflicts === 0,
    conflictingBookings,
    sameDayConflicts,
    totalConflicts,
    details: {
      hasDateConflicts: conflictingBookings.length > 0,
      hasSameDayConflicts: sameDayConflicts.length > 0,
    },
  };
};

module.exports = {
  calculateRentalDaysWithTimeLogic,
  getTimeExcessInfo,
  validateBookingDates,
  validateSameDayBooking,
  checkAdvancedAvailability,
};
