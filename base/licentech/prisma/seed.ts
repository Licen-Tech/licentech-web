import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!, password = process.env.ADMIN_PASSWORD!;
  if (!email || password?.length < 12) throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD (12+ caracteres)");
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
}
main().finally(() => prisma.$disconnect());
