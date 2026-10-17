import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import SupportWidget from "@/components/SupportWidget";
import { CartProvider } from "@/components/CartProvider";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "LicenTech Colombia",
  description: "Licencias de software de terceros con entrega inmediata",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: "main" },
    include: { logoMedia: { select: { id: true, name: true, altText: true, externalUrl: true } } },
  });
  const supportEmail = settings?.supportEmail.trim() || process.env.SUPPORT_EMAIL?.trim() || "brianxxp082@gmail.com";
  const whatsapp = (settings?.whatsappNumber || process.env.SELLER_WHATSAPP || "").replace(/\D/g, "");
  const telegram = settings?.telegramUsername ?? "";
  return (
    <html lang="es">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <CartProvider>
          <Header
            siteName={settings?.siteName || "LicenTech Colombia"}
            logo={settings?.logoMedia ? {
              src: settings.logoMedia.externalUrl ?? `/api/media/${settings.logoMedia.id}`,
              alt: settings.logoMedia.altText || settings.logoMedia.name,
            } : null}
          />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <SupportWidget whatsapp={whatsapp} email={supportEmail} telegram={telegram} />
          <footer className="border-t border-stone-200 px-4 py-6 text-center text-xs text-stone-500">
            Revendedor de software de terceros. Las marcas pertenecen a sus dueños.{" "}
            <Link className="underline" href="/legal/descargo">Descargo de responsabilidad y garantía</Link>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
