import { google } from "googleapis";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";
import { BlogPost } from "../models/BlogPost.model.js";
import {
  uploadImageUrlToCloudinary,
  uploadImageFileToCloudinary,
} from "./cloudinary.service.js";
import { withImageRestrictions } from "../constants/imagePromptRules.js";

dotenv.config();

class BlogFromSheetService {
  constructor() {
    this.sheets = null;
    this.auth = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_BLOG_ID;
    this.sheetName = process.env.GOOGLE_SHEETS_BLOG_NAME || "Sheet1";
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ----------------------------- Setup -----------------------------

  async initialize() {
    if (this.sheets) return true;

    // Drop legacy unique index on BlogPost.videoId if it still exists.
    // Older versions of the schema had `videoId: unique: true`, which causes
    // E11000 duplicate-key errors whenever we save more than one post
    // without a YouTube video (multiple null videoIds).
    await this._ensureVideoIdIndexDropped();

    if (!this.spreadsheetId) {
      console.error(
        " GOOGLE_SHEETS_BLOG_ID is not set; cannot run blog-from-sheet service.",
      );
      return false;
    }

    try {
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          type: "service_account",
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await this.auth.getClient();
      this.sheets = google.sheets({ version: "v4", auth: authClient });
      return true;
    } catch (error) {
      console.error("Error initializing Google Sheets (blog):", error);
      return false;
    }
  }

  // ----------------------------- Helpers -----------------------------

  async _ensureVideoIdIndexDropped() {
    if (this._videoIdIndexChecked) return;
    this._videoIdIndexChecked = true;
    try {
      const indexes = await BlogPost.collection.indexes();
      const legacy = indexes.find(
        (i) => i.name === "videoId_1" && i.unique,
      );
      if (legacy) {
        await BlogPost.collection.dropIndex("videoId_1");
        console.log(
          "🧹 Dropped legacy unique index videoId_1 on blogposts collection.",
        );
      }
    } catch (e) {
      // Non-fatal: just log and continue.
      console.warn(
        "Could not check/drop legacy videoId index:",
        e.message,
      );
    }
  }

  _quotedRange(range) {
    return this.sheetName.includes(" ")
      ? `'${this.sheetName}'!${range}`
      : `${this.sheetName}!${range}`;
  }

  _parseTags(raw) {
    if (!raw) return [];
    return String(raw)
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  _extractVideoId(videoUrl) {
    if (!videoUrl) return null;
    try {
      const url = new URL(videoUrl);
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      if (url.hostname.includes("youtu.be")) {
        return url.pathname.replace("/", "") || null;
      }
      // /shorts/<id>, /embed/<id>
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
      return null;
    } catch {
      return null;
    }
  }

  _todayString() {
    // YYYY-MM-DD in server local time
    return new Date().toISOString().slice(0, 10);
  }

  // ----------------------------- Image helpers -----------------------------

  _extractDriveFileId(url) {
    if (!url) return null;
    try {
      // Patterns: /file/d/<id>/..., open?id=<id>, uc?id=<id>, ?id=<id>
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) return fileMatch[1];
      const u = new URL(url);
      const idParam = u.searchParams.get("id");
      if (idParam) return idParam;
      return null;
    } catch {
      return null;
    }
  }

  _driveDirectDownloadUrl(url) {
    const id = this._extractDriveFileId(url);
    if (id) {
      return `https://drive.google.com/uc?export=download&id=${id}`;
    }
    return url; // fall back to original URL if not a recognizable Drive link
  }

  async _downloadImageToBlogImage(imageUrl, title) {
    const dir = path.resolve("public", "blogImage");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const downloadUrl = this._driveDirectDownloadUrl(imageUrl);
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 60000,
    });

    // Try to infer extension from content-type, default to .jpg
    const ct = (response.headers["content-type"] || "").toLowerCase();
    let ext = ".jpg";
    if (ct.includes("png")) ext = ".png";
    else if (ct.includes("webp")) ext = ".webp";
    else if (ct.includes("gif")) ext = ".gif";
    else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";

