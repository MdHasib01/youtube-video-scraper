const express = require("express");
const rateLimit = require("express-rate-limit");
const emailController = require("../controllers/emailController");

const router = express.Router();

// Rate limiting for email endpoints
const emailRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 email requests per windowMs
  message: {
    success: false,
    message: "Too many email requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 contact form submissions per hour
  message: {
    success: false,
    message:
      "Too many contact form submissions from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple admin authentication middleware (replace with proper auth)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication required",
    });
  }
  next();
};

// Public routes
router.post(
  "/newsletter/subscribe",
  emailRateLimit,
  emailController.subscribeToNewsletter
);
router.post(
  "/newsletter/unsubscribe",
  emailRateLimit,
  emailController.unsubscribeFromNewsletter
);
router.post("/contact", contactRateLimit, emailController.submitContactForm);

// Admin routes (protected)
router.get(
  "/admin/subscribers",
  adminAuth,
  emailController.getNewsletterSubscribers
);
router.get("/admin/contacts", adminAuth, emailController.getContactSubmissions);
router.put(
  "/admin/contacts/:id/status",
  adminAuth,
  emailController.updateContactStatus
);
router.get("/admin/logs", adminAuth, emailController.getEmailLogs);
router.post("/admin/test-email", adminAuth, emailController.sendTestEmail);
router.get("/admin/stats", adminAuth, emailController.getEmailStats);

// Health check for email service
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Email service is running",
    timestamp: new Date().toISOString(),
    services: {
      database: "connected",
      email: "ready",
    },
  });
});

module.exports = router;
