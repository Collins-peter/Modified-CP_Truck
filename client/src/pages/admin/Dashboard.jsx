import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminStats,
  getAllRequests,
  updateRequestStatus,
  getFlaggedRequests,
  recheckFraud,
  clearFraudFlag,
  getFraudLogs,
  getOperationalReports,
} from '../../services/adminService';
import { getAvailableRiders, assignRiderAndGenerateTracking } from '../../services/trackingService';
import styles from './AdminDashboard.module.css';

const adminNavItems = [
  { label: 'Admin Overview', path: '/admin/dashboard', icon: 'admin' },
];

const AdminDashboard = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'fraud' | 'assign' | 'reports'
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [flaggedRequests, setFlaggedRequests] = useState([]);
  const [availableRiders, setAvailableRiders] = useState([]);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Approval modal state
  const [approvingRequest, setApprovingRequest] = useState(null);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');

  // Fraud details modal state
  const [selectedFraudLogs, setSelectedFraudLogs] = useState(null);

  // Assignment selection state
  const [selectedRiderMap, setSelectedRiderMap] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, requestsRes, flaggedRes, ridersRes, reportsRes] = await Promise.all([
        getAdminStats(),
        getAllRequests(),
        getFlaggedRequests(),
        getAvailableRiders(),
        getOperationalReports(),
      ]);

      setStats(statsRes.stats);
      setRequests(requestsRes.requests);
      setFlaggedRequests(flaggedRes.flagged_requests);
      setAvailableRiders(ridersRes.riders);
      setReports(reportsRes);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Request approval handler
  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approvingRequest || !deliveryFeeInput) return;

    try {
      await updateRequestStatus(approvingRequest.id, 'approved', deliveryFeeInput);
      setMessage(`Request #${approvingRequest.id} approved with fee ₦${Number(deliveryFeeInput).toLocaleString()}.`);
      setApprovingRequest(null);
      setDeliveryFeeInput('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve request.');
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this request?')) return;
    try {
      await updateRequestStatus(requestId, 'rejected');
      setMessage(`Request #${requestId} has been rejected.`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject request.');
    }
  };

  // Fraud re-check handler
  const handleRecheckFraud = async (requestId) => {
    try {
      const res = await recheckFraud(requestId);
      alert(`Fraud risk re-evaluated. Score: ${res.score} (${res.flagged ? 'FLAGGED' : 'SAFE'})`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to recheck fraud.');
    }
  };

  // Fraud clear flag handler
  const handleClearFlag = async (requestId) => {
    if (!window.confirm('Clear fraud flag for this request? It will be marked as reviewed.')) return;
    try {
      await clearFraudFlag(requestId);
      setMessage(`Fraud flag cleared for request #${requestId}.`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear flag.');
    }
  };

  // View fraud logs
  const handleViewFraudLogs = async (requestId) => {
    try {
      const res = await getFraudLogs(requestId);
      setSelectedFraudLogs({ requestId, logs: res.logs });
    } catch (err) {
      alert('Could not fetch fraud logs.');
    }
  };

  // Rider assignment handler
  const handleAssignRider = async (requestId) => {
    const riderId = selectedRiderMap[requestId];
    if (!riderId) {
      alert('Please select an available rider from the list.');
      return;
    }

    try {
      const res = await assignRiderAndGenerateTracking(requestId, riderId);
      alert(`Success! Tracking ID generated: ${res.tracking.tracking_id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign rider.');
    }
  };

  return (
    <DashboardLayout navItems={adminNavItems}>
      <div className={styles.adminContainer}>
        {/* Banner */}
        <div className={styles.topBanner}>
          <div className={styles.titleArea}>
            <h1>Administrator Operations Center</h1>
            <p>Welcome, {user?.full_name} — Manage dispatches, monitor fraud, and allocate fleet</p>
          </div>
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 Refresh Data
          </button>
        </div>

        {message && (
          <div style={{ padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontWeight: 500 }}>
            {message}
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={`card ${styles.statCard}`}>
              <div className={styles.statValue}>{stats.totalRequests}</div>
              <div className={styles.statLabel}>Total Orders</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statCardPending}`}>
              <div className={styles.statValue}>{stats.requestsByStatus?.pending || 0}</div>
              <div className={styles.statLabel}>Pending Approval</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statCardFraud}`}>
              <div className={styles.statValue}>{stats.flaggedFraudCount}</div>
              <div className={styles.statLabel}>Fraud Alerts</div>
            </div>
            <div className={`card ${styles.statCard} ${styles.statCardRevenue}`}>
              <div className={styles.statValue}>₦{stats.totalRevenue?.toLocaleString()}</div>
              <div className={styles.statLabel}>Total Revenue</div>
            </div>
            <div className={`card ${styles.statCard}`}>
              <div className={styles.statValue}>{stats.availableRidersCount} / {stats.totalRiders}</div>
              <div className={styles.statLabel}>Available Riders</div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📋 Dispatch Orders ({requests.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'fraud' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('fraud')}
          >
            🛡️ Fraud Detection Center ({flaggedRequests.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'assign' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('assign')}
          >
            🏍️ Rider Assignment ({availableRiders.length} Available)
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'reports' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            📊 Operational Analytics & Reports
          </button>
        </div>

        {/* Tab 1: Dispatch Requests */}
        {activeTab === 'requests' && (
          <div className={`card ${styles.tableCard}`}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>Customer Dispatch Requests</h3>
            {loading ? (
              <p>Loading requests...</p>
            ) : requests.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>No dispatch requests submitted yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Pickup & Destination</th>
                    <th>Package Info</th>
                    <th>Distance</th>
                    <th>Fee</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>
                        <strong>{r.customer_name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.customer_phone}</div>
                      </td>
                      <td>
                        <div><strong>From:</strong> {r.pickup_address}</div>
                        <div><strong>To:</strong> {r.destination_address}</div>
                      </td>
                      <td>
                        <div>{r.package_description}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          Receiver: {r.receiver_name} ({r.receiver_phone})
                        </div>
                      </td>
                      <td>{r.distance_km} km</td>
                      <td>{r.delivery_fee ? `₦${Number(r.delivery_fee).toLocaleString()}` : '—'}</td>
                      <td>
                        <span className={`badge badge-${r.request_status}`}>
                          {r.request_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {r.is_flagged ? (
                          <span className={styles.fraudRiskHigh}>Flagged ({r.fraud_score})</span>
                        ) : (
                          <span className={styles.fraudRiskSafe}>Safe</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionBtnGroup}>
                          {r.request_status === 'pending' && (
                            <>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                                onClick={() => {
                                  setApprovingRequest(r);
                                  // Suggest fee based on distance
                                  const suggested = Math.max(1500, Math.round(r.distance_km * 200));
                                  setDeliveryFeeInput(suggested);
                                }}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.82rem', color: 'var(--color-danger)' }}
                                onClick={() => handleReject(r.id)}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Fraud Detection Center */}
        {activeTab === 'fraud' && (
          <div className={`card ${styles.tableCard}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ color: 'var(--color-danger)' }}>🛡️ Intelligent Fraud Risk Monitoring</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Orders flagged by our 6-rule risk evaluation engine (score &ge; 0.50).
                </p>
              </div>
            </div>

            {flaggedRequests.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600 }}>
                ✅ No suspicious or fraudulent delivery requests detected!
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Risk Score</th>
                    <th>Triggered Rule Explanations</th>
                    <th>Package Value</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedRequests.map((fr) => (
                    <tr key={fr.id}>
                      <td>#{fr.id}</td>
                      <td>
                        <strong>{fr.customer_name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{fr.customer_email}</div>
                      </td>
                      <td>
                        <span className={styles.fraudRiskHigh} style={{ fontSize: '0.95rem' }}>
                          Score: {fr.fraud_score} / 1.0
                        </span>
                      </td>
                      <td style={{ maxWidth: '350px' }}>
                        <div style={{ fontSize: '0.88rem', color: '#991b1b', lineHeight: '1.4' }}>
                          {fr.flag_reason || 'High risk pattern detected'}
                        </div>
                      </td>
                      <td>₦{Number(fr.package_value || 0).toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${fr.request_status}`}>
                          {fr.request_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtnGroup}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleViewFraudLogs(fr.id)}
                          >
                            Audit Log
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleRecheckFraud(fr.id)}
                          >
                            Re-check
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleClearFlag(fr.id)}
                          >
                            Clear Flag
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Rider Assignment */}
        {activeTab === 'assign' && (
          <div className={`card ${styles.tableCard}`}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>
              Dispatch Rider Assignment
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Assign an available rider to approved orders that have completed customer payment.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Delivery Fee</th>
                  <th>Payment</th>
                  <th>Select Available Rider</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {requests
                  .filter((r) => r.request_status === 'approved')
                  .map((r) => (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.destination_address}</td>
                      <td>₦{Number(r.delivery_fee).toLocaleString()}</td>
                      <td>
                        <span className="badge badge-approved">Confirmed</span>
                      </td>
                      <td>
                        <select
                          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', width: '100%' }}
                          value={selectedRiderMap[r.id] || ''}
                          onChange={(e) =>
                            setSelectedRiderMap({ ...selectedRiderMap, [r.id]: e.target.value })
                          }
                        >
                          <option value="">-- Choose Rider --</option>
                          {availableRiders.map((rider) => (
                            <option key={rider.id} value={rider.id}>
                              {rider.full_name} ({rider.vehicle_type} - {rider.plate_number}) ★ {rider.rating}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                          onClick={() => handleAssignRider(r.id)}
                        >
                          Assign & Generate Tracking
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {requests.filter((r) => r.request_status === 'approved').length === 0 && (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                No approved orders currently waiting for rider assignment.
              </p>
            )}
          </div>
        )}

        {/* Tab 4: Operational Reports */}
        {activeTab === 'reports' && reports && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className={`card ${styles.tableCard}`}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>
                📈 Fleet & Dispatch Operational Report
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{reports.summary?.total_shipments || 0}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Total Shipments Dispatched</div>
                </div>
                <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>{reports.summary?.delivered_count || 0}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Successfully Delivered</div>
                </div>
                <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>{reports.summary?.in_transit_count || 0}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Currently In Transit</div>
                </div>
              </div>

              <h4 style={{ marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Top Dispatch Riders</h4>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rider Name</th>
                    <th>Vehicle</th>
                    <th>Deliveries Completed</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.topRiders?.map((rider, i) => (
                    <tr key={i}>
                      <td><strong>{rider.full_name}</strong></td>
                      <td>{rider.vehicle_type}</td>
                      <td>{rider.total_deliveries}</td>
                      <td>⭐ {rider.rating} / 5.0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Approval Modal */}
        {approvingRequest && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3>Approve Dispatch Request #{approvingRequest.id}</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0.5rem 0 1rem 0' }}>
                Set the delivery fee for the customer ({approvingRequest.customer_name}). Distance: <strong>{approvingRequest.distance_km} km</strong>.
              </p>

              <form onSubmit={handleApproveSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    Delivery Fee (₦)
                  </label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                    value={deliveryFeeInput}
                    onChange={(e) => setDeliveryFeeInput(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setApprovingRequest(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Confirm Approval
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Fraud Log Audit Modal */}
        {selectedFraudLogs && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
              <h3>Fraud Audit Trail — Request #{selectedFraudLogs.requestId}</h3>
              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                {selectedFraudLogs.logs.length === 0 ? (
                  <p>No logged rules.</p>
                ) : (
                  selectedFraudLogs.logs.map((log) => (
                    <div key={log.id} style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600, color: '#991b1b' }}>{log.rule_triggered}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Weight: {log.risk_score} | {new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedFraudLogs(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
