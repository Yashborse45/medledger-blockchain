// MongoDB connection configuration using Mongoose
const mongoose = require('mongoose');
const dns = require('dns');

// Force use of Google DNS to resolve MongoDB Atlas SRV records
// (router DNS may fail to resolve _mongodb._tcp SRV lookups)
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
