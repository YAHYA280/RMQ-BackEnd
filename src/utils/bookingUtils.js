// src/utils/bookingUtils.js - REFACTORED: Grace-based lateness rule + sub-day admin bookings

// --- Core Pricing Function (New Lateness Rule) ---

/**
 * Calculate charged days using the 90-minute lateness rule.
 *
 * Rule: Lateness = time beyond whole 24h blocks from startAt (same time-of-day anchor).
 * If lateness >= 90 minutes (1h 30m), charge +1 extra day.
 *
 * @param {string} pickupDate - Date in YYYY-MM-DD format
 * @param {string} returnDate - Date in YYYY-MM-DD format
 * @param {string} pickupTime - Time in HH:MM format
 * @param {string} returnTime - Time in HH:MM format
 * @returns {object} { fullDays, latenessMinutes, chargedDays, durationMinutes }
 */
function calculateChargedDaysWithLatenessRule(
  pickupDate,
  returnDate,
  pickupTime,
  returnTime
) {
  try {
    // Parse dates and times
    const pickupDateTime = new Date(`${pickupDate}T${pickupTime}:00`);
    const returnDateTime = new Date(`${returnDate}T${returnTime}:00`);

    // Total duration in minutes
    const totalMinutes = Math.floor(
      (returnDateTime - pickupDateTime) / (1000 * 60)
    );

    if (totalMinutes < 0) {
      console.error("Return time is before pickup time");
      return {
        fullDays: 0,
        latenessMinutes: 0,
        chargedDays: 0,
        durationMinutes: 0,
      };
    }

    // Calculate full 24-hour blocks
    const fullDays = Math.floor(totalMinutes / 1440); // 1440 = 24 * 60

    // Calculate lateness (remainder beyond full days)
    const latenessMinutes = totalMinutes - fullDays * 1440;

    // Apply lateness rule: >= 90 minutes adds +1 day
    const chargedDays = fullDays + (latenessMinutes >= 90 ? 1 : 0);

    return {
      fullDays,
      latenessMinutes,
      chargedDays: Math.max(1, chargedDays), // Minimum 1 day charged
      durationMinutes: totalMinutes,
    };
  } catch (error) {
    console.error("Error calculating charged days:", error);
    return {
      fullDays: 0,
      latenessMinutes: 0,
      chargedDays: 1,
      durationMinutes: 0,
    };
  }
}

// --- Legacy Function (Website Compatibility) ---

/**
 * LEGACY: Calculate rental days with minimum 1-day enforcement (for website).
 * Kept for backward compatibility with existing website booking flow.
 *
 * @deprecated Use calculateChargedDaysWithLatenessRule for admin bookings
 */
function calculateRentalDaysWithTimeLogic(
  pickupDate,
  returnDate,
  pickupTime,
  returnTime
) {
  const result = calculateChargedDaysWithLatenessRule(
    pickupDate,
    returnDate,
    pickupTime,
    returnTime
  );

  // Website always enforces minimum 1 day
  return Math.max(1, result.chargedDays);
}

// --- Validation Functions ---

/**
 * Validate booking dates and times for WEBSITE bookings.
 * Enforces minimum 1 day rental period.
 */
const validateBookingDates = (
  pickupDate,
  returnDate,
  pickupTime = null,
  returnTime = null
) => {
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (pickup < today) {
    return { isValid: false, error: "Pickup date cannot be in the past" };
  }

  if (returnD < pickup) {
    return {
      isValid: false,
      error: "Return date cannot be before pickup date",
    };
  }

  // For same-day bookings, validate return time is after pickup time
  if (pickupDate === returnDate && pickupTime && returnTime) {
    const [pickupHour, pickupMin] = pickupTime.split(":").map(Number);
    const [returnHour, returnMin] = returnTime.split(":").map(Number);

    const pickupMinutes = pickupHour * 60 + pickupMin;
    const returnMinutes = returnHour * 60 + returnMin;

    if (returnMinutes <= pickupMinutes) {
      return {
        isValid: false,
        error: "For same-day bookings, return time must be after pickup time",
      };
    }
  }

  // Website: Enforce minimum 1 day
  if (pickupTime && returnTime) {
    const result = calculateChargedDaysWithLatenessRule(
      pickupDate,
      returnDate,
      pickupTime,
      returnTime
    );

    if (result.chargedDays < 1) {
      return {
        isValid: false,
        error: "Minimum rental period is 1 day for website bookings",
      };
    }
  }

  return { isValid: true };
};

/**
 * Validate booking dates and times for ADMIN bookings.
 * Allows sub-day durations (minimum 15 minutes configurable).
 */
