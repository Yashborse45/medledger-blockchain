// Entry point — configures Express, connects to MongoDB, mounts routes
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

// Route modules
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const doctorRoutes = require('./src/routes/doctor');
const patientRoutes = require('./src/routes/patient');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Unknown route handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed by CORS policy' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ message: 'Internal server error' });
});

// ─── Seed: default admin account ─────────────────────────────────────────────
const seedAdmin = async () => {
  const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@medledger.com').trim().toLowerCase();
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) {
    return;
  }

  if (!process.env.ADMIN_DEFAULT_PASSWORD) {
    console.warn('ADMIN_DEFAULT_PASSWORD is not set. Skipping default admin seed.');
    return;
  }

  await User.create({
    name: 'System Admin',
    email: adminEmail,
    password: process.env.ADMIN_DEFAULT_PASSWORD,
    role: 'admin',
    isApproved: true,
  });
  console.log(`Default admin created: ${adminEmail}`);
};

const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missingVars = requiredVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// ─── Start server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    validateEnvironment();
    await connectDB();
    await seedAdmin();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
