import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import {
  getMyPatients,
  requestAccess,
  getAccessRequests,
  getPatientRecords,
} from '../services/api';

/**
 * DoctorDashboard shows:
 * 1. Patients with granted access and their records (expandable)
 * 2. Access request form (by patient ID)
 * 3. All access requests with their current status
 */
const DoctorDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [requestMsg, setRequestMsg] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State for expanded patient record panel
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes] = await Promise.all([getMyPatients(), getAccessRequests()]);
      setPatients(pRes.data.patients || pRes.data);
      setAccessRequests(rRes.data.requests || rRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequestAccess = async (e) => {
    e.preventDefault();
    setRequestMsg('');
    setRequestError('');
    setRequestLoading(true);
    try {
      await requestAccess(patientId.trim());
      setRequestMsg('Access request sent successfully.');
      setPatientId('');
      fetchData();
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to send request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleViewRecords = async (patient) => {
    if (expandedPatient === (patient._id || patient.id)) {
      setExpandedPatient(null);
      setPatientRecords([]);
      return;
    }
    setExpandedPatient(patient._id || patient.id);
    setRecordsLoading(true);
    try {
      const res = await getPatientRecords(patient._id || patient.id);
      setPatientRecords(res.data.records || res.data);
    } catch (err) {
      setPatientRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'granted') return 'badge badge-success';
    if (status === 'revoked') return 'badge badge-danger';
    return 'badge badge-warning';
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
          {requestError && <div className="alert alert-error">{requestError}</div>}
          {requestMsg && <div className="alert alert-success">{requestMsg}</div>}
          <form onSubmit={handleRequestAccess} className="inline-form inline-form-row">
            <div className="form-group flex-grow">
              <label htmlFor="patientId">Patient ID</label>
              <input
                id="patientId"
                className="form-input"
                placeholder="Enter patient ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={requestLoading}>
              {requestLoading ? 'Sending…' : 'Send Request'}
            </button>
          </form>
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
                    <td>{req.patient?.name || req.patientId || '—'}</td>
                    <td>{new Date(req.createdAt).toLocaleString()}</td>
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
