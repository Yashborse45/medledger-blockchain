import { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import {
  approvePatient,
  createDoctor,
  deactivateUser,
  getAuditLogs,
  getUsers,
  verifyAuditLog,
} from '../services/api';
import { extractApiError } from '../utils/apiError';

/**
 * AdminDashboard provides user management and audit log views.
 * Tabs: Users (approve / deactivate / create doctor) | Audit Logs
 */
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Blockchain verification state: { [logId]: { loading, result } }
  const [verifyState, setVerifyState] = useState({});

  // Create-doctor form state
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    name: '', email: '', password: '', specialization: '',
  });
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getUsers();
      setUsers(res.data.users || res.data);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAuditLogs();
      setAuditLogs(res.data.logs || res.data);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load audit logs.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load appropriate data when tab changes
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchAuditLogs();
  }, [activeTab, fetchUsers, fetchAuditLogs]);

  const flash = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleApprove = async (id) => {
    try {
      await approvePatient(id);
      flash('Patient approved successfully.');
      fetchUsers();
    } catch (err) {
      setError(extractApiError(err, 'Approval failed.'));
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await deactivateUser(id);
      flash('User deactivated.');
      fetchUsers();
    } catch (err) {
      setError(extractApiError(err, 'Deactivation failed.'));
    }
  };

  const handleDoctorChange = (e) =>
    setDoctorForm({ ...doctorForm, [e.target.name]: e.target.value });

  const handleVerify = async (logId) => {
    setVerifyState((prev) => ({ ...prev, [logId]: { loading: true, result: null } }));
    try {
      const res = await verifyAuditLog(logId);
      setVerifyState((prev) => ({ ...prev, [logId]: { loading: false, result: res.data } }));
    } catch (err) {
      setVerifyState((prev) => ({
        ...prev,
        [logId]: { loading: false, result: { verified: false, reason: 'Verification request failed' } },
      }));
    }
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setDoctorError('');
    setDoctorLoading(true);
    try {
      const payload = {
        name: doctorForm.name.trim(),
        email: doctorForm.email.trim(),
        password: doctorForm.password,
        specialization: doctorForm.specialization.trim(),
      };
      await createDoctor(payload);
      flash('Doctor account created.');
      setShowDoctorForm(false);
      setDoctorForm({ name: '', email: '', password: '', specialization: '' });
      fetchUsers();
    } catch (err) {
      setDoctorError(extractApiError(err, 'Failed to create doctor.'));
    } finally {
      setDoctorLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-container">
        <h1 className="page-title">Admin Dashboard</h1>

        {/* Tab navigation */}
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Audit Logs
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {actionMsg && <div className="alert alert-success">{actionMsg}</div>}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <div className="card">
            <div className="card-header">
              <h2>User Management</h2>
              <button
                className="btn btn-primary"
                onClick={() => setShowDoctorForm(!showDoctorForm)}
              >
                {showDoctorForm ? 'Cancel' : '+ Create Doctor'}
              </button>
            </div>

            {/* Inline create-doctor form */}
            {showDoctorForm && (
              <form onSubmit={handleCreateDoctor} className="inline-form">
                <h3>New Doctor Account</h3>
                {doctorError && <div className="alert alert-error">{doctorError}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      name="name"
                      className="form-input"
                      value={doctorForm.name}
                      onChange={handleDoctorChange}
                      required
                      placeholder="Dr. Jane Smith"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      name="email"
                      type="email"
                      className="form-input"
                      value={doctorForm.email}
                      onChange={handleDoctorChange}
                      required
                      placeholder="doctor@hospital.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      name="password"
                      type="password"
                      className="form-input"
                      value={doctorForm.password}
                      onChange={handleDoctorChange}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="form-group">
                    <label>Specialization</label>
                    <input
                      name="specialization"
                      className="form-input"
                      value={doctorForm.specialization}
                      onChange={handleDoctorChange}
                      placeholder="Cardiology"
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-success" disabled={doctorLoading}>
                  {doctorLoading ? 'Creating…' : 'Create Doctor'}
                </button>
              </form>
            )}

            {loading ? (
              <div className="loading">Loading users…</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center">No users found.</td>
                      </tr>
                    )}
                    {users.map((u) => (
                      <tr key={u._id || u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td><span className="badge">{u.role}</span></td>
                        <td>
                          <span className={`badge ${u.isApproved ? 'badge-success' : 'badge-warning'} ${u.isActive === false ? 'badge-danger' : ''}`}>
                            {u.isActive === false ? 'Inactive' : u.isApproved ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="action-cell">
                          {u.role === 'patient' && !u.isApproved && u.isActive !== false && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(u._id || u.id)}
                            >
                              Approve
                            </button>
                          )}
                          {u.isActive !== false && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeactivate(u._id || u.id)}
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Audit Logs Tab ── */}
        {activeTab === 'audit' && (
          <div className="card">
            <div className="card-header">
              <h2>Audit Logs</h2>
            </div>
            {loading ? (
              <div className="loading">Loading logs…</div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Performed By</th>
                      <th>Timestamp</th>
                      <th>Blockchain TX</th>
                      <th>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center">No audit logs found.</td>
                      </tr>
                    )}
                    {auditLogs.map((log, i) => {
                      const logId = log._id || i;
                      const vs = verifyState[logId];
                      return (
                        <tr key={logId}>
                          <td><span className="badge">{log.action}</span></td>
                          <td>{log.performedBy?.name || log.performedBy || '—'}</td>
                          <td>{new Date(log.timestamp || log.createdAt).toLocaleString()}</td>
                          <td>
                            {log.blockchainTxHash ? (
                              <span className="tx-hash" title={log.blockchainTxHash}>
                                {log.blockchainTxHash.slice(0, 10)}…{log.blockchainTxHash.slice(-6)}
                              </span>
                            ) : (
                              <span className="tx-none">Not on blockchain</span>
                            )}
                          </td>
                          <td>
                            {log.blockchainTxHash ? (
                              <div className="verify-cell">
                                <button
                                  className="btn btn-sm btn-verify"
                                  disabled={vs?.loading}
                                  onClick={() => handleVerify(logId)}
                                >
                                  {vs?.loading ? 'Checking…' : 'Verify'}
                                </button>
                                {vs && !vs.loading && vs.result && (
                                  vs.result.verified ? (
                                    <div className="verify-ok">
                                      ✔ Verified
                                      <span className="verify-meta">
                                        Block #{vs.result.blockNumber}
                                        {vs.result.timestamp && (
                                          <> · {new Date(vs.result.timestamp).toLocaleString()}</>
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="verify-fail">
                                      ⚠ {vs.result.reason || 'Could not verify'}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <span className="tx-none">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;
