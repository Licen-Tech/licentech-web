import { prisma } from "@/lib/prisma";

export async function GET() {
  const faqs = await prisma.supportFaq.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true },
  });
  return Response.json(faqs);
}
