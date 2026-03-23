# MedLedger Viva Implementation Guide

Date: March 24, 2026

This document explains exactly what was implemented for:
1. MetaMask based consultation fee payment on access grant
2. Wallet linking by patient and doctor themselves (not by admin)
3. Doctor and patient wallet visibility and profile/wallet pages
4. UI modernization and navbar improvements

## 1. End to End Flow Summary

When a patient clicks Approve + Pay:
1. Frontend validates doctor wallet and MetaMask availability.
2. Frontend opens MetaMask and sends ETH payment to doctor wallet.
3. Frontend waits for on-chain confirmation.
4. Only after confirmation, frontend calls backend grant API with paymentTxHash.
5. Backend stores paymentTxHash in AccessPermission.
6. Backend writes audit event ACCESS_GRANTED_WITH_PAYMENT and async logs it to blockchain.

## 2. Frontend Implementation

## 2.1 Routes Added for Profile and Wallet

File: frontend/src/App.jsx

    import UserProfile from './pages/UserProfile';

    <Route
      path="/profile"
      element={
        <PrivateRoute>
          <UserProfile />
        </PrivateRoute>
      }
    />
    <Route
      path="/wallet"
      element={
        <PrivateRoute>
          <UserProfile />
        </PrivateRoute>
      }
    />

Why:
1. Gives users a dedicated profile and wallet details screen.
2. Keeps route protected for authenticated users only.

## 2.2 Navbar Updated with Dashboard, Profile, Wallet, Logout

File: frontend/src/components/Navbar.jsx

    import { useLocation, useNavigate } from 'react-router-dom';

    const dashboardPath = user?.role ? `/${user.role}` : '/login';
    const showWalletActions = user?.role === 'doctor' || user?.role === 'patient';

    <button className={`btn btn-ghost btn-sm ${isActive(dashboardPath) ? 'btn-ghost-active' : ''}`}>
      Dashboard
    </button>
    <button className={`btn btn-ghost btn-sm ${isActive('/profile') ? 'btn-ghost-active' : ''}`}>
      Profile
    </button>
    {showWalletActions && (
      <button className={`btn btn-ghost btn-sm ${isActive('/wallet') ? 'btn-ghost-active' : ''}`}>
        Wallet
      </button>
    )}

Why:
1. Requested profile button beside logout is implemented.
2. Wallet button in navbar is implemented for doctor and patient.

## 2.3 Patient Approve + Pay Flow with MetaMask

File: frontend/src/pages/PatientDashboard.jsx

Key constants:

    const CONSULTATION_FEE_ETH = import.meta.env.VITE_CONSULTATION_FEE_ETH || '0.01';

Core handler:

    const handleGrant = async (request) => {
      const reqId = request._id || request.id;
      const doctorWallet = request.doctorId?.ethereumAddress;
      const consultationFeeWei = ethers.parseEther(CONSULTATION_FEE_ETH);

      if (!window.ethereum) {
        setError('MetaMask not detected. Please install MetaMask to approve with payment.');
        return;
      }
      if (!doctorWallet || !ethers.isAddress(doctorWallet)) {
        setError('Doctor wallet address is missing or invalid. Ask the doctor to link MetaMask.');
        return;
      }

      let paymentTxHash = '';

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();

        const signerAddress = await signer.getAddress();
        const balanceWei = await provider.getBalance(signerAddress);
        const network = await provider.getNetwork();

        setWalletInfo({
          address: signerAddress,
          balanceEth: ethers.formatEther(balanceWei),
          chainId: network.chainId.toString(),
        });

        if (balanceWei < consultationFeeWei) {
          setError(
            `Insufficient funds on account ${signerAddress} (chain ${network.chainId.toString()}). Wallet balance is ${ethers.formatEther(balanceWei)} ETH, but at least ${CONSULTATION_FEE_ETH} ETH (+ gas) is required.`
          );
          return;
        }

        const paymentTx = await signer.sendTransaction({
          to: doctorWallet,
          value: consultationFeeWei,
        });

        const receipt = await paymentTx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error('Payment transaction failed on-chain. Access was not granted.');
        }

        paymentTxHash = paymentTx.hash;
      } catch (err) {
        if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
          setError('Transaction rejected in MetaMask. Access was not granted.');
        } else if (
          err?.code === 'INSUFFICIENT_FUNDS' ||
          /insufficient funds/i.test(err?.shortMessage || '') ||
          /insufficient funds/i.test(err?.message || '')
        ) {
          setError('Insufficient funds for payment + gas. Please fund the patient wallet and retry.');
        } else {
          setError(extractApiError(err, 'Payment failed in MetaMask. Access was not granted.'));
        }
        return;
      }

      try {
        await grantAccess(reqId, { paymentTxHash });
        flash('Payment confirmed and access granted.');
        fetchData();
      } catch (err) {
        setError(
          extractApiError(
            err,
            `Payment succeeded (tx: ${paymentTxHash.slice(0, 10)}...) but backend access grant failed. Please retry.`
          )
        );
      }
    };

