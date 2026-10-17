import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CartLink } from "@/components/CartProvider";
import LogoutButton from "@/components/LogoutButton";

export default async function Header({
  siteName,
  logo,
}: {
  siteName: string;
  logo: { src: string; alt: string } | null;
}) {
  const [s, menuItems] = await Promise.all([
    getSession(),
    prisma.navigationItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, href: true, label: true },
    }),
  ]);
  const accountLinks = s ? [
      ...(s.role === "ADMIN" ? [{ href: "/admin", label: "Panel" }] : []),
      { href: "/mis-compras", label: "Mis compras" },
      { href: "/saldo", label: "Saldo" },
      { href: "/perfil", label: "Perfil" },
    ] : [
      { href: "/login", label: "Ingresar" },
      { href: "/registro", label: "Crear cuenta" },
    ];
  return (
    <>
    <header className="fixed inset-x-0 top-0 z-40 w-full border-b border-stone-300 bg-white/95 shadow-sm backdrop-blur">
      <div className="w-full bg-teal-950 text-white">
        <div className="flex w-full items-center gap-3 px-4 py-2">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold">
            {logo && <Image src={logo.src} alt={logo.alt} width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded object-contain" />}
            <span className="truncate">{siteName}</span>
          </Link>
          <div className="shrink-0 text-sm text-white [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1">
            <CartLink />
          </div>
        </div>
      </div>
      <nav aria-label="Navegación principal" className="flex w-full flex-nowrap justify-start gap-2 overflow-x-auto px-4 py-2 text-sm md:justify-center">
        {menuItems.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900"
          >
            {link.label}
          </Link>
        ))}
        {accountLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900"
          >
            {link.label}
          </Link>
        ))}
        {s && (
          <span className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:border-teal-700 hover:bg-teal-50 hover:text-teal-900">
            <LogoutButton />
          </span>
        )}
      </nav>
    </header>
    <div aria-hidden="true" className="h-[105px]" />
    </>
  );
}
