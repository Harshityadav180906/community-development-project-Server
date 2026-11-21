const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');
const { findAndAssignNearestDriver } = require('../utils/geoUtils');

/**
 * @route   GET /api/delivery/me/assigned
 * @desc    Get active rescue missions assigned to this delivery partner
 * @access  Private (delivery only)
 */
router.get('/me/assigned', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const activeMissions = await FoodListing.find({
      assignedDriver: req.user._id,
      driverStatus: { $in: ['Assigned', 'Heading to Pickup', 'Picked Up'] },
    })
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation')
      .sort({ updatedAt: -1 });

    return res.json({
      success: true,
      count: activeMissions.length,
      data: activeMissions,
    });
  } catch (error) {
    console.error('[Delivery Assigned Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving assigned missions.' });
  }
});

/**
 * @route   GET /api/delivery/me/history
 * @desc    Get completed delivery history for this delivery partner
 * @access  Private (delivery only)
 */
router.get('/me/history', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const history = await FoodListing.find({
      assignedDriver: req.user._id,
      driverStatus: 'Delivered',
    })
      .populate('donor', 'name organizationName phone locality city')
      .populate('claimedBy', 'name organizationName phone locality city')
      .sort({ deliveredAt: -1, updatedAt: -1 });

    return res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error('[Delivery History Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving delivery history.' });
  }
});

/**
 * @route   PATCH /api/delivery/me/location
 * @desc    Update delivery partner's real-time GPS coordinates
 * @access  Private (delivery only)
 */
router.patch('/me/location', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Latitude and longitude coordinates are required.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          'currentLocation.latitude': Number(latitude),
          'currentLocation.longitude': Number(longitude),
          'currentLocation.address': address || req.user.currentLocation?.address || '',
          'currentLocation.updatedAt': new Date(),
        },
      },
      { new: true }
    ).select('-password');

    return res.json({
      success: true,
      message: 'Live GPS location updated.',
      location: updatedUser.currentLocation,
    });
  } catch (error) {
    console.error('[Update Location Error]:', error);
    return res.status(500).json({ message: 'Server error updating GPS location.' });
  }
});

/**
 * @route   PATCH /api/delivery/me/availability
 * @desc    Toggle delivery partner's online availability status
 * @access  Private (delivery only)
 */
router.patch('/me/availability', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { isAvailable: Boolean(isAvailable) },
      },
      { new: true }
    ).select('-password');

    return res.json({
      success: true,
      message: `Availability set to ${updatedUser.isAvailable ? 'Online' : 'Offline'}.`,
      isAvailable: updatedUser.isAvailable,
    });
  } catch (error) {
    console.error('[Update Availability Error]:', error);
    return res.status(500).json({ message: 'Server error updating availability.' });
  }
});

/**
 * @route   PATCH /api/delivery/:id/status
 * @desc    Update mission status by delivery partner
 * @access  Private (delivery only)
 */
router.patch('/:id/status', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowedDriverStatuses = ['Heading to Pickup', 'Picked Up', 'Delivered'];

    if (!allowedDriverStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid driver status. Allowed: ${allowedDriverStatuses.join(', ')}`,
      });
    }

    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Food mission not found.' });
    }

    if (!listing.assignedDriver || !listing.assignedDriver.equals(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this rescue mission.' });
    }

    listing.driverStatus = status;

    if (status === 'Heading to Pickup') {
      // Driver acknowledged and en route to kitchen
    } else if (status === 'Picked Up') {
      listing.status = 'Picked Up';
      listing.pickedUpAt = new Date();
    } else if (status === 'Delivered') {
      listing.status = 'Completed';
      listing.deliveredAt = new Date();

      // Free up driver capacity
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { activeOrdersCount: -1 },
      });
    }

    await listing.save();

    const populated = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation');

    return res.json({
      success: true,
      message: `Delivery mission status updated to '${status}'.`,
      data: populated,
    });
  } catch (error) {
    console.error('[Update Mission Status Error]:', error);
    return res.status(500).json({ message: 'Server error updating mission status.' });
  }
});

/**
 * @route   GET /api/delivery/drivers
 * @desc    List all online delivery partners with coordinates (for NGO live map tracking)
 * @access  Private (ngo or donor)
 */
router.get('/drivers', protect, async (req, res) => {
  try {
    const drivers = await User.find({
      role: 'delivery',
    }).select('name phone vehicleType vehicleNumber isAvailable currentLocation activeOrdersCount');

    return res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error('[Get Drivers Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving drivers.' });
  }
});

/**
 * @route   POST /api/delivery/auto-assign/:id
 * @desc    Manually re-trigger auto assignment of nearest driver to a listing
 * @access  Private (ngo or donor)
 */
router.post('/auto-assign/:id', protect, async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const assigned = await findAndAssignNearestDriver(listing);
    if (!assigned) {
      return res.status(200).json({
        success: false,
        message: 'No online delivery partners found within operational radius.',
      });
    }

    const updated = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation');

    return res.json({
      success: true,
      message: `Successfully assigned nearest delivery partner '${assigned.name}'.`,
      data: updated,
    });
  } catch (error) {
    console.error('[Auto Assign Trigger Error]:', error);
    return res.status(500).json({ message: 'Server error auto-assigning delivery partner.' });
  }
});

module.exports = router;
