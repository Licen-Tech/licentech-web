"use client";

import { useEffect, useState } from "react";

type Faq = { id: string; question: string; answer: string };

export default function SupportWidget({ whatsapp, email, telegram }: { whatsapp: string; email: string; telegram: string }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, necesito ayuda con LicenTech.")}`
    : null;
  const telegramUrl = telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : null;

  useEffect(() => {
    fetch("/api/faqs")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las preguntas frecuentes.");
        setFaqs(await response.json());
      })
      .catch((error) => console.error("No se pudieron cargar las preguntas frecuentes", error));
  }, []);

  return (
    <aside className="fixed bottom-4 right-4 z-50">
      {open && (
        <section className="mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-stone-200 bg-white p-4 shadow-xl" aria-label="Asistente de atención al cliente">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Asistente LicenTech</h2>
              <p className="mt-1 text-xs text-stone-600">Elige una pregunta frecuente o comunícate con atención al cliente.</p>
            </div>
            <button type="button" className="rounded px-2 py-1 text-stone-600 hover:bg-stone-100" aria-label="Cerrar asistente" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="mt-3 space-y-2">
            {faqs.length === 0 && <p className="rounded bg-stone-50 p-3 text-sm text-stone-600">No hay preguntas frecuentes publicadas todavía. Escríbenos para que podamos ayudarte.</p>}
            {faqs.map((item) => (
              <div key={item.id}>
                <button
                  type="button"
                  className="w-full rounded border border-stone-200 px-3 py-2 text-left text-sm hover:border-teal-700"
                  aria-expanded={answer === item.id}
                  onClick={() => setAnswer(answer === item.id ? null : item.id)}
                >
                  {item.question}
                </button>
                {answer === item.id && <p className="px-3 py-2 text-sm leading-5 text-stone-700">{item.answer}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {whatsappUrl ? (
              <a className="rounded bg-green-700 px-2 py-2 text-center text-xs font-medium text-white" href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
            ) : (
              <span className="rounded bg-stone-100 px-2 py-2 text-center text-xs text-stone-500">WhatsApp</span>
            )}
            {telegramUrl
              ? <a className="rounded bg-sky-700 px-2 py-2 text-center text-xs font-medium text-white" href={telegramUrl} target="_blank" rel="noreferrer">Telegram</a>
              : <span className="rounded bg-stone-100 px-2 py-2 text-center text-xs text-stone-500">Telegram</span>}
            <a className="rounded bg-teal-800 px-2 py-2 text-center text-xs font-medium text-white" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Consulta de atención al cliente - LicenTech")}`}>
              Correo
            </a>
          </div>
          <p className="mt-2 break-all text-center text-xs text-stone-500">{email}</p>
        </section>
      )}
      <button
        type="button"
        className="ml-auto block rounded-full bg-teal-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-teal-800"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Cerrar ayuda" : "¿Necesitas ayuda?"}
      </button>
    </aside>
  );
}
