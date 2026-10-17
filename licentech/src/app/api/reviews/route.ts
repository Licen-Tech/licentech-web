import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerReviewSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  const [reviews, user] = await Promise.all([
    prisma.customerReview.findMany({
      where: { status: "APPROVED" },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        rating: true,
        comment: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
    }),
    session
      ? prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, review: { select: { rating: true, comment: true, status: true } } },
      })
      : null,
  ]);

  return NextResponse.json({
    reviews: reviews.map(({ user: reviewer, ...review }) => ({ ...review, name: reviewer.name })),
    currentUser: user ? { name: user.name, review: user.review } : null,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para dejar un comentario." }, { status: 401 });

  const parsed = customerReviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });

  const review = await prisma.customerReview.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data, status: "APPROVED" },
    update: { ...parsed.data, status: "APPROVED" },
    select: { status: true },
  });
  return NextResponse.json({ status: review.status }, { status: 201 });
}