Why:
1. MetaMask popup occurs on approve action only.
2. Backend grant is strictly after confirmed payment.
3. Strong handling for reject and insufficient funds.

## 2.4 Doctor Wallet Details and Received ETH Summary

File: frontend/src/pages/DoctorDashboard.jsx

    const [walletInfo, setWalletInfo] = useState({ address: '', balanceEth: '', chainId: '' });
    const [receivedSummary, setReceivedSummary] = useState({ totalReceivedEth: '0', txCount: 0 });

    const loadDoctorWalletSummary = useCallback(async (requests) => {
      ...
      const paid = requests.filter((item) => item.status === 'granted' && item.paymentTxHash);
      ...
      const tx = await provider.getTransaction(item.paymentTxHash);
      if (tx.to.toLowerCase() !== address.toLowerCase()) return;
      totalWei += tx.value;
      txCount += 1;
      ...
      setReceivedSummary({ totalReceivedEth: ethers.formatEther(totalWei), txCount });
    }, [user?.ethereumAddress]);

Displayed in UI:

    <p className="text-muted">
      Consultation ETH received: {receivedSummary.totalReceivedEth} ETH ({receivedSummary.txCount} tx)
    </p>

Why:
1. Doctor can see how much consultation ETH has been received.
2. Uses paymentTxHash entries already stored in grants.

## 2.5 Dedicated Profile and Wallet Screen

File: frontend/src/pages/UserProfile.jsx

Highlights:

    const walletTitle = useMemo(() => {
      if (location.pathname === '/wallet') return 'Wallet Details';
      return 'Profile';
    }, [location.pathname]);

    const requestsResponse = user.role === 'doctor'
      ? await getAccessRequests()
      : await getIncomingRequests();

    const paidRequests = requests.filter((item) => item.status === 'granted' && item.paymentTxHash);

    const isDoctorIncome = user.role === 'doctor' && tx.to && tx.to.toLowerCase() === address.toLowerCase();
    const isPatientSpend = user.role === 'patient' && tx.from && tx.from.toLowerCase() === address.toLowerCase();

    setWalletStats({
      totalReceivedEth: user.role === 'doctor' ? ethers.formatEther(totalWei) : '0',
      totalPaidEth: user.role === 'patient' ? ethers.formatEther(totalWei) : '0',
      txCount,
      lastPaymentTxHash,
    });

Why:
1. One consolidated screen for account and wallet metrics.
2. Shows role specific ETH received/paid details requested for viva/demo.

## 2.6 API Client and Error Handling

File: frontend/src/services/api.js

Added wallet auth APIs:

    export const requestWalletLinkNonce = (address) => api.post('/api/auth/wallet/nonce', { address });
    export const verifyWalletLink = (address, signature) =>
      api.post('/api/auth/wallet/verify', { address, signature });

Grant call supports paymentTxHash:

    export const grantAccess = (reqId, data) => api.patch(`/api/patient/access-requests/${reqId}/grant`, data);

File: frontend/src/utils/apiError.js

Improved non Axios error support (ethers/MetaMask):

    const isAxiosLike = Boolean(error?.isAxiosError || error?.config || error?.response);

    if (!isAxiosLike) {
      if (typeof error?.shortMessage === 'string' && error.shortMessage.trim()) return error.shortMessage;
      if (typeof error?.reason === 'string' && error.reason.trim()) return error.reason;
      if (typeof error?.message === 'string' && error.message.trim()) return error.message;
      return fallbackMessage;
    }

Why:
1. Prevents showing wrong message like server unreachable for wallet errors.

## 2.7 Auth Context Update for Live Profile Refresh

File: frontend/src/context/AuthContext.jsx

    const updateUser = useCallback((nextUser) => {
      if (!nextUser) return;
      localStorage.setItem('user', JSON.stringify(nextUser));
      setUser(nextUser);
    }, []);

Why:
1. After wallet linking, UI updates instantly without relogin.

## 2.8 Modern Global Styling

File: frontend/src/styles/App.css

Main upgrades:
1. New design tokens in :root
2. Modern gradient navbar and ghost nav actions
3. Improved card, table, button, auth, and profile sections
4. Responsive behavior for mobile layouts

Example tokens:

    :root {
      --bg: #f6f9f8;
      --surface: #ffffff;
      --primary: #1e6cc7;
      --shadow-sm: 0 8px 20px rgba(20, 36, 61, 0.08);
      --radius-lg: 16px;
    }

## 3. Backend Implementation

## 3.1 User Model Wallet Fields

File: backend/src/models/User.js

    ethereumAddress: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address'],
      unique: true,
      sparse: true,
    },
    walletLinkNonce: {
      type: String,
      default: null,
    },
    walletLinkNonceExpiresAt: {
      type: Date,
      default: null,
    },

Why:
1. Unique wallet per user.
2. Secure nonce based wallet linking.

## 3.2 Wallet Linking APIs (Nonce + Verify)

Files:
1. backend/src/controllers/authController.js
2. backend/src/routes/auth.js

