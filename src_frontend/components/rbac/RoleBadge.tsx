import { Badge } from "@/components/ui/badge";
import type { Role } from "@/types/rbac";

const tone: Record<Role, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  LISTER: "bg-emerald-100 text-emerald-800",
  RENTER: "bg-gray-100 text-gray-700",
  AGENT: "bg-amber-100 text-amber-800",
  EDITOR: "bg-pink-100 text-pink-800",
};

export default function RoleBadge({ role }: { role: Role }) {
  return <Badge className={tone[role]}>{role}</Badge>;
}
