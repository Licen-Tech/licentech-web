"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MIN_CREDIT_QUANTITY } from "@/lib/checkout-pricing";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceCop: number;
  deliveryType: "LICENSE_KEY" | "ACCOUNT_ACTIVATION" | "CREDITS" | "RENTAL";
  creditAmount: number | null;
  quantity: number;
  maxQty: number;
  available: boolean;
  activationEmail?: string;
  rentalOptionId?: string;
  rentalOptions: Array<{ id: string; quantity: number; unit: "HOUR" | "MONTH"; priceCop: number }>;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  updateItem: (productId: string, changes: Partial<Pick<CartItem, "quantity" | "activationEmail" | "rentalOptionId">>) => void;
  removeItem: (productId: string) => void;
  syncItems: (updates: Array<Pick<CartItem, "productId" | "slug" | "name" | "priceCop" | "deliveryType" | "creditAmount" | "maxQty" | "available" | "rentalOptions">>) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "licentech-cart";
const deliveryTypes = new Set(["LICENSE_KEY", "ACCOUNT_ACTIVATION", "CREDITS", "RENTAL"]);

function parseCartItem(value: unknown): CartItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const isCreditProduct = item.deliveryType === "CREDITS";
  if (!(typeof item.productId === "string"
    && typeof item.slug === "string"
    && typeof item.name === "string"
    && Number.isInteger(item.priceCop) && Number(item.priceCop) >= 0
    && typeof item.deliveryType === "string" && deliveryTypes.has(item.deliveryType)
    && (item.creditAmount === null || Number.isInteger(item.creditAmount))
    && Number.isInteger(item.quantity) && Number(item.quantity) >= 1 && Number(item.quantity) <= (isCreditProduct ? 1_000_000 : 5)
    && Number.isInteger(item.maxQty) && Number(item.maxQty) >= 0 && Number(item.maxQty) <= (isCreditProduct ? 1_000_000 : 5)
    && (item.available === undefined || typeof item.available === "boolean")
    && (item.activationEmail === undefined || typeof item.activationEmail === "string")
    && (item.rentalOptionId === undefined || typeof item.rentalOptionId === "string")
    && (item.rentalOptions === undefined || Array.isArray(item.rentalOptions))
    && (item.deliveryType !== "RENTAL" || typeof item.rentalOptionId === "string"))) return null;
  return {
    ...item,
    quantity: Number(item.quantity),
    available: item.available === undefined ? true : item.available,
    rentalOptions: Array.isArray(item.rentalOptions) ? item.rentalOptions : [],
  } as CartItem;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setItems(parsed.map(parseCartItem).filter((item): item is CartItem => item !== null));
      }
    } catch (error) {
      console.error("No se pudo recuperar el carrito guardado", error);
      try {
        localStorage.removeItem(storageKey);
      } catch (storageError) {
        console.error("No se pudo limpiar el carrito guardado", storageError);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (error) {
      console.error("No se pudo guardar el carrito", error);
    }
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    ready,
    addItem: (item) => setItems((current) => {
      const existing = current.find((line) => line.productId === item.productId);
      if (existing) {
        const changedRentalOption = item.deliveryType === "RENTAL"
          && existing.rentalOptionId !== item.rentalOptionId;
        return current.map((line) => line.productId === item.productId
          ? {
            ...item,
            quantity: item.available
              ? Math.max(item.deliveryType === "CREDITS" ? MIN_CREDIT_QUANTITY : 1, Math.min(changedRentalOption ? item.quantity ?? 1 : line.quantity + (item.quantity ?? 1), item.maxQty))
              : line.quantity,
            activationEmail: line.activationEmail,
          }
          : line);
      }
      return [...current, {
        ...item,
        quantity: Math.max(item.deliveryType === "CREDITS" ? MIN_CREDIT_QUANTITY : 1, item.quantity ?? 1),
      }];
    }),
    updateItem: (productId, changes) => setItems((current) => current.map((line) => line.productId === productId
      ? {
        ...line,
        ...changes,
        ...(changes.rentalOptionId ? {
          priceCop: line.rentalOptions.find((option) => option.id === changes.rentalOptionId)?.priceCop ?? line.priceCop,
        } : {}),
        ...(changes.quantity !== undefined ? {
          quantity: Math.max(1, Math.min(Math.max(line.maxQty, 1), changes.quantity)),
        } : {}),
      }
      : line)),
    removeItem: (productId) => setItems((current) => current.filter((line) => line.productId !== productId)),
    syncItems: (updates) => setItems((current) => {
      const byId = new Map(updates.map((item) => [item.productId, item]));
      return current.flatMap((line) => {
        const refreshed = byId.get(line.productId);
        if (!refreshed) return [];
        return [{
          ...line,
          ...refreshed,
          ...(line.deliveryType === "RENTAL" ? {
            priceCop: refreshed.rentalOptions.find((option) => option.id === line.rentalOptionId)?.priceCop ?? line.priceCop,
            available: refreshed.rentalOptions.some((option) => option.id === line.rentalOptionId),
          } : {}),
          quantity: refreshed.available
            ? Math.max(1, Math.min(line.quantity, refreshed.maxQty))
            : line.quantity,
        }];
      });
    }),
    clearCart: () => setItems([]),
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider.");
  return context;
}

export function CartLink() {
  const { items, ready } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Link href="/carrito" aria-label={`Carrito${ready ? `, ${count} productos` : ""}`} className="inline-flex items-center gap-1">
      <span aria-hidden="true">🛒</span>
      <span className="hidden sm:inline">Carrito</span>
      {ready && count > 0 && <span className="rounded-full bg-teal-800 px-1.5 py-0.5 text-xs text-white">{count}</span>}
    </Link>
  );
}

export function AddToCartButton({ item }: { item: Omit<CartItem, "quantity"> }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="mt-3 w-full rounded border border-teal-800 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50"
      disabled={!item.available}
      onClick={() => {
        addItem(item);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
      }}
    >
      {!item.available ? "Agotado" : added ? "Agregado al carrito" : "Agregar al carrito"}
    </button>
  );
}
