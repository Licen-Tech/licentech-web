import { z } from "zod";

const httpsUrl = z.string().trim().url().refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
}, "Ingresa una URL HTTP o HTTPS válida.");
const youtubeUrlSchema = httpsUrl.refine((value) => {
  const host = new URL(value).hostname.toLowerCase();
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com");
}, "Usa un enlace válido de YouTube.");

export const phoneE164 = z.string().regex(/^\+[1-9]\d{7,14}$/, "Ingresa el teléfono internacional con código de país, por ejemplo +573001234567.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(10).max(72), // bcrypt solo usa los primeros 72 bytes
  phone: phoneE164.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

const productBaseSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(120, "El nombre no puede superar 120 caracteres."),
  slug: z.string().trim().regex(/^[a-z0-9-]*$/, "Usa solo letras minúsculas, números y guiones en el slug.").max(80, "El slug no puede superar 80 caracteres.").default(""),
  vendor: z.string().trim().max(80, "El fabricante no puede superar 80 caracteres.").default(""),
  version: z.string().trim().max(40, "La versión no puede superar 40 caracteres.").default(""),
  description: z.string().trim().max(10000, "La descripción no puede superar 10.000 caracteres.").default(""),
  youtubeUrl: youtubeUrlSchema.nullable().default(null),
  officialUrl: httpsUrl.nullable().default(null),
  category: z.string().trim().min(2).max(80).default("Software"),
  searchTerms: z.string().trim().max(500).default(""),
  priceCop: z.number().int("El precio debe ser un número entero en pesos.").min(0, "El precio no puede ser negativo.").max(50_000_000, "El precio máximo es $50.000.000 COP."),
  deliveryType: z.enum(["LICENSE_KEY", "ACCOUNT_ACTIVATION", "CREDITS", "RENTAL"]).default("LICENSE_KEY"),
  creditAmount: z.number().int().positive().max(1_000_000).nullable().default(null),
  rentalOptions: z.array(z.object({
    quantity: z.number().int().min(1).max(120),
    unit: z.enum(["HOUR", "MONTH"]),
    priceCop: z.number().int().min(1000).max(50_000_000),
    active: z.boolean().default(true),
  })).max(30).default([]),
  deliveryDetails: z.string().trim().max(2000).nullable().default(null),
  coverMediaId: z.string().cuid().nullable().default(null),
  active: z.boolean().default(true),
});

export const productSchema = productBaseSchema.superRefine((product, ctx) => {
  if (!product.slug) {
    ctx.addIssue({ code: "custom", path: ["slug"], message: "No se pudo generar un slug desde el nombre." });
  }
  if (product.active && product.deliveryType !== "RENTAL" && product.priceCop < 1000) {
    ctx.addIssue({ code: "custom", path: ["priceCop"], message: "Define un precio de al menos $1.000 COP antes de publicar el producto." });
  }
  if (product.deliveryType !== "CREDITS" && product.creditAmount !== null) {
    ctx.addIssue({ code: "custom", path: ["creditAmount"], message: "Los créditos solo aplican a productos de tipo Créditos." });
  }
  if (product.deliveryType === "RENTAL" && product.active && product.rentalOptions.filter((option) => option.active).length === 0) {
    ctx.addIssue({ code: "custom", path: ["rentalOptions"], message: "Agrega al menos una duración y su precio antes de publicar una renta." });
  }
  const rentalKeys = product.rentalOptions.map((option) => `${option.quantity}-${option.unit}`);
  if (new Set(rentalKeys).size !== rentalKeys.length) {
    ctx.addIssue({ code: "custom", path: ["rentalOptions"], message: "No repitas la misma duración de renta." });
  }
});

export const productPatchSchema = productBaseSchema.partial();

export const mediaAssetSchema = z.object({
  name: z.string().trim().min(2).max(120),
  altText: z.string().trim().max(300).default(""),
  externalUrl: httpsUrl,
});

export const siteBannerSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  linkUrl: httpsUrl.nullable().optional(),
  mediaId: z.string().cuid().nullable().optional(),
  active: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const tutorialSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(100),
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(2).max(80),
  summary: z.string().trim().max(1000).default(""),
  content: z.string().trim().min(10).max(20000),
  youtubeUrl: youtubeUrlSchema.nullable().optional(),
  vipOnly: z.boolean().default(false),
  published: z.boolean().default(false),
});

export const downloadResourceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  url: httpsUrl,
});

export const tutorialSaveSchema = tutorialSchema.extend({
  mediaIds: z.array(z.string().cuid()).max(20).default([]),
  downloads: z.array(downloadResourceSchema).max(20).default([]),
});

