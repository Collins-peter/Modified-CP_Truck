import api from './api';

export const sendChatMessage = async (message, sessionId = null) => {
  const response = await api.post('/chat/message', { message, session_id: sessionId });
  return response.data;
};

export const getChatSessions = async () => {
  const response = await api.get('/chat/sessions');
  return response.data;
};

export const getSessionMessages = async (sessionId) => {
  const response = await api.get(`/chat/sessions/${sessionId}/messages`);
  return response.data;
};
