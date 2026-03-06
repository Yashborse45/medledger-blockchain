import { useCallback, useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar';
import {
  getAccessRequests,
  getMyPatients,
  getPatientRecords,
  requestAccess,
  searchPatients,
} from '../services/api';
import { extractApiError } from '../utils/apiError';

/**
 * DoctorDashboard shows:
 * 1. Patients with granted access and their records (expandable)
 * 2. Patient search + access request flow (search by name/email, then click Request)
 * 3. All access requests with their current status
 */
const DoctorDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Patient search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  // Per-patient request state: { [patientId]: { loading, msg, error } }
  const [requestState, setRequestState] = useState({});

  // State for expanded patient record panel
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  const searchInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes] = await Promise.all([getMyPatients(), getAccessRequests()]);
      setPatients(pRes.data.patients || pRes.data);
      setAccessRequests(rRes.data.requests || rRes.data);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load data.'));
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1 className="page-title">Doctor Dashboard</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="loading">Loading…</div>}

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
                  return (
                    <div key={patient._id} className="search-result-item">
                      <div className="patient-info">
                        <strong>{patient.name}</strong>
                        <span className="text-muted">{patient.email}</span>
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
