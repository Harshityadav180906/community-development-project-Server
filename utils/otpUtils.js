const FoodListing = require('../models/FoodListing');

/**
 * Generates a unique 4-digit numeric OTP (1000 - 9999) that does not collide
 * with any other active food order in the database.
 * @param {string} [excludeListingId] - Optional listing ID to exclude during collision checks
 * @returns {Promise<string>} 4-digit OTP string
 */
const generateUniqueOtp = async (excludeListingId = null) => {
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const candidate = Math.floor(1000 + Math.random() * 9000).toString();

    const query = {
      deliveryOtp: candidate,
      status: { $in: ['Available', 'Claimed', 'Picked Up'] },
    };

    if (excludeListingId) {
      query._id = { $ne: excludeListingId };
    }

    const collision = await FoodListing.findOne(query);
    if (!collision) {
      return candidate;
    }
    attempts++;
  }

  // Fallback random if max attempts reached
  return Math.floor(1000 + Math.random() * 9000).toString();
};

module.exports = {
  generateUniqueOtp,
};
