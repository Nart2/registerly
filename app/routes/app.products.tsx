import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  InlineStack,
  BlockStack,
  Button,
  Modal,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "~/shopify.server";
import { getProducts, updateProductWarranty, syncProduct } from "~/services/product.server";
import { generateQRCode, getRegistrationUrl } from "~/services/qrcode.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const products = await getProducts(shop.id);

  return json({ products, shopDomain: session.shop, shopId: shop.id });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  if (intent === "sync") {
    try {
      const response = await admin.rest.resources.Product.all({ session, limit: 250 });
      let synced = 0;
      for (const p of response.data || []) {
        await syncProduct(shop.id, String(p.id), p.title || "Untitled Product");
        synced++;
      }
      return json({ success: true, synced });
    } catch (e) {
      console.error("Failed to sync products:", e);
      return json({ error: "Failed to sync products from Shopify" }, { status: 500 });
    }
  }

  if (intent === "updateWarranty") {
    const productId = formData.get("productId") as string;
    const warrantyMonths = parseInt(formData.get("warrantyMonths") as string) || 12;
    const isActive = formData.get("isActive") === "true";
    const requireSerialNumber = formData.get("requireSerialNumber") === "true";

    try {
      await updateProductWarranty(productId, shop.id, { warrantyMonths, isActive, requireSerialNumber });
    } catch (e: any) {
      return json({ error: e.message || "Product not found" }, { status: 404 });
    }
    return json({ success: true });
  }

  if (intent === "generateQR") {
    const shopDomain = formData.get("shopDomain") as string;
    const productId = formData.get("productId") as string;
    const url = getRegistrationUrl(shopDomain, productId);
    const qrCode = await generateQRCode(url);
    return json({ qrCode, url });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function ProductsPage() {
  const { products, shopDomain } = useLoaderData<typeof loader>();
  const warrantyFetcher = useFetcher();
  const qrFetcher = useFetcher<{ qrCode?: string; url?: string }>();
  const syncFetcher = useFetcher();
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const isSyncing = syncFetcher.state !== "idle";

  const handleWarrantyToggle = useCallback(
    (product: any, e: React.MouseEvent) => {
      e.stopPropagation();
      warrantyFetcher.submit(
        {
          intent: "updateWarranty",
          productId: product.id,
          warrantyMonths: String(product.warrantyMonths),
          isActive: String(!product.isActive),
          requireSerialNumber: String(product.requireSerialNumber),
        },
        { method: "post" },
      );
    },
    [warrantyFetcher],
  );

  const handleGenerateQR = useCallback(
    (productId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      qrFetcher.submit(
        { intent: "generateQR", shopDomain, productId },
        { method: "post" },
      );
    },
    [qrFetcher, shopDomain],
  );

  const handleSync = useCallback(() => {
    syncFetcher.submit({ intent: "sync" }, { method: "post" });
  }, [syncFetcher]);

  // Open QR modal when data arrives
  useEffect(() => {
    if (qrFetcher.data?.qrCode) {
      setQrModalOpen(true);
    }
  }, [qrFetcher.data]);

  return (
    <Page
      title="Products"
      subtitle="Manage warranty settings for your products"
      primaryAction={{ content: isSyncing ? "Syncing..." : "Sync from Shopify", onAction: handleSync, loading: isSyncing }}
    >
      <Layout>
        <Layout.Section>
          {products.length === 0 ? (
            <Card>
              <EmptyState
                heading="No products synced yet"
                image=""
              >
                <p>Click "Sync from Shopify" above to import your products.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={products}
                renderItem={(product: any) => (
                  <ResourceItem id={product.id} onClick={() => {}}>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="semibold">{product.name}</Text>
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={product.isActive ? "success" : "enabled"}>
                            {product.isActive ? "Warranty Active" : "No Warranty"}
                          </Badge>
                          {product.isActive && (
                            <Badge tone="info">{product.warrantyMonths} months</Badge>
                          )}
                          <Text as="span" tone="subdued" variant="bodySm">
                            {product._count.registrations} {product._count.registrations === 1 ? "registration" : "registrations"}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                      <InlineStack gap="200">
                        <Button size="slim" onClick={(e: any) => handleWarrantyToggle(product, e)}>
                          {product.isActive ? "Disable" : "Enable"} Warranty
                        </Button>
                        {product.isActive && (
                          <Button size="slim" variant="plain" onClick={(e: any) => handleGenerateQR(product.id, e)}>
                            QR Code
                          </Button>
                        )}
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>

      {/* QR Code Modal */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Registration QR Code"
        secondaryActions={[{ content: "Close", onAction: () => setQrModalOpen(false) }]}
      >
        <Modal.Section>
          {qrFetcher.data?.qrCode && (
            <BlockStack gap="400" inlineAlign="center">
              <img
                src={qrFetcher.data.qrCode}
                alt="Registration QR Code"
                style={{ width: 256, height: 256 }}
              />
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Customers can scan this QR code to register their product.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center" breakWord>
                {qrFetcher.data.url}
              </Text>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
