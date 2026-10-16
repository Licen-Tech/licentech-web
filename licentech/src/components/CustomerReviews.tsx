"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  updatedAt: string;
};

type ReviewData = {
  reviews: Review[];
  currentUser: {
    name: string;
    review: { rating: number; comment: string; status: "PENDING" | "APPROVED" } | null;
  } | null;
};

const field = "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";

export default function CustomerReviews() {
  const [data, setData] = useState<ReviewData>({ reviews: [], currentUser: null });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/reviews");
    if (!response.ok) throw new Error("No se pudieron cargar los comentarios.");
    const result: ReviewData = await response.json();
    setData(result);
    if (result.currentUser?.review) {
      setRating(result.currentUser.review.rating);
      setComment(result.currentUser.review.comment);
    }
  }

  useEffect(() => {
    load()
      .catch((error) => {
        console.error("No se pudieron cargar los comentarios", error);
        setMessage("No pudimos cargar los comentarios en este momento.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "No se pudo guardar tu comentario.";
        setMessage(error);
        return;
      }
      setMessage("Gracias. Tu comentario será visible cuando lo apruebe el administrador.");
      await load();
    } catch (error) {
      console.error("No se pudo guardar el comentario", error);
      setMessage("No pudimos conectar para guardar tu comentario. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="comentarios" className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 sm:p-7" aria-labelledby="customer-reviews-title">
      <div>
        <h2 id="customer-reviews-title" className="text-2xl font-semibold">Opiniones de clientes</h2>
        <p className="mt-1 text-sm text-stone-600">Los comentarios se publican después de una revisión para mantener un espacio respetuoso y útil.</p>
      </div>
      {loading ? (
        <p className="text-sm text-stone-500">Cargando opiniones…</p>
      ) : data.reviews.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.reviews.map((review) => (
            <article key={review.id} className="rounded-lg bg-stone-50 p-4">
              <p className="text-sm font-medium">{review.name} · {review.rating}/5</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-700">{review.comment}</p>
              <time className="mt-2 block text-xs text-stone-500" dateTime={review.updatedAt}>
                {new Date(review.updatedAt).toLocaleDateString("es-CO")}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-500">Todavía no hay opiniones publicadas.</p>
      )}
      {data.currentUser ? (
        <form className="space-y-3 border-t border-stone-200 pt-4" onSubmit={submit}>
          <h3 className="font-medium">Comparte tu experiencia, {data.currentUser.name}</h3>
          {data.currentUser.review?.status === "PENDING" && (
            <p className="text-sm text-amber-800">Tu comentario está pendiente de aprobación. Si lo editas, se revisará de nuevo.</p>
          )}
          <label className="block space-y-1 text-sm">
            <span>Calificación</span>
            <select className={field} value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}/5</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Comentario (10 a 1200 caracteres)</span>
            <textarea className={field} rows={4} minLength={10} maxLength={1200} required value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
          <button disabled={saving} className="rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Enviando…" : data.currentUser.review ? "Actualizar comentario" : "Enviar comentario"}
          </button>
        </form>
      ) : (
        <p className="border-t border-stone-200 pt-4 text-sm">
          <Link href="/login" className="font-medium text-teal-800 underline">Inicia sesión</Link> para compartir tu opinión.
        </p>
      )}
      {!data.currentUser && message && <p role="status" className="text-sm text-red-700">{message}</p>}
    </section>
  );
}
