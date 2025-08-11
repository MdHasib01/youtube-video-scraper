import express from "express";
import {
  featuredPodcast,
  getAllVideos,
  getVideoStats,
  triggerScraping,
} from "../controllers/youtube.controller.js";

const router = express.Router();

router.get("/scrape", triggerScraping);
router.get("/videos", getAllVideos);
router.get("/stats", getVideoStats);
router.get("/featured-podcasts", featuredPodcast);

export default router;
