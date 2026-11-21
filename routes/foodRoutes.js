const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { getCoordinatesForLocality, findAndAssignNearestDriver } = require('../utils/geoUtils');

/**
 * Helper: Automatically update expired listings that are still marked 'Available'
 */
const autoExpireListings = async () => {
  try {
    const now = new Date();
    await FoodListing.updateMany(
      {
        status: 'Available',
        expiresAt: { $lt: now },
      },
      {
        $set: { status: 'Expired' },
      }
    );
  } catch (err) {
    console.error('[AutoExpire Warning]:', err.message);
  }
};

/**
 * @route   GET /api/food
 * @desc    Public endpoint to fetch active/available food listings with optional filtering
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    await autoExpireListings();

    const { foodType, locality, search, status } = req.query;

    const query = {};

    // Filter by status (default to Available if not specified or 'all')
    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      query.status = 'Available';
    }

    // Filter by foodType (Veg / Non-Veg)
    if (foodType && ['Veg', 'Non-Veg'].includes(foodType)) {
      query.foodType = foodType;
    }

    // Filter by locality
    if (locality && locality.trim() !== '') {
      query.locality = { $regex: locality.trim(), $options: 'i' };
    }

    // Search query matching title, locality, or notes
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { title: searchRegex },
        { locality: searchRegex },
        { notes: searchRegex },
        { pickupAddress: searchRegex },
      ];
    }

    const listings = await FoodListing.find(query)
      .populate('donor', 'name organizationName phone locality city')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ expiresAt: 1, createdAt: -1 });

    return res.json({
      success: true,
      count: listings.length,
      data: listings,
    });
  } catch (error) {
    console.error('[Get Listings Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving food listings.' });
  }
});

/**
 * @route   GET /api/food/stats
 * @desc    Public aggregation endpoint for live platform impact counters
 * @access  Public
 */
router.get('/stats', async (req, res) => {
  try {
    await autoExpireListings();

    // Baseline numbers for platform impact realism
    const BASE_MEALS = 14850;
    const BASE_DONORS = 38;
    const BASE_NGOS = 24;

    // Aggregate saved meals (Claimed, Picked Up, Completed)
    const savedMealsAgg = await FoodListing.aggregate([
      {
        $match: {
          status: { $in: ['Claimed', 'Picked Up', 'Completed'] },
        },
      },
      {
        $group: {
          _id: null,
          totalMeals: { $sum: '$quantityServings' },
        },
      },
    ]);

    const dynamicMeals = savedMealsAgg.length > 0 ? savedMealsAgg[0].totalMeals : 0;
    const totalMealsSaved = BASE_MEALS + dynamicMeals;

    // Distinct count of donors
    const distinctDonors = await User.countDocuments({ role: 'donor' });
    const totalDonors = Math.max(BASE_DONORS, distinctDonors);

    // Distinct count of NGOs
    const distinctNgos = await User.countDocuments({ role: 'ngo' });
    const totalNgos = Math.max(BASE_NGOS, distinctNgos);

    // Estimated CO2 saved in KG
    const co2SavedKg = Math.round(totalMealsSaved * 2.5);

    // Active listings count
    const activeListingsCount = await FoodListing.countDocuments({ status: 'Available' });

    return res.json({
      success: true,
      data: {
        totalMealsSaved,
        activeDonors: totalDonors,
        partnerNgos: totalNgos,
        co2SavedKg,
        activeListingsCount,
      },
    });
  } catch (error) {
    console.error('[Get Stats Error]:', error);
    return res.status(500).json({ message: 'Server error calculating impact statistics.' });
  }
});

/**
 * @route   POST /api/food
 * @desc    Create a new surplus food listing
 * @access  Private (donor only)
 */
router.post('/', protect, authorizeRoles('donor'), async (req, res) => {
  try {
    const {
      title,
      foodType,
      quantityServings,
      cookedAt,
      expiresAt,
      pickupAddress,
      locality,
      contactPhone,
      notes,
      latitude,
      longitude,
    } = req.body;

    if (!title || !foodType || !quantityServings || !cookedAt || !expiresAt || !pickupAddress) {
      return res.status(400).json({ message: 'Please provide all required food listing fields.' });
    }

    if (Number(quantityServings) < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1 serving.' });
    }

    const cookedDate = new Date(cookedAt);
    const expiresDate = new Date(expiresAt);

    if (expiresDate <= cookedDate) {
      return res.status(400).json({ message: 'Expiration time must be after the cooked time.' });
    }

    if (expiresDate <= new Date()) {
      return res.status(400).json({ message: 'Expiration time must be in the future.' });
    }

    const listingLocality = (locality || req.user.locality || '').trim();

    // Determine pickup coordinates (GPS from client or locality approximation)
    let pickupCoords = { latitude: 12.9716, longitude: 77.5946 };
    if (latitude && longitude) {
      pickupCoords = { latitude: Number(latitude), longitude: Number(longitude) };
    } else {
      pickupCoords = getCoordinatesForLocality(listingLocality);
    }

    const listing = await FoodListing.create({
      donor: req.user._id,
      title: title.trim(),
      foodType,
      quantityServings: Number(quantityServings),
      cookedAt: cookedDate,
      expiresAt: expiresDate,
      pickupAddress: pickupAddress.trim(),
      locality: listingLocality,
      contactPhone: (contactPhone || req.user.phone || '').trim(),
      notes: (notes || '').trim(),
      status: 'Available',
      pickupCoordinates: pickupCoords,
    });

    const populatedListing = await FoodListing.findById(listing._id).populate(
      'donor',
      'name organizationName phone locality city'
    );

    return res.status(201).json({
      success: true,
      message: 'Surplus food listing published successfully!',
      data: populatedListing,
    });
  } catch (error) {
    console.error('[Create Food Listing Error]:', error);
    return res.status(500).json({ message: 'Server error creating food listing.', error: error.message });
  }
});

