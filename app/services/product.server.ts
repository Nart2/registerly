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
  shopId: string,
  data: { warrantyMonths?: number; isActive?: boolean; requireSerialNumber?: boolean },
) {
  const product = await prisma.product.findFirst({ where: { id, shopId } });
  if (!product) {
    throw new Error("Product not found");
  }
  return prisma.product.update({ where: { id }, data });
}

export async function importSerialNumbers(
  shopId: string,
  productId: string,
  serialNumbers: string[],
) {
  // Verify product belongs to shop
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) {
    throw new Error("Product not found");
  }

  const data = serialNumbers
    .map((sn) => sn.trim())
    .filter((sn) => sn.length > 0)
    .map((sn) => ({ shopId, productId, serialNumber: sn }));

  return prisma.serialNumber.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function getSerialNumbers(productId: string, shopId: string, page = 1, limit = 50) {
  // Verify product belongs to shop
  const product = await prisma.product.findFirst({ where: { id: productId, shopId } });
  if (!product) {
    throw new Error("Product not found");
  }
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
