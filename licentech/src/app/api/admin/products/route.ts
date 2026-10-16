import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { productSchema } from "@/lib/validation";

const forbidden = () => NextResponse.json({ error: "No autorizado" }, { status: 403 });

export async function GET() {
  if (!(await requireAdmin())) return forbidden();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { licenses: { where: { status: "AVAILABLE" } } } },
      image: { select: { id: true } },
      coverMedia: { select: { id: true, externalUrl: true, altText: true } },
      gallery: { select: { mediaId: true } },
      rentalOptions: { orderBy: [{ sortOrder: "asc" }, { quantity: "asc" }] },
    },
  });
  return NextResponse.json(products.map(({ _count, image, coverMedia, ...p }) => ({
    ...p,
    coverMedia,
    hasImage: Boolean(image || coverMedia),
    stock: _count.licenses,
  })));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return forbidden();
  const body: unknown = await req.json().catch(() => null);
  const submitted = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const providedSlug = typeof submitted?.slug === "string" ? submitted.slug.trim() : "";
  const baseSlug = providedSlug || (typeof submitted?.name === "string" ? submitted.name : "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  let slug = baseSlug;
  for (let suffix = 2; slug; suffix++) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    const ending = `-${suffix}`;
    slug = `${baseSlug.slice(0, 80 - ending.length)}${ending}`;
  }
  const parsed = productSchema.safeParse(submitted ? { ...submitted, slug } : body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.coverMediaId && !(await prisma.mediaAsset.findUnique({ where: { id: parsed.data.coverMediaId }, select: { id: true } }))) {
    return NextResponse.json({ error: "La imagen seleccionada ya no está disponible." }, { status: 400 });
  }
  try {
    const { rentalOptions, ...productData } = parsed.data;
    return NextResponse.json(await prisma.product.create({
      data: {
        ...productData,
        ...(rentalOptions.length ? { rentalOptions: { create: rentalOptions } } : {}),
      },
      include: { rentalOptions: true },
    }), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
    }
    throw error;
  }
}
