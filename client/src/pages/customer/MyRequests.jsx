import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/common/DashboardLayout';
import { getMyRequests } from '../../services/requestService';
import { initiatePayment } from '../../services/paymentService';
import { customerNavItems } from './navItems';
import styles from './MyRequests.module.css';

const MyRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState(null); // tracks which request's "Pay Now" is in-flight

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const { requests: data } = await getMyRequests();
        setRequests(data);
      } catch (err) {
        setError('Failed to load your requests.');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  const handlePayNow = async (requestId) => {
    setPayingId(requestId);
    setError('');
    try {
      const { authorization_url } = await initiatePayment(requestId);
      // Send the customer to Paystack's hosted checkout page
      window.location.href = authorization_url;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start payment. Please try again.');
      setPayingId(null);
    }
  };

  return (
    <DashboardLayout navItems={customerNavItems}>
      <div className={styles.header}>
        <h2>My Dispatch Requests</h2>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          You haven't submitted any dispatch requests yet.
        </div>
      ) : (
        <div className={styles.list}>
          {requests.map((req) => (
            <div key={req.id} className={`card ${styles.requestCard}`}>
              <div className={styles.requestInfo}>
                <p className={styles.route}>
                  {req.pickup_address} → {req.destination_address}
                </p>
                <p className={styles.description}>{req.package_description}</p>
                <div className={styles.meta}>
                  <span>{req.distance_km} km</span>
                  <span>To: {req.receiver_name}</span>
                  <span>{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className={styles.actions}>
                <span className={`badge badge-${req.request_status}`}>
                  {req.request_status.replace('_', ' ')}
                </span>

                {req.request_status === 'approved' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePayNow(req.id)}
                    disabled={payingId === req.id}
                  >
                    {payingId === req.id ? 'Redirecting...' : `Pay ₦${Number(req.delivery_fee).toLocaleString()}`}
                  </button>
                )}

                {['assigned', 'in_transit', 'delivered'].includes(req.request_status) && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate('/customer/track')}
                  >
                    Track Package 📍
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

export default MyRequests;
