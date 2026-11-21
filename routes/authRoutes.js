const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getCoordinatesForLocality } = require('../utils/geoUtils');

// Helper to generate JWT token
const generateToken = (id, role) => {
  const secret = process.env.JWT_SECRET || 'bhojansetu_super_secret_jwt_key_2024_secure_and_strong';
  return jwt.sign({ id, role }, secret, {
    expiresIn: '7d',
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (donor, ngo, or delivery partner)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      organizationName,
      role,
      phone,
      locality,
      city,
      vehicleType,
      vehicleNumber,
      latitude,
      longitude,
    } = req.body;

    // Validation
    if (!name || !email || !password || !role || !phone || !locality || !city) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    if (!['donor', 'ngo', 'delivery'].includes(role)) {
      return res.status(400).json({ message: "Role must be 'donor', 'ngo', or 'delivery'." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Check existing email
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email address already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Coordinate resolution
    let coords = { latitude: 12.9716, longitude: 77.5946 };
    if (latitude && longitude) {
      coords = { latitude: Number(latitude), longitude: Number(longitude) };
    } else {
      coords = getCoordinatesForLocality(locality);
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      organizationName: (organizationName || (role === 'delivery' ? 'BhojanSetu Logistics Partner' : name)).trim(),
      role,
      phone: phone.trim(),
      locality: locality.trim(),
      city: city.trim(),
      vehicleType: vehicleType || 'Two-Wheeler / Bike',
      vehicleNumber: vehicleNumber || '',
      isAvailable: true,
      currentLocation: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: `${locality.trim()}, ${city.trim()}`,
        updatedAt: new Date(),
      },
    });

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        organizationName: user.organizationName,
        role: user.role,
        phone: user.phone,
        locality: user.locality,
        city: user.city,
        vehicleType: user.vehicleType,
        vehicleNumber: user.vehicleNumber,
        isAvailable: user.isAvailable,
        currentLocation: user.currentLocation,
      },
    });
  } catch (error) {
    console.error('[Register Error]:', error);
    return res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password.' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id, user.role);

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        organizationName: user.organizationName,
        role: user.role,
        phone: user.phone,
        locality: user.locality,
        city: user.city,
        vehicleType: user.vehicleType,
        vehicleNumber: user.vehicleNumber,
        isAvailable: user.isAvailable,
        currentLocation: user.currentLocation,
      },
    });
  } catch (error) {
    console.error('[Login Error]:', error);
    return res.status(500).json({ message: 'Server error during authentication.', error: error.message });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user profile
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    return res.json({
      user: req.user,
    });
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    return res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

module.exports = router;
