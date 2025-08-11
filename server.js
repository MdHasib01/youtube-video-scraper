import express from "express";
import mongoose from "mongoose";
import cron from "node-cron";
import axios from "axios";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { YoutubeTranscript } from "youtube-transcript";
import { BlogPost } from "./src/models/BlogPost.model.js";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", true);
const PORT = process.env.PORT || 3000;
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "https://www.yochrisgray.com",
        "https://yochrisgray.com",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://personal-blog-ten-sigma.vercel.app",
      ];

      // Check if origin is in allowed list or matches Vercel pattern
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
});

// Blog Post Schema

// Configuration loader
async function loadConfig() {
  try {
    const configData = await fs.readFile("./config.json", "utf8");
    return JSON.parse(configData);
  } catch (error) {
    console.error("Error loading config:", error);
    return { channels: [] };
  }
}

// YouTube API functions
async function getChannelVideos(channelId, maxResults = 5) {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          channelId: channelId,
          part: "snippet",
          order: "date",
          maxResults: maxResults,
          type: "video",
        },
      }
    );
    return response.data.items;
  } catch (error) {
    console.error("Error fetching channel videos:", error);
    return [];
  }
}

async function getVideoTranscript(videoId) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    if (!transcript) throw new Error("No transcript available");
    const transcriptText = transcript.map((item) => item.text).join(" ");

    // Check if transcript is meaningful (not just music or empty)
    if (transcriptText.length < 100) {
      console.log(
        `Transcript too short for video ${videoId}: ${transcriptText.length} characters`
      );
      return null;
    }

    return transcriptText;
  } catch (error) {
    console.log(
      `No transcript available for video ${videoId}: ${error.message}`
    );
    return null;
  }
}

// Alternative: Get video description and title as fallback content
async function getVideoDetails(videoId) {
  try {
    const response = await axios.get(
      "https://www.googleapis.com/youtube/v3/videos",
      {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          id: videoId,
          part: "snippet,statistics",
        },
      }
    );

    const video = response.data.items[0];
    if (!video) return null;

    return {
      title: video.snippet.title,
      description: video.snippet.description,
      duration: video.contentDetails?.duration,
      viewCount: video.statistics?.viewCount,
      tags: video.snippet.tags || [],
    };
  } catch (error) {
    console.error("Error fetching video details:", error);
    return null;
  }
}

// Cloudinary functions

