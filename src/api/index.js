import express from 'express';
import searchRoutes from './routes/search.js';
import setsRoutes from './routes/sets.js';
import logger from '../utils/logger.js';

const app = express();

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.debug({ method: req.method, url: req.url }, 'request');
  next();
});

// Routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/search', searchRoutes);
app.use('/api/sets', setsRoutes);

// Error handler
app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, url: req.url }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
