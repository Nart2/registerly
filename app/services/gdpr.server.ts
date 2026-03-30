import prisma from "~/db.server";

export async function requestDataDeletion(shopId: string, customerEmail: string) {
  return prisma.dataDeletionRequest.create({
    data: { shopId, customerEmail },
  });
}

export async function processDataDeletion(requestId: string) {
  const request = await prisma.dataDeletionRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) throw new Error("Deletion request not found");

  // Delete all registrations and associated claims for this customer
  const registrations = await prisma.registration.findMany({
    where: { shopId: request.shopId, customerEmail: request.customerEmail },
  });

  for (const reg of registrations) {
    await prisma.claim.deleteMany({ where: { registrationId: reg.id } });
  }

  await prisma.registration.deleteMany({
    where: { shopId: request.shopId, customerEmail: request.customerEmail },
  });

  await prisma.dataDeletionRequest.update({
    where: { id: requestId },
    data: { status: "COMPLETED", completedAt: new Date() },
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
      product: r.product.name,
      serialNumber: r.serialNumber,
      purchaseDate: r.purchaseDate.toISOString(),
      purchaseChannel: r.purchaseChannel,
      warrantyExpiresAt: r.warrantyExpiresAt?.toISOString(),
      status: r.status,
      claims: r.claims.map((c) => ({
        issueType: c.issueType,
        issueDescription: c.issueDescription,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    })),
  };
}
