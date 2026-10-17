import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const topics = await prisma.forumTopic.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      images: { select: { id: true } },
      user: { select: { name: true, email: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          images: { select: { id: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  return NextResponse.json(topics);
}
