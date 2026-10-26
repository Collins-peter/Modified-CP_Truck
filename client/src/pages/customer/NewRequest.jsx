import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/common/DashboardLayout';
import PlacesAutocompleteInput, { checkIsEnuguAddress } from '../../components/common/PlacesAutocompleteInput';
import { createDispatchRequest } from '../../services/requestService';
import { customerNavItems } from './navItems';
import styles from './NewRequest.module.css';

const initialState = {
  pickup_address: '',
  pickup_lat: null,
  pickup_lng: null,
  destination_address: '',
  destination_lat: null,
  destination_lng: null,
  package_description: '',
  package_weight: '',
  package_value: '',
  receiver_name: '',
  receiver_phone: '',
  receiver_address: '',
};

const NewRequest = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Called when the customer picks a suggestion from the Places
  // Autocomplete dropdown — captures both the formatted address and
  // its coordinates, which the backend uses for real distance/ETA.
  const handlePickupSelect = (place) => {
    setFormData((prev) => ({
      ...prev,
      pickup_address: place.address,
      pickup_lat: place.lat,
      pickup_lng: place.lng,
    }));
  };

  const handleDestinationSelect = (place) => {
    setFormData((prev) => ({
      ...prev,
      destination_address: place.address,
      destination_lat: place.lat,
      destination_lng: place.lng,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side Enugu State boundary check
    if (
      !checkIsEnuguAddress(
        formData.pickup_address,
        formData.pickup_lat,
        formData.pickup_lng
      )
    ) {
      setError(
        'Pickup address must be within Enugu State, Nigeria (e.g. Enugu, Nsukka, 9th Mile, Agbani).'
      );
      return;
    }

    if (
      !checkIsEnuguAddress(
        formData.destination_address,
        formData.destination_lat,
        formData.destination_lng
      )
    ) {
      setError(
        'Destination address must be within Enugu State, Nigeria (e.g. Enugu, Nsukka, 9th Mile, Agbani).'
      );
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        package_weight: formData.package_weight ? Number(formData.package_weight) : undefined,
        package_value: formData.package_value ? Number(formData.package_value) : undefined,
      };

      const { request } = await createDispatchRequest(payload);
      setSuccessResult(request);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <DashboardLayout navItems={customerNavItems}>
        <div className={styles.successBox}>
          <h3>Request submitted successfully! 🎉</h3>
          <p>Your dispatch request is now awaiting admin approval. You'll be able to pay once it's approved.</p>
          <div className={styles.successDetails}>
            <span>
              <strong>Distance:</strong> {successResult.distance_km} km
            </span>
            <span>
              <strong>Estimated duration:</strong> {successResult.estimated_duration_minutes} minutes
            </span>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/customer/requests')}>
              View My Requests
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSuccessResult(null);
                setFormData(initialState);
              }}
            >
              Create Another
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={customerNavItems}>
      <div className={styles.header}>
        <h2>New Dispatch Request</h2>
        <p>Intra-state package delivery within Enugu State, Nigeria.</p>
      </div>

      <div
        style={{
          background: 'rgba(7, 91, 58, 0.08)',
          border: '1px solid rgba(7, 91, 58, 0.25)',
          color: 'var(--color-primary)',
          padding: '10px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          fontWeight: '500',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>📍</span>
        <span>
          <strong>Operational Area:</strong> Both pickup and destination addresses must be within <strong>Enugu State, Nigeria</strong> (Enugu Metropolis, Nsukka/UNN, 9th Mile, Agbani, Udi, etc.).
        </span>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={`card ${styles.section}`}>
          <p className={styles.sectionTitle}>Pickup & Destination (Enugu State)</p>

          <datalist id="enugu-districts">
            <option value="Faculty of Physical Sciences, UNN, Nsukka, Enugu State" />
            <option value="UNN Main Gate, University of Nigeria, Nsukka, Enugu State" />
            <option value="Ogige Market, Nsukka, Enugu State" />
            <option value="Odenigbo Roundabout, Nsukka, Enugu State" />
            <option value="Polo Park Mall (Shoprite), GRA, Enugu, Enugu State" />
            <option value="Independence Layout, Enugu, Enugu State" />
            <option value="Chime Avenue, New Haven, Enugu, Enugu State" />
            <option value="Ogui Road, Enugu, Enugu State" />
            <option value="Abakpa Nike, Enugu, Enugu State" />
            <option value="Trans-Ekulu, Enugu, Enugu State" />
            <option value="9th Mile Corner, Ngwo, Enugu State" />
            <option value="Agbani Town (ESUT Campus), Enugu State" />
            <option value="Emene Industrial Layout / Akanu Ibiam Airport, Enugu" />
            <option value="Coal Camp, Enugu, Enugu State" />
            <option value="Holy Ghost Park, Old Park, Enugu, Enugu State" />
            <option value="IMT Campus, Enugu, Enugu State" />
            <option value="Gariki Market, Awkunanaw, Enugu, Enugu State" />
            <option value="Uwani, Enugu, Enugu State" />
          </datalist>

          <div className={styles.field}>
            <label htmlFor="pickup_address">Pickup Address (Enugu State)</label>
            <PlacesAutocompleteInput
              id="pickup_address"
              name="pickup_address"
              list="enugu-districts"
              placeholder="e.g. 15 Chime Avenue, New Haven, Enugu"
              value={formData.pickup_address}
              onChange={handleChange}
              onPlaceSelect={handlePickupSelect}
              onLocationWarning={(msg) => setError(msg)}
              required
            />
            <span className={styles.hint}>
              Type an address or choose from suggestions within Enugu State.
            </span>
          </div>

          <div className={styles.field}>
            <label htmlFor="destination_address">Destination Address (Enugu State)</label>
            <PlacesAutocompleteInput
              id="destination_address"
              name="destination_address"
              list="enugu-districts"
              placeholder="e.g. Faculty of Physical Sciences, UNN, Nsukka"
              value={formData.destination_address}
              onChange={handleChange}
              onPlaceSelect={handleDestinationSelect}
              onLocationWarning={(msg) => setError(msg)}
              required
            />
          </div>
        </div>

        <div className={`card ${styles.section}`}>
          <p className={styles.sectionTitle}>Package Details</p>

          <div className={styles.field}>
            <label htmlFor="package_description">Description</label>
            <textarea
              id="package_description"
              name="package_description"
              rows={3}
              placeholder="e.g. Small electronics box, fragile"
              value={formData.package_description}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="package_weight">Weight (kg) — optional</label>
              <input
                id="package_weight"
                name="package_weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 2.5"
                value={formData.package_weight}
                onChange={handleChange}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="package_value">Declared Value (₦) — optional</label>
              <input
                id="package_value"
                name="package_value"
                type="number"
                min="0"
                placeholder="e.g. 15000"
                value={formData.package_value}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className={`card ${styles.section}`}>
          <p className={styles.sectionTitle}>Receiver Details</p>

          <div className={styles.field}>
            <label htmlFor="receiver_name">Receiver Name</label>
            <input
              id="receiver_name"
              name="receiver_name"
              type="text"
              placeholder="Full name"
              value={formData.receiver_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="receiver_phone">Receiver Phone</label>
            <input
              id="receiver_phone"
              name="receiver_phone"
              type="tel"
              placeholder="08012345678"
              value={formData.receiver_phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="receiver_address">Receiver Address — optional</label>
            <input
              id="receiver_address"
              name="receiver_address"
              type="text"
              placeholder="If different from destination"
              value={formData.receiver_address}
              onChange={handleChange}
            />
          </div>
        </div>

        <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>
    </DashboardLayout>
  );
};

export default NewRequest;
