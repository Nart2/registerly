import type { Session } from "@shopify/shopify-api";
import prisma from "~/db.server";
import type { PlanType } from "@prisma/client";

interface PlanConfig {
  name: string;
  type: PlanType;
  price: number;
  registrationsPerMonth: number;
  features: string[];
}

export const PLANS: PlanConfig[] = [
  {
    name: "Free",
    type: "FREE",
    price: 0,
    registrationsPerMonth: 50,
    features: ["50 registrations/month", "Standard email notifications", "QR code generation"],
  },
  {
    name: "Starter",
    type: "STARTER",
    price: 19,
    registrationsPerMonth: 500,
    features: ["500 registrations/month", "Custom email templates", "QR code generation", "Priority support"],
  },
  {
    name: "Growth",
    type: "GROWTH",
    price: 49,
    registrationsPerMonth: 2000,
    features: ["2,000 registrations/month", "Custom email templates", "QR code generation", "Serial number validation", "Analytics dashboard", "Priority support"],
  },
  {
    name: "Pro",
    type: "PRO",
    price: 99,
    registrationsPerMonth: -1, // unlimited
    features: ["Unlimited registrations", "Custom email templates", "QR code generation", "Serial number validation", "Analytics dashboard", "White-label portal", "Priority support"],
  },
];

export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLANS.find((p) => p.type === plan) || PLANS[0];
}

// Feature gating — which features are available per plan
export type Feature = "customTemplates" | "serialNumbers" | "analytics" | "whiteLabel" | "brandColor";

const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  FREE: [],
  STARTER: ["customTemplates", "brandColor"],
  GROWTH: ["customTemplates", "brandColor", "serialNumbers", "analytics"],
  PRO: ["customTemplates", "brandColor", "serialNumbers", "analytics", "whiteLabel"],
};

export function hasFeature(plan: PlanType, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function getRequiredPlan(feature: Feature): string {
  const planOrder: PlanType[] = ["FREE", "STARTER", "GROWTH", "PRO"];
  for (const plan of planOrder) {
    if (PLAN_FEATURES[plan].includes(feature)) {
      const config = getPlanConfig(plan);
      return config.name;
    }
  }
  return "Pro";
}

export async function checkRegistrationLimit(shopId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) throw new Error("Shop not found");

  const planConfig = getPlanConfig(shop.plan);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (planConfig.registrationsPerMonth === -1) {
    const rateLimit = await prisma.rateLimit.findUnique({
      where: { shopId_month: { shopId, month: monthKey } },
    });
    return { allowed: true, current: rateLimit?.count || 0, limit: -1 };
  }

  const rateLimit = await prisma.rateLimit.findUnique({
    where: { shopId_month: { shopId, month: monthKey } },
  });

  const current = rateLimit?.count || 0;

  return {
    allowed: current < planConfig.registrationsPerMonth,
    current,
    limit: planConfig.registrationsPerMonth,
  };
}

// Shopify Billing API — create a recurring subscription
export async function createSubscription(
  admin: any,
  shop: { id: string; domain: string },
  planType: PlanType,
  returnUrl: string,
) {
  const planConfig = getPlanConfig(planType);

  if (planType === "FREE") {
    // Cancel existing subscription and set to free
    await cancelSubscription(admin, shop);
    return { confirmationUrl: returnUrl };
  }

  const response = await admin.graphql(
    `#graphql
    mutation appSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        test: $test
      ) {
        appSubscription {
          id
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: `Registerly ${planConfig.name}`,
        returnUrl,
        test: process.env.NODE_ENV !== "production", // Auto: test in dev, real charges in production
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: planConfig.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    },
  );

  const data = await response.json();
  const result = data.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    throw new Error(result.userErrors.map((e: any) => e.message).join(", "));
  }

  if (!result?.confirmationUrl) {
    throw new Error("Failed to create subscription");
  }

  return { confirmationUrl: result.confirmationUrl };
}

// Cancel active subscription and revert to FREE
export async function cancelSubscription(admin: any, shop: { id: string; domain: string }) {
  // Find active subscription
  const response = await admin.graphql(
    `#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
        }
      }
    }`,
  );

  const data = await response.json();
  const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];

  for (const sub of subscriptions) {
    if (sub.status === "ACTIVE") {
      try {
        const cancelResponse = await admin.graphql(
          `#graphql
          mutation appSubscriptionCancel($id: ID!) {
            appSubscriptionCancel(id: $id) {
              appSubscription { id }
              userErrors { field message }
            }
          }`,
          { variables: { id: sub.id } },
        );
        const cancelData = await cancelResponse.json();
        const cancelResult = cancelData.data?.appSubscriptionCancel;
        if (cancelResult?.userErrors?.length > 0) {
          console.error("Subscription cancel userErrors:", cancelResult.userErrors);
        }
      } catch (cancelError) {
        console.error("Failed to cancel subscription:", sub.id, cancelError);
      }
    }
  }

  // Revert shop plan to FREE
  await prisma.shop.update({
    where: { id: shop.id },
    data: { plan: "FREE" },
  });
}

// Confirm subscription after merchant approves — called from callback
export async function confirmSubscription(
  admin: any,
  shopDomain: string,
  planType: PlanType,
) {
  // Verify the subscription is active
  const response = await admin.graphql(
    `#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
        }
      }
    }`,
  );

  const data = await response.json();
  const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
  const planConfig = getPlanConfig(planType);

  const isActive = subscriptions.some(
    (sub: any) => sub.status === "ACTIVE" && sub.name === `Registerly ${planConfig.name}`,
  );

  if (planType === "FREE") {
    // For FREE plan downgrades, verify there are no active subscriptions
    // (cancellation should have been done first via createSubscription)
    const hasActive = subscriptions.some((sub: any) => sub.status === "ACTIVE");
    if (hasActive) {
      throw new Error("Cannot downgrade to FREE while active subscriptions exist. Cancel subscriptions first.");
    }
  } else if (!isActive) {
    throw new Error("Subscription not active");
  }

  // Update shop plan
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) throw new Error("Shop not found");

  await prisma.shop.update({
    where: { id: shop.id },
    data: { plan: planType },
  });

  return { success: true, plan: planType };
}

export async function incrementRegistrationCount(shopId: string): Promise<void> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.rateLimit.upsert({
    where: { shopId_month: { shopId, month: monthKey } },
    create: { shopId, month: monthKey, count: 1 },
    update: { count: { increment: 1 } },
  });
}
