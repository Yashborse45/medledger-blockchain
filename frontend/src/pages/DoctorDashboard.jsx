import { ethers } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import {
  getAccessRequests,
  getMyPatients,
  getPatientRecords,
  requestAccess,
  requestWalletLinkNonce,
  searchPatients,
  updatePatientRecordByDoctor,
  verifyWalletLink,
} from '../services/api';
import { extractApiError } from '../utils/apiError';

/**
 * DoctorDashboard shows:
 * 1. Patients with granted access and their records (expandable)
 * 2. Patient search + access request flow (search by name/email, then click Request)
 * 3. All access requests with their current status
 */
const DoctorDashboard = () => {
  const { user, updateUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletLinkLoading, setWalletLinkLoading] = useState(false);
  const [walletInfo, setWalletInfo] = useState({ address: '', balanceEth: '', chainId: '' });
  const [receivedSummary, setReceivedSummary] = useState({ totalReceivedEth: '0', txCount: 0 });

  // Patient search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  // Per-patient request state: { [patientId]: { loading, msg, error } }
  const [requestState, setRequestState] = useState({});
  const [recordEditState, setRecordEditState] = useState({});

  // State for expanded patient record panel
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  const searchInputRef = useRef(null);

  const getId = (value) => (value?._id || value?.id || value || '').toString();

  const resolveAccessStatus = (patient) => {
    if (patient?.accessStatus && patient.accessStatus !== 'none') {
      return patient.accessStatus;
    }

    const patientId = getId(patient);
    const matching = accessRequests.find((item) => getId(item.patientId) === patientId);
    return matching?.status || 'none';
  };

  const loadDoctorWalletSummary = useCallback(async (requests) => {
    if (!window.ethereum || !user?.ethereumAddress) {
      setReceivedSummary({ totalReceivedEth: '0', txCount: 0 });
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_accounts', []);
    if (!accounts || accounts.length === 0) {
      setReceivedSummary({ totalReceivedEth: '0', txCount: 0 });
      return;
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const [network, balanceWei] = await Promise.all([
      provider.getNetwork(),
      provider.getBalance(address),
    ]);

    setWalletInfo({
      address,
      balanceEth: ethers.formatEther(balanceWei),
      chainId: network.chainId.toString(),
    });

    const paid = requests.filter((item) => item.status === 'granted' && item.paymentTxHash);
    let totalWei = 0n;
    let txCount = 0;

    await Promise.all(
      paid.map(async (item) => {
        try {
          const tx = await provider.getTransaction(item.paymentTxHash);
          if (!tx || !tx.value || !tx.to) return;
          if (tx.to.toLowerCase() !== address.toLowerCase()) return;

          totalWei += tx.value;
          txCount += 1;
        } catch (txErr) {
          console.error('Failed to load payment tx details:', txErr);
        }
      })
    );

    setReceivedSummary({ totalReceivedEth: ethers.formatEther(totalWei), txCount });
  }, [user?.ethereumAddress]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes] = await Promise.all([getMyPatients(), getAccessRequests()]);
      const requests = rRes.data.requests || rRes.data || [];
      setPatients(pRes.data.patients || pRes.data);
      setAccessRequests(requests);
      await loadDoctorWalletSummary(requests);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load data.'));
    } finally {
      setLoading(false);
    }
  }, [loadDoctorWalletSummary]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError('Enter at least 2 characters to search.');
      return;
    }
    setSearchError('');
    setSearchResults([]);
    setSearchLoading(true);
    setSearched(true);
    try {
      const res = await searchPatients(q);
      setSearchResults(res.data.patients || []);
    } catch (err) {
      setSearchError(extractApiError(err, 'Search failed.'));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRequestAccess = async (patient) => {
    const id = patient._id;
    setRequestState((prev) => ({ ...prev, [id]: { loading: true, msg: '', error: '' } }));
    try {
      const res = await requestAccess(id);
      setRequestState((prev) => ({
        ...prev,
        [id]: { loading: false, msg: res.data?.message || 'Request sent.', error: '' },
      }));
      fetchData();
    } catch (err) {
      setRequestState((prev) => ({
        ...prev,
        [id]: { loading: false, msg: '', error: extractApiError(err, 'Failed to send request.') },
      }));
    }
  };

  const toggleRecordEditor = (recordId) => {
    setRecordEditState((prev) => {
      const current = prev[recordId] || {};
      return {
        ...prev,
        [recordId]: {
          ...current,
          open: !current.open,
          diagnosis: current.diagnosis || '',
          prescription: current.prescription || '',
          description: current.description || '',
          loading: false,
          error: '',
          success: '',
        },
      };
    });
  };

  const handleRecordFieldChange = (recordId, field, value) => {
    setRecordEditState((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || {}),
        [field]: value,
      },
    }));
  };

  const handleDoctorUpdateRecord = async (patientId, recordId) => {
    const state = recordEditState[recordId] || {};
    setRecordEditState((prev) => ({
      ...prev,
      [recordId]: { ...(prev[recordId] || {}), loading: true, error: '', success: '' },
    }));

    try {
      const payload = {
        diagnosis: state.diagnosis || '',
        prescription: state.prescription || '',
        description: state.description || '',
      };

      await updatePatientRecordByDoctor(patientId, recordId, payload);

      setRecordEditState((prev) => ({
        ...prev,
        [recordId]: {
          ...(prev[recordId] || {}),
          loading: false,
          success: 'Record updated and sent to patient.',
          error: '',
          open: false,
        },
      }));

      setSearchResults((prev) =>
        prev.map((patient) => {
          if (patient._id !== patientId) return patient;
          return {
            ...patient,
            openCheckups: (patient.openCheckups || []).filter((item) => item._id !== recordId),
          };
        })
      );

      setPatients((prev) =>
        prev.map((patient) => {
          if (getId(patient) !== patientId) return patient;
          return {
            ...patient,
            openCheckups: (patient.openCheckups || []).filter((item) => item._id !== recordId),
          };
        })
      );

      fetchData();
    } catch (err) {
      setRecordEditState((prev) => ({
        ...prev,
        [recordId]: {
          ...(prev[recordId] || {}),
          loading: false,
          error: extractApiError(err, 'Failed to update patient record.'),
          success: '',
        },
      }));
    }
  };

  const handleViewRecords = async (patient) => {
    if (expandedPatient === (patient._id || patient.id)) {
      setExpandedPatient(null);
      setPatientRecords([]);
      setRecordsError('');
      return;
    }
    setExpandedPatient(patient._id || patient.id);
    setRecordsError('');
    setRecordsLoading(true);
    try {
      const res = await getPatientRecords(patient._id || patient.id);
      setPatientRecords(res.data.records || res.data);
    } catch (err) {
      setPatientRecords([]);
      setRecordsError(extractApiError(err, 'Failed to load patient records.'));
    } finally {
      setRecordsLoading(false);
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
      await fetchData();
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

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1 className="page-title">Doctor Dashboard</h1>

        {error && <div className="alert alert-error">{error}</div>}
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
          <p className="text-muted">
            Consultation ETH received: {receivedSummary.totalReceivedEth} ETH ({receivedSummary.txCount} tx)
          </p>
        </div>

        {/* ── Request Access Section ── */}
        <div className="card">
          <div className="card-header"><h2>Request Patient Access</h2></div>
          <form onSubmit={handleSearch} className="inline-form inline-form-row">
            <div className="form-group flex-grow">
              <label htmlFor="patientSearch">Search by patient name or email</label>
              <input
                id="patientSearch"
                ref={searchInputRef}
                className="form-input"
                placeholder="e.g. John or john@example.com"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearched(false); setSearchResults([]); setSearchError(''); }}
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={searchLoading}>
              {searchLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && <div className="alert alert-error">{searchError}</div>}

          {searched && !searchLoading && (
            <div className="search-results">
              {searchResults.length === 0 ? (
                <p className="empty-msg">No approved patients found matching "{searchQuery}".</p>
              ) : (
                searchResults.map((patient) => {
                  const rs = requestState[patient._id] || {};
                  const accessStatus = resolveAccessStatus(patient);
                  const hasEditableAccess = accessStatus === 'pending' || accessStatus === 'granted';
                  return (
                    <div key={patient._id} className="search-result-item">
                      <div className="patient-info">
                        <strong>{patient.name}</strong>
                        <span className="text-muted">{patient.email}</span>
                        <span className={`badge ${accessStatus === 'granted' ? 'badge-success' : accessStatus === 'pending' ? 'badge-warning' : ''}`}>
                          Access: {accessStatus}
                        </span>
                      </div>
                      <div className="search-result-actions">
                        {rs.msg && <span className="text-success text-sm">{rs.msg}</span>}
                        {rs.error && <span className="text-danger text-sm">{rs.error}</span>}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleRequestAccess(patient)}
                          disabled={rs.loading || !!rs.msg}
                        >
                          {rs.loading ? 'Sending…' : rs.msg ? 'Requested' : 'Request Access'}
                        </button>
                      </div>

                      {(patient.openCheckups || []).length > 0 && (
                        <div className="doctor-draft-list">
                          <strong>Open checkup requests:</strong>
                          {patient.openCheckups.map((draft) => {
                            const edit = recordEditState[draft._id] || {};
                            return (
                              <div key={draft._id} className="doctor-draft-item">
                                <div className="doctor-draft-header">
                                  <span>{draft.title}</span>
                                  {hasEditableAccess ? (
                                    <button
                                      className="btn btn-soft btn-sm"
                                      onClick={() => toggleRecordEditor(draft._id)}
                                    >
                                      {edit.open ? 'Close' : 'Add Prescription'}
                                    </button>
                                  ) : (
                                    <span className="text-muted text-sm">Request access first</span>
                                  )}
                                </div>

                                {edit.success && <div className="text-success text-sm">{edit.success}</div>}
                                {edit.error && <div className="text-danger text-sm">{edit.error}</div>}

                                {edit.open && hasEditableAccess && (
                                  <div className="doctor-draft-form">
                                    <input
                                      className="form-input"
                                      placeholder="Diagnosis"
                                      value={edit.diagnosis || ''}
                                      onChange={(e) => handleRecordFieldChange(draft._id, 'diagnosis', e.target.value)}
                                    />
                                    <input
                                      className="form-input"
                                      placeholder="Prescription"
                                      value={edit.prescription || ''}
                                      onChange={(e) => handleRecordFieldChange(draft._id, 'prescription', e.target.value)}
                                    />
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Doctor notes"
                                      value={edit.description || ''}
                                      onChange={(e) => handleRecordFieldChange(draft._id, 'description', e.target.value)}
                                    />
                                    <button
                                      className="btn btn-primary btn-sm"
                                      disabled={edit.loading}
                                      onClick={() => handleDoctorUpdateRecord(patient._id, draft._id)}
                                    >
                                      {edit.loading ? 'Saving…' : 'Send To Patient'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── My Patients Section ── */}
        <div className="card">
          <div className="card-header"><h2>My Patients</h2></div>
          {patients.length === 0 && !loading ? (
            <p className="empty-msg">No patients with granted access yet.</p>
          ) : (
            patients.map((p) => (
              <div key={p._id || p.id} className="patient-item">
                <div className="patient-info">
                  <strong>{p.name}</strong>
                  <span className="text-muted">{p.email}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleViewRecords(p)}
                >
                  {expandedPatient === (p._id || p.id) ? 'Hide Records' : 'View Records'}
                </button>

                {(p.openCheckups || []).length > 0 && (
                  <div className="doctor-draft-list">
                    <strong>Open checkup requests:</strong>
                    {(p.openCheckups || []).map((draft) => {
                      const edit = recordEditState[draft._id] || {};
                      return (
                        <div key={draft._id} className="doctor-draft-item">
                          <div className="doctor-draft-header">
                            <span>{draft.title}</span>
                            <button
                              className="btn btn-soft btn-sm"
                              onClick={() => toggleRecordEditor(draft._id)}
                            >
                              {edit.open ? 'Close' : 'Add Prescription'}
                            </button>
                          </div>

                          {edit.success && <div className="text-success text-sm">{edit.success}</div>}
                          {edit.error && <div className="text-danger text-sm">{edit.error}</div>}

                          {edit.open && (
                            <div className="doctor-draft-form">
                              <input
                                className="form-input"
                                placeholder="Diagnosis"
                                value={edit.diagnosis || ''}
                                onChange={(e) => handleRecordFieldChange(draft._id, 'diagnosis', e.target.value)}
                              />
                              <input
                                className="form-input"
                                placeholder="Prescription"
                                value={edit.prescription || ''}
                                onChange={(e) => handleRecordFieldChange(draft._id, 'prescription', e.target.value)}
                              />
                              <textarea
                                className="form-input"
                                rows={2}
                                placeholder="Doctor notes"
                                value={edit.description || ''}
                                onChange={(e) => handleRecordFieldChange(draft._id, 'description', e.target.value)}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={edit.loading}
                                onClick={() => handleDoctorUpdateRecord(getId(p), draft._id)}
                              >
                                {edit.loading ? 'Saving…' : 'Send To Patient'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expandable records panel */}
                {expandedPatient === (p._id || p.id) && (
                  <div className="records-panel">
                    {recordsLoading ? (
                      <div className="loading">Loading records…</div>
                    ) : recordsError ? (
                      <p className="empty-msg">{recordsError}</p>
                    ) : patientRecords.length === 0 ? (
                      <p className="empty-msg">No records found for this patient.</p>
                    ) : (
                      patientRecords.map((rec, i) => (
                        <div key={rec._id || i} className="record-card">
                          <h4>{rec.title}</h4>
                          <p><strong>Diagnosis:</strong> {rec.diagnosis || '—'}</p>
                          <p><strong>Prescription:</strong> {rec.prescription || '—'}</p>
                          <p className="record-desc">{rec.description}</p>
                          <span className="text-muted text-sm">
                            {new Date(rec.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Access Requests Section ── */}
        <div className="card">
          <div className="card-header"><h2>Access Requests</h2></div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Requested At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.length === 0 && (
                  <tr><td colSpan={3} className="text-center">No requests yet.</td></tr>
                )}
                {accessRequests.map((req, i) => (
                  <tr key={req._id || i}>
                    <td>{req.patientId?.name || req.patientId || '—'}</td>
                    <td>{formatDateTime(req.requestedAt || req.createdAt)}</td>
                    <td><span className={statusBadgeClass(req.status)}>{req.status}</span></td>
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

export default DoctorDashboard;
