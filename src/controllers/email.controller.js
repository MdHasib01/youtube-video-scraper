import Joi from "joi";
import emailClient from "../utils/emailClient.js";
import { Newsletter } from "../models/Newsletter.model.js";

class EmailController {
  // Newsletter subscription
  async subscribeToNewsletter(email, source) {
    try {
      const userInfo = {
        source,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      };

      // Check if already subscribed
      const existingSubscription = await Newsletter.findOne({ email });
      if (existingSubscription) {
        return res.status(409).json({
          success: false,
          message: "This email is already subscribed to our newsletter",
        });
      } else {
        // Create new subscription
        const subscription = new Newsletter({
          email,
        });
        await subscription.save();
      }

      // Send emails concurrently
      const emailPromises = [
        emailClient.sendNewsletterWelcome(email),
        emailClient.sendNewsletterAdminNotification(email, userInfo),
      ];

      const emailResults = await Promise.allSettled(emailPromises);
      const emailErrors = emailResults.filter(
        (result) => result.status === "rejected"
      );

      if (emailErrors.length > 0) {
        console.error("Some emails failed to send:", emailErrors);
      }

      res.status(201).json({
        success: true,
        message:
          "Successfully subscribed to newsletter! Check your email for confirmation.",
        data: {
          email,
          subscribed: true,
          subscriptionDate: new Date(),
        },
      });
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to subscribe to newsletter. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

// Export as default
export default new EmailController();
