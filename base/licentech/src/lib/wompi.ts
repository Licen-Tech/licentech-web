import { createHash, timingSafeEqual } from "crypto";

const API = process.env.WOMPI_API_URL!;
const PUB = process.env.WOMPI_PUBLIC_KEY!;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function wompi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${PUB}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Wompi ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json.data as T;
}

export const getPseBanks = () =>
  wompi<{ financial_institution_code: string; financial_institution_name: string }[]>("/pse/financial_institutions");

export const getTransaction = (id: string) =>
  wompi<{
    id: string; status: string; reference: string; amount_in_cents: number; currency: string;
    payment_method_type: string; payment_method?: { extra?: { async_payment_url?: string } };
  }>(`/transactions/${id}`);

async function getAcceptanceToken() {
  const m = await wompi<{ presigned_acceptance: { acceptance_token: string } }>(`/merchants/${PUB}`);
  return m.presigned_acceptance.acceptance_token;
}

// Firma de integridad: SHA256(referencia + monto en centavos + moneda + secreto de integridad)
const integritySignature = (reference: string, cents: number) =>
  sha(`${reference}${cents}COP${process.env.WOMPI_INTEGRITY_SECRET}`);

export async function createPseTransaction(p: {
  reference: string; amountCop: number; email: string; userType: 0 | 1;
  idType: string; idNumber: string; bankCode: string; description: string;
}) {
  const cents = p.amountCop * 100;
  const tx = await wompi<{ id: string }>("/transactions", {
    method: "POST",
    body: JSON.stringify({
      acceptance_token: await getAcceptanceToken(),
      amount_in_cents: cents,
      currency: "COP",
      customer_email: p.email,
      reference: p.reference,
      signature: integritySignature(p.reference, cents),
      redirect_url: `${process.env.APP_URL}/mis-compras?ref=${p.reference}`,
      payment_method: {
        type: "PSE",
        user_type: p.userType,
        user_legal_id_type: p.idType,
        user_legal_id: p.idNumber,
        financial_institution_code: p.bankCode,
        payment_description: p.description.slice(0, 64),
      },
    }),
  });

  // PSE es asíncrono: la URL del banco aparece unos segundos después
  for (let i = 0; i < 8; i++) {
    const t = await getTransaction(tx.id);
    const url = t.payment_method?.extra?.async_payment_url;
    if (url) return { id: tx.id, url };
    if (t.status !== "PENDING") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Wompi no devolvió la URL de PSE");
}

// Valida el checksum del evento: SHA256(valores de signature.properties + timestamp + secreto de eventos)
export function verifyEvent(event: any): boolean {
  const props: unknown = event?.signature?.properties;
  const checksum: unknown = event?.signature?.checksum;
  if (!Array.isArray(props) || typeof checksum !== "string" || !event.timestamp) return false;
  const values = props.map((path: string) => path.split(".").reduce((o: any, k) => o?.[k], event.data));
  const expected = Buffer.from(sha(values.join("") + event.timestamp + process.env.WOMPI_EVENTS_SECRET));
  const received = Buffer.from(checksum.toLowerCase());
  return expected.length === received.length && timingSafeEqual(expected, received);
}
