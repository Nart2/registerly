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
    price: 9.99,
    registrationsPerMonth: 500,
    features: ["500 registrations/month", "Custom email templates", "QR code generation", "Priority support"],
  },
  {
    name: "Growth",
    type: "GROWTH",
    price: 24.99,
    registrationsPerMonth: 2000,
    features: ["2,000 registrations/month", "Custom email templates", "QR code generation", "Serial number validation", "Analytics dashboard", "Priority support"],
  },
  {
    name: "Pro",
    type: "PRO",
    price: 49.99,
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

// Shopify Managed Pricing: Shopify hosts the plan selection, charge approval,
// decline and re-approval-on-reinstall flow. A Managed Pricing app must NOT
// create charges via the Billing API (Shopify rejects appSubscriptionCreate).
// The app only links merchants to the Shopify-hosted pricing page and reads
// the active subscription to gate features.
//
// The app handle defaults to "registerly" but can be overridden via the
// SHOPIFY_APP_HANDLE env var — it MUST match the handle in the Partner
// Dashboard (visible in the App Store listing URL apps.shopify.com/<handle>).
export function getManagedPricingUrl(shopDomain: string): string {
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/i, "");
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "registerly";
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

// Reconcile the locally stored plan with Shopify's real subscription state.
// With Managed Pricing, Shopify owns the subscription lifecycle (subscribe,
// accept, decline, cancel, and re-approval on reinstall). This makes the
// app's stored plan follow Shopify's truth:
//   - active subscription    -> map its plan name to our PlanType
//   - no active subscription -> FREE (covers uninstall/reinstall and cancels)
export async function reconcilePlanWithShopify(
  admin: any,
  shopDomain: string,
): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return; // not provisioned yet (fresh install)

  let subscriptions: Array<{ name?: string; status?: string }>;
  try {
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
    subscriptions =
      data.data?.currentAppInstallation?.activeSubscriptions || [];
  } catch (e) {
    // Fail safe: on a transient Shopify API error do not change the plan, to
    // avoid wrongly cutting off a paying merchant. The APP_UNINSTALLED webhook
    // and the next auth / billing-page load still reconcile the reinstall case.
    console.error(
      `[billing] reconcile: could not verify subscription for ${shopDomain}:`,
      e,
    );
    return;
  }

  const active = subscriptions.find((sub) => sub.status === "ACTIVE");

  let resolvedPlan: PlanType = "FREE";
  if (active) {
    const name = (active.name || "").toLowerCase();
    const matched = PLANS.find(
      (p) => p.type !== "FREE" && name.includes(p.name.toLowerCase()),
    );
    // Active paid subscription: use the matched plan. If the Shopify plan name
    // cannot be mapped, keep the merchant's current paid plan, otherwise fall
    // back to the lowest paid plan so paid access is never silently lost.
    resolvedPlan =
      matched?.type ?? (shop.plan !== "FREE" ? shop.plan : "STARTER");
  }

  if (shop.plan !== resolvedPlan) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan: resolvedPlan },
    });
    console.log(
      `[billing] reconcile: ${shopDomain} plan ${shop.plan} -> ${resolvedPlan}`,
    );
  }
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
