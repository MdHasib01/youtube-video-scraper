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

  // Contact form submission
  async submitContactForm(req, res) {
    try {
      const { name, email, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: "All fields are required (name, email, subject, message)",
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      // Get user info
      const userInfo = {
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
        timestamp: new Date(),
      };

      // Prepare contact data
      const contactData = {
        name,
        email,
        subject,
        message,
        ...userInfo,
      };

      // Optional: Save to database (if you have a Contact model)
      // const contact = new Contact(contactData);
      // await contact.save();

      // Send notification email to admin
      await emailClient.sendContactNotification(contactData);

      // Optional: Send confirmation email to user
      // await emailClient.sendContactConfirmation(email, name);

      res.status(200).json({
        success: true,
        message: "Thank you for your message! We'll get back to you soon.",
        data: {
          submitted: true,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error("Contact form submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send message. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}
// Export as default
export default new EmailController();
