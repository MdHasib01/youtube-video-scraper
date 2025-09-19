// src/controllers/newsletter.controller.js
import { Newsletter } from "../models/Newsletter.model.js";
import { GoogleSheetsServices } from "../services/googleSheets.service.js";
import emailService from "../utils/emailService.js";

export const subscribeToNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Get user IP address
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    // Check if email already exists
    const existingSubscriber = await Newsletter.findOne({
      email: email.toLowerCase(),
    });

    if (existingSubscriber) {
      // If email exists but is inactive, reactivate it
      if (!existingSubscriber.isActive) {
        existingSubscriber.isActive = true;
        existingSubscriber.subscribedAt = new Date();
        await existingSubscriber.save();

        // Update Google Sheets
        try {
          res.json({
            success: true,
            message: "Subscribed to newsletter successfully!",
          });

          await GoogleSheetsServices.updateSubscriber(email, true);
          await emailController.subscribeToNewsletter(email, "website");
        } catch (error) {
          console.error("Error updating Google Sheets:", error);
        }

        return res.status(200).json({
          success: true,
          message: "Subscribed to newsletter successfully!",
          data: {
            email: existingSubscriber.email,
            subscribedAt: existingSubscriber.subscribedAt,
          },
        });
      }

      return res.status(409).json({
        success: false,
        message: "Already subscribed to our newsletter",
      });
    }

    // Create new subscriber
    const newSubscriber = new Newsletter({
      email: email.toLowerCase(),
      ipAddress: ipAddress,
      source: req.body.source || "website",
    });

    // Save to database
    await newSubscriber.save();

    // Save to Google Sheets
    try {
      await emailService.sendEmail(
        email,
        "newsletter-welcome", // template name
        {
          email: email,
          name: "Subscriber",
        },
        "Welcome to Our Newsletter!",
        process.env.DEFAULT_FROM_EMAIL
      );
      await emailService.sendEmail(
        "chris@redpalm.us",
        "notify-for-newsletter-subscriber", // template name
        {
          email: email,
          timestamp: new Date().toLocaleString(),
          date: newSubscriber.subscribedAt.toLocaleString(),
        },
        "New Subscription!",
        process.env.DEFAULT_FROM_EMAIL,
        "marisol@redpalm.us",
        "madmaxshishir47@gmail.com "
      );
      await GoogleSheetsServices.addSubscriber({
        email: newSubscriber.email,
        subscribedAt: newSubscriber.subscribedAt,
        source: newSubscriber.source,
        ipAddress: newSubscriber.ipAddress,
      });
    } catch (error) {
      console.error("Error saving to Google Sheets:", error);
      // Don't fail the request if Google Sheets fails
    }

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter!",
      data: {
        email: newSubscriber.email,
        subscribedAt: newSubscriber.subscribedAt,
      },
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email is already subscribed to our newsletter",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
export const sendContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required (name, email, subject, message)",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Get user IP address
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    // Get current timestamp
    const timestamp = new Date().toLocaleString();

    try {
      // Send notification email to your noreply address
      await emailService.sendEmail(
        "chris@redpalm.us", // recipient
        "contact-form-notification", // template name
        {
          name: name,
          email: email,
          subject: subject,
          message: message,
          timestamp: timestamp,
          ipAddress: ipAddress,
        },
        `New Contact Form Submission: ${subject}`, // email subject
        process.env.DEFAULT_FROM_EMAIL,
        "madmaxshishir47@gmail.com "
      );

      res.status(200).json({
        success: true,
        message:
          "Your message has been sent successfully! We'll get back to you soon.",
        data: {
          name: name,
          email: email,
          subject: subject,
          submittedAt: timestamp,
        },
      });
    } catch (emailError) {
      console.error("Error sending contact form email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send your message. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Contact form submission error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};
export const unsubscribeFromNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our subscription list",
      });
    }

    // Mark as inactive instead of deleting
    subscriber.isActive = false;
    await subscriber.save();

    // Update Google Sheets
    try {
      await GoogleSheetsServices.updateSubscriber(email, false);
    } catch (error) {
      console.error("Error updating Google Sheets:", error);
    }

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from newsletter",
    });
  } catch (error) {
    console.error("Newsletter unsubscription error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

export const getNewsletterStats = async (req, res) => {
  try {
    const totalSubscribers = await Newsletter.countDocuments({
      isActive: true,
    });
    const totalUnsubscribed = await Newsletter.countDocuments({
      isActive: false,
    });
    const recentSubscribers = await Newsletter.countDocuments({
      isActive: true,
      subscribedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const latestSubscribers = await Newsletter.find({ isActive: true })
      .sort({ subscribedAt: -1 })
      .limit(10)
      .select("email subscribedAt source");

    res.status(200).json({
      success: true,
      data: {
        totalSubscribers,
        totalUnsubscribed,
        recentSubscribers,
        latestSubscribers,
      },
    });
  } catch (error) {
    console.error("Newsletter stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
