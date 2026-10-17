import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const image = await prisma.forumImage.findUnique({
    where: { id: params.id },
    select: { content: true, mimeType: true },
  });
  if (!image) return new Response("Imagen no encontrada", { status: 404 });

  return new Response(image.content, {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
