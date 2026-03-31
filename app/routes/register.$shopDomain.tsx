import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { z } from "zod";
import prisma from "~/db.server";
import { createRegistration } from "~/services/registration.server";
import { checkRegistrationLimit, incrementRegistrationCount } from "~/services/billing.server";
import { rateLimitMiddleware } from "~/services/ratelimit.server";
import { sendEmail } from "~/services/email.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

const registrationSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().min(1, "Please enter a purchase date"),
  purchaseChannel: z.enum(["SHOPIFY", "AMAZON", "RETAIL", "OTHER"]),
  consent: z.literal("on", { errorMap: () => ({ message: "You must agree to the terms" }) }),
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });

  if (!shop) throw new Response("Shop not found", { status: 404 });

  const url = new URL(request.url);
  const preselectedProduct = url.searchParams.get("product");

  return json({
    shop: { domain: shop.domain, brandColor: shop.brandColor, brandLogo: shop.brandLogo },
    products: shop.products.map((p) => ({
      id: p.id,
      name: p.name,
      warrantyMonths: p.warrantyMonths,
      requireSerialNumber: p.requireSerialNumber,
    })),
    preselectedProduct,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  // IP-based rate limiting: 10 submissions per minute per IP
  const rl = rateLimitMiddleware(request, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return json(
      { errors: { _form: "Too many requests. Please wait a moment before trying again." } },
      { status: 429, headers: rl.headers },
    );
  }

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  // Check registration limit
  const limitCheck = await checkRegistrationLimit(shop.id);
  if (!limitCheck.allowed) {
    return json(
      { errors: { _form: "This shop has reached its monthly registration limit. Please try again later." } },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return json({ errors }, { status: 400 });
  }

  try {
    const registration = await createRegistration({
      shopId: shop.id,
      productId: parsed.data.productId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      serialNumber: parsed.data.serialNumber,
      purchaseDate: new Date(parsed.data.purchaseDate),
      purchaseChannel: parsed.data.purchaseChannel,
      consentGiven: true,
    });

    await incrementRegistrationCount(shop.id);

    // Send confirmation email
    try {
      await sendEmail({
        to: registration.customerEmail,
        shopId: shop.id,
        templateType: "REGISTRATION_CONFIRM",
        variables: {
          customerName: registration.customerName,
          productName: registration.product.name,
          serialNumber: registration.serialNumber || "N/A",
          warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString() || "N/A",
          portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
        },
      });
    } catch (e) {
      console.error("Failed to send registration email:", e);
    }

    return redirect(`/portal/${registration.id}?registered=true`);
  } catch (error: any) {
    return json({ errors: { _form: error.message } }, { status: 400 });
  }
};

export default function RegisterPage() {
  const { shop, products, preselectedProduct } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData as any)?.errors || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: shop.brandColor + "15" }}
          >
            <svg className="w-8 h-8" style={{ color: shop.brandColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register Your Product</h1>
          <p className="text-gray-500 mt-2">Activate your warranty by registering your purchase</p>
        </div>

        {/* Form */}
        <div className="card">
          {errors._form && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors._form}
            </div>
          )}

          <Form method="post" className="space-y-5">
            {/* Product Selection */}
            <div>
              <label htmlFor="productId" className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
              <select
                id="productId"
                name="productId"
                defaultValue={preselectedProduct || ""}
                className="input-field"
                required
              >
                <option value="">Select your product...</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.warrantyMonths} months warranty)
                  </option>
                ))}
              </select>
              {errors.productId && <p className="text-red-500 text-sm mt-1">{errors.productId}</p>}
            </div>

            {/* Customer Name */}
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" id="customerName" name="customerName" className="input-field" required placeholder="John Doe" />
              {errors.customerName && <p className="text-red-500 text-sm mt-1">{errors.customerName}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input type="email" id="customerEmail" name="customerEmail" className="input-field" required placeholder="john@example.com" />
              {errors.customerEmail && <p className="text-red-500 text-sm mt-1">{errors.customerEmail}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" id="customerPhone" name="customerPhone" className="input-field" placeholder="+1 (555) 000-0000" />
            </div>

            {/* Serial Number */}
            <div>
              <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
              <input type="text" id="serialNumber" name="serialNumber" className="input-field" placeholder="Found on product packaging" />
              {errors.serialNumber && <p className="text-red-500 text-sm mt-1">{errors.serialNumber}</p>}
            </div>

            {/* Purchase Date */}
            <div>
              <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
              <input type="date" id="purchaseDate" name="purchaseDate" className="input-field" required max={new Date().toISOString().split("T")[0]} />
              {errors.purchaseDate && <p className="text-red-500 text-sm mt-1">{errors.purchaseDate}</p>}
            </div>

            {/* Purchase Channel */}
            <div>
              <label htmlFor="purchaseChannel" className="block text-sm font-medium text-gray-700 mb-1">Where did you purchase? *</label>
              <select id="purchaseChannel" name="purchaseChannel" className="input-field" required>
                <option value="SHOPIFY">Online Store</option>
                <option value="AMAZON">Amazon</option>
                <option value="RETAIL">Retail Store</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Consent */}
            <div className="flex items-start gap-3">
              <input type="checkbox" id="consent" name="consent" className="mt-1 h-4 w-4 rounded border-gray-300" required />
              <label htmlFor="consent" className="text-sm text-gray-600">
                I agree to the storage and processing of my data for warranty purposes. I can request deletion at any time.
              </label>
            </div>
            {errors.consent && <p className="text-red-500 text-sm">{errors.consent}</p>}

            {/* Submit */}
            <button type="submit" className="btn-primary w-full" disabled={isSubmitting} style={{ backgroundColor: shop.brandColor }}>
              {isSubmitting ? "Registering..." : "Register Product"}
            </button>
          </Form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Registerly
        </p>
      </div>
    </div>
  );
}
