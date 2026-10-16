import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supportFaqSchema } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = supportFaqSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const updated = await prisma.supportFaq.updateMany({ where: { id: params.id }, data: parsed.data });
  if (!updated.count) return NextResponse.json({ error: "No encontramos la pregunta." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const deleted = await prisma.supportFaq.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "No encontramos la pregunta." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
