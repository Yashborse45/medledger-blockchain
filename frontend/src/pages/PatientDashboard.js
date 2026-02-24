import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import {
  getMyRecords,
  createRecord,
  getIncomingRequests,
  grantAccess,
  revokeAccess,
} from '../services/api';

/**
 * PatientDashboard shows:
 * 1. My Records – list with inline form to add new records
 * 2. Access Requests – incoming doctor requests with Grant/Revoke actions
 */
const PatientDashboard = () => {
  const [records, setRecords] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // New record form state
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({
    title: '', description: '', diagnosis: '', prescription: '',
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
      setError(err.response?.data?.message || 'Failed to load data.');
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
      await createRecord(recordForm);
      flash('Record added successfully.');
      setShowRecordForm(false);
      setRecordForm({ title: '', description: '', diagnosis: '', prescription: '' });
      fetchData();
    } catch (err) {
      setRecordError(err.response?.data?.message || 'Failed to create record.');
    } finally {
      setRecordLoading(false);
    }
  };

  const handleGrant = async (reqId) => {
    try {
      await grantAccess(reqId);
      flash('Access granted.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to grant access.');
    }
  };

  const handleRevoke = async (reqId) => {
    try {
      await revokeAccess(reqId);
      flash('Access revoked.');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke access.');
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
        <h1 className="page-title">Patient Dashboard</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {actionMsg && <div className="alert alert-success">{actionMsg}</div>}
        {loading && <div className="loading">Loading…</div>}

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
              <h3>New Medical Record</h3>
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
                <div className="form-group">
                  <label>Diagnosis</label>
                  <input
                    name="diagnosis"
                    className="form-input"
                    value={recordForm.diagnosis}
                    onChange={handleRecordChange}
                    placeholder="Hypertension"
                  />
                </div>
                <div className="form-group">
                  <label>Prescription</label>
                  <input
                    name="prescription"
                    className="form-input"
                    value={recordForm.prescription}
                    onChange={handleRecordChange}
                    placeholder="Lisinopril 10mg"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  className="form-input"
                  value={recordForm.description}
                  onChange={handleRecordChange}
                  rows={3}
                  placeholder="Additional notes…"
                />
              </div>
              <button type="submit" className="btn btn-success" disabled={recordLoading}>
                {recordLoading ? 'Saving…' : 'Save Record'}
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
                    <td>{req.doctor?.name || req.doctorId || '—'}</td>
                    <td>{new Date(req.createdAt).toLocaleString()}</td>
                    <td><span className={statusBadgeClass(req.status)}>{req.status}</span></td>
                    <td className="action-cell">
                      {req.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleGrant(req._id || req.id)}
                        >
                          Grant
                        </button>
                      )}
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
