"use client";

import { useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: "PENDING" | "APPROVED";
  user: { name: string; email: string };
};

export default function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/reviews");
    if (!response.ok) {
      setMessage("No se pudieron cargar las opiniones.");
      return;
    }
    setReviews(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function update(review: Review, action: "approve" | "delete") {
    if (action === "delete" && !window.confirm("¿Eliminar este comentario permanentemente?")) return;
    setBusy(review.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        ...(action === "approve" ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        } : {}),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "No se pudo actualizar el comentario.";
        setMessage(error);
        return;
      }
      setMessage(action === "approve" ? "Comentario publicado." : "Comentario eliminado.");
      await load();
    } catch (error) {
      console.error("No se pudo moderar el comentario", error);
      setMessage("No pudimos conectar para actualizar el comentario.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Opiniones públicas ({reviews.length})</h2>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {reviews.length === 0 ? (
        <p className="text-sm text-stone-500">Todavía no hay opiniones.</p>
      ) : reviews.map((review) => (
        <article key={review.id} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div>
            <p className="font-medium">{review.user.name} · {review.rating}/5 · {review.status === "APPROVED" ? "Publicado" : "Pendiente"}</p>
            <p className="text-xs text-stone-500">{review.user.email} · {new Date(review.createdAt).toLocaleString("es-CO")}</p>
          </div>
          <p className="whitespace-pre-line text-sm text-stone-700">{review.comment}</p>
          <div className="flex gap-3">
            {review.status === "PENDING" && (
              <button disabled={busy === review.id} className="rounded bg-teal-800 px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => void update(review, "approve")}>
                Publicar opinión
              </button>
            )}
            <button disabled={busy === review.id} className="rounded border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50" onClick={() => void update(review, "delete")}>
              Eliminar
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
