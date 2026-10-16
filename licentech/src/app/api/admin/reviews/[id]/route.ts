import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || !["approve", "hide"].includes(body.action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const updated = await prisma.customerReview.updateMany({
    where: { id: params.id },
    data: { status: body.action === "approve" ? "APPROVED" : "PENDING" },
  });
  if (!updated.count) return NextResponse.json({ error: "No encontramos el comentario." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const deleted = await prisma.customerReview.deleteMany({ where: { id: params.id } });
  if (!deleted.count) return NextResponse.json({ error: "No encontramos el comentario." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
