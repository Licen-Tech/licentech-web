import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const product = await prisma.product.findFirst({
    where: { slug: params.slug, active: true },
    select: {
      image: { select: { content: true, mimeType: true } },
      coverMedia: { select: { content: true, mimeType: true, externalUrl: true } },
    },
  });

  if (product?.coverMedia?.externalUrl) {
    return Response.redirect(product.coverMedia.externalUrl, 302);
  }

  const image = product?.image ?? null;
  if (!image) return new Response("Imagen no encontrada", { status: 404 });
  if (!image.content || !image.mimeType) return new Response("Imagen no encontrada", { status: 404 });

  return new Response(image.content, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
      ...(image.mimeType === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'none'; sandbox" } : {}),
    },
  });
}
