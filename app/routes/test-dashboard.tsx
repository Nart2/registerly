/**
 * Local test route for the merchant dashboard (no Shopify auth needed).
 * Access at: http://localhost:3000/test-dashboard
 * DELETE THIS FILE before deploying to production.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import prisma from "~/db.server";
import { getRegistrationStats } from "~/services/registration.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const loader = async () => {
  // Use the demo shop for testing
  let shop = await prisma.shop.findFirst();
  if (!shop) {
    return json({ shop: null, stats: null, registrations: [], products: [] });
  }

  const stats = await getRegistrationStats(shop.id);

  const registrations = await prisma.registration.findMany({
    where: { shopId: shop.id },
    include: { product: true, claims: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const products = await prisma.product.findMany({
    where: { shopId: shop.id },
    include: { _count: { select: { registrations: true } } },
  });

  return json({ shop, stats, registrations, products });
};

export default function TestDashboard() {
  const { shop, stats, registrations, products } = useLoaderData<typeof loader>();

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">No shop found. Run `npx prisma db seed` first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Registerly — Test Dashboard</h1>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">Shop: {shop.domain}</span>
            <span className="text-gray-500">Plan: {shop.plan}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Registrations" value={stats?.total || 0} />
          <StatCard title="Active Warranties" value={stats?.approved || 0} color="green" />
          <StatCard title="Open Claims" value={stats?.openClaims || 0} color="yellow" />
          <StatCard title="Expiring Soon" value={stats?.expiringSoon || 0} color="red" />
        </div>

        {/* Products */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Products</h2>
          <div className="divide-y divide-gray-100">
            {products.map((product: any) => (
              <div key={product.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    {product.warrantyMonths} months warranty — {product._count.registrations} registrations
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Registrations */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Registrations ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <p className="text-gray-500">
              No registrations yet. Test it: <a href={`/register/${shop.domain}`} className="text-brand-600 underline">Register a product</a>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Serial #</th>
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Warranty Expires</th>
                    <th className="pb-2 font-medium">Portal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((reg: any) => (
                    <tr key={reg.id}>
                      <td className="py-3">
                        <p className="font-medium">{reg.customerName}</p>
                        <p className="text-gray-500 text-xs">{reg.customerEmail}</p>
                      </td>
                      <td className="py-3">{reg.product.name}</td>
                      <td className="py-3">{reg.serialNumber || "—"}</td>
                      <td className="py-3">{reg.purchaseChannel}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          reg.status === "APPROVED" ? "bg-green-100 text-green-800" :
                          reg.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs">
                        {reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3">
                        <a href={`/portal/${reg.id}`} className="text-brand-600 hover:underline text-xs">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color?: string }) {
  const bg = color === "green" ? "bg-green-50" : color === "yellow" ? "bg-yellow-50" : color === "red" ? "bg-red-50" : "bg-white";
  return (
    <div className={`${bg} rounded-xl border border-gray-200 p-5`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
