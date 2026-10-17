import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { navigationItemsSchema } from "@/lib/validation";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(await prisma.navigationItem.findMany({ orderBy: { sortOrder: "asc" } }));
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = navigationItemsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const items = await prisma.$transaction(async (tx) => {
    await tx.navigationItem.deleteMany();
    for (const [sortOrder, item] of parsed.data.entries()) {
      await tx.navigationItem.create({ data: { ...item, sortOrder } });
    }
    return tx.navigationItem.findMany({ orderBy: { sortOrder: "asc" } });
  });
  return NextResponse.json(items);
}
