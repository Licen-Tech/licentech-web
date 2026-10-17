import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseForumForm } from "@/lib/forum";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { topicId: string } }) {
  const skip = Number(new URL(req.url).searchParams.get("skip") ?? 0);
  if (!Number.isSafeInteger(skip) || skip < 0) {
    return NextResponse.json({ error: "La página solicitada no es válida." }, { status: 400 });
  }
  const topic = await prisma.forumTopic.findUnique({
    where: { id: params.topicId },
    select: { _count: { select: { replies: true } } },
  });
  if (!topic) return NextResponse.json({ error: "No encontramos ese tema." }, { status: 404 });

  const replies = await prisma.forumReply.findMany({
    where: { topicId: params.topicId },
    orderBy: { createdAt: "desc" },
    skip,
    take: 20,
    select: {
      id: true,
      content: true,
      createdAt: true,
      images: { select: { id: true } },
      user: { select: { name: true } },
    },
  });
  return NextResponse.json({
    replies: replies.reverse().map(({ user, ...reply }) => ({ ...reply, name: user.name })),
    hasMore: skip + replies.length < topic._count.replies,
  });
}

export async function POST(req: Request, { params }: { params: { topicId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para responder." }, { status: 401 });

  const parsed = await parseForumForm(req);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [user, topic] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }),
    prisma.forumTopic.findUnique({ where: { id: params.topicId }, select: { id: true } }),
  ]);
  if (!user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });
  if (!topic) return NextResponse.json({ error: "No encontramos ese tema." }, { status: 404 });

  const reply = await prisma.forumReply.create({
    data: {
      content: parsed.content,
      topicId: topic.id,
      userId: user.id,
      images: { create: parsed.images },
    },
    select: { id: true },
  });
  return NextResponse.json(reply, { status: 201 });
}
