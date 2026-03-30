import prisma from "~/db.server";

export async function getProducts(shopId: string) {
  return prisma.product.findMany({
    where: { shopId },
    include: { _count: { select: { registrations: true } } },
    orderBy: { name: "asc" },
  });
}

export async function syncProduct(
  shopId: string,
  shopifyProductId: string,
  name: string,
) {
  return prisma.product.upsert({
    where: { shopId_shopifyProductId: { shopId, shopifyProductId } },
    create: { shopId, shopifyProductId, name },
    update: { name },
  });
}

export async function updateProductWarranty(
  id: string,
  data: { warrantyMonths?: number; isActive?: boolean; requireSerialNumber?: boolean },
) {
  return prisma.product.update({ where: { id }, data });
}

export async function importSerialNumbers(
  shopId: string,
  productId: string,
  serialNumbers: string[],
) {
  const data = serialNumbers.map((sn) => ({
    shopId,
    productId,
    serialNumber: sn.trim(),
  }));

  return prisma.serialNumber.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function getSerialNumbers(productId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [serials, total] = await Promise.all([
    prisma.serialNumber.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.serialNumber.count({ where: { productId } }),
  ]);

  return { serials, total, page, limit };
}
