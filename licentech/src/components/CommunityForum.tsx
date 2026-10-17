"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import LinkifiedText from "@/components/LinkifiedText";

type ForumReply = {
  id: string;
  content: string;
  createdAt: string;
  images: { id: string }[];
  name: string;
};

type ForumTopic = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  images: { id: string }[];
  name: string;
  replyCount: number;
  hasMoreReplies: boolean;
  replies: ForumReply[];
};

type ForumData = {
  topics: ForumTopic[];
  currentUser: { name: string } | null;
  hasMoreTopics: boolean;
};

const field = "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const imageInput = "block w-full text-sm text-stone-600 file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm";

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function SharedImages({ images, alt }: { images: { id: string }[]; alt: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((image, index) => (
        <Image
          key={image.id}
          src={`/api/forum/images/${image.id}`}
          alt={`${alt} (${index + 1})`}
          width={480}
          height={320}
          unoptimized
          className="max-h-64 w-auto max-w-full rounded-lg border border-stone-200 object-contain"
        />
      ))}
    </div>
  );
}

export default function CommunityForum() {
  const [data, setData] = useState<ForumData>({ topics: [], currentUser: null, hasMoreTopics: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replyingTo, setReplyingTo] = useState("");
  const [loadingReplies, setLoadingReplies] = useState("");
  const [message, setMessage] = useState("");

  async function load(page = 1, append = false) {
    const response = await fetch(`/api/forum?page=${page}`);
    if (!response.ok) throw new Error("No se pudo cargar el foro.");
    const result: ForumData = await response.json();
    setData((current) => ({
      ...result,
      topics: append ? [...current.topics, ...result.topics] : result.topics,
    }));
  }

  useEffect(() => {
    load()
      .catch((error) => {
        console.error("No se pudo cargar el foro", error);
        setMessage("No pudimos cargar el foro en este momento.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function submitForm(event: FormEvent<HTMLFormElement>, topicId?: string) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch(topicId ? `/api/forum/${topicId}/replies` : "/api/forum", {
        method: "POST",
        body: new FormData(form),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "No se pudo publicar el mensaje.";
        setMessage(error);
        return;
      }
      form.reset();
      setReplyingTo("");
      if (topicId) {
        try {
          const refreshed = await fetch(`/api/forum/${topicId}/replies`);
          if (!refreshed.ok) throw new Error("No se pudieron actualizar las respuestas.");
          const result: { replies: ForumReply[]; hasMore: boolean } = await refreshed.json();
          setData((current) => ({
            ...current,
            topics: current.topics.map((topic) => topic.id === topicId
              ? { ...topic, replies: result.replies, replyCount: topic.replyCount + 1, hasMoreReplies: result.hasMore }
              : topic),
          }));
        } catch (error) {
          console.error("La respuesta se publicó pero no se pudo actualizar el foro", error);
          setMessage("Tu respuesta se publicó; recarga la página para verla.");
          return;
        }
      } else {
        await load();
      }
      setMessage(topicId ? "Tu respuesta ya está publicada." : "Tu tema ya está publicado.");
    } catch (error) {
      console.error("No se pudo publicar en el foro", error);
      setMessage("No pudimos conectar para publicar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function loadEarlierReplies(topic: ForumTopic) {
    setLoadingReplies(topic.id);
    try {
      const response = await fetch(`/api/forum/${topic.id}/replies?skip=${topic.replies.length}`);
      if (!response.ok) throw new Error("No se pudieron cargar las respuestas.");
      const result: { replies: ForumReply[]; hasMore: boolean } = await response.json();
      setData((current) => ({
        ...current,
        topics: current.topics.map((item) => item.id === topic.id
          ? { ...item, replies: [...result.replies, ...item.replies], hasMoreReplies: result.hasMore }
          : item),
      }));
    } catch (error) {
      console.error("No se pudieron cargar respuestas anteriores", error);
      setMessage("No pudimos cargar las respuestas anteriores.");
    } finally {
      setLoadingReplies("");
    }
  }

  return (
    <section id="foro" className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 sm:p-7" aria-labelledby="community-forum-title">
      <div>
        <h2 id="community-forum-title" className="text-2xl font-semibold">Foro de la comunidad</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Comparte preguntas, ideas y respuestas con otros usuarios. Los temas y respuestas se publican al instante;
          puedes incluir enlaces y hasta 10 imágenes por mensaje (JPG, PNG o WEBP; máximo 4 MB en total).
          Mantén un trato respetuoso: administración puede eliminar contenido que infrinja las normas.
        </p>
      </div>

      {data.currentUser ? (
        <form className="space-y-3 rounded-lg bg-stone-50 p-4" onSubmit={(event) => void submitForm(event)}>
          <h3 className="font-medium">Inicia un tema, {data.currentUser.name}</h3>
          <label className="block space-y-1 text-sm">
            <span>Título del tema</span>
            <input className={field} name="title" minLength={3} maxLength={120} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Mensaje</span>
            <textarea className={field} name="content" rows={4} maxLength={2000} required />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Imágenes opcionales (hasta 10 JPG, PNG o WEBP; máximo 4 MB en total)</span>
            <input className={imageInput} type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple />
          </label>
          <button disabled={saving} className="rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Publicando…" : "Publicar tema"}
          </button>
        </form>
      ) : (
        <p className="rounded-lg bg-stone-50 p-4 text-sm">
          <Link href="/login" className="font-medium text-teal-800 underline">Inicia sesión</Link> para crear temas y responder.
        </p>
      )}

      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      {loading ? (
        <p className="text-sm text-stone-500">Cargando temas…</p>
      ) : data.topics.length === 0 ? (
        <p className="text-sm text-stone-500">Aún no hay temas. ¡Puedes iniciar la conversación!</p>
      ) : (
        <div className="space-y-4">
          {data.topics.map((topic) => (
            <article key={topic.id} className="space-y-4 rounded-lg border border-stone-200 p-4">
              <div>
                <h3 className="text-lg font-semibold">{topic.title}</h3>
                <p className="mt-1 text-xs text-stone-500">{topic.name} · {formatDate(topic.createdAt)}</p>
                <LinkifiedText text={topic.content} className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-700" />
                {topic.images.length > 0 && <SharedImages images={topic.images} alt={`Imagen compartida por ${topic.name}`} />}
              </div>

              {topic.replies.length > 0 && (
                <div className="space-y-3 border-l-2 border-teal-100 pl-3 sm:ml-4">
                  {topic.hasMoreReplies && (
                    <button
                      type="button"
                      disabled={loadingReplies === topic.id}
                      className="text-xs font-medium text-teal-800 underline disabled:opacity-50"
                      onClick={() => void loadEarlierReplies(topic)}
                    >
                      {loadingReplies === topic.id ? "Cargando…" : "Ver respuestas anteriores"}
                    </button>
                  )}
                  {topic.replies.map((reply) => (
                    <div key={reply.id} className="rounded bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">{reply.name} · {formatDate(reply.createdAt)}</p>
                      <LinkifiedText text={reply.content} className="mt-1 whitespace-pre-line text-sm leading-6 text-stone-700" />
                      {reply.images.length > 0 && <SharedImages images={reply.images} alt={`Imagen compartida por ${reply.name}`} />}
                    </div>
                  ))}
                </div>
              )}

              {data.currentUser && (
                replyingTo === topic.id ? (
                  <form className="space-y-2 border-t border-stone-200 pt-3" onSubmit={(event) => void submitForm(event, topic.id)}>
                    <label className="block space-y-1 text-sm">
                      <span>Tu respuesta</span>
                      <textarea className={field} name="content" rows={3} maxLength={2000} required />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span>Imágenes opcionales (hasta 10 JPG, PNG o WEBP; máximo 4 MB en total)</span>
                      <input className={imageInput} type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple />
                    </label>
                    <div className="flex gap-2">
                      <button disabled={saving} className="rounded bg-teal-800 px-3 py-2 text-sm text-white disabled:opacity-50">
                        {saving ? "Enviando…" : "Responder"}
                      </button>
                      <button type="button" className="rounded border border-stone-300 px-3 py-2 text-sm" onClick={() => setReplyingTo("")}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="text-sm font-medium text-teal-800 underline" onClick={() => setReplyingTo(topic.id)}>
                    Responder
                  </button>
                )
              )}
            </article>
          ))}
        </div>
      )}
      {!loading && data.hasMoreTopics && (
        <button
          type="button"
          disabled={loading}
          className="rounded border border-teal-800 px-4 py-2 text-sm font-medium text-teal-800"
          onClick={() => void load(Math.floor(data.topics.length / 20) + 1, true).catch((error) => {
            console.error("No se pudieron cargar más temas", error);
            setMessage("No pudimos cargar más temas.");
          })}
        >
          Cargar temas anteriores
        </button>
      )}
    </section>
  );
}
