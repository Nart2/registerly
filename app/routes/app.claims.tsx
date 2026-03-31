import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  Modal,
  TextField,
  BlockStack,
  Box,
  Select,
  Divider,
  Pagination,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { getClaims, updateClaimStatus } from "~/services/claim.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as any;
  const page = parseInt(url.searchParams.get("page") || "1");

  const result = await getClaims(shop.id, { status, page });
  return json(result);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const claimId = formData.get("claimId") as string;
  const rawStatus = formData.get("status") as string;
  const merchantNotes = formData.get("merchantNotes") as string;

  // Validate status
  const validStatuses = ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "RESOLVED"];
  if (!validStatuses.includes(rawStatus)) {
    return json({ error: "Invalid status" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { domain: session.shop } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  let claim;
  try {
    claim = await updateClaimStatus(claimId, shop.id, rawStatus as any, merchantNotes);
  } catch (e: any) {
    return json({ error: e.message || "Claim not found" }, { status: 404 });
  }

  // Send status update email
  try {
    const { sendEmail } = await import("~/services/email.server");
    await sendEmail({
      to: claim.registration.customerEmail,
      shopId: claim.registration.shopId,
      templateType: "CLAIM_UPDATE",
      variables: {
        customerName: claim.registration.customerName,
        productName: claim.registration.product.name,
        claimId: claim.id.slice(0, 8),
        status: rawStatus,
        merchantNotes: merchantNotes || "",
        portalUrl: `${process.env.APP_URL}/portal/${claim.registration.id}`,
      },
    });
  } catch (e) {
    console.error("Failed to send claim update email:", e);
  }

  return json({ success: true });
};

function claimStatusTone(status: string) {
  switch (status) {
    case "OPEN": return "attention";
    case "IN_REVIEW": return "info";
    case "APPROVED": return "success";
    case "REJECTED": return "critical";
    case "RESOLVED": return "success";
    default: return undefined;
  }
}

export default function ClaimsPage() {
  const { claims, total, page, totalPages } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("IN_REVIEW");

  const handleUpdateClaim = useCallback(() => {
    if (!activeModal) return;
    const formData = new FormData();
    formData.set("claimId", activeModal);
    formData.set("status", newStatus);
    formData.set("merchantNotes", notes);
    submit(formData, { method: "post" });
    setActiveModal(null);
    setNotes("");
  }, [activeModal, newStatus, notes, submit]);

  const rowMarkup = claims.map((claim: any, index: number) => (
    <IndexTable.Row id={claim.id} key={claim.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">#{claim.id.slice(0, 8)}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{claim.registration.customerName}</IndexTable.Cell>
      <IndexTable.Cell>{claim.registration.product.name}</IndexTable.Cell>
      <IndexTable.Cell>{claim.issueType.replaceAll("_", " ")}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" truncate>{claim.issueDescription}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={claimStatusTone(claim.status)}>{claim.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{new Date(claim.createdAt).toLocaleDateString()}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button size="slim" onClick={() => { setActiveModal(claim.id); setNewStatus(claim.status); setNotes(claim.merchantNotes || ""); }}>
          Manage
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const activeClaim = activeModal ? claims.find((c: any) => c.id === activeModal) : null;

  const claimsContent = claims.length === 0 && total === 0 ? (
    <Card>
      <BlockStack gap="300" align="center">
        <Text as="h2" variant="headingMd">No warranty claims yet</Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          When customers submit warranty claims, they'll appear here for you to review and manage.
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          No claims is a good sign -- your products are holding up well!
        </Text>
      </BlockStack>
    </Card>
  ) : (
    <Card padding="0">
      <Box padding="400" paddingBlockEnd="0">
        <Text as="h2" variant="headingMd">Claims ({total} total)</Text>
      </Box>
      <IndexTable
        resourceName={{ singular: "claim", plural: "claims" }}
        itemCount={claims.length}
        headings={[
          { title: "Claim ID" },
          { title: "Customer" },
          { title: "Product" },
          { title: "Issue type" },
          { title: "Description" },
          { title: "Status" },
          { title: "Date filed" },
          { title: "Actions" },
        ]}
        selectable={false}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );

  const [, setSearchParams] = useSearchParams();

  const handlePageChange = useCallback(
    (newPage: number) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("page", String(newPage));
        return params;
      });
    },
    [setSearchParams],
  );

  return (
    <Page title="Claims">
      <Layout>
        <Layout.Section>
          {claimsContent}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => handlePageChange(page - 1)}
                onNext={() => handlePageChange(page + 1)}
              />
            </div>
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={!!activeModal}
        onClose={() => setActiveModal(null)}
        title={activeClaim ? `Manage Claim #${activeClaim.id.slice(0, 8)}` : "Manage Claim"}
        primaryAction={{ content: "Update claim", onAction: handleUpdateClaim }}
        secondaryActions={[{ content: "Cancel", onAction: () => setActiveModal(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {activeClaim && (
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Customer:</Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">{activeClaim.registration.customerName}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Product:</Text>
                  <Text as="span" variant="bodySm" fontWeight="semibold">{activeClaim.registration.product.name}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Issue:</Text>
                  <Text as="span" variant="bodySm">{activeClaim.issueType.replaceAll("_", " ")}</Text>
                </InlineStack>
                <Box paddingBlockStart="100" paddingBlockEnd="100">
                  <Divider />
                </Box>
              </BlockStack>
            )}
            <Select
              label="Update status"
              options={[
                { label: "Open", value: "OPEN" },
                { label: "In Review", value: "IN_REVIEW" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
                { label: "Resolved", value: "RESOLVED" },
              ]}
              value={newStatus}
              onChange={setNewStatus}
            />
            <TextField
              label="Notes for customer (will be included in the email)"
              value={notes}
              onChange={setNotes}
              multiline={4}
              autoComplete="off"
              helpText="The customer will see these notes when they check their claim status"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
