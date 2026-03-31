import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
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
import { PLANS, checkRegistrationLimit } from "~/services/billing.server";
import type { PlanType } from "@prisma/client";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const usage = await checkRegistrationLimit(shop.id);

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
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  if (intent === "upgrade") {
    // Plan changes are disabled until Shopify billing API integration is complete.
    // Direct DB updates would allow free plan bypassing.
    return json({ error: "Plan changes are not yet available. Shopify billing integration coming soon." }, { status: 400 });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function BillingPage() {
  const { currentPlan, usage, plans } = useLoaderData<typeof loader>();
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
        <Banner tone="warning">
          <Text as="p" variant="bodyMd">
            Shopify billing integration coming soon. Plan changes are currently manual.
          </Text>
        </Banner>

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
