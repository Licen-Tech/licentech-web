import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { productPatchSchema, productSchema } from "@/lib/validation";

const forbidden = () => NextResponse.json({ error: "No autorizado" }, { status: 403 });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return forbidden();
  const parsed = productPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const current = await prisma.product.findUnique({ where: { id: params.id }, include: { rentalOptions: true } });
  if (!current) return NextResponse.json({ error: "No encontramos el producto." }, { status: 404 });
  const merged = productSchema.safeParse({ ...current, ...parsed.data });
  if (!merged.success) return NextResponse.json({ error: merged.error.flatten() }, { status: 400 });

  if (merged.data.deliveryType !== current.deliveryType && await prisma.order.count({
    where: {
      OR: [
        { productId: current.id },
        { items: { some: { productId: current.id } } },
      ],
    },
  })) {
    return NextResponse.json({ error: "No se puede cambiar el tipo de entrega de un producto con ventas históricas." }, { status: 409 });
  }
  if (merged.data.coverMediaId && !(await prisma.mediaAsset.findUnique({ where: { id: merged.data.coverMediaId }, select: { id: true } }))) {
    return NextResponse.json({ error: "La imagen seleccionada ya no está disponible." }, { status: 400 });
  }
  const { rentalOptions, ...productData } = merged.data;
  const optionsToKeep = merged.data.deliveryType === "RENTAL" ? rentalOptions : [];
  const shouldReplaceRentalOptions = parsed.data.rentalOptions !== undefined
    || (parsed.data.deliveryType !== undefined && parsed.data.deliveryType !== "RENTAL");
  const product = await prisma.$transaction(async (tx) => {
    if (shouldReplaceRentalOptions) {
      await tx.rentalOption.deleteMany({ where: { productId: params.id } });
    }
    return tx.product.update({
      where: { id: params.id },
      data: {
        ...productData,
        ...(shouldReplaceRentalOptions && optionsToKeep.length
          ? { rentalOptions: { create: optionsToKeep } }
          : {}),
      },
      include: { rentalOptions: { orderBy: [{ sortOrder: "asc" }, { quantity: "asc" }] } },
    });
  });
  return NextResponse.json(product);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return forbidden();
  // Con ventas históricas solo se archiva (no se pierde el historial de compras)
  if (await prisma.order.count({
    where: {
      OR: [
        { productId: params.id },
        { items: { some: { productId: params.id } } },
      ],
    },
  })) {
    await prisma.product.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ archived: true });
  }
  await prisma.$transaction([
    prisma.license.deleteMany({ where: { productId: params.id } }),
    prisma.product.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ deleted: true });
}
