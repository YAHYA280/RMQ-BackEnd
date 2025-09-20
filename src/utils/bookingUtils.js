// src/utils/bookingUtils.js - NEW FILE
/**
 * Calculate rental days with time logic
 * @param {string} pickupDate - Date in YYYY-MM-DD format
 * @param {string} returnDate - Date in YYYY-MM-DD format
 * @param {string} pickupTime - Time in HH:MM format
 * @param {string} returnTime - Time in HH:MM format
 * @returns {number} Number of rental days
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

    return Math.max(1, rentalDays);
  } catch (error) {
    console.error("Error calculating rental days:", error);
    // Fallback to basic calculation
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    const diffTime = Math.abs(returnD.getTime() - pickup.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
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
 * Validate booking dates
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

  return { isValid: true };
};

module.exports = {
  calculateRentalDaysWithTimeLogic,
  getTimeExcessInfo,
  validateBookingDates,
};
