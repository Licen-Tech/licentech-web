import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tutorialSaveSchema } from "@/lib/validation";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await prisma.tutorial.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      media: { orderBy: { position: "asc" }, include: { media: { select: { id: true, name: true } } } },
      downloads: true,
    },
  }));
}

export async function POST(req: Request) {
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
    const created = await prisma.tutorial.create({
      data: {
        ...tutorial,
        media: { create: mediaIds.map((mediaId, position) => ({ mediaId, position })) },
        downloads: { create: downloads },
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ese enlace de tutorial ya existe." }, { status: 409 });
    }
    throw error;
  }
}
