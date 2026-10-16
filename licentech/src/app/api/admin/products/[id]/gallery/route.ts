import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.mediaIds) || body.mediaIds.length > 20
    || body.mediaIds.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ error: "Selecciona hasta 20 imágenes válidas." }, { status: 400 });
  }
  const mediaIds = body.mediaIds as string[];
  if (new Set(mediaIds).size !== mediaIds.length) return NextResponse.json({ error: "No repitas imágenes en la galería." }, { status: 400 });
  const [product, mediaCount] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id }, select: { id: true } }),
    mediaIds.length ? prisma.mediaAsset.count({ where: { id: { in: mediaIds } } }) : Promise.resolve(0),
  ]);
  if (!product) return NextResponse.json({ error: "No encontramos el producto." }, { status: 404 });
  if (mediaCount !== mediaIds.length) return NextResponse.json({ error: "Una imagen seleccionada ya no está disponible." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.productGalleryItem.deleteMany({ where: { productId: params.id } });
    if (mediaIds.length) {
      await tx.productGalleryItem.createMany({
        data: mediaIds.map((mediaId, position) => ({ productId: params.id, mediaId, position })),
      });
    }
  });
  return NextResponse.json({ ok: true });
}
