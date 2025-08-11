import express from "express";
import {
  createPost,
  deletePost,
  getAllPosts,
  getPostById,
} from "../controllers/post.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
const router = express.Router();

router.get("/posts", isAuthenticated, getAllPosts);
router.get("/posts/:id", getPostById);
router.delete("/posts/:id", deletePost);
router.post("/post", upload.single("image"), createPost);
router.post("/upload_image", upload.single("image"), createPost);

export default router;
