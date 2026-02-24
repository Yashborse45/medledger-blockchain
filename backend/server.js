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

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// ─── Seed: default admin account ─────────────────────────────────────────────
const seedAdmin = async () => {
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    await User.create({
      name: 'System Admin',
      email: 'admin@medledger.com',
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123',
      role: 'admin',
      isApproved: true,
    });
    console.log('Default admin created: admin@medledger.com');
  }
};

// ─── Start server ─────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  await seedAdmin();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
