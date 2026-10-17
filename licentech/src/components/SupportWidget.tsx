"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Faq = { id: string; question: string; answer: string; keywords?: string };
type ChatMessage = {
  id: number;
  from: "assistant" | "visitor";
  text: string;
  suggestions?: Faq[];
  contactUrl?: string;
};

const starterFaqs: Faq[] = [
  {
    id: "buy",
    question: "¿Cómo hago una compra?",
    answer: "Elige el producto y revisa su descripción, compatibilidad, precio y disponibilidad. Agrégalo al carrito, completa tus datos y selecciona tarjeta o un método manual disponible. Puedes comprar sin crear una cuenta.",
    keywords: "comprar compra comprar comprar pedido carrito pagar iniciar",
  },
  {
    id: "payments",
    question: "¿Qué métodos de pago aceptan?",
    answer: "Puedes pagar con tarjeta mediante el checkout seguro de Wompi o elegir Nequi/Bre-B en el checkout. Para transferencias, usa el número 3147179873 y carga el comprobante desde el enlace privado de tu compra.",
    keywords: "pago pagar pagos tarjeta wompi nequi bre b transferencia transferir número llave",
  },
  {
    id: "proof",
    question: "¿Cómo envío el comprobante de pago?",
    answer: "Abre el enlace privado de seguimiento de tu compra, carga el comprobante de la transferencia y envíalo para revisión. Al terminar, puedes avisarnos por WhatsApp desde esa misma página.",
    keywords: "comprobante comprobantes recibo captura imagen soporte transferencia enviar subir cargar",
  },
  {
    id: "tracking",
    question: "¿Cómo consulto el estado de mi pedido?",
    answer: "Consulta el estado en el enlace privado que aparece al registrar la compra. Si ya no lo tienes, escríbenos por WhatsApp con el correo usado en la compra y, si lo conservas, el código del pedido.",
    keywords: "pedido pedidos compra compras estado seguimiento rastrear link enlace código orden",
  },
  {
    id: "delivery",
    question: "¿Cuándo recibiré mi producto?",
    answer: "Primero verificamos el pago. Después, el estado y la entrega se actualizan en el enlace privado de seguimiento. No tenemos un plazo único para todos los productos; si tu pedido no avanza, contáctanos por WhatsApp con tu código de compra.",
    keywords: "entrega entregar recibir tiempo demora tarda demora licencia clave activación activacion",
  },
  {
    id: "compatibility",
    question: "¿Cómo verifico si un producto es compatible?",
    answer: "Revisa la descripción y los modelos compatibles en la página del producto antes de comprar. Si tienes dudas, pregúntanos por WhatsApp indicando la marca, el modelo exacto y qué necesitas hacer.",
    keywords: "compatible compatibilidad modelo modelos celular teléfono equipo dispositivo sirve funciona",
  },
  {
    id: "license",
    question: "¿Dónde recibo mi licencia o clave?",
    answer: "Cuando el pago se confirme, consulta el estado y la entrega en el enlace privado de tu compra. Las licencias se envían al correo de contacto indicado durante la compra; revisa también la carpeta de correo no deseado.",
    keywords: "licencia licencias clave claves código codigo serial recibir correo email contraseña",
  },
];

const stopWords = new Set([
  "a", "al", "ayuda", "ayudame", "con", "como", "cuando", "cuanto", "de",
  "del", "donde", "el", "en", "es", "esta", "estan", "este", "hacer", "hago",
  "hay", "la", "las", "licentech", "lo", "los", "me", "mi", "necesito", "por",
  "para", "puedo", "que", "quiero", "saber", "se", "un", "una", "y",
]);

function words(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .map((word) => word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word);
}

