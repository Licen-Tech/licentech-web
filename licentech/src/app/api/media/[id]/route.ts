import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { content: true, mimeType: true, externalUrl: true },
  });
  if (!media) return new Response("Recurso no encontrado", { status: 404 });
  if (media.externalUrl) return Response.redirect(media.externalUrl, 302);
  if (!media.content || !media.mimeType) return new Response("Recurso no disponible", { status: 404 });

  return new Response(media.content, {
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
      ...(media.mimeType === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'none'; sandbox" } : {}),
    },
  });
}
