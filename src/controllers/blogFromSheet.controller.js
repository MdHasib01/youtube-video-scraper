import { blogFromSheetService } from "../services/blogFromSheet.service.js";

/**
 * Manually trigger the sheet-to-blog job.
 * Useful for testing without waiting for the daily cron.
 */
export const triggerSheetBlogJob = async (req, res) => {
  try {
    const result = await blogFromSheetService.processSheet();
    return res.status(200).json({
      message: "Sheet-to-blog job finished",
      ...result,
    });
  } catch (error) {
    console.error("triggerSheetBlogJob error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Quick health check that the service can talk to the configured spreadsheet.
 */
export const testSheetBlogConnection = async (req, res) => {
  try {
    const result = await blogFromSheetService.testConnection();
    const status = result.success ? 200 : 500;
    return res.status(status).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