const validateAdminBookingDates = (
  pickupDate,
  returnDate,
  pickupTime,
  returnTime,
  minDurationMinutes = 15
) => {
  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);

  if (returnD < pickup) {
    return {
      isValid: false,
      error: "Return date cannot be before pickup date",
    };
  }

  if (!pickupTime || !returnTime) {
    return { isValid: false, error: "Pickup and return times are required" };
  }

  // Calculate total duration
  const result = calculateChargedDaysWithLatenessRule(
    pickupDate,
    returnDate,
    pickupTime,
    returnTime
  );

  // Admin: Enforce minimum duration (default 15 minutes)
  if (result.durationMinutes < minDurationMinutes) {
    return {
      isValid: false,
      error: `Minimum rental duration is ${minDurationMinutes} minutes`,
    };
  }

  return { isValid: true, chargedDays: result.chargedDays };
};

// --- Availability Check (Minute Precision) ---

/**
 * Check if a new booking conflicts with existing bookings at minute precision.
 * Handles back-to-back bookings (end == start is allowed).
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

  // Parse new booking times
  const newStart = new Date(`${newPickupDate}T${newPickupTime}:00`);
  const newEnd = new Date(`${newReturnDate}T${newReturnTime}:00`);

  for (const booking of existingBookings) {
    // Skip excluded booking (for updates)
    if (excludeBookingId && booking.id === excludeBookingId) continue;

    // Skip non-active bookings
    if (!["confirmed", "active"].includes(booking.status)) continue;

    // Parse existing booking times
    const existingStart = new Date(
      `${booking.pickupDate}T${booking.pickupTime}:00`
    );
    const existingEnd = new Date(
      `${booking.returnDate}T${booking.returnTime}:00`
    );

    // Check for overlap at minute precision
    // Overlap exists if: newStart < existingEnd AND newEnd > existingStart
    // Back-to-back is OK: newStart == existingEnd OR newEnd == existingStart
    const hasOverlap = newStart < existingEnd && newEnd > existingStart;

    if (hasOverlap) {
      // Check if it's a same-day edge case
      if (
        newPickupDate === booking.returnDate &&
        newPickupTime === booking.returnTime
      ) {
        // Back-to-back: new starts exactly when existing ends (allowed)
        continue;
      }

      if (
        newReturnDate === booking.pickupDate &&
        newReturnTime === booking.pickupTime
      ) {
        // Back-to-back: new ends exactly when existing starts (allowed)
        continue;
      }

      conflictingBookings.push(booking);
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

// --- Display Helpers ---

/**
 * Get lateness information for display purposes.
 */
const getLatenessInfo = (pickupTime, returnTime, fullDays) => {
  if (!pickupTime || !returnTime) {
    return null;
  }

  const [pickupHour, pickupMin] = pickupTime.split(":").map(Number);
  const [returnHour, returnMin] = returnTime.split(":").map(Number);

  const pickupMinutes = pickupHour * 60 + pickupMin;
  const returnMinutes = returnHour * 60 + returnMin;

  const latenessMinutes = returnMinutes - pickupMinutes;
  const gracePeriodMinutes = 90;

  if (latenessMinutes >= gracePeriodMinutes) {
    const hours = Math.floor(latenessMinutes / 60);
    const minutes = latenessMinutes % 60;

    return {
      hasLateFee: true,
      latenessMinutes,
      hours,
      minutes,
      message: `Return time exceeds ${gracePeriodMinutes}-minute grace period by ${hours}h ${minutes}m (+1 day fee applied)`,
    };
  }

  return {
    hasLateFee: false,
    latenessMinutes,
    message: `Within ${gracePeriodMinutes}-minute grace period (no extra fee)`,
  };
};

// --- Legacy Compatibility (kept for old code) ---

/**
 * @deprecated Use calculateChargedDaysWithLatenessRule instead
 */
const getTimeExcessInfo = (pickupTime, returnTime) => {
  console.warn("getTimeExcessInfo is deprecated, use getLatenessInfo");
  return getLatenessInfo(pickupTime, returnTime, 0);
};

/**
 * @deprecated Use validateAdminBookingDates instead
 */
const validateSameDayBooking = (
  existingEndDate,
  existingEndTime,
  newStartDate,
  newStartTime
) => {
  if (existingEndDate !== newStartDate) {
    return { isValid: true };
  }

  const existingEnd = new Date(`${existingEndDate}T${existingEndTime}:00`);
  const newStart = new Date(`${newStartDate}T${newStartTime}:00`);

  if (newStart <= existingEnd) {
    return {
      isValid: false,
      error: `New booking must start after ${existingEndTime} on ${existingEndDate}`,
      conflictType: "same_day_time_conflict",
    };
  }

  return { isValid: true };
};

module.exports = {
  // --- New Primary Functions ---
  calculateChargedDaysWithLatenessRule,
  validateAdminBookingDates,
  getLatenessInfo,

  // --- Website Compatibility (Legacy) ---
  calculateRentalDaysWithTimeLogic,
  validateBookingDates,

  // --- Availability ---
  checkAdvancedAvailability,

  // --- Deprecated (Backward Compatibility) ---
  getTimeExcessInfo,
  validateSameDayBooking,
};
