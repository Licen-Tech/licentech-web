import Link from "next/link";
import { getSession } from "@/lib/auth";
import { CartLink } from "@/components/CartProvider";
import MobileNav from "@/components/MobileNav";

export default async function Header({ siteName }: { siteName: string }) {
  const s = await getSession();
  const links = [
    { href: "/tutoriales", label: "Tutoriales" },
    ...(s ? [
      ...(s.role === "ADMIN" ? [{ href: "/admin", label: "Panel" }] : []),
      { href: "/mis-compras", label: "Mis compras" },
      { href: "/saldo", label: "Saldo" },
      { href: "/perfil", label: "Perfil" },
    ] : [
      { href: "/login", label: "Ingresar" },
      { href: "/registro", label: "Crear cuenta" },
    ]),
  ];
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 text-sm">
        <Link href="/" className="mr-auto text-base font-semibold text-teal-800">{siteName}</Link>
        <CartLink />
        <MobileNav links={links} authenticated={Boolean(s)} />
      </div>
    </header>
  );
}
