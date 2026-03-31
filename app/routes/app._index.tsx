import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Box,
  Badge,
  Banner,
  Button,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import { getRegistrationStats } from "~/services/registration.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: { domain: session.shop },
    });
    // Create default email templates for new shops
    const { createDefaultTemplates } = await import("~/services/email.server");
    await createDefaultTemplates(shop.id);
  }

  const stats = await getRegistrationStats(shop.id);

  // Recent registrations
  const recentRegistrations = await prisma.registration.findMany({
    where: { shopId: shop.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return json({ shop, stats, recentRegistrations });
};

export default function DashboardPage() {
  const { shop, stats, recentRegistrations } = useLoaderData<typeof loader>();
  const registrationLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register/${shop.domain}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationLink);
  };

  if (stats.total === 0) {
    return (
      <Page title="Dashboard">
        <BlockStack gap="500">
          {shop.plan === "FREE" && (
            <Banner tone="info" title="You're on the Free plan">
              <p>Upgrade to register more products and unlock advanced features.</p>
            </Banner>
          )}

          <Card>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text as="h2" variant="headingLg">Welcome to Registerly!</Text>
                <Text as="p" tone="subdued">
                  Get started in three simple steps to manage product warranties for your store.
                </Text>
              </BlockStack>

              <BlockStack gap="400">
                <InlineStack gap="300" blockAlign="start">
                  <Box background="bg-fill-info" padding="200" borderRadius="200" minWidth="32px">
                    <Text as="p" variant="headingSm" alignment="center">1</Text>
                  </Box>
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">Add products and enable warranties</Text>
                    <Text as="p" tone="subdued">Sync your Shopify products and set warranty periods for each one.</Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="start">
                  <Box background="bg-fill-info" padding="200" borderRadius="200" minWidth="32px">
                    <Text as="p" variant="headingSm" alignment="center">2</Text>
                  </Box>
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">Share your registration link with customers</Text>
                    <Text as="p" tone="subdued">Send the link via email, add it to your website, or print a QR code.</Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="start">
                  <Box background="bg-fill-info" padding="200" borderRadius="200" minWidth="32px">
                    <Text as="p" variant="headingSm" alignment="center">3</Text>
                  </Box>
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">Track registrations and manage claims</Text>
                    <Text as="p" tone="subdued">Review warranty registrations and handle customer claims from your dashboard.</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>

              <Box>
                <Button variant="primary" url="/app/products">Go to Products</Button>
              </Box>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        {shop.plan === "FREE" && (
          <Banner tone="info" title="You're on the Free plan">
            <p>Upgrade to register more products and unlock advanced features.</p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard title="Total Registrations" subtitle="All time" value={stats.total} />
          <StatCard title="Active Warranties" subtitle="Currently valid" value={stats.approved} tone="success" />
          <StatCard title="Open Claims" subtitle="Awaiting review" value={stats.openClaims} tone="warning" />
          <StatCard title="Expiring Soon" subtitle="Within 30 days" value={stats.expiringSoon} tone="attention" />
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Recent Registrations</Text>
                {recentRegistrations.length === 0 ? (
                  <Text as="p" tone="subdued">No registrations yet. Share your registration link or QR code to get started.</Text>
                ) : (
                  <BlockStack gap="200">
                    {recentRegistrations.map((reg: any) => (
                      <Box key={reg.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                        <InlineGrid columns="1fr auto" alignItems="center">
                          <BlockStack gap="100">
                            <Text as="p" fontWeight="semibold">{reg.customerName}</Text>
                            <Text as="p" tone="subdued">{reg.product.name} — {reg.customerEmail}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">
                              Registered {new Date(reg.createdAt).toLocaleDateString()}
                            </Text>
                          </BlockStack>
                          <Badge tone={reg.status === "APPROVED" ? "success" : reg.status === "PENDING" ? "attention" : "critical"}>
                            {reg.status}
                          </Badge>
                        </InlineGrid>
                      </Box>
                    ))}
                    <Box paddingBlockStart="200">
                      <Button variant="plain" url="/app/registrations">View all registrations</Button>
                    </Box>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <BlockStack gap="200">
                  <Text as="p" tone="subdued" variant="bodySm">Share this link with your customers</Text>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
                      <Text as="p" variant="bodySm" truncate>{registrationLink}</Text>
                      <Button size="slim" onClick={handleCopyLink}>Copy</Button>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function StatCard({ title, subtitle, value, tone }: { title: string; subtitle?: string; value: number; tone?: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="050">
          <Text as="p" tone="subdued">{title}</Text>
          {subtitle && <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text>}
        </BlockStack>
        <Text as="p" variant="headingXl" fontWeight="bold">
          {value.toLocaleString()}
        </Text>
      </BlockStack>
    </Card>
  );
}
