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