// OpenAI functions
async function generateBlogPost(
  content,
  videoTitle,
  channelName,
  contentType = "transcript"
) {
  try {
    let prompt;

    if (contentType === "transcript") {
      prompt = `
Convert the following YouTube video transcript into a comprehensive blog post:

Video Title: ${videoTitle}
Channel: ${channelName}
Transcript: ${content}

Please create:
1. An engaging blog title
2. A well-structured blog post with proper headings and paragraphs
3. A compelling summary (2-3 sentences)
4. Relevant tags (5-7 tags)
5. A category classification

Format the response as JSON with the following structure:
{
  "title": "Blog post title",
  "content": "Full blog post content with proper formatting",
  "summary": "Brief summary",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "category name"
}
`;
    } else {
      // Fallback for videos without transcripts
      prompt = `
Create a blog post based on this YouTube video information:

Video Title: ${videoTitle}
Channel: ${channelName}
Description: ${content}

Since no transcript is available, create a blog post that:
1. Analyzes the video topic based on the title and description
2. Provides valuable insights about the subject matter
3. Includes relevant context and background information
4. Suggests why viewers might find this content valuable

Format the response as JSON with the following structure:
{
  "title": "Blog post title",
  "content": "Full blog post content with proper formatting",
  "summary": "Brief summary",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "category name"
}
`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Error generating blog post:", error);
    return null;
  }
}

async function generateBlogImage(title, summary, videoId) {
  try {
    const prompt = `Create a professional blog post featured image for: "${title}". The image should be modern, clean, and suitable for a blog about: ${summary}. Make it visually appealing with good contrast and readable text if any.`;

    console.log(`Generating image for: ${title}`);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    const generatedImageUrl = response.data[0].url;
    console.log(`✅ Image generated by OpenAI: ${generatedImageUrl}`);

    // Upload to Cloudinary
    const publicId = `blog_${videoId}_${Date.now()}`;
    const cloudinaryResult = await uploadImageUrlToCloudinary(
      generatedImageUrl,
      publicId
    );

    return {
      openaiUrl: generatedImageUrl,
      cloudinaryUrl: cloudinaryResult?.url || null,
      cloudinaryPublicId: cloudinaryResult?.publicId || null,
    };
  } catch (error) {
    console.error("Error generating blog image:", error);
    return {
      openaiUrl: null,
      cloudinaryUrl: null,
      cloudinaryPublicId: null,
    };
  }
}

// Main processing function
async function processVideo(video, channelName) {
  const videoId = video.id.videoId;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Check if video already processed
  const existingPost = await BlogPost.findOne({ videoId });
  if (existingPost) {
    console.log(`Video ${videoId} already processed`);
    return;
  }

  console.log(`Processing video: ${video.snippet.title}`);

  // Try to get transcript first
  let transcript = await getVideoTranscript(videoId);
  let content, contentType;

  if (transcript && transcript.length > 100) {
    content = transcript;
    contentType = "transcript";
    console.log(`✅ Using transcript for video: ${video.snippet.title}`);
  } else {
    // Fallback to video details
    const videoDetails = await getVideoDetails(videoId);
    if (!videoDetails || !videoDetails.description) {
      console.log(`❌ No usable content for video: ${video.snippet.title}`);
      return;
    }

    content = `${videoDetails.description}\n\nTags: ${
      videoDetails.tags?.join(", ") || "None"
    }`;
    contentType = "description";
    console.log(
      `⚠️  Using description fallback for video: ${video.snippet.title}`
    );
  }

  // Generate blog post
  const blogData = await generateBlogPost(
    content,
    video.snippet.title,
    channelName,
    contentType
  );
  if (!blogData) {
    console.log("Failed to generate blog post for video:", videoId);
    return;
  }

  // Generate featured image and upload to Cloudinary
  const imageData = await generateBlogImage(
    blogData.title,
    blogData.summary,
    videoId
  );

  // Save to database
  const blogPost = new BlogPost({
    title: blogData.title,
    content: blogData.content,
    summary: blogData.summary,
    videoId: videoId,
    videoUrl: videoUrl,
    thumbnailUrl:
      video.snippet.thumbnails.high?.url ||
      video.snippet.thumbnails.default.url,
    generatedImageUrl: imageData.openaiUrl,
    cloudinaryImageUrl: imageData.cloudinaryUrl,
    cloudinaryPublicId: imageData.cloudinaryPublicId,
    channelName: channelName,
    publishedAt: new Date(video.snippet.publishedAt),
    tags: blogData.tags,
    category: blogData.category,
  });

  try {
    await blogPost.save();
    console.log(`✅ Blog post saved successfully: ${blogData.title}`);
    if (imageData.cloudinaryUrl) {
      console.log(
        `✅ Image uploaded to Cloudinary: ${imageData.cloudinaryUrl}`
      );
    }
  } catch (error) {
    console.error("Error saving blog post:", error);
  }
}

// Main job function
async function processChannels() {
  console.log("Starting channel processing job...");

  const config = await loadConfig();

  for (const channel of config.channels) {
    console.log(`Processing channel: ${channel.name}`);

    const videos = await getChannelVideos(channel.id, channel.maxVideos || 5);

    for (const video of videos) {
      await processVideo(video, channel.name);
      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("Channel processing job completed");
}

// Routes

app.get("/", (req, res) => {
  res.json({
    message: "YouTube to Blog Converter API",
    endpoints: {
      "/posts": "GET - Get all blog posts",
      "/posts/:id": "GET - Get specific blog post",
      "/trigger-job": "POST - Manually trigger processing job",
      "/stats": "GET - Get processing statistics",
      "/cloudinary-test": "GET - Test Cloudinary connection",
    },
  });
});

import postRoutes from "./src/routes/post.routes.js";
import youtubeRoutes from "./src/routes/youtube.routes.js";
import newsletterRoutes from "./src/routes/newsletter.routes.js";
import aiRoutes from "./src/routes/aicontent.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import { uploadImageUrlToCloudinary } from "./src/services/cloudinary.service.js";
// Post Routes
app.use("/api", postRoutes);

//ai routes
app.use("/api", aiRoutes);

// YouTube Routes
app.use("/api/youtube", youtubeRoutes);

// Newsletter Routes
app.use("/api/newsletter", newsletterRoutes);

// User Route
app.use("/api/user", userRoutes);

app.post("/trigger-job", async (req, res) => {
  try {
    await processChannels();
    res.json({ message: "Processing job triggered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const totalPosts = await BlogPost.countDocuments();
    const recentPosts = await BlogPost.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const postsWithCloudinaryImages = await BlogPost.countDocuments({
      cloudinaryImageUrl: { $ne: null },
    });

    res.json({
      totalPosts,
      recentPosts,
      postsWithCloudinaryImages,
      lastProcessed: await BlogPost.findOne()
        .sort({ createdAt: -1 })
        .select("createdAt"),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let cornJob = new Date(
  new Date().getTime() + 2 * 60 * 1000
).toLocaleTimeString();

// Cron job - runs every 2 minutes
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running scheduled job at:", new Date().toLocaleTimeString());
    cornJob = new Date(
      new Date().getTime() + 2 * 60 * 1000
    ).toLocaleTimeString();
    processChannels();
    const result = await scrapeAllChannels();
    console.log("Scheduled scraping result:", result);
  } catch (error) {
    console.error("Scheduled scraping failed:", error);
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Cron job scheduled to run every 2 minutes at:", cornJob);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});
