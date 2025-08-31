import axios from "axios";
import * as cheerio from "cheerio";
import mongoose from "mongoose";
import fs from "fs/promises";
import { featuredPodcastData } from "../utils/data.js";

// Video Schema
const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  thumbnail: { type: String, required: true },
  url: { type: String, required: true },
  channelName: { type: String, required: true },
  channelId: { type: String, required: true },
  description: { type: String, default: "" },
  publishedAt: { type: Date },
  duration: { type: String, default: "" },
  scrapedAt: { type: Date, default: Date.now },
});

const Video = mongoose.model("Video", videoSchema);

// Enhanced logging function
function logWithTimestamp(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

// Load config from config.json
async function loadConfig() {
  try {
    logWithTimestamp("📁 Loading config from config.json...");
    const configData = await fs.readFile("./config.json", "utf8");
    const config = JSON.parse(configData);
    logWithTimestamp("✅ Config loaded successfully", {
      channelsCount: config.channels?.length || 0,
      settings: config.settings || {},
    });
    return config;
  } catch (error) {
    logWithTimestamp("❌ Error loading config:", error.message);
    return { channels: [], settings: {} };
  }
}

// Check MongoDB connection
async function checkMongoConnection() {
  try {
    logWithTimestamp("🔍 Checking MongoDB connection...");
    const connectionState = mongoose.connection.readyState;
    const states = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    logWithTimestamp(
      `📊 MongoDB connection state: ${states[connectionState]} (${connectionState})`
    );

    if (connectionState !== 1) {
      logWithTimestamp("⚠️ MongoDB is not connected!");
      return false;
    }

    // Test database operation
    const testCount = await Video.countDocuments();
    logWithTimestamp(
      `✅ MongoDB connection verified. Current video count: ${testCount}`
    );
    return true;
  } catch (error) {
    logWithTimestamp("❌ MongoDB connection check failed:", error.message);
    return false;
  }
}

// Check if video is too old based on config
function isVideoTooOld(publishedDate, maxVideoAge) {
  if (!maxVideoAge || !publishedDate) return false;

  try {
    const videoDate = new Date(publishedDate);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxVideoAge);

    const isTooOld = videoDate < cutoffDate;
    logWithTimestamp(
      `📅 Age check for video published ${publishedDate}: ${
        isTooOld ? "TOO OLD" : "OK"
      }`,
      {
        videoDate: videoDate.toISOString(),
        cutoffDate: cutoffDate.toISOString(),
        maxVideoAge,
      }
    );

    return isTooOld;
  } catch (error) {
    logWithTimestamp("❌ Error checking video age:", error.message);
    return false;
  }
}

async function fetchDurationFromWatchPage(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = res.data;

    // Regex for "lengthSeconds":"123"
    const match = html.match(/"lengthSeconds":"(\d+)"/);
    if (match && match[1]) {
      return parseInt(match[1], 10); // seconds
    }
  } catch (err) {
    logWithTimestamp(
      `⚠️ Failed to fetch duration for ${videoId}: ${err.message}`
    );
  }
  return null;
}

function isShortVideo(durationSeconds) {
  if (!durationSeconds || isNaN(durationSeconds)) return false;
  const totalSeconds = parseInt(durationSeconds);
  logWithTimestamp(`🔍 Checking duration: ${totalSeconds} seconds`);
  return totalSeconds < 180;
}

