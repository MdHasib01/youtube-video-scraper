const nodemailer = require("nodemailer");
const { EmailLog } = require("../models/emailModels");

class EmailClient {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.CLOUDFLARE_SMTP_HOST,
      port: parseInt(process.env.CLOUDFLARE_SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.CLOUDFLARE_EMAIL_USER,
        pass: process.env.CLOUDFLARE_EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error("❌ Email transporter verification failed:", error);
      } else {
        console.log("✅ Email server is ready to send messages");
      }
    });
  }

  async sendEmail(emailData) {
    try {
      const {
        to,
        subject,
        html,
        text,
        type = "general",
        metadata = {},
      } = emailData;

      const mailOptions = {
        from: `${process.env.COMPANY_NAME} <${process.env.FROM_EMAIL}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.stripHtml(html),
      };

      // Log email attempt
      const emailLog = new EmailLog({
        type: type,
        recipient: to,
        sender: process.env.FROM_EMAIL,
        subject: subject,
        status: "pending",
        metadata: metadata,
      });

      const info = await this.transporter.sendMail(mailOptions);

      // Update log with success
      emailLog.status = "sent";
      emailLog.messageId = info.messageId;
      await emailLog.save();

      console.log(`✅ Email sent successfully to ${to}:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Email sending failed:", error);

      // Update log with failure
      if (emailLog) {
        emailLog.status = "failed";
        emailLog.error = error.message;
        await emailLog.save();
      }

      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendNewsletterWelcome(email) {
    const html = this.getNewsletterWelcomeTemplate(email);
    return await this.sendEmail({
      to: email,
      subject: `Welcome to ${process.env.COMPANY_NAME} Newsletter! 🎉`,
      html: html,
      type: "newsletter_welcome",
      metadata: { userEmail: email },
    });
  }

  async sendNewsletterAdminNotification(email, userInfo = {}) {
    const html = this.getNewsletterAdminTemplate(email, userInfo);
    return await this.sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `New Newsletter Subscription - ${email}`,
      html: html,
      type: "newsletter_admin",
      metadata: { newSubscriber: email, userInfo },
    });
  }

  async sendContactFormNotification(contactData) {
    const html = this.getContactFormTemplate(contactData);
    return await this.sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Form Submission - ${contactData.subject}`,
      html: html,
      type: "contact_form",
      metadata: { contactId: contactData._id, senderEmail: contactData.email },
    });
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, "");
  }

  getNewsletterWelcomeTemplate(email) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Our Newsletter</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f7f8fc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; text-align: center; }
            .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
            .content { padding: 40px 30px; }
            .welcome-icon { font-size: 48px; text-align: center; margin-bottom: 20px; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
            .button:hover { background: #d97706; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; }
            .social-links { margin: 20px 0; }
            .social-links a { color: #f59e0b; text-decoration: none; margin: 0 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">${process.env.COMPANY_NAME}</div>
                <p>Welcome to our community!</p>
            </div>
            <div class="content">
                <div class="welcome-icon">🎉</div>
                <h1 style="color: #1f2937; margin-bottom: 20px;">Thank You for Subscribing!</h1>
                <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
                    Hi there! Welcome to the ${process.env.COMPANY_NAME} newsletter family. We're thrilled to have you on board!
                </p>
                <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">
                    You'll be the first to know about our latest updates, exclusive offers, and exciting news. 
                    We promise to keep it interesting and never spam your inbox.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.COMPANY_WEBSITE}" class="button">Visit Our Website</a>
                </div>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #f59e0b; margin-top: 0;">What to Expect:</h3>
                    <ul style="color: #4b5563; padding-left: 20px;">
                        <li>Weekly industry insights and tips</li>
                        <li>Exclusive promotions and early access</li>
                        <li>Company updates and announcements</li>
                        <li>Curated content just for you</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                <p>Thanks for joining us!</p>
                <p style="margin: 10px 0;">${process.env.COMPANY_NAME} Team</p>
                <div class="social-links">
                    <a href="#">Facebook</a> |
                    <a href="#">Twitter</a> |
                    <a href="#">LinkedIn</a> |
                    <a href="#">Instagram</a>
                </div>
                <p style="font-size: 12px; color: #9ca3af;">
                    You're receiving this email because you subscribed to our newsletter at ${process.env.COMPANY_WEBSITE}
                    <br>
                    <a href="#" style="color: #f59e0b;">Unsubscribe</a> | 
                    <a href="#" style="color: #f59e0b;">Update Preferences</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getNewsletterAdminTemplate(email, userInfo) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Newsletter Subscription</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f7f8fc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .info-card { background: #f8f9fa; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 5px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📧 New Newsletter Subscription</h1>
                <p>Someone just joined your newsletter!</p>
            </div>
            <div class="content">
                <div class="info-card">
                    <h3 style="color: #f59e0b; margin-top: 0;">Subscriber Details</h3>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subscription Date:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Source:</strong> ${
                      userInfo.source || "Website"
                    }</p>
                    ${
                      userInfo.ipAddress
                        ? `<p><strong>IP Address:</strong> ${userInfo.ipAddress}</p>`
                        : ""
                    }
                </div>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="mailto:${email}" class="button">Send Email</a>
                    <a href="${
                      process.env.COMPANY_WEBSITE
                    }/admin/subscribers" class="button">Manage Subscribers</a>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from ${
                  process.env.COMPANY_NAME
                }</p>
                <p>Generated at ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getContactFormTemplate(contactData) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f7f8fc; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; }
            .info-card { background: #f8f9fa; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; }
            .message-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 5px; font-weight: bold; }
            .button:hover { background: #d97706; }
            .button.secondary { background: #6b7280; }
            .priority { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; color: white; }
            .priority.high { background: #ef4444; }
            .priority.medium { background: #f59e0b; }
            .priority.low { background: #10b981; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📝 New Contact Form Submission</h1>
                <p>You have received a new message!</p>
            </div>
            <div class="content">
                <div class="info-card">
                    <h3 style="color: #f59e0b; margin-top: 0;">
                        Contact Details 
                        <span class="priority ${contactData.priority}">${
      contactData.priority?.toUpperCase() || "MEDIUM"
    }</span>
                    </h3>
                    <p><strong>Name:</strong> ${contactData.name}</p>
                    <p><strong>Email:</strong> ${contactData.email}</p>
                    <p><strong>Subject:</strong> ${contactData.subject}</p>
                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                    ${
                      contactData.ipAddress
                        ? `<p><strong>IP Address:</strong> ${contactData.ipAddress}</p>`
                        : ""
                    }
                </div>
                
                <div class="message-card">
                    <h3 style="color: #f59e0b; margin-top: 0;">Message</h3>
                    <p style="white-space: pre-wrap; line-height: 1.6;">${
                      contactData.message
                    }</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="mailto:${contactData.email}?subject=Re: ${
      contactData.subject
    }" class="button">
                        📧 Reply via Email
                    </a>
                    <a href="${
                      process.env.COMPANY_WEBSITE
                    }/admin/contacts" class="button secondary">
                        📋 View All Contacts
                    </a>
                </div>
                
                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <h4 style="color: #0369a1; margin-top: 0;">Quick Actions</h4>
                    <p style="margin: 5px 0;">
                        <strong>Mark as:</strong> 
                        <a href="#" style="color: #f59e0b; text-decoration: none;">Read</a> | 
                        <a href="#" style="color: #f59e0b; text-decoration: none;">High Priority</a> | 
                        <a href="#" style="color: #f59e0b; text-decoration: none;">Archived</a>
                    </p>
                </div>
            </div>
            <div class="footer">
                <p>This is an automated notification from ${
                  process.env.COMPANY_NAME
                }</p>
                <p>Contact ID: ${contactData._id || "N/A"}</p>
                <p>Generated at ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

module.exports = new EmailClient();
