// Blockchain service — thin wrapper around the deployed AuditLogger contract.
// Used only by auditLog.js; nothing else should import this directly.
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

let contract = null;

/**
 * Lazily initialise and cache the contract instance.
 * Returns null if any required env var is missing (blockchain disabled).
 */
const getContract = () => {
    if (contract) return contract;

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
        return null; // blockchain not configured — silently disabled
    }

    try {
        const abiPath = path.join(__dirname, '../config/AuditLoggerABI.json');
        const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        contract = new ethers.Contract(contractAddress, abi, wallet);
        return contract;
    } catch (err) {
        console.error('[Blockchain] Failed to initialise contract:', err.message);
        return null;
    }
};

/**
 * Writes an audit event to the blockchain.
 * @param {string} action         - Action identifier e.g. "LOGIN"
 * @param {string} details        - JSON string with context
 * @returns {Promise<string|null>} txHash on success, null on any failure
 */
const logToBlockchain = async (action, details) => {
    const c = getContract();
    if (!c) return null; // blockchain disabled or not yet configured

    try {
        // Use address(0) as performer — we track identity in MongoDB
        const tx = await c.logEvent(action, ethers.ZeroAddress, details);
        const receipt = await tx.wait();
        return receipt.hash;
    } catch (err) {
        // Non-fatal: blockchain being down must never break the API
        console.error(`[Blockchain] logEvent failed for action "${action}":`, err.message);
        return null;
    }
};

/**
 * Verifies a transaction exists on the blockchain and returns its block info.
 * Uses a read-only provider — no wallet/signing needed.
 * @param {string} txHash
 * @returns {Promise<{txHash, blockNumber, timestamp}|null>} null if unavailable or not found
 */
const verifyTransaction = async (txHash) => {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    if (!rpcUrl) return null;

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return null;

        const block = await provider.getBlock(receipt.blockNumber);
        return {
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            timestamp: block ? new Date(block.timestamp * 1000).toISOString() : null,
        };
    } catch (err) {
        console.error('[Blockchain] verifyTransaction failed:', err.message);
        return null;
    }
};

module.exports = { logToBlockchain, verifyTransaction };
