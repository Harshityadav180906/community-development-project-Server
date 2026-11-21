const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    organizationName: {
      type: String,
      required: [true, 'Please provide your organization or entity name'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Please specify your role'],
      enum: {
        values: ['donor', 'ngo', 'delivery', 'admin'],
        message: 'Role must be either donor, ngo, delivery, or admin',
      },
    },
    phone: {
      type: String,
      required: [true, 'Please provide a contact phone number'],
      trim: true,
    },
    locality: {
      type: String,
      required: [true, 'Please provide your locality or area'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please provide your city'],
      trim: true,
    },
    // Delivery Partner Specific Fields
    vehicleType: {
      type: String,
      default: 'Two-Wheeler / Bike',
      trim: true,
    },
    vehicleNumber: {
      type: String,
      default: '',
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    activeOrdersCount: {
      type: Number,
      default: 0,
    },
    // Rider Earnings & Wallet Balance (₹15 per completed delivery)
    walletBalance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    completedDeliveriesCount: {
      type: Number,
      default: 0,
    },
    // Live Location Coordinates
    currentLocation: {
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
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
