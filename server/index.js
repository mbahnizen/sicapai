/**
 * SiCAPAI Backend — Express Server
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from './middleware/auth.js';
import aiRoutes from './routes/ai.js';
import institutionRoutes from './routes/institutions.js';
import studentRoutes from './routes/students.js';
import reportRoutes from './routes/reports.js';
import quotaRoutes from './routes/quota.js';
import progressRoutes from './routes/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const isProduction = process.env.NODE_ENV === 'production';

// ---- Security & Rate Limiting ----
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    reportOnly: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com"],
      connectSrc: [
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
      ],
      frameSrc: ["https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  } : false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { message: 'Terlalu banyak request, silakan coba lagi nanti.' },
});
app.use('/api/', limiter);

// ---- Middleware ----
app.use(express.json({ limit: '1mb' }));

// ---- API Routes (all require auth) ----
app.use('/api/generate-ai', authMiddleware, aiRoutes);
app.use('/api/institutions', authMiddleware, institutionRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/quota', authMiddleware, quotaRoutes);
app.use('/api/progress', authMiddleware, progressRoutes);

// ---- Health Check ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SiCAPAI API', timestamp: new Date().toISOString() });
});

// ---- Serve Frontend (production) ----
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ---- Error Handler ----
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  const message = isProduction
    ? 'Terjadi kesalahan internal server'
    : (err.message || 'Terjadi kesalahan internal server');
  res.status(err.status || 500).json({ message });
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🎓 SiCAPAI server running on port ${PORT}`);
});

export default app;
