import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Select,
  TextField,
  Button,
  Banner,
  IndexTable,
  Text,
  Badge,
  InlineStack,
} from "@shopify/polaris";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "~/shopify.server";
import prisma from "~/db.server";
import {
  getProducts,
  importSerialNumbers,
  getSerialNumbers,
} from "~/services/product.server";
import { hasFeature } from "~/services/billing.server";

interface SerialNumber {
  id: string;
  serialNumber: string;
  createdAt: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
  imported?: number;
  duplicatesSkipped?: number;
  deletedId?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  // Feature gate: serial numbers require Growth plan
  const canUseSerials = hasFeature(shop.plan, "serialNumbers");

  const products = await getProducts(shop.id);

  const serialCounts: Record<string, number> = {};
  for (const product of products) {
    const count = await prisma.serialNumber.count({
      where: { productId: product.id },
    });
    serialCounts[product.id] = count;
  }

  const url = new URL(request.url);
  const selectedProductId = url.searchParams.get("productId") || "";

  let serials: SerialNumber[] = [];
  let totalSerials = 0;
  if (selectedProductId) {
    const result = await getSerialNumbers(selectedProductId, shop.id, 1, 50);
    serials = result.serials.map((s) => ({
      id: s.id,
      serialNumber: s.serialNumber,
      createdAt: s.createdAt.toISOString(),
    }));
    totalSerials = result.total;
  }

  return json({
    canUseSerials,
    products,
    serialCounts,
    selectedProductId,
    serials,
    totalSerials,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  // Feature gate
  if (!hasFeature(shop.plan, "serialNumbers")) {
    return json<ActionData>({ error: "Serial number management requires the Growth plan or higher." });
  }

  if (intent === "import") {
    const productId = formData.get("productId") as string;
    const csvText = formData.get("csvText") as string;

    if (!productId) {
      return json<ActionData>({ error: "Please select a product." });
    }
    if (!csvText || !csvText.trim()) {
      return json<ActionData>({ error: "Please paste serial numbers." });
    }

    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return json<ActionData>({ error: "No valid serial numbers found." });
    }

    const result = await importSerialNumbers(shop.id, productId, lines);

    const imported = result.count;
    const duplicatesSkipped = lines.length - imported;

    return json<ActionData>({
      success: true,
      imported,
      duplicatesSkipped,
    });
  }

  if (intent === "delete") {
    const serialId = formData.get("serialId") as string;
    if (!serialId) {
      return json<ActionData>({ error: "Serial number ID is required." });
    }

    // Verify serial belongs to this shop
    const serial = await prisma.serialNumber.findFirst({
      where: { id: serialId, shopId: shop.id },
    });
    if (!serial) {
      return json<ActionData>({ error: "Serial number not found." });
    }

    await prisma.serialNumber.delete({ where: { id: serialId } });

    return json<ActionData>({ success: true, deletedId: serialId });
  }

  return json<ActionData>({ error: "Unknown intent." });
};

export default function SerialImportPage() {
  const data = useLoaderData<typeof loader>();
  const {
    canUseSerials,
    products,
    serialCounts,
    selectedProductId: initialProductId,
    serials,
    totalSerials,
  } = data as any;
  const actionData = useActionData<ActionData>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // All hooks must be called before any conditional returns (Rules of Hooks)
  const [selectedProductId, setSelectedProductId] = useState(initialProductId || "");
  const [csvText, setCsvText] = useState("");

  const productOptions = useMemo(
    () => [
      { label: "Select a product", value: "" },
      ...products.map((p: any) => ({
        label: `${p.name} (${serialCounts[p.id] || 0} serials)`,
        value: p.id,
      })),
    ],
    [products, serialCounts],
  );

  const handleProductChange = useCallback(
    (value: string) => {
      setSelectedProductId(value);
      if (value) {
        submit({ productId: value }, { method: "get" });
      }
    },
    [submit],
  );

  const handleImport = useCallback(() => {
    if (!selectedProductId || !csvText.trim()) return;
    submit(
      { intent: "import", productId: selectedProductId, csvText },
      { method: "post" },
    );
    setCsvText("");
  }, [submit, selectedProductId, csvText]);

  const handleDelete = useCallback(
    (serialId: string) => {
      submit({ intent: "delete", serialId }, { method: "post" });
    },
    [submit],
  );

  if (!canUseSerials) {
    return (
      <Page
        title="Serial Number Import"
        backAction={{ content: "Products", url: "/app/products" }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300" align="center">
                <Text as="h2" variant="headingMd">Serial Number Management</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Serial number import and validation is available on the Growth plan and above.
                  Upgrade to validate serial numbers during product registration.
                </Text>
                <InlineStack align="end">
                  <Button url="/app/billing" variant="primary">View Plans</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const resourceName = { singular: "serial number", plural: "serial numbers" };

  const rowMarkup = serials.map((serial: SerialNumber, index: number) => (
    <IndexTable.Row id={serial.id} key={serial.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {serial.serialNumber}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {new Date(serial.createdAt).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant="plain"
          tone="critical"
          onClick={() => handleDelete(serial.id)}
          disabled={isSubmitting}
        >
          Delete
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Serial Number Import"
      subtitle="Import and manage serial numbers for your products"
      backAction={{ content: "Products", url: "/app/products" }}
    >
      <Layout>
        {actionData?.success && actionData.imported !== undefined && (
          <Layout.Section>
            <Banner
              title="Import complete"
              tone="success"
              onDismiss={() => {}}
            >
              <p>
                {actionData.imported} serial number{actionData.imported !== 1 ? "s" : ""} imported.
                {actionData.duplicatesSkipped
                  ? ` ${actionData.duplicatesSkipped} duplicate${actionData.duplicatesSkipped !== 1 ? "s" : ""} skipped.`
                  : ""}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.success && actionData.deletedId && (
          <Layout.Section>
            <Banner title="Serial number deleted" tone="success" onDismiss={() => {}}>
              <p>The serial number has been removed.</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Error" tone="critical" onDismiss={() => {}}>
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Import Serial Numbers
              </Text>
              <Select
                label="Product"
                options={productOptions}
                value={selectedProductId}
                onChange={handleProductChange}
              />
              <TextField
                label="Serial Numbers (one per line)"
                value={csvText}
                onChange={setCsvText}
                multiline={8}
                autoComplete="off"
                placeholder={"SN-001\nSN-002\nSN-003"}
                helpText="Paste one serial number per line. Duplicates will be skipped automatically."
              />
              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!selectedProductId || !csvText.trim() || isSubmitting}
                  loading={isSubmitting && navigation.formData?.get("intent") === "import"}
                >
                  Import Serial Numbers
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {selectedProductId && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Existing Serial Numbers
                  </Text>
                  <Badge>{`${totalSerials} total`}</Badge>
                </InlineStack>
                {serials.length > 0 ? (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={serials.length}
                    headings={[
                      { title: "Serial Number" },
                      { title: "Date Added" },
                      { title: "Actions" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                ) : (
                  <Text as="p" tone="subdued">
                    No serial numbers found for this product.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
