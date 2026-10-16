import { z } from "zod";

export const phoneCO = z.string().regex(/^\+573\d{9}$/, "Formato: +573001234567");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(10).max(72), // bcrypt solo usa los primeros 72 bytes
  phone: phoneCO.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  vendor: z.string().trim().min(1).max(80),
  version: z.string().trim().max(40),
  description: z.string().trim().max(4000),
  priceCop: z.number().int().min(1000).max(50_000_000),
  active: z.boolean().default(true),
});

export const pseSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(5).default(1),
  bankCode: z.string().min(1).max(10),
  userType: z.union([z.literal(0), z.literal(1)]), // 0 persona natural, 1 jurídica
  idType: z.enum(["CC", "CE", "NIT", "PP"]),
  idNumber: z.string().regex(/^\d{5,15}$/),
});

export const licenseBatchSchema = z.object({
  productId: z.string().cuid(),
  keys: z.array(z.string().trim().min(5).max(200)).min(1).max(1000),
});
