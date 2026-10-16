import { cop } from "@/lib/format";
import { checkoutPrice } from "@/lib/checkout-pricing";

export default function CheckoutPrice({ subtotalCop, className = "" }: { subtotalCop: number; className?: string }) {
  const { feeCop, totalCop } = checkoutPrice(subtotalCop);
  return (
    <div className={className}>
      <p className="text-sm text-stone-600">{cop.format(subtotalCop)} + cargos incluidos de conversión y pago: {cop.format(feeCop)}</p>
      <p className="text-lg font-semibold">Total a pagar: {cop.format(totalCop)}</p>
    </div>
  );
}
