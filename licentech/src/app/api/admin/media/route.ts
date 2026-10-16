import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSupportedRaster, sanitizeSvg } from "@/lib/media";
import { mediaAssetSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const media = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, altText: true, mimeType: true, externalUrl: true, createdAt: true },
  });
  return NextResponse.json(media);
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el recurso multimedia." }, { status: 400 });
  }

  const image = form.get("image");
  const payload = {
    name: form.get("name"),
    altText: form.get("altText") ?? "",
    externalUrl: form.get("externalUrl"),
  };
  if (!(image instanceof File)) {
    const parsed = mediaAssetSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    return NextResponse.json(await prisma.mediaAsset.create({
      data: { name: parsed.data.name, altText: parsed.data.altText, externalUrl: parsed.data.externalUrl },
      select: { id: true, name: true, altText: true, mimeType: true, externalUrl: true },
    }), { status: 201 });
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const altText = typeof payload.altText === "string" ? payload.altText.trim() : "";
  if (name.length < 2 || name.length > 120 || altText.length > 300) {
    return NextResponse.json({ error: "Revisa el nombre y el texto alternativo de la imagen." }, { status: 400 });
  }
  if (!supportedTypes.has(image.type)) {
    return NextResponse.json({ error: "Usa una imagen JPG, PNG, WEBP o SVG." }, { status: 400 });
  }
  if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "La imagen debe pesar máximo 5 MB." }, { status: 400 });
  }

  let content = Buffer.from(await image.arrayBuffer());
  if (image.type === "image/svg+xml") {
    try {
      content = sanitizeSvg(content);
    } catch {
      return NextResponse.json({ error: "El SVG no es válido o contiene elementos no permitidos." }, { status: 400 });
    }
  } else if (!isSupportedRaster(content, image.type)) {
    return NextResponse.json({ error: "El archivo no coincide con el formato de imagen declarado." }, { status: 400 });
  }
  if (content.length > MAX_IMAGE_SIZE) return NextResponse.json({ error: "La imagen optimizada supera 5 MB." }, { status: 400 });

  const media = await prisma.mediaAsset.create({
    data: { name, altText, content, mimeType: image.type },
    select: { id: true, name: true, altText: true, mimeType: true, externalUrl: true },
  });
  return NextResponse.json(media, { status: 201 });
}
