import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  TextField,
  InlineStack,
  BlockStack,
  Button,
  Modal,
  FormLayout,
  Select,
  Thumbnail,
  Banner,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { getProducts, updateProductWarranty, syncProduct } from "~/services/product.server";
import { generateQRCode, getRegistrationUrl } from "~/services/qrcode.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  // Sync products from Shopify
  try {
    const response = await admin.rest.resources.Product.all({ session, limit: 250 });
    for (const p of response.data || []) {
      await syncProduct(shop.id, String(p.id), p.title || "Untitled Product");
    }
  } catch (e) {
    console.error("Failed to sync products:", e);
  }

  const products = await getProducts(shop.id);

  return json({ products, shopDomain: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "updateWarranty") {
    const productId = formData.get("productId") as string;
    const warrantyMonths = parseInt(formData.get("warrantyMonths") as string) || 12;
    const isActive = formData.get("isActive") === "true";
    const requireSerialNumber = formData.get("requireSerialNumber") === "true";

    const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
    if (!shop) throw new Response("Shop not found", { status: 404 });

    await updateProductWarranty(productId, shop.id, { warrantyMonths, isActive, requireSerialNumber });
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
  const fetcher = useFetcher();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qrModal, setQrModal] = useState<{ open: boolean; qrCode?: string; url?: string }>({ open: false });

  const handleWarrantyToggle = useCallback(
    (product: any) => {
      fetcher.submit(
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
    [fetcher],
  );

  const handleGenerateQR = useCallback(
    async (productId: string) => {
      fetcher.submit(
        { intent: "generateQR", shopDomain, productId },
        { method: "post" },
      );
    },
    [fetcher, shopDomain],
  );

  return (
    <Page title="Products" subtitle="Manage warranty settings for your products">
      <Layout>
        <Layout.Section>
          {products.length === 0 ? (
            <Card>
              <EmptyState
                heading="No products synced yet"
                image=""
              >
                <p>Products are automatically synced from your Shopify store. If you have just installed the app, reload the page to trigger a sync.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={products}
                renderItem={(product: any) => (
                  <ResourceItem
                    id={product.id}
                    onClick={() => setSelectedProduct(product)}
                  >
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
                        <Button size="slim" onClick={() => handleWarrantyToggle(product)}>
                          {product.isActive ? "Disable" : "Enable"} Warranty
                        </Button>
                        {product.isActive && (
                          <Button size="slim" variant="plain" onClick={() => handleGenerateQR(product.id)}>
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
    </Page>
  );
}