Controller snippets:

    const WALLET_NONCE_TTL_MS = 10 * 60 * 1000;

    const walletLinkMessage = ({ nonce, userId, address }) => (
      `MedLedger wallet link request\nNonce: ${nonce}\nUser: ${userId}\nWallet: ${address}`
    );

    const createWalletLinkNonce = async (req, res) => {
      const nonce = crypto.randomBytes(16).toString('hex');
      req.user.walletLinkNonce = nonce;
      req.user.walletLinkNonceExpiresAt = new Date(Date.now() + WALLET_NONCE_TTL_MS);
      ...
    };

    const verifyAndLinkWallet = async (req, res) => {
      ...
      const recovered = ethers.verifyMessage(message, signature).toLowerCase();
      if (recovered !== address) return res.status(401).json({ message: 'Signature verification failed' });
      ...
      freshUser.ethereumAddress = address;
      freshUser.walletLinkNonce = null;
      freshUser.walletLinkNonceExpiresAt = null;
      ...
    };

Routes:

    router.post('/wallet/nonce', [verifyToken, requireRole('doctor', 'patient'), ...], createWalletLinkNonce);
    router.post('/wallet/verify', [verifyToken, requireRole('doctor', 'patient'), ...], verifyAndLinkWallet);

Why:
1. Only authenticated doctor/patient can link wallet.
2. Signature verification ensures wallet ownership proof.

## 3.3 Access Grant With Payment Hash

Files:
1. backend/src/models/AccessPermission.js
2. backend/src/routes/patient.js
3. backend/src/controllers/patientController.js

Model:

    paymentTxHash: {
      type: String,
      trim: true,
      default: null,
      match: /^0x[a-fA-F0-9]{64}$/,
    },

Route validation:

    body('paymentTxHash')
      .trim()
      .notEmpty()
      .withMessage('paymentTxHash is required')
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage('paymentTxHash must be a valid Ethereum transaction hash')

Controller grant:

    const paymentTxHash = req.body.paymentTxHash?.trim();
    ...
    permission.status = 'granted';
    permission.respondedAt = new Date();
    permission.paymentTxHash = paymentTxHash;
    await permission.save();

    await createAuditLog({
      action: 'ACCESS_GRANTED_WITH_PAYMENT',
      performedBy: req.user._id,
      targetUser: permission.doctorId,
      details: {
        permissionId: permission._id,
        paymentTxHash,
      },
    });

Why:
1. Access grant is tied to blockchain payment proof.
2. Audit includes payment hash.

## 3.4 Admin Account Creation Logic Kept Same, Wallet Input Removed

Files:
1. backend/src/controllers/adminController.js
2. backend/src/routes/admin.js

Doctor creation remains with:

    const doctor = await User.create({
      name,
      email,
      password,
      role: 'doctor',
      isApproved: true,
      specialization,
    });

Why:
1. Admin still creates doctor account.
2. Wallet is linked by doctor themselves later.

## 3.5 Blockchain Audit Service

Files:
1. backend/src/services/auditLog.js
2. backend/src/services/blockchain.js

Async blockchain write flow:

    const log = await AuditLog.create({ action, performedBy, targetUser, details });

    setImmediate(async () => {
      const payload = JSON.stringify({
        mongoId: log._id.toString(),
        action,
        ...(details || {}),
      });

      const txHash = await logToBlockchain(action, payload);
      if (txHash) {
        await AuditLog.findByIdAndUpdate(log._id, { blockchainTxHash: txHash });
      }
    });

Why:
1. API response is not blocked by blockchain latency.
2. Mongo and blockchain audit trails remain linked.

## 4. Viva Talking Points

Use these in viva:
1. Security: Wallet linking uses nonce + signature verification, not plain address submission.
2. Integrity: Access is granted only after payment confirmation and paymentTxHash is stored.
3. Auditability: Every critical action is logged in MongoDB and mirrored to AuditLogger contract.
4. UX: Clear user feedback for MetaMask rejection, insufficient funds, and backend errors.
5. Scalability: Blockchain logging is asynchronous so API remains responsive.
6. Maintainability: Wallet/Profile logic centralized with shared API helpers and AuthContext updateUser.

## 5. Exact File List Changed for This Feature Set

Frontend:
1. frontend/src/App.jsx
2. frontend/src/components/Navbar.jsx
3. frontend/src/pages/PatientDashboard.jsx
4. frontend/src/pages/DoctorDashboard.jsx
5. frontend/src/pages/UserProfile.jsx
6. frontend/src/services/api.js
7. frontend/src/utils/apiError.js
8. frontend/src/context/AuthContext.jsx
9. frontend/src/styles/App.css

Backend:
1. backend/src/models/User.js
2. backend/src/controllers/authController.js
3. backend/src/routes/auth.js
4. backend/src/models/AccessPermission.js
5. backend/src/routes/patient.js
6. backend/src/controllers/patientController.js
7. backend/src/controllers/adminController.js
8. backend/src/routes/admin.js
9. backend/src/services/auditLog.js
10. backend/src/services/blockchain.js
