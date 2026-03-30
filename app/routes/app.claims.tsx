import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
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
  Select,
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
  const status = formData.get("status") as any;
  const merchantNotes = formData.get("merchantNotes") as string;

  const claim = await updateClaimStatus(claimId, status, merchantNotes);

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
        status,
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
      <IndexTable.Cell>{claim.issueType.replace("_", " ")}</IndexTable.Cell>
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

  return (
    <Page title="Claims" subtitle={`${total} total claims`}>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "claim", plural: "claims" }}
              itemCount={claims.length}
              headings={[
                { title: "Claim ID" },
                { title: "Customer" },
                { title: "Product" },
                { title: "Issue Type" },
                { title: "Description" },
                { title: "Status" },
                { title: "Created" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={!!activeModal}
        onClose={() => setActiveModal(null)}
        title="Manage Claim"
        primaryAction={{ content: "Update", onAction: handleUpdateClaim }}
        secondaryActions={[{ content: "Cancel", onAction: () => setActiveModal(null) }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Status"
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
              label="Merchant Notes"
              value={notes}
              onChange={setNotes}
              multiline={4}
              autoComplete="off"
              helpText="Notes visible to the customer"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
