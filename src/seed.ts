import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding database...");

  // Create a demo shop
  const shop = await prisma.shop.upsert({
    where: { domain: "demo-store.myshopify.com" },
    create: {
      domain: "demo-store.myshopify.com",
      email: "demo@example.com",
      plan: "GROWTH",
    },
    update: {},
  });

  console.log(`Created shop: ${shop.domain}`);

  // Create sample products
  const products = [
    { name: "Wireless Headphones Pro", shopifyProductId: "demo-1", warrantyMonths: 24 },
    { name: "Smart Watch Ultra", shopifyProductId: "demo-2", warrantyMonths: 12 },
    { name: "Bluetooth Speaker Max", shopifyProductId: "demo-3", warrantyMonths: 18 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { shopId_shopifyProductId: { shopId: shop.id, shopifyProductId: p.shopifyProductId } },
      create: { shopId: shop.id, ...p, isActive: true },
      update: {},
    });
  }

  console.log(`Created ${products.length} products`);

  // Create default email templates
  const templates = [
    {
      type: "REGISTRATION_CONFIRM" as const,
      subject: "Your product has been registered - {{productName}}",
      body: "<h2>Hi {{customerName}},</h2><p>Your <strong>{{productName}}</strong> has been successfully registered!</p><p><strong>Serial Number:</strong> {{serialNumber}}</p><p><strong>Warranty valid until:</strong> {{warrantyExpiry}}</p><p><a href=\"{{portalUrl}}\">View My Registration</a></p>",
    },
    {
      type: "WARRANTY_EXPIRY" as const,
      subject: "Your warranty for {{productName}} expires soon",
      body: "<h2>Hi {{customerName}},</h2><p>Your warranty for <strong>{{productName}}</strong> expires on <strong>{{warrantyExpiry}}</strong>.</p><p><a href=\"{{portalUrl}}\">View My Registration</a></p>",
    },
    {
      type: "CLAIM_RECEIVED" as const,
      subject: "Claim #{{claimId}} received - {{productName}}",
      body: "<h2>Hi {{customerName}},</h2><p>We received your warranty claim for <strong>{{productName}}</strong>.</p><p><strong>Claim ID:</strong> #{{claimId}}</p><p>We'll respond within 48 hours.</p><p><a href=\"{{portalUrl}}\">Track Claim Status</a></p>",
    },
    {
      type: "CLAIM_UPDATE" as const,
      subject: "Claim #{{claimId}} update - {{status}}",
      body: "<h2>Hi {{customerName}},</h2><p>Your claim #{{claimId}} for <strong>{{productName}}</strong> has been updated.</p><p><strong>Status:</strong> {{status}}</p><p>{{merchantNotes}}</p><p><a href=\"{{portalUrl}}\">View Claim Details</a></p>",
    },
  ];

  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { shopId_type: { shopId: shop.id, type: t.type } },
      create: { shopId: shop.id, ...t },
      update: {},
    });
  }

  console.log(`Created ${templates.length} email templates`);
  console.log("Seeding complete!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
