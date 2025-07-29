import mongoose from "mongoose";

// Newsletter Subscription Schema

// Contact Form Schema
const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ["pending", "read", "replied", "archived"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    ipAddress: String,
    userAgent: String,
    repliedAt: Date,
    repliedBy: String,
  },
  {
    timestamps: true,
  }
);

// Email Log Schema
const emailLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["newsletter_welcome", "newsletter_admin", "contact_form"],
      required: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "failed", "pending"],
      default: "pending",
    },
    messageId: String,
    error: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better performance

contactSchema.index({ email: 1, createdAt: -1 });
emailLogSchema.index({ type: 1, createdAt: -1 });

export const Contact = mongoose.model("Contact", contactSchema);
export const EmailLog = mongoose.model("EmailLog", emailLogSchema);
