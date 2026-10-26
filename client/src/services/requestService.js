import api from './api';

export const createDispatchRequest = async (data) => {
  const response = await api.post('/requests', data);
  return response.data;
};

export const getMyRequests = async () => {
  const response = await api.get('/requests/my');
  return response.data;
};

export const getRequestById = async (id) => {
  const response = await api.get(`/requests/${id}`);
  return response.data;
};
