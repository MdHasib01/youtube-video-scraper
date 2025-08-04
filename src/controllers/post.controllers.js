import { BlogPost } from "../models/BlogPost.model.js";
import { uploadImageFileToCloudinary } from "../services/cloudinary.service.js";

export const getAllPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 }).limit(20);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPostById = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Post blog
export const createPost = async (req, res) => {
  const {
    title,
    content,
    summary,
    videoUrl,
    channelName,
    tags,
    category,
    imageUrl,
  } = req.body;
  const imagePath = req.file?.path;
  console.log(imagePath);
  try {
    if (
      !title ||
      !content ||
      !summary ||
      !videoUrl ||
      !channelName ||
      !tags ||
      !category
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const uploadedImageUrl = imagePath
      ? await uploadImageFileToCloudinary(imagePath)
      : null;

    const videoId = videoUrl.split("v=")[1] || null;
    const post = new BlogPost({
      title,
      content,
      summary,
      videoId,
      videoUrl,
      cloudinaryImageUrl: imageUrl || uploadedImageUrl?.url || null,
      channelName,
      tags,
      category,
    });
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
