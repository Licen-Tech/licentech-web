import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const reviews = await prisma.customerReview.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      status: true,
      user: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json(reviews);
}
