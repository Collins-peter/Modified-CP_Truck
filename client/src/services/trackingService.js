import api from './api';

export const trackPackage = async (trackingId) => {
  const response = await api.get(`/tracking/${trackingId}`);
  return response.data;
};

export const getAvailableRiders = async () => {
  const response = await api.get('/tracking/riders/available');
  return response.data;
};

export const assignRiderAndGenerateTracking = async (requestId, riderId) => {
  const response = await api.post('/tracking/generate', {
    request_id: requestId,
    rider_id: riderId,
  });
  return response.data;
};

export const getAllTrackingDeliveries = async () => {
  const response = await api.get('/tracking');
  return response.data;
};
