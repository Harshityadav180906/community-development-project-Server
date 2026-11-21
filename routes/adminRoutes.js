const express = require('express');
const router = express.Router();
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { protect } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/role');

/**
 * @route   GET /api/admin/overview
 * @desc    Company team member KPI analytics & platform overview
 * @access  Private (admin or company member)
 */
router.get('/overview', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const totalOrders = await FoodListing.countDocuments();
    const completedOrders = await FoodListing.countDocuments({ status: 'Completed' });
    const activeOrders = await FoodListing.countDocuments({
      status: { $in: ['Claimed', 'Picked Up'] },
    });
    const availableOrders = await FoodListing.countDocuments({ status: 'Available' });

    // Aggregate total servings saved
    const servingsAgg = await FoodListing.aggregate([
      { $match: { status: { $in: ['Claimed', 'Picked Up', 'Completed'] } } },
      { $group: { _id: null, totalServings: { $sum: '$quantityServings' } } },
    ]);
    const totalServingsSaved = servingsAgg[0]?.totalServings || 0;

    // Aggregate total payouts to riders (₹15 per completed delivery)
    const totalRiderPayouts = completedOrders * 15;

    // Platform user counts
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalNgos = await User.countDocuments({ role: 'ngo' });
    const totalRiders = await User.countDocuments({ role: 'delivery' });

    // Ticket metrics
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: { $in: ['Open', 'In Progress'] } });
    const resolvedTickets = await Ticket.countDocuments({ status: 'Resolved' });

    return res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        activeOrders,
        availableOrders,
        totalServingsSaved,
        totalRiderPayouts,
        totalDonors,
        totalNgos,
        totalRiders,
        totalTickets,
        openTickets,
        resolvedTickets,
      },
    });
  } catch (error) {
    console.error('[Admin Overview Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving admin overview.' });
  }
});

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders with verification photo, OTP status, rider details, and payment
 * @access  Private (admin)
 */
router.get('/orders', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { locality: { $regex: search, $options: 'i' } },
      ];
    }

    const orders = await FoodListing.find(query)
      .populate('donor', 'name organizationName phone email locality city')
      .populate('claimedBy', 'name organizationName phone email locality city')
      .populate('assignedDriver', 'name phone vehicleType vehicleNumber walletBalance')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error('[Admin Orders Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving all orders.' });
  }
});

/**
 * @route   GET /api/admin/tickets
 * @desc    Get all support and issue tickets
 * @access  Private (admin)
 */
router.get('/tickets', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const query = {};

    if (status && status !== 'All') query.status = status;
    if (priority && priority !== 'All') query.priority = priority;
    if (category && category !== 'All') query.category = category;

    const tickets = await Ticket.find(query)
      .populate('relatedOrder', 'title foodType quantityServings status deliveryOtp')
      .populate('createdBy', 'name organizationName role phone')
      .populate('assignedTo', 'name organizationName role phone')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    console.error('[Admin Tickets Error]:', error);
    return res.status(500).json({ message: 'Server error retrieving tickets.' });
  }
});

/**
 * @route   POST /api/admin/tickets
 * @desc    Create a new support or incident ticket
 * @access  Private
 */
router.post('/tickets', protect, async (req, res) => {
  try {
    const { title, description, category, priority, relatedOrderId } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const count = await Ticket.countDocuments();
    const ticketId = `TKT-${1000 + count + 1}`;

    const newTicket = await Ticket.create({
      ticketId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'Delivery Issue',
      priority: priority || 'Medium',
      relatedOrder: relatedOrderId || null,
      createdBy: req.user._id,
      status: 'Open',
    });

    const populated = await Ticket.findById(newTicket._id)
      .populate('relatedOrder', 'title foodType quantityServings status')
      .populate('createdBy', 'name organizationName role phone');

    return res.status(201).json({
      success: true,
      message: `Support Ticket #${ticketId} created successfully.`,
      data: populated,
    });
  } catch (error) {
    console.error('[Create Ticket Error]:', error);
    return res.status(500).json({ message: 'Server error creating support ticket.' });
  }
});

/**
 * @route   PATCH /api/admin/tickets/:id
 * @desc    Update ticket resolution status & company notes
 * @access  Private (admin)
 */
router.patch('/tickets/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    if (status) ticket.status = status;
    if (resolutionNotes) ticket.resolutionNotes = resolutionNotes;
    if (status === 'Resolved' || status === 'Closed') {
      ticket.resolvedAt = new Date();
      ticket.assignedTo = req.user._id;
    }

    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate('relatedOrder', 'title foodType quantityServings status')
      .populate('createdBy', 'name organizationName role phone')
      .populate('assignedTo', 'name organizationName role phone');

    return res.json({
      success: true,
      message: `Ticket #${ticket.ticketId} updated to ${ticket.status}.`,
      data: populated,
    });
  } catch (error) {
    console.error('[Update Ticket Error]:', error);
    return res.status(500).json({ message: 'Server error updating ticket.' });
  }
});

module.exports = router;
