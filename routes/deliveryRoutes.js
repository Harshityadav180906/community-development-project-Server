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
      driverStatus: { $in: ['Assigned', 'Heading to Pickup', 'Picked Up', 'Reached Dropoff'] },
    })
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation walletBalance')
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

/**
 * @route   GET /api/delivery/me/wallet
 * @desc    Get rider's live wallet balance and compensation stats
 * @access  Private (delivery only)
 */
router.get('/me/wallet', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const rider = await User.findById(req.user._id).select(
      'name walletBalance totalEarnings completedDeliveriesCount vehicleType vehicleNumber'
    );
    return res.json({
      success: true,
      data: {
        walletBalance: rider.walletBalance || 0,
        totalEarnings: rider.totalEarnings || 0,
        completedDeliveriesCount: rider.completedDeliveriesCount || 0,
        ratePerDelivery: 15,
      },
    });
  } catch (error) {
    console.error('[Delivery Wallet Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving rider wallet.' });
  }
});

/**
 * @route   POST /api/delivery/:id/verify-otp
 * @desc    Verify handover OTP provided by NGO recipient before unlocking payment
 * @access  Private (delivery only)
 */
router.post('/:id/verify-otp', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: 'Please provide the 4-digit verification OTP.' });
    }

    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Food mission not found.' });
    }

    if (!listing.assignedDriver || !listing.assignedDriver.equals(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this rescue mission.' });
    }

    // Verify OTP match
    if (listing.deliveryOtp && listing.deliveryOtp.trim() !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP! Please check the code displayed on the NGO portal or SMS.',
      });
    }

    listing.otpVerified = true;
    listing.otpVerifiedAt = new Date();
    listing.driverStatus = 'Reached Dropoff';
    await listing.save();

    const populated = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation walletBalance');

    return res.json({
      success: true,
      message: '✅ OTP verified successfully! Delivery payment section unlocked.',
      data: populated,
    });
  } catch (error) {
    console.error('[Verify OTP Error]:', error);
    return res.status(500).json({ message: 'Server error verifying OTP.' });
  }
});

/**
 * @route   POST /api/delivery/:id/confirm-payment
 * @desc    Confirm delivery compensation (₹15 via UPI or Cash)
 * @access  Private (delivery only)
 */
router.post('/:id/confirm-payment', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { paymentMethod } = req.body; // 'UPI' or 'Cash'

    if (!['UPI', 'Cash'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method. Choose UPI or Cash.' });
    }

    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Food mission not found.' });
    }

    if (!listing.assignedDriver || !listing.assignedDriver.equals(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this rescue mission.' });
    }

    if (!listing.otpVerified) {
      return res.status(400).json({
        message: 'OTP verification is required before processing payment confirmation.',
      });
    }

    listing.paymentStatus = paymentMethod === 'Cash' ? 'Paid_Cash' : 'Paid_UPI';
    listing.paymentMethod = paymentMethod;
    listing.payoutAmount = 15;
    listing.paymentCompletedAt = new Date();
    await listing.save();

    const populated = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation walletBalance');

    return res.json({
      success: true,
      message: `✅ ₹15 ${paymentMethod} payment confirmed! Photo proof upload section unlocked.`,
      data: populated,
    });
  } catch (error) {
    console.error('[Confirm Payment Error]:', error);
    return res.status(500).json({ message: 'Server error confirming payment.' });
  }
});

/**
 * @route   POST /api/delivery/:id/upload-proof
 * @desc    Upload food handover photo proof & finalize delivery with ₹15 rider payout
 * @access  Private (delivery only)
 */
router.post('/:id/upload-proof', protect, authorizeRoles('delivery'), async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) {
      return res.status(400).json({ message: 'Please capture or upload a photo of the food delivery.' });
    }

    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Food mission not found.' });
    }

    if (!listing.assignedDriver || !listing.assignedDriver.equals(req.user._id)) {
      return res.status(403).json({ message: 'Forbidden: You are not assigned to this rescue mission.' });
    }

    if (!listing.otpVerified) {
      return res.status(400).json({ message: 'Handover OTP must be verified first.' });
    }

    if (listing.paymentStatus === 'Pending') {
      return res.status(400).json({ message: 'Delivery payment confirmation is required before photo submission.' });
    }

    // Save proof photo and finalize order
    listing.deliveryProofPhoto = photo;
    listing.deliveryProofPhotoUploadedAt = new Date();
    listing.driverStatus = 'Delivered';
    listing.status = 'Completed';
    listing.deliveredAt = new Date();
    await listing.save();

    // Credit ₹15 compensation to Rider wallet & increment delivery count
    const updatedDriver = await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          walletBalance: 15,
          totalEarnings: 15,
          completedDeliveriesCount: 1,
          activeOrdersCount: -1,
        },
        $set: { isAvailable: true },
      },
      { new: true }
    ).select('-password');

    const populated = await FoodListing.findById(listing._id)
      .populate('donor', 'name organizationName phone locality city pickupAddress')
      .populate('claimedBy', 'name organizationName phone locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber currentLocation walletBalance');

    return res.json({
      success: true,
      message: '🎉 Food handover proof verified! ₹15 has been credited to your Rider Wallet.',
      data: populated,
      wallet: {
        walletBalance: updatedDriver.walletBalance,
        totalEarnings: updatedDriver.totalEarnings,
        completedDeliveriesCount: updatedDriver.completedDeliveriesCount,
      },
    });
  } catch (error) {
    console.error('[Upload Proof Error]:', error);
    return res.status(500).json({ message: 'Server error processing delivery photo proof.' });
  }
});

module.exports = router;