    const safeTitle = String(title || "blog")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50);
    const filename = `sheet-blog-${Date.now()}-${safeTitle}${ext}`;
    const localPath = path.join(dir, filename);
    fs.writeFileSync(localPath, response.data);
    return localPath;
  }

  async _useProvidedCoverImage(imageUrl, title) {
    let localPath = null;
    try {
      console.log(`🖼️  Downloading provided image: ${imageUrl}`);
      localPath = await this._downloadImageToBlogImage(imageUrl, title);
      // uploadImageFileToCloudinary deletes the local file on both success and error.
      const uploaded = await uploadImageFileToCloudinary(localPath);
      return uploaded; // { url, publicId } or null
    } catch (error) {
      console.error("Failed to use provided image:", error.message);
      // Best-effort cleanup if the file still exists.
      try {
        if (localPath && fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (_) {}
      return null;
    }
  }

  // ----------------------------- AI helpers -----------------------------

  async _generateSummary(title, content) {
    try {
      const trimmed = String(content).slice(0, 6000);
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write concise, compelling blog post summaries (2-3 sentences, max 60 words) based purely on the article text. Do NOT mention or reference any video, YouTube, transcript, channel, or speaker. Treat the input as a written blog article. Return plain text only, no quotes, no markdown.",
          },
          {
            role: "user",
            content: `Title: ${title}\n\nArticle:\n${trimmed}\n\nWrite the summary now.`,
          },
        ],
        max_tokens: 160,
        temperature: 0.6,
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (error) {
      console.error("Summary generation failed:", error.message);
    }
    // Fallback: first ~240 chars of content.
    const fallback = String(content).replace(/\s+/g, " ").trim().slice(0, 240);
    return fallback || title;
  }

  async _generateCoverImage(title, summary) {
    try {
      const prompt = `Professional, modern blog cover illustration for a post titled "${title}". Visual theme based on: ${summary}. Clean composition, business/editorial aesthetic, vibrant but tasteful color palette of blues/grays/whites with accent color, soft lighting, high quality. Do NOT include any text, letters, words, or watermarks in the image.`;

      const response = await this.openai.images.generate({
        model: "gpt-image-1",
        prompt: withImageRestrictions(prompt),
        n: 1,
        size: "1024x1024",
      });

      const img = response.data?.[0];
      const source = img?.url
        ? img.url
        : img?.b64_json
          ? `data:image/png;base64,${img.b64_json}`
          : null;

      if (!source) return null;

      const publicId = `sheet-blog-${Date.now()}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .substring(0, 50)}`;

      const uploaded = await uploadImageUrlToCloudinary(source, publicId);
      return uploaded; // { url, publicId } or null
    } catch (error) {
      console.error("Cover image generation failed:", error.message);
      return null;
    }
  }

  // ----------------------------- Sheet I/O -----------------------------

  async _fetchRows() {
    const range = this._quotedRange("A:H");
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });
    return response.data.values || [];
  }

  async _markRowDone(rowNumber, postedDate) {
    // Update G (Posted Date) and H (Status) of the row.
    const range = this._quotedRange(`G${rowNumber}:H${rowNumber}`);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[postedDate, "Done"]],
      },
    });
  }

  async _markRowNotDone(rowNumber) {
    const range = this._quotedRange(`H${rowNumber}`);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: { values: [["Not Done"]] },
    });
  }

  // ----------------------------- Main job -----------------------------

  async processSheet() {
    const ok = await this.initialize();
    if (!ok) {
      return { success: false, message: "Google Sheets not initialized" };
    }

    const rows = await this._fetchRows();
    if (rows.length <= 1) {
      return {
        success: true,
        message: "No data rows in sheet",
        processed: 0,
        skipped: 0,
        failed: 0,
      };
    }

    const results = { processed: 0, skipped: 0, failed: 0, details: [] };

    // rows[0] is the header. Data starts at sheet row 2.
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sheetRowNumber = i + 1; // 1-based row number in the sheet

      const [
        title,
        content,
        imageUrlRaw,
        videoUrl,
        tagsRaw,
        category,
        _postedDate,
        statusRaw,
      ] = row;

      const providedImageUrl = (imageUrlRaw || "").toString().trim();

      const status = (statusRaw || "").toString().trim();

      // Only Done rows are skipped. Empty / "Not Done" / anything else is processed.
      if (status.toLowerCase() === "done") {
        results.skipped++;
        continue;
      }

      // Skip completely empty rows silently
      if (!title && !content) {
        results.skipped++;
        continue;
      }

      // Validate required fields
      if (!title || !content) {
        results.failed++;
        results.details.push({
          row: sheetRowNumber,
          status: "failed",
          reason: "Missing title or content",
        });
        try {
          await this._markRowNotDone(sheetRowNumber);
        } catch (e) {
          console.error("Failed to mark row as Not Done:", e.message);
        }
        continue;
      }

      try {
        console.log(
          `📝 [Row ${sheetRowNumber}] Creating blog post: "${title}"`,
        );

        // Generate summary
        const summary = await this._generateSummary(title, content);

        // Use provided image (Google Drive link) if available; otherwise generate one.
        let image = null;
        if (providedImageUrl) {
          image = await this._useProvidedCoverImage(providedImageUrl, title);
          if (!image) {
            console.warn(
              `⚠️  [Row ${sheetRowNumber}] Provided image failed, falling back to AI generation.`,
            );
          }
        }
        if (!image) {
          image = await this._generateCoverImage(title, summary);
        }

        // Build post
        const videoId = this._extractVideoId(videoUrl);

        const postDoc = {
          title: String(title).trim(),
          content: String(content),
          summary,
          videoUrl: videoUrl || null,
          generatedImageUrl: image?.url || null,
          cloudinaryImageUrl: image?.url || null,
          cloudinaryPublicId: image?.publicId || null,
          channelName: "Chris Gray",
          publishedAt: new Date(),
          tags: this._parseTags(tagsRaw),
          category: category || "Uncategorized",
        };
        // Only attach videoId when there is an actual YouTube video.
        if (videoId) postDoc.videoId = videoId;

        const post = new BlogPost(postDoc);
        await post.save();

        const postedDate = this._todayString();
        await this._markRowDone(sheetRowNumber, postedDate);

        results.processed++;
        results.details.push({
          row: sheetRowNumber,
          status: "done",
          postId: post._id.toString(),
          title: post.title,
        });
        console.log(
          `✅ [Row ${sheetRowNumber}] Blog post created (id=${post._id})`,
        );
      } catch (error) {
        console.error(
          `❌ [Row ${sheetRowNumber}] Failed to create blog post:`,
          error,
        );
        results.failed++;
        results.details.push({
          row: sheetRowNumber,
          status: "failed",
          reason: error.message,
        });
        try {
          await this._markRowNotDone(sheetRowNumber);
        } catch (e) {
          console.error("Also failed to mark row as Not Done:", e.message);
        }
      }

      // Small delay to avoid hammering OpenAI / Sheets APIs.
      await new Promise((r) => setTimeout(r, 1500));
    }

    return { success: true, ...results };
  }

  async testConnection() {
    const ok = await this.initialize();
    if (!ok) {
      return { success: false, message: "Failed to initialize" };
    }
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      return {
        success: true,
        message: "Blog sheet connection successful",
        spreadsheetTitle: response.data.properties.title,
        availableSheets: response.data.sheets.map((s) => s.properties.title),
        configuredSheetName: this.sheetName,
      };
    } catch (error) {
      return {
        success: false,
        message: "Blog sheet connection failed",
        error: error.message,
      };
    }
  }
}

export const blogFromSheetService = new BlogFromSheetService();
