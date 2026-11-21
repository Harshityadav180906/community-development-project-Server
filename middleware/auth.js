const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'bhojansetu_super_secret_jwt_key_2024_secure_and_strong';
      
      const decoded = jwt.verify(token, jwtSecret);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found or account deactivated.' });
      }

      next();
    } catch (error) {
      console.error('[Auth Middleware Error]:', error.message);
      return res.status(401).json({ message: 'Not authorized, invalid or expired token.' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no bearer token provided.' });
  }
};

module.exports = { protect };
