import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { siteBannerSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = siteBannerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.mediaId && !(await prisma.mediaAsset.findUnique({ where: { id: parsed.data.mediaId }, select: { id: true } }))) {
    return NextResponse.json({ error: "La imagen seleccionada no existe." }, { status: 400 });
  }
  const updated = await prisma.siteBanner.updateMany({ where: { id: params.id }, data: parsed.data });
  if (!updated.count) return NextResponse.json({ error: "No encontramos el banner." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const deleted = await prisma.siteBanner.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "No encontramos el banner." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