// Scrape videos from RSS feed for a channel
async function scrapeChannelFromRSS(channelConfig, settings) {
  try {
    logWithTimestamp(
      `🎯 Starting to process channel: ${channelConfig.name} (ID: ${channelConfig.id})`
    );

    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelConfig.id}`;
    logWithTimestamp(`🌐 Fetching RSS feed: ${rssUrl}`);

    const response = await axios.get(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RSS Reader; +http://example.com/bot)",
      },
      timeout: 15000,
    });

    logWithTimestamp(
      `✅ RSS feed fetched successfully. Response size: ${response.data.length} characters`
    );

    const $ = cheerio.load(response.data, { xmlMode: true });
    const entries = $("entry");
    logWithTimestamp(`📋 Found ${entries.length} entries in RSS feed`);

    const videos = [];
    let skippedShorts = 0;
    const maxVideos =
      channelConfig.maxVideos || settings.defaultMaxVideos || 500;

    $("entry").each((index, element) => {
      try {
        if (index >= maxVideos) return false;

        const $entry = $(element);
        const videoId = $entry.find("yt\\:videoId").text();
        const title = $entry.find("title").text();
        const published = $entry.find("published").text();
        const description = $entry.find("media\\:description").text() || "";

        // ✅ Extract duration from media:content
        let durationSeconds = "";
        const mediaContent = $entry.find("media\\:content");
        if (mediaContent.length > 0) {
          durationSeconds = mediaContent.attr("duration") || "";
        }

        logWithTimestamp(`📝 Video data extracted:`, {
          videoId,
          title: title.substring(0, 50) + (title.length > 50 ? "..." : ""),
          published,
          duration: durationSeconds ? `${durationSeconds} seconds` : "N/A",
        });

        if (!videoId || !title) return;

        // Skip old videos
        if (
          settings.maxVideoAge &&
          isVideoTooOld(published, settings.maxVideoAge)
        )
          return;

        // Skip shorts
        if (settings.skipShortsVideos && durationSeconds) {
          if (isShortVideo(durationSeconds)) {
            skippedShorts++;
            logWithTimestamp(
              `🩳 Skipping short video (${durationSeconds}s): ${title.substring(
                0,
                50
              )}...`
            );
            return;
          }
        }

        const videoData = {
          videoId,
          title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          channelName: channelConfig.name,
          channelId: channelConfig.id,
          description,
          publishedAt: new Date(published),
          duration: durationSeconds
            ? `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60)
                .toString()
                .padStart(2, "0")}`
            : "",
        };

        videos.push(videoData);
      } catch (entryError) {
        logWithTimestamp(
          `❌ Error processing entry ${index + 1}:`,
          entryError.message
        );
      }
    });

    logWithTimestamp(
      `📊 Channel processing completed. Total videos to save: ${videos.length}, Skipped shorts: ${skippedShorts}`
    );
    return videos;
  } catch (error) {
    logWithTimestamp(
      `❌ Error scraping channel ${channelConfig.name}:`,
      error.message
    );
    return [];
  }
}

// Enhanced video saving function with additional shorts check
async function saveVideoToDatabase(video, settings = {}) {
  try {
    // Additional safety check for shorts before saving
    if (settings.skipShortsVideos && video.duration) {
      const durationParts = video.duration.split(":");
      let totalSeconds = 0;

      if (durationParts.length === 2) {
        // Format: "M:SS"
        totalSeconds =
          parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
      } else if (durationParts.length === 3) {
        // Format: "H:MM:SS"
        totalSeconds =
          parseInt(durationParts[0]) * 3600 +
          parseInt(durationParts[1]) * 60 +
          parseInt(durationParts[2]);
      }

      if (totalSeconds > 0 && totalSeconds < 180) {
        // 3 minutes = 180 seconds
        logWithTimestamp(
          `🩳 Safety check: Skipping short video in save function (${totalSeconds}s): ${video.title.substring(
            0,
            50
          )}...`
        );
        return { success: false, error: "Video is too short", isShort: true };
      }
    }

    logWithTimestamp(
      `💾 Attempting to save video: ${video.title.substring(0, 50)}...`
    );
    logWithTimestamp(`📋 Video data being saved:`, {
      videoId: video.videoId,
      title: video.title.substring(0, 100),
      channelName: video.channelName,
      publishedAt: video.publishedAt,
      duration: video.duration,
    });

    // Check if video already exists
    const existingVideo = await Video.findOne({ videoId: video.videoId });
    if (existingVideo) {
      logWithTimestamp(`🔄 Video already exists, updating: ${video.videoId}`);
    } else {
      logWithTimestamp(`🆕 New video, creating: ${video.videoId}`);
    }

    const result = await Video.findOneAndUpdate(
      { videoId: video.videoId },
      video,
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    logWithTimestamp(`✅ Video saved successfully:`, {
      videoId: result.videoId,
      _id: result._id.toString(),
      isNew: !existingVideo,
      scrapedAt: result.scrapedAt,
    });

    return { success: true, isNew: !existingVideo, video: result };
  } catch (error) {
    logWithTimestamp(`❌ Error saving video ${video.videoId}:`, {
      error: error.message,
      code: error.code,
      name: error.name,
    });

    // Log validation errors in detail
    if (error.name === "ValidationError") {
      logWithTimestamp(`🔍 Validation error details:`, error.errors);
    }

    // Log duplicate key errors
    if (error.code === 11000) {
      logWithTimestamp(`🔑 Duplicate key error for video: ${video.videoId}`);
    }

    return { success: false, error: error.message };
  }
}

// Main scraping function (for cron job)
export const scrapeAllChannels = async () => {
  try {
    logWithTimestamp("🚀 Starting YouTube scraping process...");

    // Check MongoDB connection first
    const isConnected = await checkMongoConnection();
    if (!isConnected) {
      const errorMsg =
        "MongoDB is not connected. Cannot proceed with scraping.";
      logWithTimestamp(`❌ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    const config = await loadConfig();

    if (!config.channels || config.channels.length === 0) {
      const errorMsg = "No channels configured in config.json";
      logWithTimestamp(`⚠️ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    logWithTimestamp(
      `📊 Starting to process ${config.channels.length} channels`
    );

    let totalScraped = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let totalSkippedShorts = 0;
    const results = [];

    for (let i = 0; i < config.channels.length; i++) {
      const channelConfig = config.channels[i];

      try {
        logWithTimestamp(
          `\n🎯 Processing channel ${i + 1}/${config.channels.length}: ${
            channelConfig.name
          }`
        );

        const videos = await scrapeChannelFromRSS(
          channelConfig,
          config.settings
        );
        logWithTimestamp(
          `📋 Found ${videos.length} videos for channel: ${channelConfig.name}`
        );

        // Save videos to database
        let savedCount = 0;
        let newCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        let skippedShortsCount = 0;

        for (let j = 0; j < videos.length; j++) {
          const video = videos[j];
          logWithTimestamp(
            `\n💾 Saving video ${j + 1}/${videos.length} for ${
              channelConfig.name
            }`
          );

          const saveResult = await saveVideoToDatabase(video, config.settings);

          if (saveResult.success) {
            savedCount++;
            if (saveResult.isNew) {
              newCount++;
            } else {
              updatedCount++;
            }
          } else if (saveResult.isShort) {
            // Don't count shorts as errors, just log them
            skippedShortsCount++;
            totalSkippedShorts++;
            logWithTimestamp(
              `🩳 Skipped short video in save: ${video.title.substring(
                0,
                50
              )}...`
            );
          } else {
            errorCount++;
            totalErrors++;
          }

          // Small delay between saves to avoid overwhelming the database
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const channelResult = {
          channelName: channelConfig.name,
          channelId: channelConfig.id,
          foundVideos: videos.length,
          savedVideos: savedCount,
          newVideos: newCount,
          updatedVideos: updatedCount,
          skippedShorts: skippedShortsCount,
          errorCount: errorCount,
        };

        results.push(channelResult);
        totalScraped += savedCount;
        totalNew += newCount;
        totalUpdated += updatedCount;

        logWithTimestamp(`✅ Channel completed:`, channelResult);

        // Processing delay between channels
        if (config.settings.processingDelay) {
          logWithTimestamp(
            `⏳ Waiting ${config.settings.processingDelay}ms before next channel...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, config.settings.processingDelay)
          );
        }
      } catch (error) {
        const errorMsg = `Failed to process channel ${channelConfig.name}: ${error.message}`;
        logWithTimestamp(`❌ ${errorMsg}`);

        results.push({
          channelName: channelConfig.name,
          channelId: channelConfig.id,
          error: error.message,
        });
        totalErrors++;
      }
    }

    const finalResult = {
      success: true,
      totalScraped,
      totalNew,
      totalUpdated,
      totalSkippedShorts,
      totalErrors,
      results,
      timestamp: new Date(),
    };

    logWithTimestamp(`\n🎉 Scraping process completed!`, finalResult);

    return finalResult;
  } catch (error) {
    const errorMsg = `Critical error in scraping process: ${error.message}`;
    logWithTimestamp(`💥 ${errorMsg}`);
    return { success: false, error: error.message };
  }
};

