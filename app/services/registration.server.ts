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
  const product = await prisma.product.findFirst({
    where: { id: input.productId, shopId: input.shopId },
  });

  if (!product || !product.isActive) {
    throw new Error("Product not found or warranty not active");
  }

  // Validate serial number if required
  if (product.requireSerialNumber && !input.serialNumber) {
    throw new Error("Serial number is required");
  }

  // Calculate warranty expiry (safe month math — clamp to last day of target month)
  const warrantyExpiresAt = new Date(input.purchaseDate);
  const targetMonth = warrantyExpiresAt.getMonth() + product.warrantyMonths;
  warrantyExpiresAt.setDate(1); // avoid overflow
  warrantyExpiresAt.setMonth(targetMonth);
  // Clamp to last day of target month if original day was higher
  const originalDay = new Date(input.purchaseDate).getDate();
  const lastDayOfTargetMonth = new Date(warrantyExpiresAt.getFullYear(), warrantyExpiresAt.getMonth() + 1, 0).getDate();
  warrantyExpiresAt.setDate(Math.min(originalDay, lastDayOfTargetMonth));

  // Use transaction for serial number marking + registration creation (atomic)
  return prisma.$transaction(async (tx) => {
    if (product.requireSerialNumber && input.serialNumber) {
      const serial = await tx.serialNumber.findUnique({
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

      await tx.serialNumber.update({
        where: { id: serial.id },
        data: { isUsed: true },
      });
    }

    return tx.registration.create({
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

export async function updateRegistrationStatus(id: string, shopId: string, status: RegistrationStatus) {
  const registration = await prisma.registration.findFirst({
    where: { id, shopId },
  });
  if (!registration) {
    throw new Error("Registration not found");
  }
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
