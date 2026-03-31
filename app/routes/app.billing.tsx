import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Button,
  Badge,
  Banner,
  ProgressBar,
  List,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import { PLANS, checkRegistrationLimit, confirmSubscription, createSubscription } from "~/services/billing.server";
import type { PlanType } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const usage = await checkRegistrationLimit(shop.id);

  // Check if returning from Shopify billing confirmation
  const url = new URL(request.url);
  const chargeConfirmed = url.searchParams.get("charge_confirmed");
  const newPlan = url.searchParams.get("plan") as PlanType | null;

  if (chargeConfirmed === "true" && newPlan) {
    // Validate referrer to mitigate CSRF — Shopify redirects always come from Shopify's domain
    const referrer = request.headers.get("referer") || request.headers.get("referrer") || "";
    const isFromShopify = referrer === "" || referrer.includes(".myshopify.com") || referrer.includes(".shopify.com");
    if (!isFromShopify) {
      console.error("Billing confirmation referrer check failed:", referrer);
      return redirect("/app/billing");
    }

    try {
      await confirmSubscription(admin, session.shop, newPlan);
    } catch (e) {
      console.error("Failed to confirm subscription:", e);
    }
    // Redirect to clean URL
    return redirect("/app/billing");
  }

  return json({
    currentPlan: shop.plan,
    usage: {
      current: usage.current,
      limit: usage.limit,
    },
    plans: PLANS,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  if (intent === "upgrade") {
    const newPlan = formData.get("plan") as PlanType;

    const validPlans: PlanType[] = ["FREE", "STARTER", "GROWTH", "PRO"];
    if (!validPlans.includes(newPlan)) {
      return json({ error: "Invalid plan selected" }, { status: 400 });
    }

    // Don't allow "upgrading" to current plan
    if (newPlan === shop.plan) {
      return json({ error: "You are already on this plan" }, { status: 400 });
    }

    try {
      const appUrl = process.env.APP_URL || "https://registerly.onrender.com";
      const returnUrl = `${appUrl}/app/billing?charge_confirmed=true&plan=${newPlan}`;

      const result = await createSubscription(admin, shop, newPlan, returnUrl);

      // For FREE plan (cancellation), redirect directly
      if (newPlan === "FREE") {
        return redirect("/app/billing");
      }

      // For paid plans, redirect to Shopify's confirmation page
      return redirect(result.confirmationUrl);
    } catch (e: any) {
      console.error("Billing error:", e);
      return json({ error: e.message || "Failed to process plan change" }, { status: 500 });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function BillingPage() {
  const { currentPlan, usage, plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const currentPlanConfig = plans.find((p) => p.type === currentPlan) || plans[0];
  const isUnlimited = usage.limit === -1;
  const usagePercent = isUnlimited ? 0 : Math.min((usage.current / usage.limit) * 100, 100);
  const isNearLimit = !isUnlimited && usagePercent >= 80;

  const handlePlanChange = (planType: string) => {
    const formData = new FormData();
    formData.set("intent", "upgrade");
    formData.set("plan", planType);
    submit(formData, { method: "post" });
  };

  const getPlanBadgeTone = (planType: string): "info" | "success" | "warning" | "critical" => {
    switch (planType) {
      case "FREE": return "info";
      case "STARTER": return "success";
      case "GROWTH": return "warning";
      case "PRO": return "critical";
      default: return "info";
    }
  };

  return (
    <Page title="Billing & Plans">
      <BlockStack gap="500">
        {(actionData as any)?.error && (
          <Banner tone="critical">
            <Text as="p" variant="bodyMd">
              {(actionData as any).error}
            </Text>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Current Plan
                    </Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p" variant="headingLg">
                        {currentPlanConfig.name}
                      </Text>
                      <Badge tone={getPlanBadgeTone(currentPlan)}>
                        Active
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                  <Text as="p" variant="headingLg">
                    ${currentPlanConfig.price}/mo
                  </Text>
                </InlineStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd">
                      Registrations this month
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {isUnlimited
                        ? `${usage.current} (unlimited)`
                        : `${usage.current} of ${usage.limit}`}
                    </Text>
                  </InlineStack>

                  {!isUnlimited && (
                    <ProgressBar
                      progress={usagePercent}
                      tone={isNearLimit ? "critical" : "primary"}
                      size="small"
                    />
                  )}

                  {isNearLimit && (
                    <Banner tone="warning">
                      <Text as="p" variant="bodyMd">
                        You are approaching your monthly registration limit. Consider upgrading your
                        plan to avoid disruptions.
                      </Text>
                    </Banner>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Text as="h2" variant="headingMd">
          Available Plans
        </Text>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 2, lg: 4 }} gap="400">
          {plans.map((plan) => {
            const isCurrent = plan.type === currentPlan;
            const planIndex = plans.findIndex((p) => p.type === plan.type);
            const currentIndex = plans.findIndex((p) => p.type === currentPlan);
            const isDowngrade = planIndex < currentIndex;

            return (
              <Card key={plan.type}>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingMd">
                      {plan.name}
                    </Text>
                    {isCurrent && (
                      <Badge tone="success">Current</Badge>
                    )}
                  </InlineStack>

                  <BlockStack gap="100">
                    <InlineStack blockAlign="baseline" gap="100">
                      <Text as="p" variant="heading2xl">
                        ${plan.price}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        /month
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {plan.registrationsPerMonth === -1
                        ? "Unlimited registrations"
                        : `${plan.registrationsPerMonth.toLocaleString()} registrations/month`}
                    </Text>
                  </BlockStack>

                  <Divider />

                  <List>
                    {plan.features.map((feature) => (
                      <List.Item key={feature}>{feature}</List.Item>
                    ))}
                  </List>

                  <Box paddingBlockStart="200">
                    <Button
                      variant={isCurrent ? undefined : isDowngrade ? "secondary" : "primary"}
                      disabled={isCurrent || isSubmitting}
                      onClick={() => handlePlanChange(plan.type)}
                      fullWidth
                      loading={isSubmitting}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : isDowngrade
                          ? "Downgrade"
                          : "Upgrade"}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
