import mongoose from "mongoose";

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  videoId: { type: String, required: true, unique: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: null },
  generatedImageUrl: { type: String, default: null },
  cloudinaryImageUrl: { type: String, default: null },
  cloudinaryPublicId: { type: String, default: null },
  channelName: { type: String, default: "Chris Gray" },
  publishedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  tags: [String],
  category: String,
});

export const BlogPost = mongoose.model("BlogPost", blogPostSchema);
