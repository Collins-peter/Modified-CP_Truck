import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import {
  getRiderProfile,
  updateRiderAvailability,
  getMyDeliveries,
  updateDeliveryStatus,
  updateRiderLocation,
} from '../../services/riderService';
import styles from './RiderDashboard.module.css';

const riderNavItems = [
  { label: 'Rider Portal', path: '/rider/dashboard', icon: 'rider' },
];

const RiderDashboard = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadRiderData = async () => {
    setLoading(true);
    try {
      const [profileRes, deliveriesRes] = await Promise.all([
        getRiderProfile(),
        getMyDeliveries(),
      ]);
      setProfile(profileRes.profile);
      setDeliveries(deliveriesRes.deliveries);
    } catch (err) {
      console.error('Error loading rider data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiderData();
  }, []);

  const handleAvailabilityChange = async (e) => {
    const newStatus = e.target.value;
    try {
      await updateRiderAvailability(newStatus);
      setProfile((prev) => ({ ...prev, availability: newStatus }));
      setMessage(`Status updated to ${newStatus}.`);
    } catch (err) {
      alert('Failed to update availability.');
    }
  };

  const handleStatusProgression = async (deliveryId, newStatus) => {
    setActionLoading(true);
    setMessage('');
    try {
      await updateDeliveryStatus(deliveryId, newStatus);
      setMessage(`Delivery status successfully progressed to "${newStatus.replace('_', ' ')}"!`);
      loadRiderData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Simulates GPS movement and triggers Delivery Time Prediction recalculation
  const handlePingGpsLocation = async (deliveryId) => {
    // Generate slight location update near Lagos mainland / VI
    const simulatedLat = +(6.5244 + (Math.random() - 0.5) * 0.04).toFixed(6);
    const simulatedLng = +(3.3792 + (Math.random() - 0.5) * 0.04).toFixed(6);

    try {
      const res = await updateRiderLocation(deliveryId, simulatedLat, simulatedLng);
      let alertMsg = `📍 Location updated to (${simulatedLat}, ${simulatedLng})!`;
      if (res.liveEta) {
        alertMsg += ` Live ETA recalculated: ~${res.liveEta.durationMinutes} mins remaining.`;
      }
      alert(alertMsg);
      loadRiderData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update location.');
    }
  };

  const activeDeliveries = deliveries.filter((d) => d.current_status !== 'delivered');
  const completedDeliveries = deliveries.filter((d) => d.current_status === 'delivered');

  return (
    <DashboardLayout navItems={riderNavItems}>
      <div className={styles.riderContainer}>
        {/* Profile Card */}
        {profile && (
          <div className={`card ${styles.profileCard}`}>
            <div className={styles.profileDetails}>
              <h2>🏍️ {profile.full_name}</h2>
              <div className={styles.profileMeta}>
                <span><strong>Vehicle:</strong> {profile.vehicle_type || 'Motorcycle'} ({profile.plate_number || 'CPT-772-LG'})</span>
                <span><strong>Deliveries:</strong> {profile.total_deliveries}</span>
                <span><strong>Rating:</strong> ⭐ {profile.rating || '5.0'} / 5.0</span>
              </div>
            </div>

            <div className={styles.availabilityGroup}>
              <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>Rider Status:</span>
              <select
                className={styles.availabilitySelect}
                value={profile.availability}
                onChange={handleAvailabilityChange}
              >
                <option value="available">🟢 Available for Delivery</option>
                <option value="busy">🟡 Busy with Delivery</option>
                <option value="offline">⚪ Offline</option>
              </select>
            </div>
          </div>
        )}

        {message && (
          <div style={{ padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontWeight: 500 }}>
            {message}
          </div>
        )}

        {/* Active Deliveries */}
        <div>
          <h3 style={{ color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
            📦 Assigned Deliveries ({activeDeliveries.length})
          </h3>

          {loading ? (
            <p>Loading assigned deliveries...</p>
          ) : activeDeliveries.length === 0 ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              You have no active package deliveries right now. Set your status to <strong>Available</strong> to receive dispatch assignments.
            </div>
          ) : (
            <div className={styles.deliveriesList}>
              {activeDeliveries.map((d) => (
                <div key={d.id} className={`card ${styles.deliveryCard}`}>
                  <div className={styles.deliveryDetails}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span className="badge badge-assigned" style={{ fontFamily: 'monospace' }}>
                        {d.tracking_id}
                      </span>
                      <span className={`badge badge-${d.current_status}`}>
                        {d.current_status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className={styles.routeLine}>
                      {d.pickup_address} ➡️ {d.destination_address}
                    </div>

                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Package:</span>
                      <span>{d.package_description}</span>
                    </div>

                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Receiver:</span>
                      <span><strong>{d.receiver_name}</strong> ({d.receiver_phone})</span>
                    </div>
                  </div>

                  <div className={styles.deliveryActions}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      TRANSIT CONTROLS
                    </span>

                    {d.current_status === 'pending_pickup' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleStatusProgression(d.id, 'picked_up')}
                        disabled={actionLoading}
                      >
                        ✓ Mark as Picked Up
                      </button>
                    )}

                    {d.current_status === 'picked_up' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleStatusProgression(d.id, 'in_transit')}
                        disabled={actionLoading}
                      >
                        🚀 Start Transit
                      </button>
                    )}

                    {d.current_status === 'in_transit' && (
                      <button
                        className="btn btn-primary"
                        style={{ backgroundColor: 'var(--color-success)' }}
                        onClick={() => handleStatusProgression(d.id, 'delivered')}
                        disabled={actionLoading}
                      >
                        🎉 Confirm Delivered
                      </button>
                    )}

                    {/* GPS Ping Button for real-time ETA recalculation */}
                    <div className={styles.gpsBox}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        Dynamic Delivery Prediction
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                        onClick={() => handlePingGpsLocation(d.id)}
                      >
                        📍 Ping Live GPS Position
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Deliveries */}
        {completedDeliveries.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--color-primary)', marginBottom: '0.75rem' }}>
              ✅ Delivery History ({completedDeliveries.length})
            </h3>
            <div className="card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '8px' }}>Tracking ID</th>
                    <th style={{ padding: '8px' }}>Route</th>
                    <th style={{ padding: '8px' }}>Receiver</th>
                    <th style={{ padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedDeliveries.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{d.tracking_id}</td>
                      <td style={{ padding: '10px 8px' }}>{d.pickup_address} → {d.destination_address}</td>
                      <td style={{ padding: '10px 8px' }}>{d.receiver_name}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className="badge badge-delivered">Delivered</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiderDashboard;
