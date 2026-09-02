const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();

app.use(cookieParser());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Razorpay checkout SDK (checkout.js), its inline scripts, fonts and the
      // payment iframe all require their own origins. No wildcards / unsafe-eval.
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://checkout.razorpay.com",
        "https://api.razorpay.com",
        "cdnjs.cloudflare.com",
        "unpkg.com",
        "instant.page",
        "fonts.googleapis.com",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com", "https://checkout.razorpay.com"],
      imgSrc: [
        "'self'",
        "data:",
        "https://*.googleusercontent.com",
        "https://*.supabase.co",
        "https://images.unsplash.com",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      fontSrc: ["'self'", "fonts.gstatic.com", "https:", "data:"],
      connectSrc: [
        "'self'",
        "https://checkout.razorpay.com",
        "https://api.razorpay.com",
        "https://*.razorpay.com",
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com",
        "https://www.instagram.com",
        "https://checkout.razorpay.com",
        "https://*.razorpay.com",
      ],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Razorpay webhook verification needs the RAW request body (Razorpay signs the
// exact bytes). Parse it before the global JSON parser consumes the stream and
// stash it on req.rawBody. Only matched for the webhook path.
const razorpayWebhookRaw = express.raw({ type: '*/*', limit: '1mb' });
app.use('/api/v1/payments/webhook', (req, res, next) => {
  razorpayWebhookRaw(req, res, (err) => {
    if (err) return next(err);
    if (req.body && Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body.toString('utf8'));
    }
    next();
  });
});

const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = [
      'https://fam-website-wq2e.onrender.com',
      'https://famorg-website.onrender.com',
      'http://localhost:5173',
      'http://localhost:5000',
      'http://localhost:8765',
      ...String(process.env.FRONTEND_URL || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});

// Dedicated limiter for admin credentials. Allows a short burst for front-desk
// login while still capping brute-force attempts. Returns 429 when exceeded and
// uses the same generic message so it does not reveal whether an email exists.
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipFailedRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/oauth/start', authLimiter);
app.use('/api/v1/admin/login', adminAuthLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/contact', contactRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Flamingo aur Maina - API Documentation',
}));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve frontend static files
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
  setHeaders: function(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// SPA fallback — serve index.html for non-API, non-file routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next(ApiError.notFound(`Route ${req.originalUrl} not found`));
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
});

app.use(errorHandler);

module.exports = app;
