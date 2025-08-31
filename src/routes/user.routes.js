import express from "express";
import {
  checkValidUser,
  loginUser,
  registerUser,
} from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/checkUser", isAuthenticated, checkValidUser);
export default router;
