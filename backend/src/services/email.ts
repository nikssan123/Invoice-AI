import nodemailer from "nodemailer";
import { config } from "../config.js";
import { buildEmailHtml } from "./emailTemplate.js";

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
    const html = buildEmailHtml({
      title: "Welcome to Invoice Desk",
      introText: `Hi ${displayName},`,
      bodyHtml:
        "<p>Your account has been created successfully. You can log in to review and approve invoices with the help of Invoice Desk.</p>",
      ctaLabel: "Go to app",
      ctaUrl: `${config.appUrl.replace(/\/$/, "")}/dashboard`,
    });

    await transporter.sendMail({
      from: config.emailFrom ?? config.smtpUser,
      to,
      subject: "Welcome to Invoice Desk – your account has been created",
      text: `Hi ${displayName},\n\nYour account has been created successfully. You can log in anytime to manage your invoices.\n\nBest regards,\nInvoice Desk`,
      html,
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

  const resetUrl = `${config.appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    const html = buildEmailHtml({
      title: "Reset your password",
      introText: "You requested a password reset.",
      bodyHtml:
        `<p>Click the button below to set a new password for your Invoice Desk account.</p>
         <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
      ctaLabel: "Reset password",
      ctaUrl: resetUrl,
    });

    await transporter.sendMail({
      from: config.emailFrom ?? config.smtpUser,
      to,
      subject: "Reset your Invoice Desk password",
      text: `You requested a password reset.\n\nUse this link to set a new password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      html,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
  }
}

export async function sendInvitationEmail(
  to: string,
  organizationName: string,
  inviterName: string,
  acceptUrl: string
): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("Email not configured (SMTP_* env vars missing). Skipping invitation email.");
    return;
  }

  const from = config.emailFrom ?? config.smtpUser;

  try {
    const html = buildEmailHtml({
      title: `Invitation to join ${organizationName}`,
      introText: "Hi,",
      bodyHtml:
        `<p>${inviterName} invited you to join <strong>${organizationName}</strong> on Invoice Desk.</p>
         <p>Invoice Desk helps your team extract, review, and approve invoices faster with AI assistance.</p>`,
      ctaLabel: "Accept invitation",
      ctaUrl: acceptUrl,
      secondaryText: "If you weren’t expecting this invitation, you can safely ignore this email.",
    });

    await transporter.sendMail({
      from,
      to,
      subject: `You're invited to join ${organizationName} on Invoice Desk`,
      text: `Hi,\n\n${inviterName} invited you to join ${organizationName} on Invoice Desk.\n\nAccept and create your account:\n${acceptUrl}\n\nIf you didn't expect this, you can ignore this email.`,
      html,
    });
  } catch (err) {
    console.error("Failed to send invitation email:", err);
  }
}

export async function sendContactRequest(params: {
  fromEmail: string;
  fromName?: string | null;
  phone: string;
  message?: string | null;
}): Promise<void> {
  const transporter = getTransporter();
  const to = config.contactEmail ?? config.emailFrom ?? config.smtpUser;

  if (!transporter || !to) {
    console.warn("Contact email not configured (CONTACT_EMAIL or EMAIL_FROM). Skipping contact request.");
    return;
  }

  const { fromEmail, fromName, phone, message } = params;
  const nameLine = fromName ? `Name: ${fromName}\n` : "";
  const messageLine = message ? `\nMessage:\n${message}\n` : "";

  try {
    const detailsHtml =
      `<p><strong>New contact request</strong></p>
       <p>Email: <a href="mailto:${fromEmail}">${fromEmail}</a></p>` +
      (fromName ? `<p>Name: ${fromName}</p>` : "") +
      `<p>Phone: ${phone}</p>` +
      (message ? `<p>Message:</p><p>${message.replace(/\n/g, "<br>")}</p>` : "");

    const html = buildEmailHtml({
      title: "New contact request",
      bodyHtml: detailsHtml,
    });

    await transporter.sendMail({
      from: config.emailFrom ?? config.smtpUser,
      to,
      replyTo: fromEmail,
      subject: "Contact / Sales request from app",
      text: `New contact request:\n\nEmail: ${fromEmail}\n${nameLine}Phone: ${phone}${messageLine}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send contact request email:", err);
    throw err;
  }
}

/** Send a non-blocking notification when an invoice is approved. Do not await in the request path. */
export async function sendInvoiceApprovedNotification(
  to: string,
  invoiceFilename: string,
  approvedBy: string
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    const baseUrl = config.appUrl.replace(/\/$/, "");
    const invoicesUrl = `${baseUrl}/invoices`;

    const html = buildEmailHtml({
      title: "Invoice approved",
      bodyHtml: `<p>The invoice <strong>${invoiceFilename}</strong> was approved by ${approvedBy}.</p>`,
      ctaLabel: "View invoices",
      ctaUrl: invoicesUrl,
    });

    await transporter.sendMail({
      from: config.emailFrom ?? config.smtpUser,
      to,
      subject: `Invoice approved: ${invoiceFilename}`,
      text: `The invoice "${invoiceFilename}" was approved by ${approvedBy}.\n\nYou can review your invoices here: ${invoicesUrl}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send invoice approved notification:", err);
    throw err;
  }
}
