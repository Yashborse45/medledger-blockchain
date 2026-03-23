// Auth controller — handles registration and login
const crypto = require('crypto');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createAuditLog } = require('../services/auditLog');

const WALLET_NONCE_TTL_MS = 10 * 60 * 1000;

const walletLinkMessage = ({ nonce, userId, address }) => (
  `MedLedger wallet link request\nNonce: ${nonce}\nUser: ${userId}\nWallet: ${address}`
);

/**
 * POST /api/auth/register
 * Patient self-registration. isApproved defaults to false until admin approves.
 */
const register = async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'patient',
      isApproved: false,
    });

    return res.status(201).json({
      message: 'Registration successful. Await admin approval.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/login
 * Login for all roles. Returns JWT containing id, role, and isApproved.
 */
const login = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Sign JWT with user id and role only; approval is re-validated per request
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Audit: log successful login
    await createAuditLog({
      action: 'LOGIN',
      performedBy: user._id,
      details: { email: user.email, role: user.role },
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        ethereumAddress: user.ethereumAddress || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/wallet/nonce
 * Creates a short-lived nonce that the authenticated patient/doctor signs via MetaMask.
 */
const createWalletLinkNonce = async (req, res) => {
  const address = req.body.address?.trim().toLowerCase();

  try {
    const nonce = crypto.randomBytes(16).toString('hex');

    req.user.walletLinkNonce = nonce;
    req.user.walletLinkNonceExpiresAt = new Date(Date.now() + WALLET_NONCE_TTL_MS);
    await req.user.save();

    return res.status(200).json({
      nonce,
      message: walletLinkMessage({ nonce, userId: req.user._id.toString(), address }),
      expiresAt: req.user.walletLinkNonceExpiresAt,
    });
  } catch (error) {
    console.error('Failed to create wallet link nonce:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/wallet/verify
 * Verifies the signed nonce and links wallet to authenticated patient/doctor account.
 */
const verifyAndLinkWallet = async (req, res) => {
  const address = req.body.address?.trim().toLowerCase();
  const signature = req.body.signature?.trim();

  try {
    const freshUser = await User.findById(req.user._id);
    if (!freshUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!freshUser.walletLinkNonce || !freshUser.walletLinkNonceExpiresAt) {
      return res.status(400).json({ message: 'No active wallet link request found' });
    }
    if (freshUser.walletLinkNonceExpiresAt.getTime() < Date.now()) {
      freshUser.walletLinkNonce = null;
      freshUser.walletLinkNonceExpiresAt = null;
      await freshUser.save();
      return res.status(400).json({ message: 'Wallet link request expired. Please retry.' });
    }

    const message = walletLinkMessage({
      nonce: freshUser.walletLinkNonce,
      userId: freshUser._id.toString(),
      address,
    });

    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== address) {
      return res.status(401).json({ message: 'Signature verification failed' });
    }

    const existingWalletOwner = await User.findOne({
      _id: { $ne: freshUser._id },
      ethereumAddress: address,
    });
    if (existingWalletOwner) {
      return res.status(409).json({ message: 'Wallet address is already linked to another account' });
    }

    freshUser.ethereumAddress = address;
    freshUser.walletLinkNonce = null;
    freshUser.walletLinkNonceExpiresAt = null;
    await freshUser.save();

    await createAuditLog({
      action: 'WALLET_LINKED',
      performedBy: freshUser._id,
      details: { ethereumAddress: address },
    });

    return res.status(200).json({
      message: 'Wallet linked successfully',
      user: {
        id: freshUser._id,
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role,
        isApproved: freshUser.isApproved,
        ethereumAddress: freshUser.ethereumAddress,
      },
    });
  } catch (error) {
    console.error('Failed to verify wallet signature:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { register, login, createWalletLinkNonce, verifyAndLinkWallet };
