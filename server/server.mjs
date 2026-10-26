import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import { testConnection } from './config/db.mjs';
import authRoutes from './routes/authRoutes.mjs';
import requestRoutes from './routes/requestRoutes.mjs';
import paymentRoutes from './routes/paymentRoutes.mjs';
import trackingRoutes from './routes/trackingRoutes.mjs';
import chatRoutes from './routes/chatRoutes.mjs';
import fraudRoutes from './routes/fraudRoutes.mjs';
import adminRoutes from './routes/adminRoutes.mjs';

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
// Support multiple origins (Vercel preview URLs, production domain, and localhost)
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    const clientUrl = (process.env.CLIENT_URL || '').replace(/\/$/, '');
    if (
      origin === clientUrl ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:3000' ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }
    // Fallback: allow the origin so presentations/demos never get blocked by CORS
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/admin', adminRoutes);

// More routes will be added here as we build them out:
// import requestRoutes from './routes/requestRoutes.mjs';
// app.use('/api/requests', requestRoutes);
// app.use('/api/tracking', trackingRoutes);
// app.use('/api/riders', riderRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/chat', chatRoutes);
// app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'CP Truck API is running.' });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await testConnection();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚚 CP Truck server running on port ${PORT}`);
  });
};

startServer();
