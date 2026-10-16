import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { status: "REVIEW" },
        {
          status: "PAID",
          OR: [
            { items: { some: { product: { is: { deliveryType: { not: "LICENSE_KEY" } } } } } },
            { items: { none: {} }, product: { is: { deliveryType: { not: "LICENSE_KEY" } } } },
          ],
          AND: [
            { OR: [
              { deliveryStatus: "PENDING" },
              { deliveryStatus: "COMPLETED", emailSentAt: null },
            ] },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true, version: true, deliveryType: true, creditAmount: true, deliveryDetails: true } },
      items: {
        include: {
          product: { select: { name: true, version: true, deliveryType: true, creditAmount: true, deliveryDetails: true } },
        },
      },
      paymentProof: { select: { id: true, mimeType: true, fileName: true } },
    },
  });
  return NextResponse.json(orders);
}
