const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Request timeout (30 seconds)
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static files (must come before routes)
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: false
}));

// API Routes
app.use('/', routes);

// Catch 404 for static files and return index.html (SPA fallback)
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    res.status(404).json({ success: false, message: 'Route not found' });
  } else {
    res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
      if (err) res.status(500).json({ success: false, message: 'Server error' });
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`NexHealth Pro server running on http://localhost:${PORT}`);
  console.log('Doctor credentials: doctor1/pass123, doctor2/pass123, doctor3/pass123');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
