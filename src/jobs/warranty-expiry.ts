import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

async function checkExpiringWarranties() {
  console.log(`[${new Date().toISOString()}] Checking for expiring warranties...`);

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Find registrations expiring in the next 30 days that haven't been notified
  const expiringRegistrations = await prisma.registration.findMany({
    where: {
      status: "APPROVED",
      warrantyExpiresAt: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      expiryNotificationSent: false,
    },
    include: {
      product: true,
      shop: true,
    },
  });

  console.log(`Found ${expiringRegistrations.length} expiring registrations`);

  for (const registration of expiringRegistrations) {
    // Get the email template
    const template = await prisma.emailTemplate.findUnique({
      where: {
        shopId_type: {
          shopId: registration.shopId,
          type: "WARRANTY_EXPIRY",
        },
      },
    });

    if (!template) {
      console.log(`No warranty expiry template for shop ${registration.shopId}, skipping`);
      continue;
    }

    // Replace variables
    let subject = template.subject;
    let body = template.body;

    const variables: Record<string, string> = {
      customerName: registration.customerName,
      productName: registration.product.name,
      serialNumber: registration.serialNumber || "N/A",
      warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString() || "N/A",
      portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
    };

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replaceAll(placeholder, value);
      body = body.replaceAll(placeholder, value);
    }

    try {
      await resend.emails.send({
        from: "Registerly <noreply@registerly.app>",
        to: registration.customerEmail,
        subject,
        html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    a { color: #2563eb; }
  </style>
</head>
<body>${body}</body>
</html>`,
      });

      // Mark as notified
      await prisma.registration.update({
        where: { id: registration.id },
        data: { expiryNotificationSent: true },
      });

      console.log(`Sent expiry notification to ${registration.customerEmail} for registration ${registration.id}`);
    } catch (error) {
      console.error(`Failed to send expiry notification for registration ${registration.id}:`, error);
    }
  }

  console.log(`[${new Date().toISOString()}] Warranty expiry check complete`);
}

// Run immediately when called
checkExpiringWarranties()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
