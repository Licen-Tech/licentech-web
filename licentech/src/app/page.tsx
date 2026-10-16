import { prisma } from "@/lib/prisma";
import Catalog from "@/components/Catalog";
import CustomerReviews from "@/components/CustomerReviews";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, banners, settings] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
        image: { select: { id: true } },
        coverMedia: { select: { id: true, externalUrl: true, altText: true } },
        rentalOptions: { where: { active: true }, select: { priceCop: true } },
      },
    }),
    prisma.siteBanner.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { media: { select: { id: true, name: true, altText: true, externalUrl: true } } },
    }),
    prisma.siteSettings.findUnique({ where: { id: "main" } }),
  ]);
  const catalogProducts = products.map(({ _count, image, coverMedia, rentalOptions, ...product }) => ({
    ...product,
    priceCop: product.deliveryType === "RENTAL" && rentalOptions.length
      ? Math.min(...rentalOptions.map((option) => option.priceCop))
      : product.priceCop,
    stock: _count.licenses,
    coverMedia,
    hasImage: Boolean(image || coverMedia),
  }));
  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-teal-950 p-6 text-white sm:p-9">
        <p className="text-sm font-medium text-teal-200">LicenTech Colombia · Software y soporte digital</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">{settings?.heroTitle || "Herramientas de software para desbloqueo y mantenimiento"}</h1>
        <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-teal-50 sm:text-base">
          {settings?.heroDescription || "Explora nuestro catálogo de software y servicios digitales. Consulta cada producto para conocer compatibilidad, versiones, disponibilidad y condiciones antes de comprar."}
        </p>
        <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-teal-100">
          {settings?.heroNotice || "Compra sin crear una cuenta. Paga con tarjeta o con los métodos manuales habilitados. Verificamos cada pago antes de gestionar la entrega."}
        </p>
      </section>
      {banners.map((banner) => {
        const content = (
          <div className="grid overflow-hidden rounded-xl border border-stone-200 bg-white sm:grid-cols-2">
            {banner.media && (
              <Image
                src={banner.media.externalUrl ?? `/api/media/${banner.media.id}`}
                alt={banner.media.altText || banner.media.name}
                width={960}
                height={480}
                unoptimized
                className="h-48 w-full object-cover sm:h-full"
              />
            )}
            <div className="flex flex-col justify-center p-6">
              <h2 className="text-xl font-semibold">{banner.title}</h2>
              {banner.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600">{banner.description}</p>}
            </div>
          </div>
        );
        return banner.linkUrl
          ? <Link key={banner.id} href={banner.linkUrl}>{content}</Link>
          : <section key={banner.id}>{content}</section>;
      })}
      <Catalog products={catalogProducts} />
      <section className="grid gap-4 md:grid-cols-3" aria-labelledby="how-to-buy">
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-teal-800">01 · Elige tu software</p>
          <h2 id="how-to-buy" className="mt-2 text-lg font-semibold">Encuentra el servicio que necesitas</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Busca por nombre o fabricante y revisa la versión, descripción, precio y disponibilidad antes de comprar.</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-teal-800">02 · Escoge cómo pagar</p>
          <h2 className="mt-2 text-lg font-semibold">Tarjeta o Nequi/Bre-B</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">El pago con tarjeta se procesa en el checkout seguro de Wompi. Para Nequi/Bre-B verás los datos de transferencia y cargarás el comprobante después de pagar.</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <p className="text-sm font-semibold text-teal-800">03 · Sigue tu compra</p>
          <h2 className="mt-2 text-lg font-semibold">Verificamos antes de entregar</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">Usa el enlace privado de seguimiento para consultar el estado. Tras confirmar el pago, enviamos la licencia al correo que indiques.</p>
        </div>
      </section>
      <CustomerReviews />
    </div>
  );
}
