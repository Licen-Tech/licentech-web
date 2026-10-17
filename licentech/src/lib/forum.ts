import { isSupportedRaster } from "@/lib/media";
import { forumReplySchema, forumTopicSchema } from "@/lib/validation";

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ForumFormError = { success: false; error: string };
type ForumTopicFormResult =
  | { success: true; content: string; title: string; images: { content: Uint8Array<ArrayBuffer>; mimeType: string }[] }
  | ForumFormError;
type ForumReplyFormResult =
  | { success: true; content: string; images: { content: Uint8Array<ArrayBuffer>; mimeType: string }[] }
  | ForumFormError;

export async function parseForumForm(req: Request, includeTitle: true): Promise<ForumTopicFormResult>;
export async function parseForumForm(req: Request, includeTitle?: false): Promise<ForumReplyFormResult>;
export async function parseForumForm(req: Request, includeTitle = false): Promise<ForumTopicFormResult | ForumReplyFormResult> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { success: false, error: "No pudimos leer el formulario." };
  }

  const rawTitle = form.get("title");
  const rawContent = form.get("content");
  if (typeof rawContent !== "string" || (includeTitle && typeof rawTitle !== "string")) {
    return { success: false, error: "Completa los campos obligatorios." };
  }

  const parsed = includeTitle
    ? forumTopicSchema.safeParse({ title: rawTitle, content: rawContent })
    : forumReplySchema.safeParse({ content: rawContent });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Revisa el contenido." };

  const files = form.getAll("images");
  if (files.some((file) => !(file instanceof File))) {
    return { success: false, error: "Uno de los archivos adjuntos no es válido." };
  }
  const images = files.filter((file): file is File => file instanceof File).filter((file) => file.size > 0 || file.name);
  if (images.length > MAX_IMAGE_COUNT) {
    return { success: false, error: "Puedes adjuntar máximo 10 imágenes por mensaje." };
  }
  if (images.some((image) => !supportedTypes.has(image.type))) {
    return { success: false, error: "Adjunta imágenes JPG, PNG o WEBP." };
  }
  if (images.some((image) => image.size > MAX_IMAGE_SIZE)
    || images.reduce((total, image) => total + image.size, 0) > MAX_TOTAL_IMAGE_SIZE) {
    return { success: false, error: "Las imágenes pueden pesar máximo 4 MB en total (4 MB cada una como límite)." };
  }

  const uploads: { content: Uint8Array<ArrayBuffer>; mimeType: string }[] = [];
  for (const image of images) {
    const content = new Uint8Array(await image.arrayBuffer());
    if (!isSupportedRaster(Buffer.from(content), image.type)) {
      return { success: false, error: "Uno de los archivos no coincide con el formato de imagen declarado." };
    }
    uploads.push({ content, mimeType: image.type });
  }
  return {
    success: true,
    ...parsed.data,
    images: uploads,
  };
}
