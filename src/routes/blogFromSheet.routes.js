import express from "express";
import {
  triggerSheetBlogJob,
  testSheetBlogConnection,
} from "../controllers/blogFromSheet.controller.js";

const router = express.Router();

// Manually run the sheet-to-blog job (same logic the daily cron runs).
router.post("/sheet-blog/run", triggerSheetBlogJob);

// Verify the service account can reach the configured spreadsheet.
router.get("/sheet-blog/test", testSheetBlogConnection);

export default router;
