import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  createRecord,
  getIncomingRequests,
  getMyRecords,
  grantAccess,
  requestWalletLinkNonce,
  revokeAccess,
  verifyWalletLink,
} from '../services/api';
import { extractApiError } from '../utils/apiError';

const CONSULTATION_FEE_ETH = import.meta.env.VITE_CONSULTATION_FEE_ETH || '0.01';

/**
 * PatientDashboard shows:
 * 1. My Records – list with inline form to add new records
 * 2. Access Requests – incoming doctor requests with Grant/Revoke actions
 */
const PatientDashboard = () => {
  const { user, updateUser } = useAuth();
  const [records, setRecords] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [paymentPendingRequestId, setPaymentPendingRequestId] = useState('');
  const [walletLinkLoading, setWalletLinkLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState({ address: '', balanceEth: '', chainId: '' });

  // New record form state
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({
    title: '', description: '',
  });
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rRes, aRes] = await Promise.all([getMyRecords(), getIncomingRequests()]);
      setRecords(rRes.data.records || rRes.data);
      setAccessRequests(aRes.data.requests || aRes.data);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const flash = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleRecordChange = (e) =>
    setRecordForm({ ...recordForm, [e.target.name]: e.target.value });

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setRecordError('');
    setRecordLoading(true);
    try {
      const payload = {
        title: recordForm.title.trim(),
        description: recordForm.description.trim(),
      };
      await createRecord(payload);
      flash('Checkup request created. Doctor will fill diagnosis and prescription.');
      setShowRecordForm(false);
      setRecordForm({ title: '', description: '' });
      fetchData();
    } catch (err) {
      setRecordError(extractApiError(err, 'Failed to create record.'));
    } finally {
      setRecordLoading(false);
    }
  };

  const handleGrant = async (request) => {
    const reqId = request._id || request.id;
    const doctorWallet = request.doctorId?.ethereumAddress;
    const consultationFeeWei = ethers.parseEther(CONSULTATION_FEE_ETH);

    setError('');

    if (!window.ethereum) {
      setError('MetaMask not detected. Please install MetaMask to approve with payment.');
      return;
    }
    if (!doctorWallet || !ethers.isAddress(doctorWallet)) {
      setError('Doctor wallet address is missing or invalid. Ask the doctor to link MetaMask.');
      return;
    }

    setPaymentPendingRequestId(reqId);

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
        setPaymentPendingRequestId('');
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
        setError(`Insufficient funds for payment + gas. Please fund the patient wallet and retry.`);
      } else {
        setError(extractApiError(err, 'Payment failed in MetaMask. Access was not granted.'));
      }
      setPaymentPendingRequestId('');
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
    } finally {
      setPaymentPendingRequestId('');
    }
  };

  const handleConnectWallet = async () => {
    setError('');
    setWalletLinkLoading(true);

    try {
      if (!window.ethereum) {
        setError('MetaMask not detected. Please install MetaMask first.');
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = (await signer.getAddress()).toLowerCase();
      const balanceWei = await provider.getBalance(address);
      const network = await provider.getNetwork();

      setWalletInfo({
        address,
        balanceEth: ethers.formatEther(balanceWei),
        chainId: network.chainId.toString(),
      });

      const nonceRes = await requestWalletLinkNonce(address);
      const message = nonceRes.data?.message;
      if (!message) {
        throw new Error('Wallet link message was not returned by server.');
      }

      const signature = await signer.signMessage(message);
      const verifyRes = await verifyWalletLink(address, signature);
      const linkedUser = verifyRes.data?.user;

      if (linkedUser) {
        updateUser(linkedUser);
      }

      flash('MetaMask wallet linked successfully.');
      fetchData();
    } catch (err) {
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
        setError('MetaMask signature request was rejected. Wallet not linked.');
      } else {
        setError(extractApiError(err, 'Failed to link MetaMask wallet.'));
      }
    } finally {
      setWalletLinkLoading(false);
    }
  };

  const handleRevoke = async (reqId) => {
    try {
      await revokeAccess(reqId);
      flash('Access revoked.');
      fetchData();
    } catch (err) {
      setError(extractApiError(err, 'Failed to revoke access.'));
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'granted') return 'badge badge-success';
    if (status === 'revoked') return 'badge badge-danger';
    return 'badge badge-warning';
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1 className="page-title">Patient Dashboard</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {actionMsg && <div className="alert alert-success">{actionMsg}</div>}
        {loading && <div className="loading">Loading…</div>}

        <div className="card">
          <div className="card-header">
            <h2>Wallet</h2>
            <button
              className="btn btn-primary"
              onClick={handleConnectWallet}
              disabled={walletLinkLoading}
            >
              {walletLinkLoading ? 'Connecting…' : user?.ethereumAddress ? 'Reconnect MetaMask' : 'Connect MetaMask'}
            </button>
          </div>
          <p className="text-muted">
            Linked wallet: {user?.ethereumAddress || 'Not linked'}
          </p>
          {walletInfo.address && (
            <p className="text-muted">
              Connected wallet: {walletInfo.address} | Chain ID: {walletInfo.chainId || '—'} | Balance: {walletInfo.balanceEth} ETH
            </p>
          )}
        </div>

        {/* ── My Records Section ── */}
        <div className="card">
          <div className="card-header">
            <h2>My Medical Records</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowRecordForm(!showRecordForm)}
            >
              {showRecordForm ? 'Cancel' : '+ Add Record'}
            </button>
          </div>

          {/* Add record inline form */}
          {showRecordForm && (
            <form onSubmit={handleCreateRecord} className="inline-form">
              <h3>New Checkup Request</h3>
              {recordError && <div className="alert alert-error">{recordError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    name="title"
                    className="form-input"
                    value={recordForm.title}
                    onChange={handleRecordChange}
                    required
                    placeholder="Annual Checkup"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Symptoms / Notes (optional)</label>
                <textarea
                  name="description"
                  className="form-input"
                  value={recordForm.description}
                  onChange={handleRecordChange}
                  rows={3}
                  placeholder="Headache for 3 days, mild fever..."
                />
              </div>
              <button type="submit" className="btn btn-success" disabled={recordLoading}>
                {recordLoading ? 'Saving…' : 'Create Checkup Request'}
              </button>
            </form>
          )}

          {/* Records list */}
          {records.length === 0 && !loading ? (
            <p className="empty-msg">No records yet. Click "Add Record" to create one.</p>
          ) : (
            <div className="records-grid">
              {records.map((rec, i) => (
                <div key={rec._id || i} className="record-card">
                  <h4>{rec.title}</h4>
                  <p><strong>Status:</strong> {rec.diagnosis || rec.prescription ? 'Doctor Updated' : 'Awaiting Doctor'}</p>
                  <p><strong>Diagnosis:</strong> {rec.diagnosis || '—'}</p>
                  <p><strong>Prescription:</strong> {rec.prescription || '—'}</p>
                  {rec.description && <p className="record-desc">{rec.description}</p>}
                  <span className="text-muted text-sm">
                    {new Date(rec.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Access Requests Section ── */}
        <div className="card">
          <div className="card-header"><h2>Doctor Access Requests</h2></div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Requested At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.length === 0 && (
                  <tr><td colSpan={4} className="text-center">No access requests.</td></tr>
                )}
                {accessRequests.map((req, i) => (
                  <tr key={req._id || i}>
                    <td>{req.doctorId?.name || req.doctorId || '—'}</td>
                    <td>{formatDateTime(req.requestedAt || req.createdAt)}</td>
                    <td><span className={statusBadgeClass(req.status)}>{req.status}</span></td>
                    <td className="action-cell">
                      {req.status === 'pending' && (() => {
                        const reqId = req._id || req.id;
                        const isApproving = paymentPendingRequestId === reqId;

                        return (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleGrant(req)}
                              disabled={isApproving}
                            >
                              {isApproving ? 'Processing Payment…' : 'Approve + Pay'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRevoke(req._id || req.id)}
                              disabled={isApproving}
                            >
                              Reject
                            </button>
                          </>
                        );
                      })()}
                      {req.status === 'granted' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRevoke(req._id || req.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default PatientDashboard;
