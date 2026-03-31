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
  DataTable,
  Badge,
  InlineStack,
  Divider,
  Box,
  Button,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
  });

  if (!shop) {
    return json({
      plan: "FREE",
      gated: true,
      totalRegistrations: 0,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      registrationsByMonth: [],
      topProducts: [],
      claimsByStatus: { OPEN: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0, RESOLVED: 0 },
      avgWarrantyMonths: 0,
      channelBreakdown: { SHOPIFY: 0, AMAZON: 0, RETAIL: 0, OTHER: 0 },
      growthPercentage: 0,
      thisMonthCount: 0,
      lastMonthCount: 0,
    });
  }

  const { hasFeature } = await import("~/services/billing.server");
  if (!hasFeature(shop.plan, "analytics")) {
    return json({
      gated: true,
      plan: shop.plan,
      totalRegistrations: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0,
      registrationsByMonth: [], topProducts: [],
      claimsByStatus: { OPEN: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0, RESOLVED: 0 },
      avgWarrantyMonths: 0, channelBreakdown: { SHOPIFY: 0, AMAZON: 0, RETAIL: 0, OTHER: 0 },
      growthPercentage: 0, thisMonthCount: 0, lastMonthCount: 0,
    });
  }

  const shopId = shop.id;

  // Total registration counts by status
  const [totalRegistrations, approvedCount, pendingCount, rejectedCount] =
    await Promise.all([
      prisma.registration.count({ where: { shopId } }),
      prisma.registration.count({ where: { shopId, status: "APPROVED" } }),
      prisma.registration.count({ where: { shopId, status: "PENDING" } }),
      prisma.registration.count({ where: { shopId, status: "REJECTED" } }),
    ]);

  // Registrations per month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const recentRegistrations = await prisma.registration.findMany({
    where: {
      shopId,
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthCounts: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts[key] = 0;
  }
  for (const reg of recentRegistrations) {
    const d = new Date(reg.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthCounts) {
      monthCounts[key]++;
    }
  }
  const registrationsByMonth = Object.entries(monthCounts).map(
    ([month, count]) => ({ month, count }),
  );

  // Top 5 products by registration count
  const topProductsRaw = await prisma.registration.groupBy({
    by: ["productId"],
    where: { shopId },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const productIds = topProductsRaw.map((p) => p.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, warrantyMonths: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const now = new Date();
  const activeWarrantyCounts = await prisma.registration.groupBy({
    by: ["productId"],
    where: {
      shopId,
      productId: { in: productIds },
      status: "APPROVED",
      warrantyExpiresAt: { gt: now },
    },
    _count: { id: true },
  });
  const activeMap = new Map(
    activeWarrantyCounts.map((a) => [a.productId, a._count.id]),
  );

  const topProducts = topProductsRaw.map((p) => {
    const product = productMap.get(p.productId);
    return {
      name: product?.name ?? "Unknown Product",
      registrations: p._count.id,
      activeWarranties: activeMap.get(p.productId) ?? 0,
    };
  });

  // Claims by status breakdown
  const claimsGrouped = await prisma.claim.groupBy({
    by: ["status"],
    where: {
      registration: { shopId },
    },
    _count: { id: true },
  });
  const claimsByStatus: Record<string, number> = {
    OPEN: 0,
    IN_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    RESOLVED: 0,
  };
  for (const c of claimsGrouped) {
    claimsByStatus[c.status] = c._count.id;
  }

  // Average warranty duration
  const avgWarranty = await prisma.product.aggregate({
    where: { shopId, isActive: true },
    _avg: { warrantyMonths: true },
  });
  const avgWarrantyMonths = Math.round(avgWarranty._avg.warrantyMonths ?? 0);

  // Registration channels breakdown
  const channelsGrouped = await prisma.registration.groupBy({
    by: ["purchaseChannel"],
    where: { shopId },
    _count: { id: true },
  });
  const channelBreakdown: Record<string, number> = {
    SHOPIFY: 0,
    AMAZON: 0,
    RETAIL: 0,
    OTHER: 0,
  };
  for (const ch of channelsGrouped) {
    channelBreakdown[ch.purchaseChannel] = ch._count.id;
  }

  // Registration growth (this month vs last month)
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  const [thisMonthCount, lastMonthCount] = await Promise.all([
    prisma.registration.count({
      where: { shopId, createdAt: { gte: thisMonthStart } },
    }),
    prisma.registration.count({
      where: {
        shopId,
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
      },
    }),
  ]);

  const growthPercentage =
    lastMonthCount > 0
      ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
      : thisMonthCount > 0
        ? 100
        : 0;

  return json({
    gated: false,
    plan: shop.plan,
    totalRegistrations,
    approvedCount,
    pendingCount,
    rejectedCount,
    registrationsByMonth,
    topProducts,
    claimsByStatus,
    avgWarrantyMonths,
    channelBreakdown,
    growthPercentage,
    thisMonthCount,
    lastMonthCount,
  });
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const {
    totalRegistrations,
    approvedCount,
    pendingCount,
    rejectedCount,
    registrationsByMonth,
    topProducts,
    claimsByStatus,
    avgWarrantyMonths,
    channelBreakdown,
    growthPercentage,
    thisMonthCount,
    lastMonthCount,
  } = data as any;

  if ((data as any).gated) {
    return (
      <Page title="Analytics">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300" inlineAlign="center">
                <Text as="h2" variant="headingMd">Analytics Dashboard</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  The Analytics Dashboard is available on the Growth plan and above.
                  Upgrade to see registration trends, channel breakdown, top products, and more.
                </Text>
                <Box paddingBlockStart="200">
                  <Button url="/app/billing" variant="primary">View Plans</Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const approvedRate =
    totalRegistrations > 0
      ? Math.round((approvedCount / totalRegistrations) * 100)
      : 0;

  const totalClaims = Object.values(claimsByStatus).reduce(
    (sum, v) => sum + v,
    0,
  );
  const claimsRate =
    totalRegistrations > 0
      ? ((totalClaims / totalRegistrations) * 100).toFixed(1)
      : "0.0";

  const monthRows = (registrationsByMonth as Array<{ month: string; count: number }>).map(
    ({ month, count }) => {
      const [year, m] = month.split("-");
      const date = new Date(Number(year), Number(m) - 1);
      const label = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      return [label, count];
    },
  );

  const productRows = (topProducts as Array<{ name: string; registrations: number; activeWarranties: number }>).map(
    (p) => [p.name, p.registrations, p.activeWarranties],
  );

  const claimStatusTone = (status: string) => {
    switch (status) {
      case "OPEN":
        return "attention";
      case "IN_REVIEW":
        return "info";
      case "APPROVED":
        return "success";
      case "REJECTED":
        return "critical";
      case "RESOLVED":
        return undefined;
      default:
        return undefined;
    }
  };

  const channelRows = Object.entries(channelBreakdown).map(
    ([channel, count]) => {
      const pct =
        totalRegistrations > 0
          ? ((count / totalRegistrations) * 100).toFixed(1)
          : "0.0";
      return [channel, count, `${pct}%`];
    },
  );

  return (
    <Page title="Analytics">
      <BlockStack gap="500">
        {/* Summary Stat Cards */}
        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Total Registrations
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {totalRegistrations.toLocaleString()}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Approved Rate
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {approvedRate}%
              </Text>
              <InlineStack gap="200">
                <Badge tone="success">{`${approvedCount} approved`}</Badge>
                <Badge tone="attention">{`${pendingCount} pending`}</Badge>
              </InlineStack>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Claims Rate
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {claimsRate}%
              </Text>
              <Text as="p" tone="subdued">
                {`${totalClaims} total claims`}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">
                Monthly Growth
              </Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {growthPercentage >= 0 ? "+" : ""}
                {growthPercentage}%
              </Text>
              <Text as="p" tone="subdued">
                {`${thisMonthCount} this month vs ${lastMonthCount} last month`}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Divider />

        <Layout>
          {/* Registrations by Month */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Registrations by Month
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric"]}
                  headings={["Month", "Registrations"]}
                  rows={monthRows}
                  totals={[
                    "",
                    monthRows.reduce(
                      (sum: number, r: (string | number)[]) =>
                        sum + (r[1] as number),
                      0,
                    ),
                  ]}
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Avg Warranty Duration side panel */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Warranty Overview
                </Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued">
                      Average Warranty Duration
                    </Text>
                    <Text as="p" variant="headingXl" fontWeight="bold">
                      {avgWarrantyMonths} months
                    </Text>
                  </BlockStack>
                </Box>
                <Divider />
                <BlockStack gap="200">
                  <Text as="p" tone="subdued">
                    Status Breakdown
                  </Text>
                  <InlineStack gap="200" wrap>
                    <Badge tone="success">{`${approvedCount} approved`}</Badge>
                    <Badge tone="attention">{`${pendingCount} pending`}</Badge>
                    <Badge tone="critical">{`${rejectedCount} rejected`}</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Top Products */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Top Products
            </Text>
            {productRows.length === 0 ? (
              <Text as="p" tone="subdued">
                No product registrations yet.
              </Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "numeric", "numeric"]}
                headings={["Product Name", "Registrations", "Active Warranties"]}
                rows={productRows}
              />
            )}
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {/* Claims Overview */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Claims Overview
              </Text>
              {totalClaims === 0 ? (
                <Text as="p" tone="subdued">
                  No claims filed yet.
                </Text>
              ) : (
                <BlockStack gap="200">
                  {Object.entries(claimsByStatus).map(([status, count]) => (
                    <InlineStack key={status} align="space-between">
                      <Badge tone={claimStatusTone(status)}>{status.replace("_", " ")}</Badge>
                      <Text as="p" fontWeight="semibold">
                        {count}
                      </Text>
                    </InlineStack>
                  ))}
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="p" fontWeight="bold">
                      Total
                    </Text>
                    <Text as="p" fontWeight="bold">
                      {totalClaims}
                    </Text>
                  </InlineStack>
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          {/* Registration Channels */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Registration Channels
              </Text>
              <DataTable
                columnContentTypes={["text", "numeric", "text"]}
                headings={["Channel", "Count", "Share"]}
                rows={channelRows}
                totals={["", totalRegistrations, "100%"]}
              />
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
