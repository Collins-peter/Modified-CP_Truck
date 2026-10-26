import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/common/DashboardLayout';
import { trackPackage } from '../../services/trackingService';
import { customerNavItems } from './navItems';
import styles from './Track.module.css';

const STEPS = [
  { key: 'pending_pickup', label: 'Order Assigned' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

const Track = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || 'CPT-20261024-9A4B';

  const [trackingIdInput, setTrackingIdInput] = useState(initialId);
  const [trackingData, setTrackingData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTracking = async (idToTrack) => {
    if (!idToTrack || !idToTrack.trim()) return;

    setError('');
    setLoading(true);
    try {
      const data = await trackPackage(idToTrack.trim().toUpperCase());
      setTrackingData(data.tracking);
      setHistory(data.history || []);
      setSearchParams({ id: idToTrack.trim().toUpperCase() });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Could not find package with this Tracking ID. Please verify and try again.'
      );
      setTrackingData(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      fetchTracking(initialId);
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTracking(trackingIdInput);
  };

  const getStepStatusClass = (stepKey) => {
    if (!trackingData) return '';
    const order = ['pending_pickup', 'picked_up', 'in_transit', 'delivered'];
    const currentIndex = order.indexOf(trackingData.current_status);
    const stepIndex = order.indexOf(stepKey);

    if (stepIndex < currentIndex) return styles.stepCompleted;
    if (stepIndex === currentIndex) return styles.stepActive;
    return '';
  };

  return (
    <DashboardLayout navItems={customerNavItems}>
      <div className={styles.trackContainer}>
        {/* Search Card */}
        <div className={`card ${styles.searchCard}`}>
          <h2>Real-Time Package Tracking</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Enter your Tracking ID to view the live status, assigned rider, and delivery arrival prediction.
          </p>

          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="e.g. CPT-20261024-9A4B"
              value={trackingIdInput}
              onChange={(e) => setTrackingIdInput(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Searching...' : 'Track Package'}
            </button>
          </form>

          <div className={styles.demoHint}>
            Demo sample available:{' '}
            <span
              className={styles.demoLink}
              onClick={() => {
                setTrackingIdInput('CPT-20261024-9A4B');
                fetchTracking('CPT-20261024-9A4B');
              }}
            >
              CPT-20261024-9A4B
            </span>
          </div>

          {error && (
            <div style={{ marginTop: '1rem', color: 'var(--color-danger)', fontWeight: 500 }}>
              {error}
            </div>
          )}
        </div>

        {/* Tracking Details & Stepper */}
        {trackingData && (
          <>
            {/* Status Header */}
            <div className={`card ${styles.statusHeader}`}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Tracking ID
                </span>
                <div className={styles.trackingIdLarge}>{trackingData.tracking_id}</div>
              </div>
              <div>
                <span className={`badge badge-${trackingData.current_status}`} style={{ fontSize: '0.95rem', padding: '6px 14px' }}>
                  {trackingData.current_status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Stepper */}
            <div className={`card ${styles.stepper}`}>
              {STEPS.map((step, idx) => (
                <div
                  key={step.key}
                  className={`${styles.stepItem} ${getStepStatusClass(step.key)}`}
                >
                  <div className={styles.stepCircle}>
                    {idx + 1}
                  </div>
                  <div className={styles.stepLabel}>{step.label}</div>
                </div>
              ))}
            </div>

            {/* Info Grid */}
            <div className={styles.detailsGrid}>
              {/* Delivery Details */}
              <div className={`card ${styles.infoCard}`}>
                <div className={styles.cardTitle}>📦 Shipment Details</div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Package</span>
                  <span className={styles.infoValue}>{trackingData.package_description}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Pickup From</span>
                  <span className={styles.infoValue}>{trackingData.pickup_address}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Deliver To</span>
                  <span className={styles.infoValue}>{trackingData.destination_address}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Recipient</span>
                  <span className={styles.infoValue}>
                    {trackingData.receiver_name} ({trackingData.receiver_phone})
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Predicted Arrival</span>
                  <span className={styles.infoValue} style={{ color: 'var(--color-accent)' }}>
                    {trackingData.predicted_delivery_time
                      ? new Date(trackingData.predicted_delivery_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Calculating...'}
                  </span>
                </div>
              </div>

              {/* Rider & Transit Log */}
              <div className={`card ${styles.infoCard}`}>
                <div className={styles.cardTitle}>🏍️ Dispatch Rider Information</div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Rider Name</span>
                  <span className={styles.infoValue}>
                    {trackingData.rider_name || 'Rider Assigned'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Contact</span>
                  <span className={styles.infoValue}>{trackingData.rider_phone || 'N/A'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Vehicle</span>
                  <span className={styles.infoValue}>
                    {trackingData.vehicle_type || 'Motorcycle'} ({trackingData.plate_number || 'CPT-772-LG'})
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Rider Rating</span>
                  <span className={styles.infoValue}>⭐ {trackingData.rating || '4.9'} / 5.0</span>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                    Activity Timeline
                  </div>
                  <div className={styles.historyList}>
                    {history.length > 0 ? (
                      history.map((h, i) => (
                        <div key={i} className={styles.historyItem}>
                          <div><strong>{h.status.replace('_', ' ').toUpperCase()}:</strong> {h.note || 'Status updated'}</div>
                          <div className={styles.historyTime}>
                            {new Date(h.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Package is registered and in dispatch pipeline.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Track;
