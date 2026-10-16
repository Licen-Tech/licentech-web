import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tutorialSaveSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = tutorialSaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { mediaIds, downloads, ...tutorial } = parsed.data;
  if (new Set(mediaIds).size !== mediaIds.length) {
    return NextResponse.json({ error: "No repitas imágenes en la galería." }, { status: 400 });
  }
  if (mediaIds.length && await prisma.mediaAsset.count({ where: { id: { in: mediaIds } } }) !== mediaIds.length) {
    return NextResponse.json({ error: "Una imagen seleccionada ya no está disponible." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tutorial.update({ where: { id: params.id }, data: tutorial });
      await tx.tutorialMedia.deleteMany({ where: { tutorialId: params.id } });
      await tx.downloadResource.deleteMany({ where: { tutorialId: params.id } });
      if (mediaIds.length) {
        await tx.tutorialMedia.createMany({
          data: mediaIds.map((mediaId, position) => ({ tutorialId: params.id, mediaId, position })),
        });
      }
      if (downloads.length) {
        await tx.downloadResource.createMany({
          data: downloads.map((resource) => ({ ...resource, tutorialId: params.id })),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ese enlace de tutorial ya existe." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const deleted = await prisma.tutorial.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "No encontramos el tutorial." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
