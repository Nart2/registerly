import { Resend } from "resend";
import prisma from "~/db.server";
import type { EmailTemplateType } from "@prisma/client";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface SendEmailInput {
  to: string;
  shopId: string;
  templateType: EmailTemplateType;
  variables: Record<string, string>;
}

export async function sendEmail({ to, shopId, templateType, variables }: SendEmailInput) {
  const template = await prisma.emailTemplate.findUnique({
    where: { shopId_type: { shopId, type: templateType } },
  });

  if (!template) {
    console.warn(`No email template found: ${templateType} for shop ${shopId}`);
    return null;
  }

  let subject = template.subject;
  let body = template.body;

  // Replace variables like {{customerName}}, {{productName}}, etc.
  // HTML-escape values to prevent XSS in emails
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, escapeHtml(value));
  }

  if (!resend) {
    console.log(`[Email skipped - no RESEND_API_KEY] To: ${to}, Subject: ${subject}`);
    return null;
  }

  try {
    const result = await resend.emails.send({
      from: "Registerly <noreply@registerly.app>",
      to,
      subject,
      html: wrapEmailHtml(body),
    });
    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

export async function getEmailTemplates(shopId: string) {
  return prisma.emailTemplate.findMany({ where: { shopId } });
}

export async function upsertEmailTemplate(
  shopId: string,
  type: EmailTemplateType,
  subject: string,
  body: string,
) {
  return prisma.emailTemplate.upsert({
    where: { shopId_type: { shopId, type } },
    create: { shopId, type, subject, body },
    update: { subject, body },
  });
}

export async function createDefaultTemplates(shopId: string) {
  const defaults: { type: EmailTemplateType; subject: string; body: string }[] = [
    {
      type: "REGISTRATION_CONFIRM",
      subject: "Your product has been registered - {{productName}}",
      body: `<h2>Hi {{customerName}},</h2>
<p>Your <strong>{{productName}}</strong> has been successfully registered!</p>
<p><strong>Serial Number:</strong> {{serialNumber}}</p>
<p><strong>Warranty valid until:</strong> {{warrantyExpiry}}</p>
<p>You can view your registration and submit warranty claims at any time:</p>
<p><a href="{{portalUrl}}">View My Registration</a></p>`,
    },
    {
      type: "WARRANTY_EXPIRY",
      subject: "Your warranty for {{productName}} expires soon",
      body: `<h2>Hi {{customerName}},</h2>
<p>Your warranty for <strong>{{productName}}</strong> expires on <strong>{{warrantyExpiry}}</strong>.</p>
<p>If you have any issues with your product, please submit a claim before your warranty expires.</p>
<p><a href="{{portalUrl}}">View My Registration</a></p>`,
    },
    {
      type: "CLAIM_RECEIVED",
      subject: "Claim #{{claimId}} received - {{productName}}",
      body: `<h2>Hi {{customerName}},</h2>
<p>We've received your warranty claim for <strong>{{productName}}</strong>.</p>
<p><strong>Claim ID:</strong> #{{claimId}}</p>
<p><strong>Issue:</strong> {{issueDescription}}</p>
<p>We'll review your claim and respond within 48 hours.</p>
<p><a href="{{portalUrl}}">Track Claim Status</a></p>`,
    },
    {
      type: "CLAIM_UPDATE",
      subject: "Claim #{{claimId}} update - {{status}}",
      body: `<h2>Hi {{customerName}},</h2>
<p>Your warranty claim #{{claimId}} for <strong>{{productName}}</strong> has been updated.</p>
<p><strong>Status:</strong> {{status}}</p>
<p>{{merchantNotes}}</p>
<p><a href="{{portalUrl}}">View Claim Details</a></p>`,
    },
  ];

  for (const tmpl of defaults) {
    await prisma.emailTemplate.upsert({
      where: { shopId_type: { shopId, type: tmpl.type } },
      create: { shopId, ...tmpl },
      update: {},
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapEmailHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    h2 { color: #1a1a1a; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    strong { color: #1a1a1a; }
  </style>
</head>
<body>${body}</body>
</html>`;
}
