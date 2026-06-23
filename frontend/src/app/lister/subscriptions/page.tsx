// frontend/src/app/lister/subscriptions/page.tsx
import { redirect } from "next/navigation";

export default function LegacyListerSubscriptionsRedirect() {
  redirect("/dashboard/lister/billing");
}
