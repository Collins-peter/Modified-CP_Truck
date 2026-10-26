import api from './api';

export const getRiderProfile = async () => {
  const response = await api.get('/tracking/rider/profile');
  return response.data;
};

export const updateRiderAvailability = async (availability) => {
  const response = await api.patch('/tracking/rider/availability', { availability });
  return response.data;
};

export const getMyDeliveries = async () => {
  const response = await api.get('/tracking/rider/my');
  return response.data;
};

export const updateDeliveryStatus = async (trackingRecordId, status, note = null) => {
  const response = await api.patch(`/tracking/${trackingRecordId}/status`, {
    status,
    note,
  });
  return response.data;
};

export const updateRiderLocation = async (trackingRecordId, lat, lng) => {
  const response = await api.patch(`/tracking/${trackingRecordId}/location`, {
    lat,
    lng,
  });
  return response.data;
};
