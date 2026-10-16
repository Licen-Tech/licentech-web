"use client";

import Link from "next/link";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

type NavigationLink = { href: string; label: string };

export default function MobileNav({ links, authenticated }: { links: NavigationLink[]; authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded border border-stone-300 text-teal-950"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="h-0.5 w-5 bg-current" />
        <span className="h-0.5 w-5 bg-current" />
        <span className="h-0.5 w-5 bg-current" />
      </button>
      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Navegación móvil"
          className="absolute right-0 top-12 z-50 min-w-52 rounded-lg border border-stone-200 bg-white p-2 shadow-lg"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded px-3 py-2 text-sm hover:bg-teal-50"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {authenticated && (
            <div className="rounded px-3 py-2 text-left text-sm hover:bg-teal-50"><LogoutButton /></div>
          )}
        </nav>
      )}
    </div>
  );
}
