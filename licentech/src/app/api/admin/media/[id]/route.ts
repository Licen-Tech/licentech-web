import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const deleted = await prisma.mediaAsset.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "No encontramos el recurso multimedia." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
