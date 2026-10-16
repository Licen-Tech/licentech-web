"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recarga los datos cada 5 s mientras se espera la confirmación del pago
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
