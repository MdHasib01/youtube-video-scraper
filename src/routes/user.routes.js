import express from "express";
import {
  checkValidUser,
  loginUser,
  registerUser,
} from "../controllers/user.controller.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/checkUser", checkValidUser);
export default router;
