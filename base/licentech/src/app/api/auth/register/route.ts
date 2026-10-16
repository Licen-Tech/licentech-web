import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { name, email, password, phone } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash: await hashPassword(password) },
      select: { id: true, role: true },
    });
    await createSession(user);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "Correo o celular ya registrado" }, { status: 409 });
    throw e;
  }
}
