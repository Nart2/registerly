import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
import { PLANS, checkRegistrationLimit, reconcilePlanWithShopify, getManagedPricingUrl } from "~/services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Managed Pricing: Shopify owns the subscription. Sync our stored plan with
  // Shopify's real state on every visit (covers subscribe, cancel, reinstall).
  await reconcilePlanWithShopify(admin, session.shop);

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
    managedPricingUrl: getManagedPricingUrl(session.shop),
  });
};

export default function BillingPage() {
  const { currentPlan, usage, plans, managedPricingUrl } = useLoaderData<typeof loader>();

  const currentPlanConfig = plans.find((p) => p.type === currentPlan) || plans[0];
  const isUnlimited = usage.limit === -1;
  const usagePercent = isUnlimited ? 0 : Math.min((usage.current / usage.limit) * 100, 100);
  const isNearLimit = !isUnlimited && usagePercent >= 80;

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
        <Banner tone="info">
          <Text as="p" variant="bodyMd">
            Plans are managed securely by Shopify. Selecting a plan opens
            Shopify&rsquo;s checkout where you can approve or decline the charge.
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
                        You are approaching your monthly registration limit. Choose a higher
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
                      variant={isCurrent ? undefined : "primary"}
                      disabled={isCurrent}
                      url={isCurrent ? undefined : managedPricingUrl}
                      target="_top"
                      fullWidth
                    >
                      {isCurrent ? "Current Plan" : "Select Plan"}
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
