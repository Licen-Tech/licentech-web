import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function validImage(content: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mimeType === "image/png") return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return content.toString("ascii", 0, 4) === "RIFF"
    && content.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer la imagen." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) return NextResponse.json({ error: "Selecciona una imagen." }, { status: 400 });
  if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "La imagen debe pesar máximo 5 MB." }, { status: 400 });
  }

  const content = Buffer.from(await image.arrayBuffer());
  if (!validImage(content, image.type)) {
    return NextResponse.json({ error: "Usa una imagen JPG, PNG o WEBP válida." }, { status: 400 });
  }
  if (!(await prisma.product.findUnique({ where: { id: params.id }, select: { id: true } }))) {
    return NextResponse.json({ error: "No encontramos el producto." }, { status: 404 });
  }

  await prisma.productImage.upsert({
    where: { productId: params.id },
    create: { productId: params.id, content, mimeType: image.type },
    update: { content, mimeType: image.type, createdAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await prisma.productImage.deleteMany({ where: { productId: params.id } });
  return NextResponse.json({ ok: true });
}
