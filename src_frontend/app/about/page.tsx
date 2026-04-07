// frontend/src/app/about/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Home, Search, Shield, Sparkles } from "lucide-react";

export const metadata = {
  title: "About Us | CribSpot Kenya",
  description: "Learn more about CribSpot Kenya — a product of CribSpot Africa Limited.",
};

export default function AboutPage() {
  return (
    <main className="container py-10">
      <section className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-brand-blue text-white">CribSpot Kenya</Badge>
            <Badge variant="outline">by CribSpot Africa Limited</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Making it easier to find your next place.
          </h1>
          <p className="text-gray-600 max-w-3xl">
            CribSpot Kenya helps renters discover available spaces, and helps listers showcase properties to the right
            audience — with a clean listing flow, smart filters, and fast browsing across counties, constituencies, and
            areas (estates / localities).
          </p>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-brand-blue text-white hover:bg-black">
              <Link href="/browse?page=1&limit=12">Browse Listings</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/lister/list">List a Property</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" /> Search that actually helps
              </CardTitle>
              <CardDescription>
                Filters that match how people search in Kenya: County → Constituency → Area (estate/locality).
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                We combine structured admin locations with real “on-the-ground” neighborhood names, so renters can search
                the way they naturally talk.
              </p>
              <ul className="space-y-1">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Area autocomplete (e.g. “Section 2, Kiambu, Thika, Township”)
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Price & bedrooms filtering for quick comparisons
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" /> Listing made simple
              </CardTitle>
              <CardDescription>
                A guided flow for listers with drafts, image uploads, and subscription quota checks.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                Listers can save drafts and come back later. Publishing consumes quota only when a listing is actually
                posted.
              </p>
              <ul className="space-y-1">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Drafts + autosave
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Subscription & featured slot controls
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Trust & safety mindset
              </CardTitle>
              <CardDescription>
                We’re building a platform where users can browse and list responsibly — with clear rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
              <p>
                We take security and data protection seriously. Access is controlled via authenticated sessions and role
                permissions.
              </p>
              <ul className="space-y-1">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Authenticated actions + permissions
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  Clear Terms & acceptable use
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Our mission
            </CardTitle>
            <CardDescription>Make renting and listing simpler, faster, and more transparent.</CardDescription>
          </CardHeader>
          <CardContent className="text-gray-600 text-sm space-y-3">
            <p>
              We’re building CribSpot Kenya to remove friction from the rental journey — from discovering options to
              connecting with listers. Our goal is to support renters with better search and help listers with visibility
              and tools that feel modern, not stressful.
            </p>
            <p>
              CribSpot Kenya is a product of <span className="font-semibold text-gray-900">CribSpot Africa Limited</span>,
              built for Kenya first — with the long-term vision of serving more markets across the region.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild className="bg-brand-blue text-white hover:bg-black">
                <Link href="/terms">Read Terms & Conditions</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/contact">Get in touch</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}