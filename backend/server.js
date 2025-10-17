import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import linkRoutes from './routes/linkRoutes.js';

dotenv.config();
const app = express();

// Simple rate limiting middleware
const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => { // 15 minutes, 100 requests
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this IP
    const ipRequests = requests.get(ip) || [];

    // Filter out old requests
    const validRequests = ipRequests.filter(time => time > windowStart);

    if (validRequests.length >= max) {
      return res.status(429).json({
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
      });
    }

    // Add current request
    validRequests.push(now);
    requests.set(ip, validRequests);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      for (const [key, times] of requests.entries()) {
        if (times.length === 0 || times[0] < windowStart) {
          requests.delete(key);
        }
      }
    }

    next();
  };
};

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4321',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Apply rate limiting to all routes
app.use(rateLimit());

// Health check endpoint (must be very first route)
app.get("/health", (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Allow direct downloads from uploads directory
app.use("/downloads", express.static("uploads", {
  setHeaders: (res, path) => {
    const filename = path.split('/').pop();
    if (filename) {
      res.set('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
    }
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  res.status(500).json({
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// MongoDB connection with retry logic
const connectDB = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URL);
      console.log("MongoDB Connected");
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${i + 1} seconds...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
      }
    }
  }
  console.error("Failed to connect to MongoDB after multiple attempts");
  process.exit(1);
};

connectDB();

// Schedule periodic cleanup of orphaned files (every 24 hours)
setInterval(async () => {
  try {
    console.log('Running scheduled cleanup of orphaned files...');
    const { cleanupOrphanedFiles } = await import('./routes/fileRoutes.js');
    const deletedCount = await cleanupOrphanedFiles();
    if (deletedCount > 0) {
      console.log(`Scheduled cleanup removed ${deletedCount} orphaned files`);
    }
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
}, 24 * 60 * 60 * 1000); // 24 hours

// Ensure uploads directory exists
import fs from 'fs';
import path from 'path';
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.use("/api/auth" , authRoutes);
app.use("/api/files" , fileRoutes);
app.use("/api/categories" , categoryRoutes);
app.use("/api/links" , linkRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT , () => console.log(`Server running at port ${PORT}`));

// Export for Render
export default app;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
 
