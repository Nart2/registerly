import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { z } from "zod";
import { getRegistrationById } from "~/services/registration.server";
import { createClaim } from "~/services/claim.server";
import { sendEmail } from "~/services/email.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

const claimSchema = z.object({
  issueType: z.enum(["DEFECTIVE", "DAMAGED", "MISSING_PARTS", "OTHER"]),
  issueDescription: z.string().min(10, "Please describe the issue in at least 10 characters"),
});

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const registrationId = params.registrationId;
  if (!registrationId) throw new Response("Not found", { status: 404 });

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
    return json({ errors: { _form: error.message } }, { status: 400 });
  }
};

export default function NewClaimPage() {
  const { registration, brandColor } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData as any)?.errors || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Submit Warranty Claim</h1>
          <p className="text-gray-500 mt-2">
            {registration.productName} — {registration.customerName}
          </p>
        </div>

        <div className="card">
          {errors._form && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors._form}
            </div>
          )}

          <Form method="post" className="space-y-5">
            <div>
              <label htmlFor="issueType" className="block text-sm font-medium text-gray-700 mb-1">Issue Type *</label>
              <select id="issueType" name="issueType" className="input-field" required>
                <option value="">Select issue type...</option>
                <option value="DEFECTIVE">Defective / Not Working</option>
                <option value="DAMAGED">Damaged</option>
                <option value="MISSING_PARTS">Missing Parts</option>
                <option value="OTHER">Other</option>
              </select>
              {errors.issueType && <p className="text-red-500 text-sm mt-1">{errors.issueType}</p>}
            </div>

            <div>
              <label htmlFor="issueDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Describe the Issue *
              </label>
              <textarea
                id="issueDescription"
                name="issueDescription"
                rows={5}
                className="input-field"
                required
                minLength={10}
                placeholder="Please describe what happened, when you noticed the issue, and any steps you've already taken..."
              />
              {errors.issueDescription && <p className="text-red-500 text-sm mt-1">{errors.issueDescription}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isSubmitting}
              style={{ backgroundColor: brandColor }}
            >
              {isSubmitting ? "Submitting..." : "Submit Claim"}
            </button>
          </Form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Registerly</p>
      </div>
    </div>
  );
}
