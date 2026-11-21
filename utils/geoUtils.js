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
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
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
 * Comprehensive coordinates lookup for popular cities and neighborhoods across India
 */
const LOCALITY_COORDINATES = {
  // Delhi NCR
  delhi: { latitude: 28.6139, longitude: 77.2090 },
  'new delhi': { latitude: 28.6139, longitude: 77.2090 },
  'connaught place': { latitude: 28.6315, longitude: 77.2167 },
  'lajpat nagar': { latitude: 28.5677, longitude: 77.2433 },
  'south extension': { latitude: 28.5683, longitude: 77.2185 },
  noida: { latitude: 28.5355, longitude: 77.3910 },
  gurgaon: { latitude: 28.4595, longitude: 77.0266 },
  gurugram: { latitude: 28.4595, longitude: 77.0266 },
  dwarka: { latitude: 28.5921, longitude: 77.0460 },
  rohini: { latitude: 28.7495, longitude: 77.0736 },
  'karol bagh': { latitude: 28.6514, longitude: 77.1907 },
  saket: { latitude: 28.5244, longitude: 77.2167 },

  // Mumbai & MMR
  mumbai: { latitude: 19.0760, longitude: 72.8777 },
  bandra: { latitude: 19.0596, longitude: 72.8295 },
  andheri: { latitude: 19.1136, longitude: 72.8697 },
  juhu: { latitude: 19.0988, longitude: 72.8264 },
  colaba: { latitude: 18.9067, longitude: 72.8147 },
  dadar: { latitude: 19.0178, longitude: 72.8478 },
  thane: { latitude: 19.2183, longitude: 72.9781 },
  'navi mumbai': { latitude: 19.0330, longitude: 73.0297 },
  powai: { latitude: 19.1176, longitude: 72.9060 },
  borivali: { latitude: 19.2288, longitude: 72.8541 },

  // Bengaluru
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  indiranagar: { latitude: 12.9784, longitude: 77.6408 },
  koramangala: { latitude: 12.9352, longitude: 77.6245 },
  'hsr layout': { latitude: 12.9121, longitude: 77.6446 },
  whitefield: { latitude: 12.9698, longitude: 77.7500 },
  jayanagar: { latitude: 12.9308, longitude: 77.5838 },
  mgroad: { latitude: 12.9756, longitude: 77.6066 },
  'electronic city': { latitude: 12.8452, longitude: 77.6602 },
  marathahalli: { latitude: 12.9591, longitude: 77.6974 },
  malleshwaram: { latitude: 13.0031, longitude: 77.5643 },
  bellandur: { latitude: 12.9260, longitude: 77.6762 },

  // Lucknow & UP
  lucknow: { latitude: 26.8467, longitude: 80.9462 },
  hazratganj: { latitude: 26.8530, longitude: 80.9468 },
  'gomti nagar': { latitude: 26.8504, longitude: 80.9992 },
  aliganj: { latitude: 26.8864, longitude: 80.9427 },
  'indira nagar': { latitude: 26.8804, longitude: 80.9832 },
  kanpur: { latitude: 26.4499, longitude: 80.3319 },
  varanasi: { latitude: 25.3176, longitude: 82.9739 },
  agra: { latitude: 27.1767, longitude: 78.0081 },
  noida: { latitude: 28.5355, longitude: 77.3910 },

  // Kolkata
  kolkata: { latitude: 22.5726, longitude: 88.3639 },
  'park street': { latitude: 22.5535, longitude: 88.3524 },
  'salt lake': { latitude: 22.5867, longitude: 88.4178 },
  'new town': { latitude: 22.5898, longitude: 88.4746 },
  howrah: { latitude: 22.5958, longitude: 88.2636 },

  // Hyderabad
  hyderabad: { latitude: 17.3850, longitude: 78.4867 },
  'banjara hills': { latitude: 17.4156, longitude: 78.4354 },
  'jubilee hills': { latitude: 17.4319, longitude: 78.4073 },
  'hitec city': { latitude: 17.4474, longitude: 78.3762 },
  gachibowli: { latitude: 17.4401, longitude: 78.3489 },
  secunderabad: { latitude: 17.4399, longitude: 78.4983 },

  // Chennai
  chennai: { latitude: 13.0827, longitude: 80.2707 },
  't nagar': { latitude: 13.0418, longitude: 80.2341 },
  'anna nagar': { latitude: 13.0850, longitude: 80.2101 },
  adyar: { latitude: 13.0012, longitude: 80.2565 },
  velachery: { latitude: 12.9815, longitude: 80.2180 },

  // Pune
  pune: { latitude: 18.5204, longitude: 73.8567 },
  kothrud: { latitude: 18.5074, longitude: 73.8077 },
  'viman nagar': { latitude: 18.5679, longitude: 73.9143 },
  hinjewadi: { latitude: 18.5913, longitude: 73.7389 },
  'shivaji nagar': { latitude: 18.5314, longitude: 73.8446 },

  // Jaipur & Rajasthan
  jaipur: { latitude: 26.9124, longitude: 75.7873 },
  'malviya nagar': { latitude: 26.8549, longitude: 75.8243 },
  mansarovar: { latitude: 26.8617, longitude: 75.7671 },

  // Other Major Metros
  ahmedabad: { latitude: 23.0225, longitude: 72.5714 },
  chandigarh: { latitude: 30.7333, longitude: 76.7794 },
  patna: { latitude: 25.5941, longitude: 85.1376 },
  bhopal: { latitude: 23.2599, longitude: 77.4126 },
  indore: { latitude: 22.7196, longitude: 75.8577 },
  kochi: { latitude: 9.9312, longitude: 76.2673 },
};

/**
 * Get approximate coordinates for a given locality or address string
 * Searches against major cities and locality landmarks nationwide
 */
const getCoordinatesForLocality = (locality = '', city = '') => {
  const combined = `${locality} ${city}`.toLowerCase().trim();

  for (const [key, coords] of Object.entries(LOCALITY_COORDINATES)) {
    if (combined.includes(key)) {
      const jitterLat = (Math.random() - 0.5) * 0.008;
      const jitterLng = (Math.random() - 0.5) * 0.008;
      return {
        latitude: Number((coords.latitude + jitterLat).toFixed(4)),
        longitude: Number((coords.longitude + jitterLng).toFixed(4)),
      };
    }
  }

  // If no match found, return null so client GPS or Map search coordinates are respected
  return null;
};

/**
 * Automatically find and assign the nearest available delivery partner to a food listing
 * @param {Object} listing FoodListing Mongoose document
 * @returns {Promise<Object|null>} Assigned driver User or null if none available
 */
const findAndAssignNearestDriver = async (listing) => {
  try {
    const pickupLat = listing.pickupCoordinates?.latitude;
    const pickupLng = listing.pickupCoordinates?.longitude;

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
      const driverLat = driver.currentLocation?.latitude;
      const driverLng = driver.currentLocation?.longitude;

      // If either location has no coordinates, assign high distance
      const distance = (pickupLat && pickupLng && driverLat && driverLng)
        ? calculateDistanceKm(pickupLat, pickupLng, driverLat, driverLng)
        : 9999;

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
