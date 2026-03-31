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
    features: ["50 registrations/month", "Basic email templates", "QR code generation"],
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
    features: ["Unlimited registrations", "Custom email templates", "QR code generation", "Serial number validation", "Advanced analytics", "White-label portal", "Custom domain", "Priority support"],
  },
];

export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLANS.find((p) => p.type === plan) || PLANS[0];
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

export async function incrementRegistrationCount(shopId: string): Promise<void> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.rateLimit.upsert({
    where: { shopId_month: { shopId, month: monthKey } },
    create: { shopId, month: monthKey, count: 1 },
    update: { count: { increment: 1 } },
  });
}
