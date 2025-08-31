import { BlogPost } from "../models/BlogPost.model.js";
import { uploadImageFileToCloudinary } from "../services/cloudinary.service.js";

export const getAllPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ createdAt: -1 });
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
    if (!title || !content || !summary || !tags || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const uploadedImageUrl = imagePath
      ? await uploadImageFileToCloudinary(imagePath)
      : null;

    const videoId = (videoUrl && videoUrl.split("v=")[1]) || null;
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

export const editPost = async (req, res) => {
  const { id } = req.params; // Get post ID from URL parameters
  const {
    title,
    content,
    summary,
    videoUrl,
    channelName,
    tags,
    category,
    imageUrl,
    status,
  } = req.body;
  console.log(req.body);
  const imagePath = req.file?.path;

  console.log("Editing post ID:", id);
  console.log("Image path:", imagePath);

  try {
    // Check if post exists
    const existingPost = await BlogPost.findById(id);
    if (!existingPost) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Validate required fields (you can adjust based on your requirements)
    if (!title || !content || !summary) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Handle image upload if new image is provided
    let finalImageUrl = imageUrl;
    if (imagePath) {
      const uploadedImageUrl = await uploadImageFileToCloudinary(imagePath);
      finalImageUrl = uploadedImageUrl?.url;
    }

    // Extract video ID if videoUrl is provided
    const videoId = (videoUrl && videoUrl.split("v=")[1]) || null;

    // Prepare update object with only provided fields
    const updateData = {
      title,
      content,
      summary,
      videoId: videoId || existingPost.videoId,
      videoUrl: videoUrl || existingPost.videoUrl,
      cloudinaryImageUrl: finalImageUrl || existingPost.cloudinaryImageUrl,
      channelName: channelName || existingPost.channelName,
      tags: tags || existingPost.tags,
      category: category || existingPost.category,
      status: status || existingPost.status,
      updatedAt: new Date(),
    };

    console.log("Update data:", updateData);

    // Update the post
    const updatedPost = await BlogPost.findByIdAndUpdate(id, updateData, {
      new: true, // Return the updated document
      runValidators: true, // Run schema validators
    });

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Error updating post:", error);
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
