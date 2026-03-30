import prisma from "~/db.server";
import type { PurchaseChannel, RegistrationStatus } from "@prisma/client";

export interface CreateRegistrationInput {
  shopId: string;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serialNumber?: string;
  purchaseDate: Date;
  purchaseChannel: PurchaseChannel;
  proofOfPurchaseUrl?: string;
  shopifyOrderId?: string;
  consentGiven: boolean;
}

export async function createRegistration(input: CreateRegistrationInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });

  if (!product || !product.isActive) {
    throw new Error("Product not found or warranty not active");
  }

  // Validate serial number if required
  if (product.requireSerialNumber && input.serialNumber) {
    const serial = await prisma.serialNumber.findUnique({
      where: {
        shopId_serialNumber: {
          shopId: input.shopId,
          serialNumber: input.serialNumber,
        },
      },
    });

    if (!serial) {
      throw new Error("Invalid serial number");
    }
    if (serial.isUsed) {
      throw new Error("Serial number already registered");
    }

    // Mark serial as used
    await prisma.serialNumber.update({
      where: { id: serial.id },
      data: { isUsed: true },
    });
  }

  // Calculate warranty expiry
  const warrantyExpiresAt = new Date(input.purchaseDate);
  warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + product.warrantyMonths);

  return prisma.registration.create({
    data: {
      shopId: input.shopId,
      productId: input.productId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      serialNumber: input.serialNumber,
      purchaseDate: input.purchaseDate,
      purchaseChannel: input.purchaseChannel,
      proofOfPurchaseUrl: input.proofOfPurchaseUrl,
      shopifyOrderId: input.shopifyOrderId,
      warrantyExpiresAt,
      consentGiven: input.consentGiven,
      consentTimestamp: input.consentGiven ? new Date() : null,
      status: "PENDING",
    },
    include: { product: true },
  });
}

export async function getRegistrations(
  shopId: string,
  filters?: {
    status?: RegistrationStatus;
    productId?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 25;
  const skip = (page - 1) * limit;

  const where: any = { shopId };

  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.productId) {
    where.productId = filters.productId;
  }
  if (filters?.search) {
    where.OR = [
      { customerName: { contains: filters.search, mode: "insensitive" } },
      { customerEmail: { contains: filters.search, mode: "insensitive" } },
      { serialNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [registrations, total] = await Promise.all([
    prisma.registration.findMany({
      where,
      include: { product: true, claims: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.registration.count({ where }),
  ]);

  return { registrations, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRegistrationById(id: string) {
  return prisma.registration.findUnique({
    where: { id },
    include: { product: true, claims: { orderBy: { createdAt: "desc" } }, shop: true },
  });
}

export async function updateRegistrationStatus(id: string, status: RegistrationStatus) {
  return prisma.registration.update({
    where: { id },
    data: { status },
    include: { product: true },
  });
}

export async function getRegistrationStats(shopId: string) {
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const [total, approved, pending, expiringSoon, openClaims] = await Promise.all([
    prisma.registration.count({ where: { shopId } }),
    prisma.registration.count({ where: { shopId, status: "APPROVED" } }),
    prisma.registration.count({ where: { shopId, status: "PENDING" } }),
    prisma.registration.count({
      where: {
        shopId,
        status: "APPROVED",
        warrantyExpiresAt: { gte: now, lte: thirtyDaysFromNow },
      },
    }),
    prisma.claim.count({
      where: {
        registration: { shopId },
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
    }),
  ]);

  return { total, approved, pending, expiringSoon, openClaims };
}

export async function getCustomerRegistrations(email: string, shopId: string) {
  return prisma.registration.findMany({
    where: { customerEmail: email, shopId },
    include: { product: true, claims: true },
    orderBy: { createdAt: "desc" },
  });
}
