import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";
const isAuthenticated = async (req, res, next) => {
  try {
    const token =
      req.cookies["token"] || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ error: "Unauthorized" })
        .clearCookie("token");
    }

    const decodedToken = jwt.verify(token, "secret");
    console.log(decodedToken);
    const user = await User.findById(decodedToken.userId);
    if (!user) {
      return res
        .status(401)
        .json({ error: "Unauthorized" })
        .clearCookie("token");
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: error.message }).clearCookie("token");
  }
};

export default isAuthenticated;
