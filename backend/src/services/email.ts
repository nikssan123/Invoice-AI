import nodemailer from "nodemailer";
import { config } from "../config.js";

function isEmailConfigured(): boolean {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpClientId && config.smtpClientSecret && config.smtpRefreshToken);
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: true,
    auth: {
        type: "OAuth2",
        user: config.smtpUser,
        clientId: config.smtpClientId,
        clientSecret: config.smtpClientSecret,
        refreshToken: config.smtpRefreshToken,
    },
  });
}

export async function sendWelcomeEmail(to: string, name?: string | null): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("Email not configured (SMTP_* env vars missing). Skipping welcome email.");
    return;
  }

  const displayName = name ?? "there";

  try {
    await transporter.sendMail({
      from: config.smtpUser,
      to,
      subject: "Welcome – your account has been created",
      text: `Hi ${displayName},\n\nYour account has been created successfully. You can log in anytime.\n\nBest regards`,
      html: `<p>Hi ${displayName},</p><p>Your account has been created successfully. You can log in anytime.</p><p>Best regards</p>`,
    });
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("Email not configured (SMTP_* env vars missing). Skipping password reset email.");
    return;
  }

  const resetUrl = `${config.appUrl.replace(/\/$/, "")}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await transporter.sendMail({
      from: config.emailFrom,
      to,
      subject: "Password reset request",
      text: `You requested a password reset. Click the link to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      html: `<p>You requested a password reset. <a href="${resetUrl}">Click here to set a new password</a>.</p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
  }
}
