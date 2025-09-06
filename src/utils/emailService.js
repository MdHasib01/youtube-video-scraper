import nodemailer from "nodemailer";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    console.log("Initializing email service...");
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(
    to,
    templateName,
    templateData = {},
    subject,
    from = null,
    bcc = null
  ) {
    try {
      console.log("Sending email...");

      const htmlContent = await this.loadTemplate(templateName, templateData);

      const mailOptions = {
        from: from || process.env.DEFAULT_FROM_EMAIL,
        to: to,
        subject: subject,
        html: htmlContent,
      };
      if (bcc) {
        mailOptions.bcc = bcc;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendPlainEmail(to, subject, text, from = null) {
    try {
      const mailOptions = {
        from: from || process.env.DEFAULT_FROM_EMAIL,
        to: to,
        subject: subject,
        text: text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Plain email sent successfully:", result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("Error sending plain email:", error);
      throw new Error(`Failed to send plain email: ${error.message}`);
    }
  }

  async loadTemplate(templateName, data) {
    try {
      const templatePath = path.join(
        __dirname,
        "../templates",
        `${templateName}.html`
      );
      let htmlContent = await fs.readFile(templatePath, "utf-8");

      Object.keys(data).forEach((key) => {
        const placeholder = new RegExp(`{{${key}}}`, "g");
        htmlContent = htmlContent.replace(placeholder, data[key]);
      });

      return htmlContent;
    } catch (error) {
      console.error("Error loading template:", error);
      throw new Error(`Failed to load template: ${templateName}`);
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("Email service connection verified");
      return true;
    } catch (error) {
      console.error("Email service connection failed:", error);
      return false;
    }
  }
}

export default new EmailService();
