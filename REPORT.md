# MedLedger — Blockchain-Integrated Healthcare Records System
## Complete Project Report & Viva Preparation Guide

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [How Each Component Works](#4-how-each-component-works)
5. [Blockchain Integration — Deep Dive](#5-blockchain-integration--deep-dive)
6. [Smart Contract Explained](#6-smart-contract-explained)
7. [Security Features](#7-security-features)
8. [Data Flow — Step by Step](#8-data-flow--step-by-step)
9. [Viva Questions & Answers](#9-viva-questions--answers)
10. [Key Terms You Must Know](#10-key-terms-you-must-know)

---

## 1. Project Overview

**MedLedger** is a full-stack web application for managing medical records with an immutable blockchain audit trail.

### Problem it solves
In traditional healthcare systems, audit logs (who accessed what, when) are stored only in a central database. This means:
- A malicious admin can delete or modify log entries
- There is no independent proof that a record was accessed
- Patients cannot truly verify who has seen their data

### What MedLedger adds
Every sensitive action (login, record creation, access grants, record views) is written to an Ethereum blockchain. Because blockchain data is **immutable and tamper-proof**, the audit trail cannot be altered even by the system administrator.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│   Login / Register / Patient Dashboard / Doctor Dashboard /     │
│   Admin Dashboard                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (Axios, JWT in headers)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                │
│                                                                 │
│  Routes → Controllers → Services                                │
│                         ├── MongoDB (AuditLog, User,            │
│                         │          PatientRecord,               │
│                         │          AccessPermission)            │
│                         └── Blockchain Service                  │
└──────────────────────────────────────┬──────────────────────────┘
                                       │ ethers.js (JSON-RPC)
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│               ETHEREUM NETWORK (Ganache / Mainnet)              │
│                                                                 │
│   AuditLogger.sol — Smart Contract                              │
│   Address: 0x72d4351497f80234b71291ffb41c960d6ABF2297           │
│   Emits: EventLogged(logId, action, performedBy, details,       │
│                       timestamp)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React.js | Component-based SPA, fast development |
| HTTP Client | Axios | Promise-based, easy interceptors for JWT |
| Backend | Node.js + Express | Non-blocking I/O, huge ecosystem |
| Database | MongoDB + Mongoose | Flexible schema for medical records, fast queries |
| Authentication | JWT (JSON Web Token) | Stateless, scalable auth over REST |
| Password Hashing | bcrypt.js | Industry-standard one-way hashing |
| Smart Contract | Solidity 0.8.20 | Statically typed, most widely used EVM language |
| Contract Deployment | Hardhat 2 | Development environment for Ethereum |
| Blockchain library | ethers.js v6 | Modern, well-typed library to call contracts from Node |
| Local Blockchain | Ganache GUI | Simulates Ethereum locally for development |

---

## 4. How Each Component Works

### 4.1 Frontend (React)

- `AuthContext.js` — A React Context that holds the logged-in user's data and JWT token globally. Any component can read the current user without prop drilling.
- `PrivateRoute.js` — Wraps routes so only authenticated users (with the correct role) can access them.
- `api.js` — Single Axios instance with the base URL and an interceptor that automatically attaches the JWT token to every request's `Authorization` header.
- Role-based dashboards — Admin, Doctor, and Patient each see a completely different dashboard pulled from different API endpoints.

### 4.2 Backend (Node + Express)

**Request lifecycle:**
```
Request → server.js (CORS, JSON parser) 
        → Route file (e.g. /api/doctor)
        → Middleware: verifyToken → requireRole
        → Controller (business logic)
        → Service (database / blockchain)
        → Response
```

**Middleware chain:**
1. `verifyToken` — Extracts the Bearer token from the `Authorization` header, verifies it with `JWT_SECRET`, and attaches the full user document to `req.user`.
2. `requireRole('admin')` — Checks `req.user.role` and rejects if not matching.

### 4.3 MongoDB Models

| Model | Purpose | Key Fields |
|---|---|---|
| `User` | All users regardless of role | name, email, password (hashed), role, isApproved, isActive |
| `PatientRecord` | A patient's medical record | patient (ref), doctor (ref), title, content, diagnosis |
| `AccessPermission` | Doctor ↔ Patient access grants | doctor (ref), patient (ref), grantedAt |
| `AuditLog` | Every sensitive action | action, performedBy, targetUser, details, blockchainTxHash |

### 4.4 Role-Based Access Control (RBAC)

There are 3 roles:

| Role | Can Do |
|---|---|
| **Patient** | See their own records, grant/revoke doctor access |
| **Doctor** | Request access to patient records, view records they have permission for |
| **Admin** | Approve/deactivate users, view all audit logs |

Patients register and wait for admin approval (`isApproved: false`). Doctors are approved by default.

---

## 5. Blockchain Integration — Deep Dive

### Why blockchain for audit logs specifically?

The audit log answers the question: **"who accessed patient data and when?"** This is sensitive from both a privacy and legal standpoint (HIPAA in the US, similar laws in India). If this log lives only in MongoDB, the database administrator could delete entries. Writing the same event to a blockchain makes it **permanently verifiable**.

### The Dual-Write Pattern

MedLedger uses a **dual-write** approach — every audit event is written to two places:

```
1. MongoDB (primary, immediately)   — fast, queryable, human-readable
2. Ethereum blockchain (async)      — immutable, tamper-proof proof of existence
```

### Why async blockchain writes?

Blockchain transactions take 1–5 seconds to confirm. If we waited for blockchain confirmation before sending the HTTP response, every API call would be 5 seconds slow. Instead:

1. Save to MongoDB → instant
2. Send HTTP response → user sees result immediately
3. `setImmediate()` fires the blockchain write in the background
4. When confirmed, update the MongoDB document with `blockchainTxHash`

This is called the **fire-and-forget with reconciliation** pattern.

### What happens if the blockchain is down?

The `logToBlockchain()` function wraps everything in a `try/catch` and returns `null` on failure. The system logs a warning but continues normally. **The blockchain being down never breaks the API.** The `blockchainTxHash` field in MongoDB just stays `null` for that entry.

### The service layer architecture

```
Controller
    └── createAuditLog(params)          ← auditLog.js
            ├── AuditLog.create()       ← MongoDB (synchronous)
            └── setImmediate(() => {
                    logToBlockchain()   ← blockchain.js (async)
                        └── contract.logEvent()  ← Solidity via ethers.js
                })
```

Nothing outside `auditLog.js` ever calls blockchain code directly. This is called **separation of concerns** — if you want to swap the blockchain library tomorrow, you only change one file.

---

## 6. Smart Contract Explained

```solidity
// AuditLogger.sol
contract AuditLogger {
    event EventLogged(
        uint256 indexed logId,
        string  action,
        address indexed performedBy,
        string  details,
        uint256 timestamp
    );

    uint256 private counter;

    function logEvent(
        string calldata action,
        address performedBy,
        string calldata details
    ) external returns (uint256 logId) {
        counter++;
        emit EventLogged(counter, action, performedBy, details, block.timestamp);
        return counter;
    }
}
```

**Line by line:**

- `event EventLogged(...)` — Declares what data gets written to the blockchain log. Events are cheaper than storing in contract `storage` and are permanently indexed.
- `uint256 indexed logId` — `indexed` means this field is stored in the transaction's topic list, making it searchable efficiently.
- `uint256 private counter` — A simple incrementing ID. Incremented each call, stored in contract state.
- `block.timestamp` — The blockchain node's current time. Cannot be forged (miners can only shift it by ~15 seconds maximum).
- `calldata` — Read-only memory for function arguments. Cheaper than `memory` because it avoids copying.
- `external` — Can only be called from outside the contract (not internally). Slightly cheaper than `public`.

**Why emit an event instead of storing in a mapping?**

Storing data in Solidity `storage` costs ~20,000 gas per 32 bytes. Emitting an event costs ~375 gas plus ~8 gas per byte. For audit logging (write-only, rarely queried on-chain), events are **~10–50× cheaper**.

**Deployed details:**
- Network: Ganache (local Ethereum simulator), chainId 1337
- Address: `0x72d4351497f80234b71291ffb41c960d6ABF2297`
- Compiled with: Hardhat 2, Solidity 0.8.20

---

## 7. Security Features

### Authentication
- Passwords hashed with **bcrypt** (saltRounds=10). bcrypt is designed to be slow — brute-forcing is impractical.
- **JWT** tokens are signed with a `JWT_SECRET` known only to the server. Tampering with a token's payload invalidates the signature.
- Tokens expire (configured via `JWT_EXPIRES_IN`). Stolen tokens have a limited window.

### Authorization
- Every protected route first runs `verifyToken`, then `requireRole`. A doctor cannot hit admin endpoints even with a valid doctor token.
- The middleware fetches the user fresh from the database on every request — so deactivating a user takes effect immediately even on existing sessions.

### CORS
- Backend only accepts requests from `localhost` / `127.0.0.1` origins (any port). External domains are blocked.

### Blockchain immutability
- Once a transaction is mined, it is part of an immutable block. Altering an audit log entry in MongoDB is detectable because the corresponding blockchain event still exists with the original data.

### What is NOT in this project (production would need)
- HTTPS / TLS (this uses HTTP, fine for development)
- Rate limiting on the auth endpoints
- Input sanitization against NoSQL injection
- Secrets management (private keys should use a vault like HashiCorp Vault, not `.env` files)

---

## 8. Data Flow — Step by Step

### Example: Doctor views a patient record

```
1. Doctor clicks "View Record" in the browser

2. React calls: GET /api/doctor/records/:id
   Authorization: Bearer <JWT>

3. Express → verifyToken middleware
   - Extracts JWT, verifies signature with JWT_SECRET
   - Fetches doctor from MongoDB, attaches to req.user

4. requireRole('doctor') middleware
   - Checks req.user.role === 'doctor' ✓

5. doctorController.getRecord()
   - Checks AccessPermission exists for (doctor, patient) pair
   - Fetches PatientRecord from MongoDB
   - Calls createAuditLog({ action: 'RECORD_VIEWED', performedBy: doctor._id, ... })

6. createAuditLog() (auditLog.js)
   - Saves AuditLog to MongoDB instantly (blockchainTxHash: null)
   - Sends HTTP 200 response with record data back to doctor ← USER SEES RESULT HERE
   - setImmediate fires blockchain write in the background

7. Blockchain write (blockchain.js)
   - ethers.js calls contract.logEvent("RECORD_VIEWED", address(0), "{mongoId:...,role:doctor,...}")
   - Ganache mines the transaction
   - receipt.hash is returned

8. MongoDB updated
   - AuditLog document gets blockchainTxHash = "0xabc..."

9. Admin can now open the Audit Logs table
   - Sees: action=RECORD_VIEWED, performedBy=Dr.Smith, timestamp=...
   - The blockchainTxHash proves this event is permanently recorded on-chain
```

---

## 9. Viva Questions & Answers

### Basic / Introductory

**Q: What is MedLedger?**
A: MedLedger is a full-stack web application for managing patient medical records. It uses role-based access control so patients, doctors, and administrators each have specific permissions. It integrates with an Ethereum blockchain to create an immutable audit trail of all sensitive actions, ensuring that the log of who accessed what data cannot be tampered with.

---

**Q: Why did you use blockchain in this project?**
A: Traditional audit logs in databases can be modified or deleted, especially by a database administrator. Blockchain data is immutable — once written, it cannot be changed. By writing every sensitive action to the blockchain, we create proof of events that exists independently of our own database. Even if someone corrupts the MongoDB data, the blockchain record remains.

---

**Q: What is a smart contract?**
A: A smart contract is a program that runs on the Ethereum blockchain. It executes automatically when called and its code is public and cannot be changed after deployment. In our project, `AuditLogger.sol` is a smart contract with one function, `logEvent()`, which records an audit event permanently on the blockchain.

---

**Q: What is the role of Ganache?**
A: Ganache is a local Ethereum blockchain simulator used for development. It gives you pre-funded test accounts and mines transactions instantly. We use it instead of the real Ethereum mainnet to avoid spending real cryptocurrency during development. For production, you would point the `BLOCKCHAIN_RPC_URL` to a real network.

---

**Q: What is Hardhat?**
A: Hardhat is a development environment for Ethereum smart contracts. It compiles Solidity code, runs tests, and provides a script runner to deploy contracts to any network. We used Hardhat to compile `AuditLogger.sol` and deploy it to Ganache.

---

**Q: What is ethers.js?**
A: ethers.js is a JavaScript library that lets you interact with the Ethereum blockchain from Node.js. It handles connecting to an RPC node, managing wallets/private keys, encoding function calls, and sending transactions. In our project, the backend uses ethers.js to call `logEvent()` on the deployed smart contract.

---

### Intermediate

**Q: How does authentication work in your project?**
A: When a user logs in, the server verifies their email and password (against the bcrypt hash stored in MongoDB), then generates a JWT token signed with a secret key. The frontend stores this token and sends it as a `Bearer` header in every subsequent request. The `verifyToken` middleware on the backend decodes and validates this token on every protected route.

---

**Q: What is JWT and why is it used?**
A: JWT (JSON Web Token) is a compact, self-contained token format. The server encodes a payload (user ID, role) and signs it with a secret key. The client sends this token with every request — the server can verify it without querying the database for every request. It allows stateless authentication, which scales well. Tokens also expire, limiting the damage from a stolen token.

---

**Q: What is RBAC and how is it implemented?**
A: RBAC stands for Role-Based Access Control. Instead of giving permissions to individual users, permissions are assigned to roles (admin, doctor, patient), and users are assigned a role. In our project, every protected route has two middleware: `verifyToken` (authentication) and `requireRole('doctor')` (authorization). If the user's role doesn't match, they get a 403 Forbidden response.

---

**Q: Why is bcrypt used for passwords and not SHA256 or MD5?**
A: MD5 and SHA256 are fast hash functions — attackers can test billions of password guesses per second against them. bcrypt is intentionally slow (it has a "cost factor" or `saltRounds`). It also automatically generates a unique random salt per password, preventing rainbow table attacks. This makes brute-force attacks impractical.

---

**Q: Explain the async pattern for blockchain writes.**
A: Blockchain transactions take 1–5 seconds to confirm. If we waited synchronously, every API call would be slow. We use `setImmediate()` to defer the blockchain write after the HTTP response is already sent. The MongoDB document is saved immediately so the data isn't lost. Once the blockchain confirms, we update the MongoDB record with the `blockchainTxHash`. This gives us speed without sacrificing the audit trail.

---

**Q: What is the ABI?**
A: ABI stands for Application Binary Interface. It's a JSON file describing a smart contract's functions and events — their names, parameter types, and return types. ethers.js uses the ABI to know how to encode a function call before sending it to the blockchain. Without the ABI, you'd be sending raw hexadecimal data blindly.

---

**Q: What does `indexed` mean in a Solidity event?**
A: When you mark an event parameter as `indexed`, Ethereum stores it in the transaction's "topics" list instead of the data field. Topics are hashed and stored in a special bloom filter that makes them efficiently searchable. You can filter all historical logs by an indexed parameter (e.g., find all events by a particular address) without scanning every transaction.

---

**Q: What is `calldata` in Solidity?**
A: `calldata` is a special read-only memory location for function arguments. It is the cheapest way to receive data in an external function because Solidity doesn't copy it to memory — it reads directly from the transaction input. Using `calldata` instead of `memory` for string parameters reduces gas costs.

---

**Q: Why did you separate blockchain.js and auditLog.js into two services?**
A: This is the Single Responsibility Principle. `blockchain.js` only knows how to talk to the Ethereum contract — it knows nothing about MongoDB or audit logs. `auditLog.js` orchestrates the dual-write logic — it knows both MongoDB and blockchain. If we ever switch from ethers.js to web3.js, or from Ganache to a different network, we only change `blockchain.js`. The rest of the codebase is unaffected.

---

### Advanced

**Q: What guarantees that blockchain data is immutable?**
A: Ethereum uses a cryptographic data structure called a Merkle Patricia Tree. Each block contains a hash of the previous block — changing any past transaction would change its block's hash, which would break the hash of every subsequent block, requiring recalculating the proof-of-work for the entire chain. With thousands of nodes independently maintaining the same chain, it is computationally impossible to alter past data.

---

**Q: Could a miner fake a `block.timestamp`?**
A: Miners can manipulate `block.timestamp` by up to ~15 seconds (this is called "timestamp manipulation"). For a healthcare audit log, a 15-second inaccuracy is acceptable. If you needed precision to the second for financial contracts, you'd use an oracle service like Chainlink for time data.

---

**Q: What is gas in Ethereum?**
A: Gas is the unit of computational work on Ethereum. Every operation (addition, storage write, event emit) costs a fixed amount of gas. Gas prevents infinite loops and spam — you must pay for every computation. Gas price (in ETH) multiplied by gas used equals the transaction fee. Emitting an event is much cheaper than writing to storage.

---

**Q: Why did you choose events over storing data in a Solidity mapping?**
A: Storing a string in a Solidity `mapping` costs ~20,000 gas per 32-byte slot. Emitting an event costs ~375 gas base plus ~8 gas per byte. Since our audit log only needs to be read externally (not by other contracts on-chain), events are 10–50× cheaper. Events are also easier to query from JavaScript using `ethers.js` provider.getLogs().

---

**Q: What is the difference between `memory` and `storage` in Solidity?**
A: `storage` is persistent data written to the blockchain — expensive (~20,000 gas to write). `memory` is temporary data that exists only during a function call — cheap and erased after. `calldata` is like `memory` but read-only and even cheaper for function parameters. Our contract only emits events and uses a single `storage` variable (`counter`) to keep costs low.

---

**Q: How would you scale this for production?**
A: Several changes would be needed:
1. Replace Ganache with a real network — Ethereum mainnet, or a cheaper Layer 2 like Polygon.
2. Use a managed RPC provider (Infura, Alchemy) instead of a local node.
3. Store the private key in a secrets vault (HashiCorp Vault, AWS KMS), never in `.env` files.
4. Add HTTPS/TLS, rate limiting, and input sanitization.
5. The MongoDB + Blockchain dual-write could trigger via a message queue (like RabbitMQ) for better reliability under high load.

---

**Q: What happens if the blockchain transaction fails but MongoDB already has the record?**
A: The `blockchainTxHash` field in MongoDB will remain `null`. The record still exists in MongoDB — no data is lost. An admin could detect un-hashed records by querying `{ blockchainTxHash: null }`. A background job could retry those entries. This is a trade-off we made: availability over perfect consistency (the CAP theorem).

---

**Q: How does CORS work and why did you configure it?**
A: CORS (Cross-Origin Resource Sharing) is a browser security feature. By default, a browser blocks JavaScript on `http://localhost:3000` from calling `http://localhost:5000` because they are different "origins" (different port = different origin). The backend must explicitly allow the frontend's origin. We configured the Express CORS middleware with a regex that matches any `localhost` or `127.0.0.1` origin on any port.

---

**Q: If someone steals the JWT token, can they access the system?**
A: Yes, until the token expires. JWT is stateless — the server has no way to revoke an individual token (there's no session table). Mitigations include: short expiry times, refresh token rotation, and maintaining a server-side token blacklist. For a medical system, short-lived tokens (15–30 minutes) with refresh tokens would be the production approach.

---

## 10. Key Terms You Must Know

| Term | Definition |
|---|---|
| **Blockchain** | A distributed ledger of transactions grouped in cryptographically linked blocks. Tamper-proof because altering one block breaks all subsequent block hashes. |
| **Smart Contract** | Self-executing code deployed on a blockchain. Runs automatically when called, cannot be modified after deployment. |
| **Solidity** | Statically-typed programming language for writing Ethereum smart contracts. |
| **ABI** | Application Binary Interface — JSON description of a contract's functions/events that lets external code call them correctly. |
| **Gas** | Unit of computational effort on Ethereum. Every operation costs gas, paid in ETH. Prevents abuse and spam. |
| **Event (Solidity)** | A way to write data to blockchain logs cheaply. Indexed for efficient filtering. Cannot be read by on-chain code, only by external clients. |
| **Merkle Tree** | Tree data structure where each node is the hash of its children. Used in Ethereum to efficiently prove data integrity. |
| **RPC** | Remote Procedure Call — the protocol used to communicate with an Ethereum node (e.g., `eth_sendTransaction`). |
| **Wallet / Private Key** | A 256-bit private key represents your Ethereum identity. Signing a transaction with it proves you authorized it. |
| **Ganache** | Local Ethereum blockchain simulator for development. Provides instant mining and pre-funded accounts. |
| **Hardhat** | Development toolkit for Solidity — compiles, tests, and deploys smart contracts. |
| **ethers.js** | JavaScript library for interacting with Ethereum — creating wallets, encoding calls, sending transactions, reading events. |
| **JWT** | JSON Web Token. A signed, self-contained token for stateless authentication. |
| **bcrypt** | Password hashing algorithm intentionally designed to be slow, preventing brute-force attacks. |
| **RBAC** | Role-Based Access Control. Permissions tied to roles (admin/doctor/patient) rather than individual users. |
| **CORS** | Cross-Origin Resource Sharing. Browser policy controlling which domains can call your API. |
| **Mongoose** | ODM (Object Data Modeling) library for MongoDB in Node.js. Provides schemas, validation, and query helpers. |
| **Middleware** | Functions in Express that execute between receiving a request and sending a response. Used for auth, logging, body parsing. |
| **setImmediate** | Node.js function to defer execution until after the current I/O event loop tick. Used to avoid blocking the HTTP response. |
| **HIPAA** | US law protecting patient health information. Requires audit trails for data access — this is exactly what MedLedger provides. |
| **Immutability** | Property of data that cannot be changed after creation. Blockchain transactions are immutable. |
| **Dual-Write** | Pattern of writing the same logical event to two different stores (here: MongoDB + blockchain) for different guarantees. |
| **CAP Theorem** | States a distributed system can guarantee only 2 of: Consistency, Availability, Partition Tolerance. MedLedger prioritizes Availability (API stays up even if blockchain is down). |
| **Truffle** | Older Ethereum development framework. Ganache GUI reads Truffle-format artifacts to decode contract events. |
| **deployedBytecode** | The compiled bytecode of a contract as it exists on-chain (without constructor code). Ganache uses this to identify which contract a transaction interacted with. |

---

## Quick Reference — Project Files

```
medledger-blockchain/
│
├── backend/
│   ├── server.js                          # Express app entry point, CORS config
│   ├── .env                               # Secrets (JWT, MongoDB URI, blockchain vars)
│   └── src/
│       ├── config/
│       │   ├── db.js                      # MongoDB connection
│       │   └── AuditLoggerABI.json        # Contract ABI for ethers.js
│       ├── middleware/
│       │   └── auth.js                    # verifyToken + requireRole
│       ├── models/
│       │   ├── User.js                    # User schema (all roles)
│       │   ├── PatientRecord.js           # Medical records
│       │   ├── AccessPermission.js        # Doctor-patient access grants
│       │   └── AuditLog.js               # Audit log + blockchainTxHash
│       ├── services/
│       │   ├── blockchain.js              # ethers.js wrapper (logToBlockchain, verifyTransaction)
│       │   └── auditLog.js               # Dual-write: MongoDB + blockchain
│       ├── controllers/
│       │   ├── authController.js          # login, register
│       │   ├── adminController.js         # user management, audit logs
│       │   ├── doctorController.js        # record access, viewing
│       │   └── patientController.js       # record management, access grants
│       └── routes/
│           ├── auth.js                    # /api/auth/*
│           ├── admin.js                   # /api/admin/*
│           ├── doctor.js                  # /api/doctor/*
│           └── patient.js                 # /api/patient/*
│
├── frontend/
│   └── src/
│       ├── context/AuthContext.js         # Global auth state
│       ├── components/
│       │   ├── Navbar.js                  # Navigation bar
│       │   └── PrivateRoute.js            # Route guard
│       ├── pages/
│       │   ├── Login.js / Register.js     # Auth pages
│       │   ├── AdminDashboard.js          # User management + audit logs
│       │   ├── DoctorDashboard.js         # Record access + viewing
│       │   └── PatientDashboard.js        # Records + access control
│       └── services/api.js               # Axios instance + all API calls
│
└── blockchain/
    ├── contracts/AuditLogger.sol          # Solidity smart contract
    ├── scripts/deploy.js                  # Deploys contract to Ganache
    ├── hardhat.config.js                  # Hardhat 2 + Ganache network config
    ├── truffle-config.js                  # Allows Ganache GUI to decode events
    └── build/contracts/AuditLogger.json   # Truffle artifact (ABI + address)
```

---

*Report generated for MedLedger — Blockchain-Integrated Healthcare Records System*
