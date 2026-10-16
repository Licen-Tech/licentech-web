import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteBannerSchema } from "@/lib/validation";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await prisma.siteBanner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { media: { select: { id: true, name: true, externalUrl: true } } },
  }));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = siteBannerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.mediaId && !(await prisma.mediaAsset.findUnique({ where: { id: parsed.data.mediaId }, select: { id: true } }))) {
    return NextResponse.json({ error: "La imagen seleccionada no existe." }, { status: 400 });
  }
  return NextResponse.json(await prisma.siteBanner.create({ data: parsed.data }), { status: 201 });
}
