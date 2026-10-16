import { prisma } from "@/lib/prisma";
import { checkoutPrice, MIN_CREDIT_QUANTITY } from "@/lib/checkout-pricing";

export type CheckoutLine = { productId: string; quantity: number; activationEmail?: string; rentalOptionId?: string };
export type CheckoutProduct = Awaited<ReturnType<typeof prisma.product.findMany>>[number] & {
  rentalOptions: Array<{ id: string; quantity: number; unit: "HOUR" | "MONTH"; priceCop: number }>;
};
export type ResolvedCheckoutLine = CheckoutLine & {
  product: CheckoutProduct;
  unitPriceCop: number;
  rentalDuration: number | null;
  rentalUnit: "HOUR" | "MONTH" | null;
};

export function normalizeCheckoutItems(data: {
  items?: CheckoutLine[];
  productId?: string;
  quantity?: number;
  activationEmail?: string;
  rentalOptionId?: string;
}): CheckoutLine[] {
  if (data.items) return data.items;
  if (!data.productId) return [];
  return [{
    productId: data.productId,
    quantity: data.quantity ?? 1,
    ...(data.activationEmail ? { activationEmail: data.activationEmail } : {}),
    ...(data.rentalOptionId ? { rentalOptionId: data.rentalOptionId } : {}),
  }];
}

export async function resolveCheckoutItems(lines: CheckoutLine[]) {
  const ids = Array.from(new Set(lines.map((line) => line.productId)));
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { rentalOptions: { where: { active: true } } },
  });
  if (products.length !== ids.length) return { lines: null, error: "Uno o más productos ya no están disponibles." } as const;
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved = lines.map((line) => {
    const product = byId.get(line.productId)!;
    const rentalOption = line.rentalOptionId
      ? product.rentalOptions.find((option) => option.id === line.rentalOptionId)
      : undefined;
    return {
      ...line,
      product,
      unitPriceCop: rentalOption?.priceCop ?? product.priceCop,
      rentalDuration: rentalOption?.quantity ?? null,
      rentalUnit: rentalOption?.unit ?? null,
      hasRentalOption: Boolean(rentalOption),
    };
  });
  if (resolved.some(({ product, hasRentalOption, unitPriceCop }) => product.deliveryType === "RENTAL"
    ? !hasRentalOption || unitPriceCop < 1000
    : unitPriceCop < 1000)) {
    return { lines: null, error: "Selecciona una duración de renta vigente o configura un precio válido." } as const;
  }
  if (resolved.some(({ product, rentalOptionId }) => product.deliveryType !== "RENTAL" && rentalOptionId)) {
    return { lines: null, error: "La opción de renta no corresponde a este producto." } as const;
  }
  if (resolved.some(({ product, quantity }) => product.deliveryType !== "CREDITS" && quantity > 5)) {
    return { lines: null, error: "La cantidad máxima para este servicio es 5." } as const;
  }
  if (resolved.some(({ product, quantity }) => product.deliveryType === "CREDITS" && quantity < MIN_CREDIT_QUANTITY)) {
    return { lines: null, error: `La compra mínima de créditos es de ${MIN_CREDIT_QUANTITY} créditos.` } as const;
  }
  if (resolved.some(({ product }) => product.priceCop < 1000 && product.deliveryType !== "RENTAL")) {
    return { lines: null, error: "Uno o más productos aún no tienen precio configurado." } as const;
  }
  const subtotalCop = resolved.reduce((sum, line) => sum + line.unitPriceCop * line.quantity, 0);
  if (checkoutPrice(subtotalCop).totalCop > 2_000_000_000) {
    return { lines: null, error: "El total supera el límite permitido para una compra." } as const;
  }
  if (resolved.some(({ product, activationEmail }) => product.deliveryType !== "LICENSE_KEY" && !activationEmail)) {
    return { lines: null, error: "Indica el correo de la cuenta del software para cada activación o paquete de créditos." } as const;
  }

  const quantities = new Map<string, number>();
  for (const line of resolved) {
    if (line.product.deliveryType === "LICENSE_KEY" || line.product.deliveryType === "RENTAL") {
      if (line.product.deliveryType === "RENTAL") continue;
      quantities.set(line.product.id, (quantities.get(line.product.id) ?? 0) + line.quantity);
    }
  }
  for (const [productId, quantity] of Array.from(quantities.entries())) {
    const stock = await prisma.license.count({ where: { productId, status: "AVAILABLE" } });
    if (stock < quantity) return { lines: null, error: `Stock insuficiente para ${byId.get(productId)?.name}.` } as const;
  }
  return { lines: resolved as ResolvedCheckoutLine[], error: null } as const;
}
