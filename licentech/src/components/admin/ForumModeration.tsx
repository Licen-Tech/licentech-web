"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import LinkifiedText from "@/components/LinkifiedText";

type ForumReply = {
  id: string;
  content: string;
  createdAt: string;
  images: { id: string }[];
  user: { name: string; email: string };
};

type ForumTopic = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  images: { id: string }[];
  user: { name: string; email: string };
  replies: ForumReply[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota" });
}

function ImagePreviews({ images, alt }: { images: { id: string }[]; alt: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((image, index) => (
        <Image
          key={image.id}
          src={`/api/forum/images/${image.id}`}
          alt={`${alt} (${index + 1})`}
          width={480}
          height={320}
          unoptimized
          className="mt-2 max-h-56 w-auto max-w-full rounded border border-stone-200 object-contain"
        />
      ))}
    </div>
  );
}

export default function ForumModeration() {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/admin/forum");
    if (!response.ok) {
      setMessage("No se pudo cargar el contenido del foro.");
      return;
    }
    setTopics(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function remove(kind: "topics" | "replies", id: string, label: string) {
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    setBusy(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/forum/${kind}/${id}`, { method: "DELETE" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "No se pudo eliminar el contenido.";
        setMessage(error);
        return;
      }
      setMessage(`${label === "el tema" ? "Tema" : "Respuesta"} eliminado.`);
      await load();
    } catch (error) {
      console.error("No se pudo eliminar contenido del foro", error);
      setMessage("No pudimos conectar para eliminar el contenido.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Moderación del foro ({topics.length} temas)</h2>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {topics.length === 0 ? (
        <p className="text-sm text-stone-500">No hay temas en el foro.</p>
      ) : topics.map((topic) => (
        <article key={topic.id} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{topic.title}</h3>
              <p className="text-xs text-stone-500">{topic.user.name} ({topic.user.email}) · {formatDate(topic.createdAt)}</p>
            </div>
            <button
              disabled={busy === topic.id}
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-50"
              onClick={() => void remove("topics", topic.id, "el tema")}
            >
              Eliminar tema
            </button>
          </div>
          <LinkifiedText text={topic.content} className="whitespace-pre-line text-sm text-stone-700" />
          {topic.images.length > 0 && <ImagePreviews images={topic.images} alt={`Imagen del tema ${topic.title}`} />}
          {topic.replies.map((reply) => (
            <div key={reply.id} className="ml-3 space-y-2 border-l-2 border-stone-200 pl-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-stone-500">{reply.user.name} ({reply.user.email}) · {formatDate(reply.createdAt)}</p>
                <button
                  disabled={busy === reply.id}
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-800 disabled:opacity-50"
                  onClick={() => void remove("replies", reply.id, "la respuesta")}
                >
                  Eliminar respuesta
                </button>
              </div>
              <LinkifiedText text={reply.content} className="whitespace-pre-line text-sm text-stone-700" />
              {reply.images.length > 0 && <ImagePreviews images={reply.images} alt={`Imagen compartida por ${reply.user.name}`} />}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
