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
      <nav className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Registerly — Test Dashboard</h1>
          <div className="flex gap-6 text-sm">
            <span className="text-gray-500">Shop: <span className="text-gray-700 font-medium">{shop.domain}</span></span>
            <span className="text-gray-500">Plan: <span className="text-gray-700 font-medium">{shop.plan}</span></span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Quick Links */}
        <div className="flex gap-3 mb-6">
          <a href={`/register/${shop.domain}`} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            Registration Page
          </a>
          <a href="/app" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            Admin Dashboard
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Registrations" value={stats?.total || 0} />
          <StatCard title="Active Warranties" value={stats?.approved || 0} color="green" />
          <StatCard title="Open Claims" value={stats?.openClaims || 0} color="yellow" />
          <StatCard title="Expiring Soon" value={stats?.expiringSoon || 0} color="red" />
        </div>

        {/* Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Products</h2>
          <div className="divide-y divide-gray-100">
            {products.map((product: any) => (
              <div key={product.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    {product.warrantyMonths} months warranty — {product._count.registrations} registrations
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${product.isActive ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20" : "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/10"}`}>
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Registrations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Registrations ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-3">No registrations yet.</p>
              <a href={`/register/${shop.domain}`} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                Test Registration Page
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial #</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Warranty Expires</th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Portal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((reg: any) => (
                    <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <p className="font-medium text-gray-900">{reg.customerName}</p>
                        <p className="text-gray-500 text-xs">{reg.customerEmail}</p>
                      </td>
                      <td className="py-3 text-gray-700">{reg.product.name}</td>
                      <td className="py-3 text-gray-600 font-mono text-xs">{reg.serialNumber || "—"}</td>
                      <td className="py-3 text-gray-600">{reg.purchaseChannel}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          reg.status === "APPROVED" ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20" :
                          reg.status === "PENDING" ? "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20" :
                          "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                        }`}>
                          {reg.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-600">
                        {reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3">
                        <a href={`/portal/${reg.id}`} className="inline-flex px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">View Portal</a>
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
  const styles = {
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };
  const valueColor = {
    green: "text-green-700",
    yellow: "text-yellow-700",
    red: "text-red-700",
  };
  const bg = color ? styles[color as keyof typeof styles] : "bg-white border-gray-200";
  const vc = color ? valueColor[color as keyof typeof valueColor] : "text-gray-900";
  return (
    <div className={`${bg} rounded-xl border p-5`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold ${vc} mt-1`}>{value}</p>
    </div>
  );
}
