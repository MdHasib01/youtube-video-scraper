const Joi = require("joi");
const { Newsletter, Contact, EmailLog } = require("../models/emailModels");
const emailClient = require("../utils/emailClient");

class EmailController {
  // Newsletter subscription
  async subscribeToNewsletter(req, res) {
    try {
      // Validation schema
      const schema = Joi.object({
        email: Joi.string().email().required().messages({
          "string.email": "Please provide a valid email address",
          "any.required": "Email is required",
        }),
        source: Joi.string().optional().default("website"),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const { email, source } = value;
      const userInfo = {
        source,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      };

      // Check if already subscribed
      const existingSubscription = await Newsletter.findOne({ email });
      if (existingSubscription) {
        if (existingSubscription.subscribed) {
          return res.status(409).json({
            success: false,
            message: "This email is already subscribed to our newsletter",
          });
        } else {
          // Re-subscribe
          existingSubscription.subscribed = true;
          existingSubscription.subscriptionDate = new Date();
          await existingSubscription.save();
        }
      } else {
        // Create new subscription
        const subscription = new Newsletter({
          email,
          source,
          ipAddress: userInfo.ipAddress,
          userAgent: userInfo.userAgent,
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

  // Unsubscribe from newsletter
  async unsubscribeFromNewsletter(req, res) {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      const { email } = value;

      const subscription = await Newsletter.findOneAndUpdate(
        { email },
        { subscribed: false, unsubscribeDate: new Date() },
        { new: true }
      );

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Email not found in our newsletter list",
        });
      }

      res.status(200).json({
        success: true,
        message: "Successfully unsubscribed from newsletter",
        data: {
          email,
          subscribed: false,
          unsubscribeDate: new Date(),
        },
      });
    } catch (error) {
      console.error("Newsletter unsubscribe error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to unsubscribe. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Contact form submission
  async submitContactForm(req, res) {
    try {
      // Validation schema
      const schema = Joi.object({
        name: Joi.string().trim().min(2).max(100).required().messages({
          "string.min": "Name must be at least 2 characters long",
          "string.max": "Name must not exceed 100 characters",
          "any.required": "Name is required",
        }),
        email: Joi.string().email().required().messages({
          "string.email": "Please provide a valid email address",
          "any.required": "Email is required",
        }),
        subject: Joi.string().trim().min(5).max(200).required().messages({
          "string.min": "Subject must be at least 5 characters long",
          "string.max": "Subject must not exceed 200 characters",
          "any.required": "Subject is required",
        }),
        message: Joi.string().trim().min(10).max(2000).required().messages({
          "string.min": "Message must be at least 10 characters long",
          "string.max": "Message must not exceed 2000 characters",
          "any.required": "Message is required",
        }),
        priority: Joi.string().valid("low", "medium", "high").default("medium"),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const contactData = {
        ...value,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      };

      // Save contact form data
      const contact = new Contact(contactData);
      await contact.save();

      // Send admin notification email
      try {
        await emailClient.sendContactFormNotification({
          ...contactData,
          _id: contact._id,
        });
      } catch (emailError) {
        console.error("Failed to send contact form notification:", emailError);
        // Continue execution even if email fails
      }

      res.status(201).json({
        success: true,
        message:
          "Your message has been sent successfully! We'll get back to you soon.",
        data: {
          id: contact._id,
          name: contact.name,
          email: contact.email,
          subject: contact.subject,
          submittedAt: contact.createdAt,
          status: contact.status,
        },
      });
    } catch (error) {
      console.error("Contact form submission error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit contact form. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get all newsletter subscribers (admin only)
  async getNewsletterSubscribers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = { subscribed: true };
      if (req.query.search) {
        filter.email = { $regex: req.query.search, $options: "i" };
      }

      const subscribers = await Newsletter.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Newsletter.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: subscribers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get newsletter subscribers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch newsletter subscribers",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get all contact form submissions (admin only)
  async getContactSubmissions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.priority) {
        filter.priority = req.query.priority;
      }
      if (req.query.search) {
        filter.$or = [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
          { subject: { $regex: req.query.search, $options: "i" } },
        ];
      }

      const contacts = await Contact.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Contact.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get contact submissions error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch contact submissions",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Update contact status (admin only)
  async updateContactStatus(req, res) {
    try {
      const { id } = req.params;
      const schema = Joi.object({
        status: Joi.string()
          .valid("pending", "read", "replied", "archived")
          .required(),
        repliedBy: Joi.string().optional(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid status provided",
        });
      }

      const updateData = { ...value };
      if (value.status === "replied") {
        updateData.repliedAt = new Date();
      }

      const contact = await Contact.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Contact status updated successfully",
        data: contact,
      });
    } catch (error) {
      console.error("Update contact status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update contact status",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get email logs (admin only)
  async getEmailLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.type) {
        filter.type = req.query.type;
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.recipient) {
        filter.recipient = { $regex: req.query.recipient, $options: "i" };
      }

      const logs = await EmailLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await EmailLog.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get email logs error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch email logs",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Send test email (admin only)
  async sendTestEmail(req, res) {
    try {
      const schema = Joi.object({
        to: Joi.string().email().required(),
        subject: Joi.string().required(),
        message: Joi.string().required(),
        type: Joi.string().valid("test", "announcement").default("test"),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details.map((detail) => detail.message),
        });
      }

      const { to, subject, message, type } = value;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1>Test Email from ${process.env.COMPANY_NAME}</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937;">${subject}</h2>
            <p style="color: #4b5563; line-height: 1.6;">${message}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">
              This is a test email sent from ${process.env.COMPANY_NAME}<br>
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `;

      await emailClient.sendEmail({
        to,
        subject: `[TEST] ${subject}`,
        html,
        type,
        metadata: { testEmail: true, sentBy: "admin" },
      });

      res.status(200).json({
        success: true,
        message: "Test email sent successfully",
        data: {
          to,
          subject,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Send test email error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send test email",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  // Get email statistics (admin only)
  async getEmailStats(req, res) {
    try {
      const [
        totalSubscribers,
        activeSubscribers,
        totalContacts,
        pendingContacts,
        emailsSent,
        emailsFailed,
      ] = await Promise.all([
        Newsletter.countDocuments(),
        Newsletter.countDocuments({ subscribed: true }),
        Contact.countDocuments(),
        Contact.countDocuments({ status: "pending" }),
        EmailLog.countDocuments({ status: "sent" }),
        EmailLog.countDocuments({ status: "failed" }),
      ]);

      // Get recent activity
      const recentSubscribers = await Newsletter.find({ subscribed: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("email createdAt");

      const recentContacts = await Contact.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email subject createdAt status");

      res.status(200).json({
        success: true,
        data: {
          stats: {
            totalSubscribers,
            activeSubscribers,
            totalContacts,
            pendingContacts,
            emailsSent,
            emailsFailed,
            successRate:
              emailsSent + emailsFailed > 0
                ? ((emailsSent / (emailsSent + emailsFailed)) * 100).toFixed(2)
                : 0,
          },
          recentActivity: {
            subscribers: recentSubscribers,
            contacts: recentContacts,
          },
        },
      });
    } catch (error) {
      console.error("Get email stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch email statistics",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

module.exports = new EmailController();
