// frontend/src/app/terms/page.tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, FileText, AlertTriangle, Lock } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions | CribSpot Kenya",
  description: "Terms of use, privacy, and data protection for CribSpot Kenya.",
};

const CONTACT_EMAIL = "info@cribspot.co.ke";

export default function TermsPage() {
  return (
    <main className="container py-10">
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-brand-blue text-white">Legal</Badge>
          <Badge variant="outline">CribSpot Kenya</Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="text-gray-600 max-w-3xl">
            These Terms govern your use of CribSpot Kenya (the “Platform”). By accessing or using the Platform, you agree
            to these Terms.
          </p>
          <p className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-2xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Key terms
              </CardTitle>
              <CardDescription>
                A practical summary (the full details are below).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-700 space-y-3">
              <ul className="list-disc pl-5 space-y-2">
                <li>You must provide accurate information and use the Platform lawfully.</li>
                <li>Listings must be genuine, clear, and not misleading (including prices and images).</li>
                <li>Subscriptions / quotas may be required to publish or feature listings.</li>
                <li>We may remove content that violates rules or applicable laws.</li>
                <li>We are a marketplace platform — we don’t own or inspect listed properties.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Need help?
              </CardTitle>
              <CardDescription>Questions about these Terms?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-gray-600">
                Contact us at:
                <br />
                <a className="text-brand-blue underline" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </p>
              <Button asChild className="bg-brand-blue text-white hover:bg-black">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Full Terms
            </CardTitle>
            <CardDescription>
              Please read carefully.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">1. About the Platform</h2>
              <p>
                CribSpot Kenya is a platform operated under CribSpot Africa Limited to help renters discover rental spaces
                and help listers market properties. We provide browsing, search filters, listing tools, image uploads,
                subscription plans, and listing visibility features (e.g., “Featured”).
              </p>
              <p>
                CribSpot Kenya is not a real estate agent, broker, landlord, or property manager unless explicitly stated.
                We do not physically inspect or verify every listing. Users are responsible for their own due diligence.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">2. Accounts & Access</h2>
              <p>
                You may need an account to list properties or manage subscriptions. You agree to provide accurate
                information and keep your login credentials safe. If you believe your account has been compromised,
                contact us immediately.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">3. Listings & Content Rules</h2>
              <p>
                By creating a listing, you confirm you have the right to list the property and that the information is
                accurate. Prohibited content includes:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Fraudulent or misleading listings, fake pricing, or deceptive photos.</li>
                <li>Illegal content, hate, harassment, or violence.</li>
                <li>Personal data you don’t have the right to share (e.g., private IDs, sensitive info).</li>
                <li>Copyright-infringing photos or content you do not own or have permission to use.</li>
              </ul>
              <p>
                We may suspend, unpublish, edit, or remove listings that violate these Terms or applicable law.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">4. Publishing, Subscriptions & Quotas</h2>
              <p>
                Some actions (such as publishing or featuring listings) may require an active subscription or sufficient
                quota. Publishing/featuring may consume a slot from your plan. Slots are generally not refundable once
                consumed, even if you later unpublish or unfeature, unless otherwise stated.
              </p>
              <p>
                Prices, plan limits, and features may change over time. When possible, we will update the Platform UI to
                reflect current plan rules.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">5. Payments</h2>
              <p>
                If the Platform supports mobile money payments (such as M-PESA STK Push) or other payment methods, you
                agree to follow payment instructions carefully. Payment processing may involve third-party providers and
                networks. We are not responsible for delays or failures caused by third-party systems, network issues, or
                incorrect payment details.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">6. User Responsibilities & Due Diligence</h2>
              <p>
                Renters should verify property details, visit properties when appropriate, confirm identity of the lister,
                and avoid sending money without proper verification. Listers should respond honestly and respect renters’
                privacy.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">7. Privacy & Data Protection</h2>
              <p>
                We collect and process personal data to provide the Platform — such as account details, listing details,
                and uploaded images. We use reasonable safeguards to protect data, but no system is 100% secure.
              </p>
              <p className="flex items-start gap-2">
                <Lock className="h-4 w-4 mt-1" />
                <span>
                  Please do not share sensitive payment credentials (like PINs) via messages or listings. We will never
                  request your PIN.
                </span>
              </p>
              <p>
                Uploaded images are stored to display your listings. If you delete a draft/listing, associated images may
                also be deleted from storage where applicable. We may retain certain records as required for legal,
                compliance, auditing, or dispute resolution purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">8. Intellectual Property</h2>
              <p>
                The Platform’s branding, design, and software are owned by CribSpot Africa Limited and/or licensors. You
                may not copy or reuse them without permission.
              </p>
              <p>
                You retain ownership of content you upload (like photos), but you grant us a license to host, display, and
                distribute it for the purpose of operating the Platform and promoting listings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">9. Disclaimers</h2>
              <p>
                The Platform is provided “as is” and “as available”. We do not guarantee that listings will be accurate,
                available, or meet your needs. We do not guarantee uninterrupted access or error-free operation.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">10. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, CribSpot Kenya / CribSpot Africa Limited shall not be liable for
                indirect, incidental, special, consequential, or punitive damages, or any loss arising from interactions
                between renters and listers, property disputes, scams, or third-party payment/provider failures.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">11. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. The latest version will be posted on this page with an
                updated date. Continued use of the Platform means you accept the updated Terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">12. Contact</h2>
              <p>
                If you have questions about these Terms or data protection, contact:
                <br />
                <a className="text-brand-blue underline" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>

            <div className="pt-2 flex flex-wrap gap-2">
              <Button asChild className="bg-brand-blue text-white hover:bg-black">
                <Link href="/browse?page=1&limit=12">Browse Listings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/about">About Us</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}