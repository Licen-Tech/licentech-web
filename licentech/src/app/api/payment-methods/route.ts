import { prisma } from "@/lib/prisma";

export async function GET() {
  const configured = await prisma.paymentMethodConfig.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { code: true, label: true, instructions: true },
  });
  const nequiDestination = process.env.NEQUI_DESTINATION?.trim();
  const brebKey = process.env.BREB_KEY?.trim();
  const methods = configured.filter((method) => !["NEQUI", "BREB"].includes(method.code)).concat(configured.flatMap((method) => {
    if (method.code === "NEQUI") {
      return [{
        ...method,
        label: "Nequi",
        instructions: nequiDestination
          ? `Transfiere el total al número Nequi: ${nequiDestination}.`
          : method.instructions,
      }];
    }
    if (method.code === "BREB") {
      return [{
        ...method,
        label: "Bre-B",
        instructions: brebKey ? `Transfiere el total a la llave Bre-B: ${brebKey}.` : method.instructions,
      }];
    }
    return [method];
  }));
  if (nequiDestination && !configured.some((method) => method.code === "NEQUI")) {
    methods.push({
      code: "NEQUI",
      label: "Nequi",
      instructions: `Transfiere el total al número Nequi: ${nequiDestination}.`,
    });
  }
  if (brebKey && !configured.some((method) => method.code === "BREB")) {
    methods.push({
      code: "BREB",
      label: "Bre-B",
      instructions: `Transfiere el total a la llave Bre-B: ${brebKey}.`,
    });
  }
  return Response.json(methods);
}