function rankFaqs(query: string, faqs: Faq[]) {
  const queryWords = Array.from(new Set(words(query)));
  if (!queryWords.length) return [];
  return faqs.map((faq) => {
    const faqWords = new Set(words(`${faq.question} ${faq.keywords ?? ""}`));
    const matched = queryWords.filter((word) => faqWords.has(word)).length;
    return { faq, score: matched / queryWords.length };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

export default function SupportWidget({ whatsapp, email, telegram }: { whatsapp: string; email: string; telegram: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>(starterFaqs);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 0,
    from: "assistant",
    text: "¡Hola! Soy el asistente de LicenTech. Pregúntame sobre compras, pagos, comprobantes o pedidos. Si no encuentro la respuesta, te ayudaré a contactar al equipo.",
  }]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(1);
  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, necesito ayuda con LicenTech.")}`
    : null;
  const telegramUrl = telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : null;

  useEffect(() => {
    fetch("/api/faqs")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las preguntas frecuentes.");
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("La respuesta de preguntas frecuentes no es válida.");
        setFaqs([...starterFaqs, ...data.filter((item): item is Faq =>
          item && typeof item.id === "string"
          && typeof item.question === "string"
          && typeof item.answer === "string").map((faq) => ({ ...faq, id: `admin-${faq.id}` }))]);
      })
      .catch((error) => {
        console.error("No se pudieron cargar las preguntas frecuentes", error);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  function addMessage(message: Omit<ChatMessage, "id">) {
    const id = nextMessageId.current++;
    setMessages((current) => [...current, { id, ...message }]);
  }

  function answerQuestion(question: string, faq?: Faq) {
    const text = question.trim();
    if (!text) return;
    addMessage({ from: "visitor", text });
    setInput("");

    if (faq) {
      addMessage({ from: "assistant", text: faq.answer });
      return;
    }

    const matches = rankFaqs(text, faqs);
    const best = matches[0];
    const secondBest = matches[1];
    if (best && best.score >= 0.6 && (!secondBest || best.score - secondBest.score >= 0.2)) {
      addMessage({ from: "assistant", text: best.faq.answer });
      return;
    }

    const suggestions = matches.slice(0, 3).map(({ faq }) => faq);
    addMessage({
      from: "assistant",
      text: suggestions.length
        ? "No estoy completamente seguro. ¿Alguna de estas opciones responde tu pregunta? Si no, puedes escribirnos por WhatsApp."
        : "No encuentro una respuesta para eso todavía. Escríbenos por WhatsApp y el equipo te ayudará.",
      ...(suggestions.length ? { suggestions } : {}),
      ...(whatsapp ? {
        contactUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, necesito ayuda con LicenTech. Mi consulta: ${text}`)}`,
      } : {}),
    });
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    answerQuestion(input);
  }

  return (
    <aside className="fixed bottom-4 right-4 z-50">
      {open && (
        <section className="mb-3 flex h-[min(38rem,calc(100dvh-6rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl" aria-label="Chat de ayuda">
          <header className="flex items-center justify-between bg-teal-950 px-4 py-3 text-white">
            <div>
              <h2 className="font-semibold">Ayuda LicenTech</h2>
              <p className="mt-0.5 text-xs text-teal-100">Respuestas rápidas y contacto directo</p>
            </div>
            <button type="button" className="rounded px-2 py-1 text-xl leading-none text-teal-100 hover:bg-teal-900" aria-label="Cerrar chat" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 p-3" aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <div key={message.id} className={message.from === "visitor" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-5 ${message.from === "visitor" ? "rounded-br-sm bg-teal-800 text-white" : "rounded-bl-sm border border-stone-200 bg-white text-stone-800"}`}>
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.suggestions && (
                    <div className="mt-2 space-y-1.5">
                      {message.suggestions.map((faq) => (
                        <button
                          key={faq.id}
                          type="button"
                          className="block w-full rounded-lg border border-teal-200 px-2.5 py-1.5 text-left text-xs font-medium text-teal-900 hover:bg-teal-50"
                          onClick={() => answerQuestion(faq.question, faq)}
                        >
                          {faq.question}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.contactUrl && (
                    <a className="mt-2 inline-block font-medium text-green-800 underline" href={message.contactUrl} target="_blank" rel="noreferrer">
                      Continuar por WhatsApp
                    </a>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pl-1">
                {faqs.slice(0, 4).map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs text-teal-900 hover:bg-teal-50"
                    onClick={() => answerQuestion(faq.question, faq)}
                  >
                    {faq.question}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="flex gap-2 border-t border-stone-200 bg-white p-3" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="support-message">Escribe tu pregunta</label>
            <input
              id="support-message"
              className="min-w-0 flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700"
              placeholder="Escribe tu pregunta…"
              value={input}
              maxLength={500}
              onChange={(event) => setInput(event.target.value)}
            />
            <button className="rounded-full bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50" type="submit" disabled={!input.trim()}>
              Enviar
            </button>
          </form>
          <nav className="flex items-center justify-center gap-4 border-t border-stone-100 px-3 py-2 text-xs" aria-label="Otros canales de atención">
            {whatsappUrl
              ? <a className="font-medium text-green-800 underline" href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
              : <span className="text-stone-400">WhatsApp no disponible</span>}
            {telegramUrl && <a className="font-medium text-sky-800 underline" href={telegramUrl} target="_blank" rel="noreferrer">Telegram</a>}
            <a className="font-medium text-teal-900 underline" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Consulta de atención al cliente - LicenTech")}`}>Correo</a>
          </nav>
        </section>
      )}
      <button
        type="button"
        className="ml-auto block rounded-full bg-teal-900 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-teal-800"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Cerrar chat" : "¿Necesitas ayuda?"}
      </button>
    </aside>
  );
}
