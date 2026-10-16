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

  const catalog = [
    ...["3", "6", "12"].map((months) => ({
      slug: `unlocktool-${months}-meses`,
      name: `UnlockTool · ${months} meses`,
      vendor: "UnlockTool",
      version: `${months} meses`,
      searchTerms: "Samsung Xiaomi Motorola Oppo Vivo Infinix Tecno FRP Android servicio técnico",
      description: "Herramienta multimarca para diagnóstico y mantenimiento de dispositivos compatibles. Consulta los modelos y funciones soportadas por el fabricante antes de comprar.",
    })),
    {
      slug: "tsm-tool-pro",
      name: "TSM Tool PRO",
      vendor: "Turbo Service Mobile",
      version: "PRO",
      searchTerms: "Samsung Xiaomi Qualcomm MediaTek MTK Unisoc Kirin KG PayJoy MDM ADB Fastboot",
      description: "Suite de mantenimiento y diagnóstico para equipos y procesadores compatibles. Consulta con el proveedor los modelos, licencias y operaciones permitidas.",
    },
    {
      slug: "pandora-tool",
      name: "Pandora Tool",
      vendor: "Z3X",
      version: "Licencia digital",
      searchTerms: "MediaTek MTK Unisoc memoria dump NV data firmware reparación",
      description: "Plataforma de servicio técnico enfocada en dispositivos con procesadores compatibles. Verifica con el fabricante las funciones disponibles para cada modelo.",
    },
    {
      slug: "chimera-tool-pro",
      name: "Chimera Tool PRO",
      vendor: "Chimera",
      version: "PRO",
      searchTerms: "Samsung multimarca diagnóstico operador firmware red",
      description: "Plataforma de diagnóstico y mantenimiento para dispositivos compatibles. Las opciones disponibles dependen del fabricante, el modelo y las autorizaciones aplicables.",
    },
  ];

  for (const product of catalog) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        ...product,
        category: "Software GSM",
        priceCop: 0,
        deliveryType: "ACCOUNT_ACTIVATION",
        deliveryDetails: "Borrador oculto. Configura el precio y verifica la disponibilidad con el proveedor antes de publicar. La activación se gestiona para una cuenta.",
        active: false,
      },
      update: {},
    });
  }

  for (const method of [
    {
      code: "NEQUI",
      label: "Nequi / Bre-B",
      instructions: process.env.NEQUI_DESTINATION
        ? `Transfiere el total al número o llave configurados: ${process.env.NEQUI_DESTINATION}.`
        : "Configura el destino Nequi o llave Bre-B antes de habilitar este método.",
      sortOrder: 0,
      active: Boolean(process.env.NEQUI_DESTINATION),
    },
    { code: "BINANCE", label: "Binance Pay / transferencia", instructions: "Configura aquí las instrucciones de pago de Binance.", sortOrder: 10 },
    { code: "AIRTM", label: "Airtm", instructions: "Configura aquí el usuario o las instrucciones de pago de Airtm.", sortOrder: 20 },
    { code: "LOCAL_TRANSFER", label: "Transferencia local", instructions: "Configura aquí el banco, titular y datos para transferencias locales.", sortOrder: 30 },
  ]) {
    await prisma.paymentMethodConfig.upsert({
      where: { code: method.code },
      create: { ...method, active: "active" in method ? method.active : false },
      update: {},
    });
  }
  await prisma.siteSettings.upsert({
    where: { id: "main" },
    create: {
      id: "main",
      supportEmail: "brianxxp082@gmail.com",
      heroDescription: "Catálogo digital de software y servicios técnicos para dispositivos móviles.",
      heroNotice: "Compra con seguridad: verificamos los pagos antes de procesar la entrega.",
    },
    update: {},
  });
}
main().finally(() => prisma.$disconnect());
