// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditLogger
 * @dev Immutable on-chain audit trail for MedLedger.
 *      All sensitive data stays in MongoDB — only the action type,
 *      performer address, and a JSON details string are stored on-chain.
 *      Emitting an event is cheap (~2000 gas) and permanently searchable.
 */
contract AuditLogger {
    // ─── Events ───────────────────────────────────────────────────────────────
    event EventLogged(
        uint256 indexed logId,
        string  action,
        address indexed performedBy,
        string  details,
        uint256 timestamp
    );

    // ─── State ────────────────────────────────────────────────────────────────
    uint256 private counter;

    // ─── Functions ────────────────────────────────────────────────────────────

    /**
     * @notice Log an audit event on-chain.
     * @param action      Action identifier e.g. "LOGIN", "ACCESS_GRANTED"
     * @param performedBy Ethereum address of the actor (use address(0) if N/A)
     * @param details     JSON string with context (mongoId, role, etc.)
     * @return logId      Incrementing on-chain log identifier
     */
    function logEvent(
        string calldata action,
        address performedBy,
        string calldata details
    ) external returns (uint256 logId) {
        counter++;
        emit EventLogged(counter, action, performedBy, details, block.timestamp);
        return counter;
    }

    /**
     * @notice Returns how many events have been logged.
     */
    function totalLogs() external view returns (uint256) {
        return counter;
    }
}