// Get all videos with pagination and search
export const getAllVideos = async (req, res) => {
  try {
    logWithTimestamp("📊 Fetching videos with filters...");

    const {
      page = 1,
      limit = 20,
      search = "",
      channel = "",
      sortBy = "publishedAt",
      order = "desc",
    } = req.query;

    logWithTimestamp("🔍 Request parameters:", {
      page,
      limit,
      search,
      channel,
      sortBy,
      order,
    });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const searchQuery = {};

    if (search) {
      searchQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { channelName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (channel) {
      searchQuery.channelName = { $regex: channel, $options: "i" };
    }

    logWithTimestamp("🔎 MongoDB query:", searchQuery);

    // Build sort object
    const sortOrder = order === "desc" ? -1 : 1;
    const sortObj = { [sortBy]: sortOrder };

    // Get total count for pagination
    const totalVideos = await Video.countDocuments(searchQuery);
    logWithTimestamp(`📊 Total videos matching query: ${totalVideos}`);

    // Get videos
    const videos = await Video.find(searchQuery)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    logWithTimestamp(
      `📋 Retrieved ${videos.length} videos for page ${pageNum}`
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalVideos / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    const response = {
      videos,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalVideos,
        hasNext,
        hasPrev,
        limit: limitNum,
      },
      filters: {
        search,
        channel,
        sortBy,
        order,
      },
    };

    logWithTimestamp("✅ Videos fetched successfully");
    res.json(response);
  } catch (error) {
    logWithTimestamp("❌ Error fetching videos:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get video statistics
export const getVideoStats = async (req, res) => {
  try {
    logWithTimestamp("📊 Fetching video statistics...");

    const totalVideos = await Video.countDocuments();
    logWithTimestamp(`📈 Total videos in database: ${totalVideos}`);

    const channelStats = await Video.aggregate([
      {
        $group: {
          _id: "$channelName",
          count: { $sum: 1 },
          channelId: { $first: "$channelId" },
          latestVideo: { $max: "$publishedAt" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    logWithTimestamp(
      `📊 Channel statistics calculated for ${channelStats.length} channels`
    );

    const recentVideos = await Video.find({})
      .sort({ scrapedAt: -1 })
      .limit(10)
      .select("title channelName scrapedAt")
      .lean();

    logWithTimestamp(
      `📋 Retrieved ${recentVideos.length} recently scraped videos`
    );

    const response = {
      totalVideos,
      totalChannels: channelStats.length,
      channelStats,
      recentlyScraped: recentVideos,
    };

    logWithTimestamp("✅ Statistics fetched successfully");
    res.json(response);
  } catch (error) {
    logWithTimestamp("❌ Error fetching stats:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Manual trigger for scraping (optional endpoint)
export const triggerScraping = async (req, res) => {
  try {
    logWithTimestamp("🎯 Manual scraping triggered via API");
    const result = await scrapeAllChannels();
    logWithTimestamp("✅ Manual scraping completed");
    res.json(result);
  } catch (error) {
    logWithTimestamp("❌ Error triggering scraping:", error.message);
    res.status(500).json({ error: error.message });
  }
};

export const featuredPodcast = async (req, res) => {
  try {
    res.json(featuredPodcastData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
