import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import { createRegistration } from "~/services/registration.server";
import { sendEmail } from "~/services/email.server";
import { checkRegistrationLimit, incrementRegistrationCount } from "~/services/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop: shopDomain, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "ORDERS_PAID": {
      await handleOrderPaid(shopDomain, payload);
      break;
    }
    case "CUSTOMERS_DATA_REQUEST": {
      // GDPR: Export and log customer data for the merchant
      const { customer: reqCustomer } = payload as any;
      if (reqCustomer?.email) {
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (shop) {
          try {
            const { exportCustomerData } = await import("~/services/gdpr.server");
            const data = await exportCustomerData(shop.id, reqCustomer.email);
            console.log(`[GDPR] Customer data export for ${reqCustomer.email}:`, JSON.stringify(data));
          } catch (e) {
            console.error(`[GDPR] Failed to export customer data for ${reqCustomer.email}:`, e);
          }
        }
      }
      return new Response(null, { status: 200 });
    }
    case "CUSTOMERS_REDACT": {
      // GDPR: Delete customer data
      const { customer } = payload as any;
      if (customer?.email) {
        const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
        if (shop) {
          const { requestDataDeletion, processDataDeletion } = await import("~/services/gdpr.server");
          const deletionRequest = await requestDataDeletion(shop.id, customer.email);
          await processDataDeletion(deletionRequest.id);
        }
      }
      return new Response(null, { status: 200 });
    }
    case "SHOP_REDACT": {
      // GDPR: Delete shop data
      await prisma.shop.deleteMany({ where: { domain: shopDomain } });
      return new Response(null, { status: 200 });
    }
  }

  return new Response(null, { status: 200 });
};

async function handleOrderPaid(shopDomain: string, payload: any) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return;

  const order = payload as any;
  const lineItems = order.line_items || [];

  for (const item of lineItems) {
    const product = await prisma.product.findFirst({
      where: {
        shopId: shop.id,
        shopifyProductId: String(item.product_id),
        isActive: true,
      },
    });

    if (!product) continue;

    // Idempotency: skip if already registered for this order + product
    const existing = await prisma.registration.findFirst({
      where: { shopId: shop.id, shopifyOrderId: String(order.id), productId: product.id },
    });
    if (existing) continue;

    // Check limit
    const limitCheck = await checkRegistrationLimit(shop.id);
    if (!limitCheck.allowed) continue;

    const customerEmail = order.email || order.customer?.email;
    const customerName = order.customer
      ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
      : "Customer";

    if (!customerEmail) continue;

    try {
      // Auto-create registration
      const registration = await createRegistration({
        shopId: shop.id,
        productId: product.id,
        customerName,
        customerEmail,
        purchaseDate: new Date(order.created_at),
        purchaseChannel: "SHOPIFY",
        shopifyOrderId: String(order.id),
        consentGiven: false, // Customer needs to consent via portal
      });

      await incrementRegistrationCount(shop.id);

      // Send registration invite email
      await sendEmail({
        to: customerEmail,
        shopId: shop.id,
        templateType: "REGISTRATION_CONFIRM",
        variables: {
          customerName,
          productName: product.name,
          serialNumber: "N/A",
          warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "N/A",
          portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
        },
      });
    } catch (e) {
      console.error(`Failed to auto-register product ${product.id} for order ${order.id}:`, e);
    }
  }
}
