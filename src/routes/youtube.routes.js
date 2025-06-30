import express from "express";
import {
  getAllVideos,
  getVideoStats,
  triggerScraping,
} from "../controllers/youtube.controller.js";

const router = express.Router();

// GET /api/youtube/scrape - Manual trigger for scraping (optional)
router.get("/scrape", triggerScraping);

// GET /api/youtube/videos - Get all videos with pagination and search
router.get("/videos", getAllVideos);

// GET /api/youtube/stats - Get basic statistics
router.get("/stats", getVideoStats);

export default router;
