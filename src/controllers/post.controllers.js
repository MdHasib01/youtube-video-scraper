import { BlogPost } from "../models/BlogPost.model.js";

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
    cloudinaryImageUrl,
    channelName,
    tags,
    category,
  } = req.body;
  try {
    if (
      !title ||
      !content ||
      !summary ||
      !videoUrl ||
      !cloudinaryImageUrl ||
      !channelName ||
      !tags ||
      !category
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const videoId = videoUrl.split("v=")[1];
    const post = new BlogPost({
      title,
      content,
      summary,
      videoId,
      videoUrl,
      cloudinaryImageUrl,
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

//Image upload to cloudinnery
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const result = await cloudinary.uploader.upload(req.file.path);
    res.json({ imageUrl: result.secure_url, publicId: result.public_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
