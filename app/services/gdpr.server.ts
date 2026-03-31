import prisma from "~/db.server";

export async function requestDataDeletion(shopId: string, customerEmail: string) {
  return prisma.dataDeletionRequest.create({
    data: { shopId, customerEmail },
  });
}

export async function processDataDeletion(requestId: string) {
  const deletionRequest = await prisma.dataDeletionRequest.findUnique({
    where: { id: requestId },
  });

  if (!deletionRequest) throw new Error("Deletion request not found");

  // Use transaction for atomic deletion
  await prisma.$transaction(async (tx) => {
    const registrations = await tx.registration.findMany({
      where: { shopId: deletionRequest.shopId, customerEmail: deletionRequest.customerEmail },
    });

    for (const reg of registrations) {
      // Delete claims
      await tx.claim.deleteMany({ where: { registrationId: reg.id } });

      // Reset serial number isUsed flag if applicable
      if (reg.serialNumber) {
        await tx.serialNumber.updateMany({
          where: {
            shopId: deletionRequest.shopId,
            serialNumber: reg.serialNumber,
          },
          data: { isUsed: false },
        });
      }
    }

    // Delete registrations
    await tx.registration.deleteMany({
      where: { shopId: deletionRequest.shopId, customerEmail: deletionRequest.customerEmail },
    });

    // Mark request as completed and clear PII from the request itself
    await tx.dataDeletionRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", completedAt: new Date(), customerEmail: "deleted" },
    });
  });
}

export async function exportCustomerData(shopId: string, customerEmail: string) {
  const registrations = await prisma.registration.findMany({
    where: { shopId, customerEmail },
    include: { product: true, claims: true },
  });

  return {
    customerEmail,
    exportedAt: new Date().toISOString(),
    registrations: registrations.map((r) => ({
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      product: r.product.name,
      serialNumber: r.serialNumber,
      purchaseDate: r.purchaseDate.toISOString(),
      purchaseChannel: r.purchaseChannel,
      proofOfPurchaseUrl: r.proofOfPurchaseUrl,
      shopifyOrderId: r.shopifyOrderId,
      warrantyExpiresAt: r.warrantyExpiresAt?.toISOString(),
      status: r.status,
      consentGiven: r.consentGiven,
      consentTimestamp: r.consentTimestamp?.toISOString(),
      claims: r.claims.map((c) => ({
        issueType: c.issueType,
        issueDescription: c.issueDescription,
        status: c.status,
        merchantNotes: c.merchantNotes,
        attachmentUrls: c.attachmentUrls,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    })),
  };
}
