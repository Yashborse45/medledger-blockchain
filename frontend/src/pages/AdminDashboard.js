import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import {
  getUsers,
  createDoctor,
  approvePatient,
  deactivateUser,
  getAuditLogs,
} from '../services/api';

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
      setError(err.response?.data?.message || 'Failed to load users.');
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
      setError(err.response?.data?.message || 'Failed to load audit logs.');
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
      setError(err.response?.data?.message || 'Approval failed.');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await deactivateUser(id);
      flash('User deactivated.');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Deactivation failed.');
    }
  };

  const handleDoctorChange = (e) =>
    setDoctorForm({ ...doctorForm, [e.target.name]: e.target.value });

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setDoctorError('');
    setDoctorLoading(true);
    try {
      await createDoctor(doctorForm);
      flash('Doctor account created.');
      setShowDoctorForm(false);
      setDoctorForm({ name: '', email: '', password: '', specialization: '' });
      fetchUsers();
    } catch (err) {
      setDoctorError(err.response?.data?.message || 'Failed to create doctor.');
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
                      minLength={6}
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
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center">No audit logs found.</td>
                      </tr>
                    )}
                    {auditLogs.map((log, i) => (
                      <tr key={log._id || i}>
                        <td>{log.action}</td>
                        <td>{log.performedBy?.name || log.performedBy || '—'}</td>
                        <td>{new Date(log.timestamp || log.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
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
