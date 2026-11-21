const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const { seedDatabase } = require('./utils/seedData');

// Load environment variables
dotenv.config();

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'BhojanSetu Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Explicit Seed Endpoint for One-Click Database Initialization
app.all('/api/seed', async (req, res) => {
  try {
    const result = await seedDatabase(true);
    res.json({
      success: true,
      message: 'BhojanSetu database seeded successfully with demo donors, NGOs, and food batches!',
      data: result,
    });
  } catch (error) {
    console.error('[Manual Seed Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/food', require('./routes/foodRoutes'));
app.use('/api/delivery', require('./routes/deliveryRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found on endpoint: ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and then start listening
connectDB().then(async () => {
  // Check if database has 0 users; if so, automatically seed!
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Empty database detected! Auto-seeding demo donors, NGOs, and food listings...');
      await seedDatabase(false);
      console.log('✅ Auto-seed completed successfully!');
    }
  } catch (err) {
    console.warn('[AutoSeed Notice]:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🍲 BhojanSetu Server running on port ${PORT}`);
    console.log(`  🌐 Health check: http://localhost:${PORT}/api/health`);
    console.log(`  🌱 Seed endpoint: http://localhost:${PORT}/api/seed`);
    console.log(`  📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });
});

module.exports = app;
