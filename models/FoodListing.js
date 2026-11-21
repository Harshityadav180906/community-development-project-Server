const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema(
  {
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Food listing must be associated with a donor'],
    },
    title: {
      type: String,
      required: [true, 'Please provide a title describing the surplus food'],
      trim: true,
    },
    foodType: {
      type: String,
      required: [true, 'Please specify whether the food is Veg or Non-Veg'],
      enum: {
        values: ['Veg', 'Non-Veg'],
        message: 'Food type must be Veg or Non-Veg',
      },
    },
    quantityServings: {
      type: Number,
      required: [true, 'Please provide the approximate number of servings'],
      min: [1, 'Servings must be at least 1'],
    },
    cookedAt: {
      type: Date,
      required: [true, 'Please specify when the food was prepared/cooked'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Please specify the estimated expiration or consumption deadline'],
    },
    pickupAddress: {
      type: String,
      required: [true, 'Please specify the full pickup address'],
      trim: true,
    },
    locality: {
      type: String,
      required: [true, 'Please specify the locality/neighborhood'],
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Please provide a contact phone number for pickup coordination'],
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Available', 'Claimed', 'Picked Up', 'Completed', 'Expired'],
        message: 'Invalid status value',
      },
      default: 'Available',
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Geolocation Coordinates for Donor Pickup Point
    pickupCoordinates: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
    },
    // Destination NGO Delivery Coordinates
    deliveryCoordinates: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      address: {
        type: String,
        default: '',
      },
    },
    // Delivery Partner Details
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    driverStatus: {
      type: String,
      enum: {
        values: [
          'Unassigned',
          'Assigned',
          'Heading to Pickup',
          'Picked Up',
          'Reached Dropoff',
          'Delivered',
        ],
        message: 'Invalid driver status value',
      },
      default: 'Unassigned',
    },
    // Delivery Handover Verification OTP (shared with NGO)
    deliveryOtp: {
      type: String,
      default: '',
      trim: true,
    },
    // SMS Notification Dispatch Record
    smsDispatch: {
      sent: {
        type: Boolean,
        default: false,
      },
      phone: {
        type: String,
        default: '',
      },
      message: {
        type: String,
        default: '',
      },
      sentAt: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        default: 'Pending',
      },
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    otpVerifiedAt: {
      type: Date,
      default: null,
    },
    // Payment Section (₹15 Delivery Compensation via UPI or Cash)
    payoutAmount: {
      type: Number,
      default: 15,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid_UPI', 'Paid_Cash'],
      default: 'Pending',
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Cash', 'None'],
      default: 'None',
    },
    paymentCompletedAt: {
      type: Date,
      default: null,
    },
    // Proof of Delivery Food Photo
    deliveryProofPhoto: {
      type: String,
      default: '',
    },
    deliveryProofPhotoUploadedAt: {
      type: Date,
      default: null,
    },
    // 15 km Delivery Service Radius Flag
    isOutOfRadius: {
      type: Boolean,
      default: false,
    },
    radiusNotice: {
      type: String,
      default: '',
    },
    driverAssignedAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexing for rapid feed filtering & locality searches
foodListingSchema.index({ status: 1, foodType: 1, locality: 1 });
foodListingSchema.index({ expiresAt: 1 });
foodListingSchema.index({ assignedDriver: 1 });

// Ensure unique, stable 4-digit handover OTP is generated and persisted on save
foodListingSchema.pre('save', function (next) {
  if (!this.deliveryOtp || this.deliveryOtp.trim() === '') {
    this.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
  }
  next();
});

const FoodListing = mongoose.model('FoodListing', foodListingSchema);
module.exports = FoodListing;
