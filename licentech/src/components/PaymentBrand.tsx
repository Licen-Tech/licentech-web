type PaymentBrandProps = {
  code: string;
  label: string;
};

export default function PaymentBrand({ code, label }: PaymentBrandProps) {
  const normalized = `${code} ${label}`.toLocaleLowerCase("es-CO");
  const hasNequi = normalized.includes("nequi");
  const hasBreB = normalized.includes("breb") || normalized.includes("bre-b");

  if (!hasNequi && !hasBreB) return <span>{label}</span>;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {hasNequi && (
        <span className="inline-flex items-center rounded-md bg-[#2d164d] px-2.5 py-1 text-sm font-bold tracking-tight text-white" aria-label="Nequi">
          nequi
        </span>
      )}
      {hasBreB && (
        <span className="inline-flex items-center gap-1 rounded-md bg-[#e5f7ed] px-2.5 py-1 text-sm font-bold tracking-tight text-[#08764b]" aria-label="Bre-B">
          <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-[#08764b] text-[10px] text-white">B</span>
          Bre-B
        </span>
      )}
      {!hasNequi && !hasBreB && label}
    </span>
  );
}
