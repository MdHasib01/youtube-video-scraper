import express from "express";
import {
  generateAiContent,
  generateAiImage,
  generateAiSummary,
} from "../controllers/generateAiContent.controller.js";
import {
  fakeContent,
  fakeImageUrl,
} from "../controllers/fakecontent.controller.js";

const router = express.Router();

router.post("/generate-content", generateAiContent);
router.post("/generate-image", generateAiImage);
router.post("/generate-summary", generateAiSummary);
// router.post("/generate-content", fakeContent);
// router.post("/generate-image", fakeImageUrl);

export default router;
