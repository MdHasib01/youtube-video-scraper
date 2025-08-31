import express from "express";
import {
  checkValidUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/checkUser", isAuthenticated, checkValidUser);
export default router;
