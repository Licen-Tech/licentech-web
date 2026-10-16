import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await prisma.walletTopUp.findMany({
    where: { status: "REVIEW" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      amountCop: true,
      paymentMethod: true,
      reference: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  }));
}
