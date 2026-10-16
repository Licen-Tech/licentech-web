import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import WalletDashboard from "@/components/WalletDashboard";

export default async function WalletPage() {
  if (!(await getSession())) redirect("/login");
  return <WalletDashboard />;
}
