const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide ticket title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide ticket description'],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Delivery Issue',
        'OTP Verification',
        'Payment & Payout',
        'Food Quality Concern',
        'Address & Navigation',
        'Rider Assistance',
        'Other',
      ],
      default: 'Delivery Issue',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodListing',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
