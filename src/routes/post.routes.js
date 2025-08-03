import express from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
} from "../controllers/post.controllers.js";
import { uploadImageFileToCloudinary } from "../services/cloudinary.service.js";
import { upload } from "../middlewares/multer.middleware.js";
const router = express.Router();

router.get("/posts", getAllPosts);
router.get("/posts/:id", getPostById);
router.post("/post", upload.single("image"), createPost);
router.post("/upload_image", upload.single("image"), createPost);

export default router;
