import prisma from "~/db.server";
import type { ClaimStatus, IssueType } from "@prisma/client";

export interface CreateClaimInput {
  registrationId: string;
  issueDescription: string;
  issueType: IssueType;
  attachmentUrls?: string[];
}

export async function createClaim(input: CreateClaimInput) {
  const registration = await prisma.registration.findUnique({
    where: { id: input.registrationId },
  });

  if (!registration) {
    throw new Error("Registration not found");
  }

  if (registration.status !== "APPROVED") {
    throw new Error("Registration must be approved to submit a claim");
  }

  if (registration.warrantyExpiresAt && registration.warrantyExpiresAt < new Date()) {
    throw new Error("Warranty has expired");
  }

  return prisma.claim.create({
    data: {
      registrationId: input.registrationId,
      issueDescription: input.issueDescription,
      issueType: input.issueType,
      attachmentUrls: input.attachmentUrls || [],
      status: "OPEN",
    },
    include: { registration: { include: { product: true } } },
  });
}

export async function getClaims(
  shopId: string,
  filters?: {
    status?: ClaimStatus;
    page?: number;
    limit?: number;
  },
) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 25;
  const skip = (page - 1) * limit;

  const where: any = { registration: { shopId } };
  if (filters?.status) {
    where.status = filters.status;
  }

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      include: {
        registration: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.claim.count({ where }),
  ]);

  return { claims, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateClaimStatus(
  id: string,
  status: ClaimStatus,
  merchantNotes?: string,
) {
  return prisma.claim.update({
    where: { id },
    data: { status, merchantNotes },
    include: { registration: { include: { product: true, shop: true } } },
  });
}
