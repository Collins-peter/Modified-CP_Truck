import api from './api';

export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

export const getAllRequests = async (status = '') => {
  const url = status ? `/requests?status=${status}` : '/requests';
  const response = await api.get(url);
  return response.data;
};

export const updateRequestStatus = async (requestId, request_status, delivery_fee = null) => {
  const payload = { request_status };
  if (delivery_fee !== null && delivery_fee !== undefined) {
    payload.delivery_fee = Number(delivery_fee);
  }
  const response = await api.patch(`/requests/${requestId}/status`, payload);
  return response.data;
};

export const getFlaggedRequests = async () => {
  const response = await api.get('/fraud/flagged');
  return response.data;
};

export const getFraudLogs = async (requestId) => {
  const response = await api.get(`/fraud/${requestId}/logs`);
  return response.data;
};

export const recheckFraud = async (requestId) => {
  const response = await api.post(`/fraud/${requestId}/recheck`);
  return response.data;
};

export const clearFraudFlag = async (requestId) => {
  const response = await api.patch(`/fraud/${requestId}/clear`);
  return response.data;
};

export const getAllUsers = async (role = '') => {
  const url = role ? `/admin/users?role=${role}` : '/admin/users';
  const response = await api.get(url);
  return response.data;
};

export const updateUserStatus = async (userId, status) => {
  const response = await api.patch(`/admin/users/${userId}/status`, { status });
  return response.data;
};

export const getOperationalReports = async () => {
  const response = await api.get('/admin/reports');
  return response.data;
};

export const getAllPayments = async () => {
  const response = await api.get('/payments');
  return response.data;
};
