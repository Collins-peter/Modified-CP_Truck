import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyPayment } from '../../services/paymentService';

// Paystack redirects the customer here after checkout, appending
// ?reference=XXXX to the URL. We verify that reference with our own
// backend (which double-checks with Paystack) to confirm success —
// see the note in paymentController.mjs about why this is a
// convenience check, not the actual source of truth (the webhook is).
const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');

  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'failed' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const check = async () => {
      if (!reference) {
        setStatus('error');
        setMessage('No payment reference found.');
        return;
      }

      try {
        const data = await verifyPayment(reference);
        setStatus(data.status === 'successful' ? 'success' : 'failed');
        setMessage(data.message);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Could not verify payment.');
      }
    };

    check();
  }, [reference]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {status === 'checking' && <p>Verifying your payment...</p>}

      {status === 'success' && (
        <>
          <h2 style={{ color: 'var(--color-success)' }}>Payment Successful! 🎉</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Your payment has been confirmed. A rider will be assigned shortly.
          </p>
        </>
      )}

      {status === 'failed' && (
        <>
          <h2 style={{ color: 'var(--color-danger)' }}>Payment Not Successful</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h2 style={{ color: 'var(--color-danger)' }}>Something Went Wrong</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        </>
      )}

      <Link to="/customer/requests" className="btn btn-primary">
        Back to My Requests
      </Link>
    </div>
  );
};

export default PaymentCallback;
