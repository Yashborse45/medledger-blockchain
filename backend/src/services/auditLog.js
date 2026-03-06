// AuditLog service — single entry point for all audit log creation.
// Replaces direct AuditLog.create() calls across controllers.
//
// Behaviour:
//   1. Saves to MongoDB immediately (blockchainTxHash = null)
//   2. Fires blockchain write asynchronously via setImmediate
//      (runs after the HTTP response is sent — zero latency impact)
//   3. Updates blockchainTxHash on the MongoDB doc when confirmed
const AuditLog = require('../models/AuditLog');
const { logToBlockchain } = require('./blockchain');

/**
 * Creates an audit log entry in MongoDB and asynchronously writes it
 * to the blockchain. Identical call signature to AuditLog.create().
 *
 * @param {object} params
 * @param {string}   params.action      - Action identifier e.g. "LOGIN"
 * @param {ObjectId} params.performedBy - User who performed the action
 * @param {ObjectId} [params.targetUser]- Optional target user
 * @param {object}   [params.details]   - Action-specific metadata
 * @returns {Promise<Document>} The saved AuditLog document
 */
const createAuditLog = async ({ action, performedBy, targetUser, details }) => {
    // 1. Persist to MongoDB synchronously so the caller can continue
    const log = await AuditLog.create({ action, performedBy, targetUser, details });

    // 2. Write to blockchain in the background — does NOT block the response
    setImmediate(async () => {
        const payload = JSON.stringify({
            mongoId: log._id.toString(),
            action,
            ...(details || {}),
        });

        const txHash = await logToBlockchain(action, payload);

        if (txHash) {
            await AuditLog.findByIdAndUpdate(log._id, { blockchainTxHash: txHash });
            console.log(`[AuditLog] ${action} → blockchain tx: ${txHash}`);
        }
    });

    return log;
};

module.exports = { createAuditLog };
