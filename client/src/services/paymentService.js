import api from './api';

export const initiatePayment = async (requestId) => {
  const response = await api.post('/payments/initiate', { request_id: requestId });
  return response.data;
};

export const verifyPayment = async (reference) => {
  const response = await api.get(`/payments/verify/${reference}`);
  return response.data;
};
