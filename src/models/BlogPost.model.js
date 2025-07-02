import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  videoId: { type: String, required: true, unique: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  generatedImageUrl: { type: String, default: null },
  cloudinaryImageUrl: { type: String, default: null },
  cloudinaryPublicId: { type: String, default: null },
  channelName: { type: String, required: true },
  publishedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  tags: [String],
  category: String,
});

export const BlogPost = mongoose.model("BlogPost", blogPostSchema);
