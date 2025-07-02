// src/models/Newsletter.model.js
import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    source: {
      type: String,
      default: "website",
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
newsletterSchema.index({ email: 1 });
newsletterSchema.index({ subscribedAt: -1 });

export const Newsletter = mongoose.model("Newsletter", newsletterSchema);
