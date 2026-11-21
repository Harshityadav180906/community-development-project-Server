const User = require('../models/User');

/**
 * Calculates Great-Circle distance between two points on a sphere (Haversine Formula)
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined
  ) {
    return 9999;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

/**
 * Coordinates lookup for common localities (Bengaluru base coordinates)
 */
const LOCALITY_COORDINATES = {
  indiranagar: { latitude: 12.9784, longitude: 77.6408 },
  koramangala: { latitude: 12.9352, longitude: 77.6245 },
  'hsr layout': { latitude: 12.9121, longitude: 77.6446 },
  whitefield: { latitude: 12.9698, longitude: 77.7500 },
  jayanagar: { latitude: 12.9308, longitude: 77.5838 },
  mgroad: { latitude: 12.9756, longitude: 77.6066 },
  'electronic city': { latitude: 12.8452, longitude: 77.6602 },
  marathahalli: { latitude: 12.9591, longitude: 77.6974 },
  malleshwaram: { latitude: 13.0031, longitude: 77.5643 },
  bellandur: { latitude: 12.926, longitude: 77.6762 },
};

/**
 * Get approximate coordinates for a given locality or address string
 */
const getCoordinatesForLocality = (locality = '') => {
  const normalized = locality.toLowerCase().trim();
  for (const [key, coords] of Object.entries(LOCALITY_COORDINATES)) {
    if (normalized.includes(key)) {
      return coords;
    }
  }
  // Default Bengaluru central coordinates with minor jitter for uniqueness
  const jitterLat = (Math.random() - 0.5) * 0.02;
  const jitterLng = (Math.random() - 0.5) * 0.02;
  return {
    latitude: Number((12.9716 + jitterLat).toFixed(4)),
    longitude: Number((77.5946 + jitterLng).toFixed(4)),
  };
};

/**
 * Automatically find and assign the nearest available delivery partner to a food listing
 * @param {Object} listing FoodListing Mongoose document
 * @returns {Promise<Object|null>} Assigned driver User or null if none available
 */
const findAndAssignNearestDriver = async (listing) => {
  try {
    const pickupLat = listing.pickupCoordinates?.latitude || 12.9716;
    const pickupLng = listing.pickupCoordinates?.longitude || 77.5946;

    // Find all active, available delivery partners
    const drivers = await User.find({
      role: 'delivery',
      isAvailable: true,
    });

    if (!drivers || drivers.length === 0) {
      console.log('[Auto-Assign] No available delivery partners online.');
      listing.driverStatus = 'Unassigned';
      await listing.save();
      return null;
    }

    // Calculate distance to each driver
    const driverDistances = drivers.map((driver) => {
      const driverLat = driver.currentLocation?.latitude || 12.9716;
      const driverLng = driver.currentLocation?.longitude || 77.5946;
      const distance = calculateDistanceKm(pickupLat, pickupLng, driverLat, driverLng);
      return { driver, distance };
    });

    // Sort by nearest distance
    driverDistances.sort((a, b) => a.distance - b.distance);

    const nearest = driverDistances[0];
    const MAX_DELIVERY_RADIUS_KM = 15;
    const isBeyondRadius = nearest.distance > MAX_DELIVERY_RADIUS_KM;

    console.log(
      `[Auto-Assign] Assigned Driver '${nearest.driver.name}' (${nearest.distance} km away) to listing '${listing.title}'. ${
        isBeyondRadius ? 'Out of 15km radius notice active.' : 'Within standard 15km radius.'
      }`
    );

    // Update listing with 15km radius awareness
    listing.assignedDriver = nearest.driver._id;
    listing.driverStatus = 'Assigned';
    listing.driverAssignedAt = new Date();
    listing.isOutOfRadius = isBeyondRadius;
    listing.radiusNotice = isBeyondRadius
      ? `Outside 15 km delivery radius (${nearest.distance} km) — We are coming to your area soon! 🚀`
      : 'Within 15 km active service zone';
    await listing.save();

    // Increment driver's active orders
    nearest.driver.activeOrdersCount = (nearest.driver.activeOrdersCount || 0) + 1;
    await nearest.driver.save();

    return nearest.driver;
  } catch (error) {
    console.error('[Auto-Assign Error]:', error.message);
    return null;
  }
};

module.exports = {
  calculateDistanceKm,
  getCoordinatesForLocality,
  findAndAssignNearestDriver,
  LOCALITY_COORDINATES,
};
