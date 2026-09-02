const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');
const { initializeSocket } = require('./sockets/index');
const { startJobs } = require('./jobs/index');
const { validateEnvironment } = require('./config/envValidation');

const PORT = process.env.PORT || 5000;

const ensureAdmin = async () => {
  const User = require('./models/User');
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap');
    return;
  }
  const normalized = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalized });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.isVerified = true;
      await existing.save();
      console.log('Promoted existing user to admin');
    }
    return;
  }
  await User.create({
    name: 'Administrator',
    email: normalized,
    password,
    role: 'admin',
    isVerified: true,
    phone: '',
  });
  console.log('Admin user auto-created');
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB();
    configureCloudinary();
    await ensureAdmin();

    const http = require('http');
    const server = http.createServer(app);

    initializeSocket(server);

    startJobs();

    app.use((err, req, res, next) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
      next(err);
    });

    server.listen(PORT, () => {
      console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📡 Listening on port ${PORT}`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health: http://localhost:${PORT}/api/v1/health\n`);
    });

    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err.message);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err.message);
      server.close(() => process.exit(1));
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
