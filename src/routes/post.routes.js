import express from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
} from "../controllers/post.controllers.js";

const router = express.Router();

router.get("/posts", getAllPosts);
router.get("/posts/:id", getPostById);
router.post("/posts", createPost);

export default router;
