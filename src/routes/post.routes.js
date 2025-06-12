import express from "express";
import { getAllPosts, getPostById } from "../controllers/post.controllers.js";

const router = express.Router();

router.get("/posts", getAllPosts);
router.get("/posts/:id", getPostById);

export default router;
