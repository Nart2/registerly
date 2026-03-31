import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { getRegistrationById } from "~/services/registration.server";
import { createClaim } from "~/services/claim.server";
import { sendEmail } from "~/services/email.server";
import { rateLimitMiddleware } from "~/services/ratelimit.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

const claimSchema = z.object({
  issueType: z.enum(["DEFECTIVE", "DAMAGED", "MISSING_PARTS", "OTHER"]),
  issueDescription: z.string().min(10, "Please describe the issue in at least 10 characters").max(5000, "Description must be 5000 characters or less"),
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const registrationId = params.registrationId;
  if (!registrationId) throw new Response("Not found", { status: 404 });

  // Rate limit: 20 requests per minute per IP
  const rl = rateLimitMiddleware(request, { maxRequests: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    throw new Response("Too many requests", { status: 429, headers: rl.headers });
  }

  const registration = await getRegistrationById(registrationId);
  if (!registration) throw new Response("Registration not found", { status: 404 });

  if (registration.status !== "APPROVED") {
    throw new Response("Registration must be approved to submit a claim", { status: 403 });
  }

  if (registration.warrantyExpiresAt && registration.warrantyExpiresAt < new Date()) {
    throw new Response("Warranty has expired", { status: 403 });
  }

  return json({
    registration: {
      id: registration.id,
      productName: registration.product.name,
      customerName: registration.customerName,
      warrantyExpiresAt: registration.warrantyExpiresAt,
    },
    brandColor: registration.shop?.brandColor || "#2563eb",
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const registrationId = params.registrationId;
  if (!registrationId) throw new Response("Not found", { status: 404 });

  const rl = rateLimitMiddleware(request, { maxRequests: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return json(
      { errors: { _form: "Too many requests. Please wait a moment before trying again." } },
      { status: 429, headers: rl.headers },
    );
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return json({ errors }, { status: 400 });
  }

  try {
    const claim = await createClaim({
      registrationId,
      issueType: parsed.data.issueType,
      issueDescription: parsed.data.issueDescription,
    });

    // Send claim received email
    try {
      await sendEmail({
        to: claim.registration.customerEmail,
        shopId: claim.registration.shopId,
        templateType: "CLAIM_RECEIVED",
        variables: {
          customerName: claim.registration.customerName,
          productName: claim.registration.product.name,
          claimId: claim.id.slice(0, 8),
          issueDescription: claim.issueDescription,
          portalUrl: `${process.env.APP_URL}/portal/${registrationId}`,
        },
      });
    } catch (e) {
      console.error("Failed to send claim email:", e);
    }

    return redirect(`/portal/${registrationId}`);
  } catch (error: any) {
    console.error("Claim submission error:", error);
    const safeMessages = ["Registration not found", "Registration must be approved to submit a claim", "Warranty has expired"];
    const message = safeMessages.includes(error.message) ? error.message : "Something went wrong. Please try again.";
    return json({ errors: { _form: message } }, { status: 400 });
  }
};

const issueTypes = [
  { value: "DEFECTIVE", label: "Defective", description: "Product is not working as expected" },
  { value: "DAMAGED", label: "Damaged", description: "Product arrived damaged or broke during use" },
  { value: "MISSING_PARTS", label: "Missing Parts", description: "Parts or accessories are missing" },
  { value: "OTHER", label: "Other", description: "Another issue not listed above" },
];

export default function NewClaimPage() {
  const { registration, brandColor } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData as any)?.errors || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Colored Hero Header */}
      <div className="hero-section">
        <div className="max-w-xl mx-auto px-4 pt-10 pb-16 sm:pt-14 sm:pb-20">
          <h1 className="text-2xl font-bold text-white tracking-tight">Submit Warranty Claim</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-brand-200">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              {registration.productName}
            </span>
            <span className="text-brand-400">|</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {registration.customerName}
            </span>
          </div>
        </div>
      </div>

      {/* Form Card - pulled up */}
      <div className="max-w-xl mx-auto px-4 -mt-8 sm:-mt-12 pb-10">
        <div className="card shadow-lg">
          {errors._form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{errors._form}</span>
            </div>
          )}

          <Form method="post" className="space-y-8">
            {/* Issue Type as radio cards */}
            <div>
              <p className="section-title">What happened?</p>
              <div className="grid grid-cols-2 gap-3">
                {issueTypes.map((type) => (
                  <label key={type.value} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="issueType"
                      value={type.value}
                      required
                      className="peer sr-only"
                    />
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white transition-all duration-200 peer-checked:border-current peer-checked:bg-opacity-5 hover:border-gray-300 peer-checked:shadow-sm" style={{ ["--tw-border-opacity" as any]: undefined }}>
                      <p className="font-medium text-sm text-gray-900 peer-checked:text-current">{type.label}</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{type.description}</p>
                    </div>
                    <style>{`
                      input[value="${type.value}"]:checked ~ div {
                        border-color: ${brandColor};
                        background-color: ${brandColor}08;
                      }
                    `}</style>
                  </label>
                ))}
              </div>
              {errors.issueType && <p className="text-red-500 text-sm mt-2">{errors.issueType}</p>}
            </div>

            {/* Description */}
            <div>
              <p className="section-title">Describe the issue</p>
              <textarea
                id="issueDescription"
                name="issueDescription"
                rows={8}
                className="input-field"
                required
                minLength={10}
                placeholder="Tell us what happened. Include details like when you first noticed the issue, what you were doing at the time, and any troubleshooting steps you have already tried..."
              />
              {errors.issueDescription && <p className="text-red-500 text-sm mt-1.5">{errors.issueDescription}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full text-base"
              disabled={isSubmitting}
              style={{ backgroundColor: brandColor }}
            >
              {isSubmitting ? "Submitting..." : "Submit Claim"}
            </button>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-400">Secured by <span className="text-brand-600 font-medium">Registerly</span></p>
        </div>
      </div>
    </div>
  );
}
