import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Filters,
  ChoiceList,
  Button,
  InlineStack,
  BlockStack,
  Box,
  Pagination,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { getRegistrations, updateRegistrationStatus } from "~/services/registration.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as any;
  const productId = url.searchParams.get("productId") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1");

  const result = await getRegistrations(shop.id, { status, productId, search, page });
  const products = await prisma.product.findMany({
    where: { shopId: shop.id, isActive: true },
    select: { id: true, name: true },
  });

  return json({ ...result, products });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const registrationId = formData.get("registrationId") as string;
  const status = formData.get("status") as "APPROVED" | "REJECTED";

  const registration = await updateRegistrationStatus(registrationId, status);

  // Send confirmation email if approved
  if (status === "APPROVED") {
    try {
      const { sendEmail } = await import("~/services/email.server");
      const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
      if (shop) {
        await sendEmail({
          to: registration.customerEmail,
          shopId: shop.id,
          templateType: "REGISTRATION_CONFIRM",
          variables: {
            customerName: registration.customerName,
            productName: registration.product.name,
            serialNumber: registration.serialNumber || "N/A",
            warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString() || "N/A",
            portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
          },
        });
      }
    } catch (e) {
      console.error("Failed to send confirmation email:", e);
    }
  }

  return json({ success: true });
};

export default function RegistrationsPage() {
  const { registrations, total, page, totalPages, products } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryValue, setQueryValue] = useState(searchParams.get("search") || "");

  const handleStatusChange = useCallback(
    (registrationId: string, status: string) => {
      const formData = new FormData();
      formData.set("registrationId", registrationId);
      formData.set("status", status);
      submit(formData, { method: "post" });
    },
    [submit],
  );

  const handleFiltersChange = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.set("page", "1");
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const resourceName = { singular: "registration", plural: "registrations" };

  const rowMarkup = registrations.map((reg: any, index: number) => (
    <IndexTable.Row id={reg.id} key={reg.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">{reg.customerName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{reg.customerEmail}</IndexTable.Cell>
      <IndexTable.Cell>{reg.product.name}</IndexTable.Cell>
      <IndexTable.Cell>{reg.serialNumber || "—"}</IndexTable.Cell>
      <IndexTable.Cell>{new Date(reg.purchaseDate).toLocaleDateString()}</IndexTable.Cell>
      <IndexTable.Cell>{reg.purchaseChannel}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={reg.status === "APPROVED" ? "success" : reg.status === "PENDING" ? "attention" : "critical"}>
          {reg.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {reg.status === "PENDING" && (
          <InlineStack gap="200">
            <Button size="slim" tone="success" onClick={() => handleStatusChange(reg.id, "APPROVED")}>
              Approve
            </Button>
            <Button size="slim" tone="critical" onClick={() => handleStatusChange(reg.id, "REJECTED")}>
              Reject
            </Button>
          </InlineStack>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  if (registrations.length === 0 && total === 0) {
    return (
      <Page title="Registrations">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300" align="center">
                <Text as="h2" variant="headingMd">No registrations yet</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Share your registration link with customers to get started. You can find the link on your Dashboard.
                </Text>
                <Box paddingBlockStart="200">
                  <Button url="/app" variant="primary">Go to Dashboard</Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Registrations">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400" paddingBlockEnd="0">
              <Text as="h2" variant="headingMd">Registrations ({total} total)</Text>
            </Box>
            <IndexTable
              resourceName={resourceName}
              itemCount={registrations.length}
              headings={[
                { title: "Customer name" },
                { title: "Email address" },
                { title: "Product" },
                { title: "Serial number" },
                { title: "Purchase date" },
                { title: "Channel" },
                { title: "Status" },
                { title: "Warranty expires" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => handleFiltersChange("page", String(page - 1))}
                onNext={() => handleFiltersChange("page", String(page + 1))}
              />
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
