import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Select,
  Banner,
  Divider,
  Badge,
  Box,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { getEmailTemplates, upsertEmailTemplate } from "~/services/email.server";
import { hasFeature } from "~/services/billing.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const templates = await getEmailTemplates(shop.id);
  const appUrl = process.env.APP_URL || "https://registerly.onrender.com";
  const canEditTemplates = hasFeature(shop.plan, "customTemplates");
  const canEditBranding = hasFeature(shop.plan, "brandColor");
  return json({ shop: { ...shop, appUrl }, templates, canEditTemplates, canEditBranding });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  if (intent === "updateTemplate") {
    if (!hasFeature(shop.plan, "customTemplates")) {
      return json({ error: "Custom email templates require the Starter plan or higher. Upgrade to customize templates." }, { status: 403 });
    }
    const type = formData.get("type") as any;
    const subject = formData.get("subject") as string;
    const body = formData.get("body") as string;
    await upsertEmailTemplate(shop.id, type, subject, body);
    return json({ success: true });
  }

  if (intent === "updateBranding") {
    if (!hasFeature(shop.plan, "brandColor")) {
      return json({ error: "Custom brand colors require the Starter plan or higher." }, { status: 403 });
    }
    const brandColor = formData.get("brandColor") as string;
    // Validate hex color to prevent CSS injection
    if (!/^#[0-9a-fA-F]{3,8}$/.test(brandColor)) {
      return json({ error: "Invalid color format. Please use a hex color (e.g. #4F46E5)." }, { status: 400 });
    }
    await prisma.shop.update({
      where: { id: shop.id },
      data: { brandColor },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function SettingsPage() {
  const { shop, templates, canEditTemplates, canEditBranding } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [brandColor, setBrandColor] = useState(shop.brandColor);

  const handleSaveTemplate = useCallback(() => {
    if (!editingTemplate) return;
    const formData = new FormData();
    formData.set("intent", "updateTemplate");
    formData.set("type", editingTemplate.type);
    formData.set("subject", editingTemplate.subject);
    formData.set("body", editingTemplate.body);
    submit(formData, { method: "post" });
    setEditingTemplate(null);
  }, [editingTemplate, submit]);

  const handleSaveBranding = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "updateBranding");
    formData.set("brandColor", brandColor);
    submit(formData, { method: "post" });
  }, [brandColor, submit]);

  const templateLabels: Record<string, string> = {
    REGISTRATION_CONFIRM: "Registration Confirmation",
    WARRANTY_EXPIRY: "Warranty Expiry Warning",
    CLAIM_RECEIVED: "Claim Received",
    CLAIM_UPDATE: "Claim Status Update",
  };

  const registrationLink = `${shop.appUrl || "https://registerly.onrender.com"}/register/${shop.domain}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationLink);
  };

  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Brand Settings</Text>
              <InlineStack gap="400" blockAlign="end">
                <Box minWidth="0" maxWidth="100%">
                  <TextField
                    label="Brand Color"
                    value={brandColor}
                    onChange={setBrandColor}
                    autoComplete="off"
                    helpText="This color will be used on your public registration page"
                  />
                </Box>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    backgroundColor: brandColor || "#000000",
                    border: "1px solid var(--p-color-border)",
                    flexShrink: 0,
                    marginBottom: "20px",
                  }}
                />
              </InlineStack>
              {canEditBranding ? (
                <Box>
                  <Button onClick={handleSaveBranding}>Save Branding</Button>
                </Box>
              ) : (
                <Banner tone="warning">
                  <p>Custom brand colors are available on the Starter plan and above. <a href="/app/billing">Upgrade now</a></p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Email Templates</Text>
                <Text as="p" tone="subdued">These emails are sent automatically to your customers when they register a product, submit a claim, or when a claim status changes. No manual action needed.</Text>
              </BlockStack>

              <Banner tone="info">
                <p>
                  Placeholders like {"{{customerName}}"} and {"{{productName}}"} are replaced automatically with each customer's real data. Available: {"{{customerName}}"}, {"{{productName}}"}, {"{{serialNumber}}"}, {"{{warrantyExpiry}}"}, {"{{portalUrl}}"}, {"{{claimId}}"}, {"{{status}}"}, {"{{merchantNotes}}"}
                </p>
              </Banner>

              <Divider />

              {!canEditTemplates && (
                <Banner tone="warning">
                  <p>Custom email templates are available on the Starter plan and above. <a href="/app/billing">Upgrade now</a></p>
                </Banner>
              )}

              {templates.map((template: any) => (
                <BlockStack key={template.id} gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge>{templateLabels[template.type] || template.type}</Badge>
                  </InlineStack>
                  {editingTemplate?.type === template.type && canEditTemplates ? (
                    <BlockStack gap="300">
                      <TextField
                        label="Subject"
                        value={editingTemplate.subject}
                        onChange={(v) => setEditingTemplate({ ...editingTemplate, subject: v })}
                        autoComplete="off"
                      />
                      <TextField
                        label="Body (HTML)"
                        value={editingTemplate.body}
                        onChange={(v) => setEditingTemplate({ ...editingTemplate, body: v })}
                        multiline={8}
                        autoComplete="off"
                      />
                      <InlineStack gap="200">
                        <Button variant="primary" onClick={handleSaveTemplate}>Save</Button>
                        <Button onClick={() => setEditingTemplate(null)}>Cancel</Button>
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" tone="subdued" variant="bodySm">Subject: {template.subject}</Text>
                      {canEditTemplates && (
                        <Box>
                          <Button size="slim" onClick={() => setEditingTemplate(template)}>Edit Template</Button>
                        </Box>
                      )}
                    </BlockStack>
                  )}
                  <Divider />
                </BlockStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Registration Link</Text>
              <Text as="p" tone="subdued">Share this link on your website or send it to customers</Text>
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
                  <Text as="p" variant="bodySm" truncate>{registrationLink}</Text>
                  <Button size="slim" onClick={handleCopyLink}>Copy</Button>
                </InlineStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