export const paymentMethodConfigSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_-]{2,40}$/).refine((code) => !["CARD", "WALLET"].includes(code), "Ese código está reservado por la tienda."),
  label: z.string().trim().min(2).max(100),
  instructions: z.string().trim().min(5).max(2000),
  active: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const siteSettingsSchema = z.object({
  logoMediaId: z.string().cuid().nullable().optional(),
  siteName: z.string().trim().min(2).max(100),
  heroTitle: z.string().trim().min(5).max(180),
  heroDescription: z.string().trim().max(2000),
  heroNotice: z.string().trim().max(1000),
  supportEmail: z.union([z.literal(""), z.string().trim().email().max(120)]),
  whatsappNumber: z.string().trim().regex(/^\+?\d{0,15}$/),
  telegramUsername: z.string().trim().regex(/^@?[A-Za-z0-9_]{0,32}$/),
});

const navigationHref = z.string().trim().min(1).max(300).refine((value) => {
  if (/[\u0000-\u001f\u007f]/.test(value) || value.startsWith("//")) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Usa una ruta interna (por ejemplo /#productos) o una URL HTTPS segura.");

export const navigationItemsSchema = z.array(z.object({
  label: z.string().trim().min(1).max(50),
  href: navigationHref,
  active: z.boolean(),
})).max(20).superRefine((items, ctx) => {
  const hrefs = new Set<string>();
  items.forEach((item, index) => {
    if (hrefs.has(item.href)) {
      ctx.addIssue({ code: "custom", path: [index, "href"], message: "No repitas el mismo destino en el menú." });
    }
    hrefs.add(item.href);
  });
});

export const supportFaqSchema = z.object({
  question: z.string().trim().min(5).max(200),
  answer: z.string().trim().min(5).max(1200),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});

export const walletTopUpSchema = z.object({
  amountCop: z.number().int().min(10000).max(50000000),
  paymentMethod: z.string().trim().regex(/^[A-Z0-9_-]{2,40}$/),
});

const checkoutLineSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(1_000_000).default(1),
  activationEmail: z.string().trim().toLowerCase().email().max(120).optional(),
  rentalOptionId: z.string().cuid().optional(),
});

const buyerFields = {
  buyerName: z.string().trim().min(2).max(100),
  buyerEmail: z.string().trim().toLowerCase().email().max(120),
  buyerPhone: z.string().trim().min(7).max(20),
};

export const cardCheckoutSchema = z.union([
  z.object({ productId: z.string().cuid(), quantity: z.number().int().min(1).max(1_000_000).default(1), activationEmail: z.string().trim().toLowerCase().email().max(120).optional(), rentalOptionId: z.string().cuid().optional(), ...buyerFields }),
  z.object({ items: z.array(checkoutLineSchema).min(1).max(10), ...buyerFields }),
]);

export const nequiCheckoutSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(1_000_000).default(1),
});

export const manualCheckoutSchema = z.union([
  z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(1_000_000).default(1),
    activationEmail: z.string().trim().toLowerCase().email().max(120).optional(),
    rentalOptionId: z.string().cuid().optional(),
    paymentMethod: z.string().trim().regex(/^[A-Z0-9_-]{2,40}$/),
  }),
  z.object({
    items: z.array(checkoutLineSchema).min(1).max(10),
    paymentMethod: z.string().trim().regex(/^[A-Z0-9_-]{2,40}$/),
  }),
]);

export const walletCheckoutSchema = z.union([
  z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(1_000_000).default(1),
    activationEmail: z.string().trim().toLowerCase().email().max(120).optional(),
    rentalOptionId: z.string().cuid().optional(),
  }),
  z.object({ items: z.array(checkoutLineSchema).min(1).max(10) }),
]);

export const nequiProofDetailsSchema = z.object({
  buyerName: z.string().trim().min(2).max(100),
  buyerEmail: z.string().trim().toLowerCase().email().max(120),
  buyerPhone: z.string().trim().min(7).max(20),
  activationEmail: z.string().trim().toLowerCase().email().max(120).optional(),
});

export const customerReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(1200),
});

export const forumTopicSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres.").max(120, "El título no puede superar 120 caracteres."),
  content: z.string().trim().min(1, "Escribe el mensaje del tema.").max(2000, "El mensaje no puede superar 2000 caracteres."),
});

export const forumReplySchema = z.object({
  content: z.string().trim().min(1, "Escribe una respuesta.").max(2000, "La respuesta no puede superar 2000 caracteres."),
});

export const licenseBatchSchema = z.object({
  productId: z.string().cuid(),
  keys: z.array(z.string().trim().min(5).max(200)).min(1).max(1000),
});
