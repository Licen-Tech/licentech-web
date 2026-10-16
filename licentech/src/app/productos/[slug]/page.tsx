import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cop } from "@/lib/format";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { youtubeEmbedUrl } from "@/lib/youtube";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  const [p, user] = await Promise.all([
    prisma.product.findUnique({
      where: { slug: params.slug },
      include: {
        _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
        image: { select: { id: true } },
        coverMedia: { select: { id: true, externalUrl: true, altText: true } },
        gallery: {
          orderBy: { position: "asc" },
          include: { media: { select: { id: true, name: true, altText: true, externalUrl: true } } },
        },
        rentalOptions: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { quantity: "asc" }] },
      },
    }),
    session ? prisma.user.findUnique({ where: { id: session.userId }, select: { walletBalanceCop: true } }) : null,
  ]);
  if (!p || !p.active) notFound();
  const stock = p.deliveryType === "LICENSE_KEY" ? p._count.licenses : null;
  const isLicenseKey = p.deliveryType === "LICENSE_KEY";
  const rentalStartingPrice = p.deliveryType === "RENTAL"
    ? p.rentalOptions.length ? Math.min(...p.rentalOptions.map((option) => option.priceCop)) : p.priceCop
    : p.priceCop;
  const video = youtubeEmbedUrl(p.youtubeUrl);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <Link href="/" className="text-sm text-teal-800 underline">Volver al catálogo</Link>
        {(p.coverMedia || p.image) && (
          <Image
            src={p.coverMedia?.externalUrl ?? `/api/products/${encodeURIComponent(p.slug)}/image`}
            alt={p.coverMedia?.altText || `Imagen de ${p.name}`}
            width={720}
            height={480}
            unoptimized
            className="mt-4 max-h-96 w-full rounded-lg object-cover"
          />
        )}
        {p.gallery.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {p.gallery.map(({ id, media }) => (
              <Image
                key={id}
                src={media.externalUrl ?? `/api/media/${media.id}`}
                alt={media.altText || media.name}
                width={200}
                height={140}
                unoptimized
                className="h-24 w-full rounded object-cover"
              />
            ))}
          </div>
        )}
        <div className="text-sm text-stone-500">{[p.category, p.vendor, p.version].filter(Boolean).join(" · ")}</div>
        <h1 className="mt-1 text-2xl font-semibold">{p.name}</h1>
        {p.officialUrl && <a className="mt-2 inline-block text-sm text-teal-800 underline" href={p.officialUrl} target="_blank" rel="noreferrer">Visitar página oficial</a>}
        <p className="mt-3 text-3xl font-semibold">
          {p.deliveryType === "RENTAL" ? `Desde ${cop.format(rentalStartingPrice)}` : `${cop.format(rentalStartingPrice)}${p.deliveryType === "CREDITS" ? " / crédito" : ""}`}
        </p>
        <p className="mt-1 text-xs text-stone-500">Precio base; antes de pagar verás el total con los cargos incluidos.</p>
        <p className={`mt-2 text-sm ${!isLicenseKey || stock! > 0 ? "text-teal-800" : "text-red-700"}`}>
          {isLicenseKey
            ? stock! > 0 ? `${stock} licencias disponibles` : "Agotado por ahora"
            : p.deliveryType === "CREDITS" ? "Elige la cantidad de créditos · entrega bajo pedido" : p.deliveryType === "RENTAL" ? "Renta digital · selecciona la duración" : "Activación de cuenta · entrega bajo pedido"}
        </p>
        <p className="mt-4 whitespace-pre-line text-stone-700">{p.description}</p>
        {p.deliveryDetails && <p className="mt-3 whitespace-pre-line text-sm text-stone-600">{p.deliveryDetails}</p>}
        {video && (
          <div className="mt-5 aspect-video overflow-hidden rounded-lg bg-black">
            <iframe className="h-full w-full" src={video} title={`Video: ${p.name}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
        )}
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-medium">{isLicenseKey ? "¿Cómo recibes tu licencia?" : p.deliveryType === "RENTAL" ? "¿Cómo funciona la renta?" : "¿Cómo funciona la entrega?"}</h2>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm leading-6 text-stone-600">
            <li>Completa el pago con tarjeta o transfiere por Nequi/Bre-B.</li>
            <li>Si pagas por transferencia, carga el comprobante desde el enlace de seguimiento.</li>
            <li>            {isLicenseKey ? "Verificamos el pago y enviamos la clave al correo indicado." : p.deliveryType === "RENTAL" ? "Indica el correo de tu cuenta; después de confirmar el pago, el administrador activa la renta por la duración que elegiste." : "Indica el correo de la cuenta del software; tras validar el pago, el administrador procesa y confirma la activación o los créditos."}</li>
          </ol>
        </div>
        <p className="mt-4 text-xs text-stone-500">
          Producto digital: una vez entregada la clave no se puede devolver, salvo los casos del{" "}
          <Link className="underline" href="/legal/descargo">descargo de responsabilidad</Link>.
        </p>
      </div>
      <div className="h-fit rounded-lg border border-stone-200 bg-white p-4">
        {isLicenseKey && stock === 0 ? (
          <p className="text-red-700">Agotado por ahora.</p>
        ) : (
          <>
            <CheckoutForm
              productId={p.id}
              productSlug={p.slug}
              productName={p.name}
              price={p.priceCop}
              maxQty={isLicenseKey ? Math.min(stock!, 5) : p.deliveryType === "CREDITS" ? 1_000_000 : 5}
              deliveryType={p.deliveryType}
              creditAmount={p.creditAmount}
              walletBalance={user?.walletBalanceCop ?? null}
              rentalOptions={p.rentalOptions}
            />
          </>
        )}
      </div>
    </div>
  );
}
