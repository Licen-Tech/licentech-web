import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseForumForm } from "@/lib/forum";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  const page = Number(new URL(req.url).searchParams.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) {
    return NextResponse.json({ error: "La página solicitada no es válida." }, { status: 400 });
  }
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const [topics, topicCount, user] = await Promise.all([
    prisma.forumTopic.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        images: { select: { id: true } },
        user: { select: { name: true } },
        replies: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            content: true,
            createdAt: true,
            images: { select: { id: true } },
            user: { select: { name: true } },
          },
        },
        _count: { select: { replies: true } },
      },
    }),
    prisma.forumTopic.count(),
    session
      ? prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } })
      : null,
  ]);

  return NextResponse.json({
    topics: topics.map(({ user: author, replies, _count, ...topic }) => ({
      ...topic,
      name: author.name,
      replyCount: _count.replies,
      hasMoreReplies: _count.replies > replies.length,
      replies: replies.reverse().map(({ user: replyAuthor, ...reply }) => ({ ...reply, name: replyAuthor.name })),
    })),
    currentUser: user ? { name: user.name } : null,
    hasMoreTopics: topicCount > skip + topics.length,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sesión para publicar en el foro." }, { status: 401 });

  const parsed = await parseForumForm(req, true);
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "La sesión no es válida. Vuelve a iniciar sesión." }, { status: 401 });

  const topic = await prisma.forumTopic.create({
    data: {
      title: parsed.title,
      content: parsed.content,
      userId: user.id,
      images: { create: parsed.images },
    },
    select: { id: true },
  });
  return NextResponse.json(topic, { status: 201 });
}
