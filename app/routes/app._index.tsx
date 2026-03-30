import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Badge,
  Banner,
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

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        {shop.plan === "FREE" && (
          <Banner tone="info" title="You're on the Free plan">
            <p>Upgrade to register more products and unlock advanced features.</p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard title="Total Registrations" value={stats.total} />
          <StatCard title="Active Warranties" value={stats.approved} tone="success" />
          <StatCard title="Open Claims" value={stats.openClaims} tone="warning" />
          <StatCard title="Expiring Soon" value={stats.expiringSoon} tone="attention" />
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
                          </BlockStack>
                          <Badge tone={reg.status === "APPROVED" ? "success" : reg.status === "PENDING" ? "attention" : "critical"}>
                            {reg.status}
                          </Badge>
                        </InlineGrid>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick Actions</Text>
                <Text as="p" tone="subdued">
                  Registration link: {process.env.APP_URL || "https://your-app.railway.app"}/register/{shop.domain}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function StatCard({ title, value, tone }: { title: string; value: number; tone?: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" tone="subdued">{title}</Text>
        <Text as="p" variant="headingXl" fontWeight="bold">
          {value.toLocaleString()}
        </Text>
      </BlockStack>
    </Card>
  );
}