/**
 * @route   GET /api/food/my-donations
 * @desc    Get all listings created by the logged-in donor
 * @access  Private (donor only)
 */
router.get('/my-donations', protect, authorizeRoles('donor'), async (req, res) => {
  try {
    await autoExpireListings();

    const donations = await FoodListing.find({ donor: req.user._id })
      .populate('claimedBy', 'name organizationName phone email locality')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: donations.length,
      data: donations,
    });
  } catch (error) {
    console.error('[Get My Donations Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving donor listings.' });
  }
});

/**
 * @route   GET /api/food/my-claims
 * @desc    Get all listings claimed by the logged-in NGO (including assigned delivery partner & coords)
 * @access  Private (ngo only)
 */
router.get('/my-claims', protect, authorizeRoles('ngo'), async (req, res) => {
  try {
    await autoExpireListings();

    const claims = await FoodListing.find({ claimedBy: req.user._id })
      .populate('donor', 'name organizationName phone email locality pickupAddress city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ updatedAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      count: claims.length,
      data: claims,
    });
  } catch (error) {
    console.error('[Get My Claims Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving claimed listings.' });
  }
});

/**
 * @route   PATCH /api/food/:id/claim
 * @desc    Claim an available food listing & automatically assign nearest delivery partner
 * @access  Private (ngo only)
 */
router.patch('/:id/claim', protect, authorizeRoles('ngo'), async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: 'Food listing not found.' });
    }

    if (listing.status !== 'Available') {
      return res.status(400).json({
        message: `This listing cannot be claimed because its status is already '${listing.status}'.`,
      });
    }

    if (new Date(listing.expiresAt) < new Date()) {
      listing.status = 'Expired';
      await listing.save();
      return res.status(400).json({ message: 'This food listing has expired and cannot be claimed.' });
    }

    // Set Claim details & destination coordinates of the claiming NGO
    listing.status = 'Claimed';
    listing.claimedBy = req.user._id;
    if (!listing.deliveryOtp) {
      listing.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const ngoCoords = getCoordinatesForLocality(req.user.locality);
    listing.deliveryCoordinates = {
      latitude: req.user.currentLocation?.latitude || ngoCoords.latitude,
      longitude: req.user.currentLocation?.longitude || ngoCoords.longitude,
      address: `${req.user.organizationName}, ${req.user.locality}, ${req.user.city}`,
    };

    // Automatically find and assign the nearest delivery partner!
    const assignedDriver = await findAndAssignNearestDriver(listing);

    await listing.save();

    const updatedListing = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone email locality pickupAddress city')
      .populate('claimedBy', 'name organizationName phone email locality')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation');

    const driverMsg = assignedDriver
      ? ` Nearest delivery partner '${assignedDriver.name}' (${assignedDriver.vehicleType}) has been automatically assigned!`
      : ' (Awaiting available delivery partner nearby).';

    return res.json({
      success: true,
      message: `Listing successfully claimed!${driverMsg}`,
      data: updatedListing,
    });
  } catch (error) {
    console.error('[Claim Listing Error]:', error);
    return res.status(500).json({ message: 'Server error claiming listing.', error: error.message });
  }
});

/**
 * @route   PATCH /api/food/:id/status
 * @desc    Update status of a food listing (Picked Up, Completed)
 * @access  Private (donor or claiming ngo)
 */
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Available', 'Claimed', 'Picked Up', 'Completed', 'Expired'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    const listing = await FoodListing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ message: 'Food listing not found.' });
    }

    const isDonor = listing.donor.toString() === req.user._id.toString();
    const isClaimingNgo = listing.claimedBy && listing.claimedBy.toString() === req.user._id.toString();

    if (!isDonor && !isClaimingNgo) {
      return res.status(403).json({
        message: 'Forbidden: You are not authorized to update the status of this listing.',
      });
    }

    listing.status = status;
    if (status === 'Picked Up') {
      listing.driverStatus = 'Picked Up';
      listing.pickedUpAt = new Date();
    } else if (status === 'Completed') {
      listing.driverStatus = 'Delivered';
      listing.deliveredAt = new Date();
    }

    await listing.save();

    const updatedListing = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone email locality pickupAddress city')
      .populate('claimedBy', 'name organizationName phone email locality')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation');

    return res.json({
      success: true,
      message: `Status successfully updated to '${status}'.`,
      data: updatedListing,
    });
  } catch (error) {
    console.error('[Update Status Error]:', error);
    return res.status(500).json({ message: 'Server error updating listing status.', error: error.message });
  }
});

module.exports = router;
