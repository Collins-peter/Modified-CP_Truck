import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/common/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { getMyRequests } from '../../services/requestService';
import { customerNavItems } from './navItems';
import styles from './Overview.module.css';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const { requests: data } = await getMyRequests();
        setRequests(data);
      } catch (err) {
        // Silently fail on the overview — MyRequests page shows the real error state
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.request_status === 'pending').length,
    inTransit: requests.filter((r) => r.request_status === 'in_transit').length,
    delivered: requests.filter((r) => r.request_status === 'delivered').length,
  };

  return (
    <DashboardLayout navItems={customerNavItems}>
      <div className={styles.header}>
        <h2>Welcome back, {user?.full_name?.split(' ')[0]} 👋</h2>
        <p>Here's an overview of your deliveries.</p>
      </div>

      {!loading && (
        <div className={styles.statsGrid}>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total Requests</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statValue}>{stats.pending}</div>
            <div className={styles.statLabel}>Pending Approval</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statValue}>{stats.inTransit}</div>
            <div className={styles.statLabel}>In Transit</div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statValue}>{stats.delivered}</div>
            <div className={styles.statLabel}>Delivered</div>
          </div>
        </div>
      )}

      <div className={`card ${styles.ctaCard}`}>
        <div>
          <h3>Need to send a package?</h3>
          <p>Get a rider dispatched to your pickup location in minutes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/customer/requests/new')}>
          New Dispatch Request
        </button>
      </div>
    </DashboardLayout>
  );
};

export default CustomerDashboard;
