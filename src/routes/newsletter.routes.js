// src/routes/newsletter.routes.js
import express from "express";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getNewsletterStats,
} from "../controllers/newsletter.controller.js";
import { GoogleSheetsServices } from "../services/googleSheets.service.js";

const router = express.Router();

// Middleware to parse JSON
router.use(express.json());

// Subscribe to newsletter
router.post("/subscribe", subscribeToNewsletter);

// Unsubscribe from newsletter
router.post("/unsubscribe", unsubscribeFromNewsletter);

// Get newsletter statistics (protected route - you might want to add auth middleware)
router.get("/stats", getNewsletterStats);

// Test Google Sheets connection
router.get("/test-sheets", async (req, res) => {
  try {
    const result = await GoogleSheetsService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error testing Google Sheets connection",
      error: error.message,
    });
  }
});

// Get all subscribers from Google Sheets (admin route)
router.get("/sheets-data", async (req, res) => {
  try {
    const subscribers = await GoogleSheetsService.getAllSubscribers();
    res.json({
      success: true,
      data: subscribers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching data from Google Sheets",
      error: error.message,
    });
  }
});

export default router;
