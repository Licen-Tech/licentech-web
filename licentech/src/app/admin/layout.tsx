import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) redirect("/login");
  return (
    <div>
      <nav className="mb-6 flex gap-4 border-b border-stone-200 pb-3 text-sm">
        <Link href="/admin">Resumen</Link>
        <Link href="/admin/productos">Productos e inventario</Link>
        <Link href="/admin/contenido">Contenido y configuración</Link>
      </nav>
      {children}
    </div>
  );
}
