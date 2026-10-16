"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Media = { id: string; name: string; altText: string; mimeType: string | null; externalUrl: string | null };
type Banner = {
  id: string; title: string; description: string; linkUrl: string | null; mediaId: string | null;
  active: boolean; sortOrder: number; media: { id: string; name: string; externalUrl: string | null } | null;
};
type Download = { title: string; description: string; url: string };
type Tutorial = {
  id: string; slug: string; title: string; category: string; summary: string; content: string;
  youtubeUrl: string | null; vipOnly: boolean; published: boolean;
  media: { mediaId: string }[]; downloads: Download[];
};
type PaymentMethod = { id: string; code: string; label: string; instructions: string; active: boolean; sortOrder: number };
type Faq = { id: string; question: string; answer: string; active: boolean; sortOrder: number };
type SiteSettings = {
  siteName: string; heroTitle: string; heroDescription: string; heroNotice: string;
  supportEmail: string; whatsappNumber: string; telegramUsername: string;
};
type Tab = "media" | "banners" | "tutorials" | "payments" | "site" | "faqs";

const input = "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700";
const button = "rounded bg-teal-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const blankBanner = { title: "", description: "", linkUrl: "", mediaId: "", active: false, sortOrder: 0 };
const blankTutorial = {
  slug: "", title: "", category: "Samsung", summary: "", content: "", youtubeUrl: "",
  vipOnly: false, published: false, mediaIds: [] as string[], resources: "",
};
const blankMethod = { code: "", label: "", instructions: "", active: false, sortOrder: 0 };
const blankSettings: SiteSettings = {
  siteName: "LicenTech Colombia", heroTitle: "Herramientas de software para desbloqueo y mantenimiento",
  heroDescription: "", heroNotice: "", supportEmail: "brianxxp082@gmail.com", whatsappNumber: "", telegramUsername: "",
};
const blankFaq = { question: "", answer: "", active: true, sortOrder: 0 };

function errorMessage(data: unknown) {
  if (data && typeof data === "object" && "error" in data) {
    const error = data.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "fieldErrors" in error) {
      const fields = error.fieldErrors;
      if (fields && typeof fields === "object") {
        const messages = Object.values(fields).flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
        if (messages.length) return messages.join(" ");
      }
    }
  }
  return "No se pudo guardar. Revisa los datos e inténtalo de nuevo.";
}

export default function ContentManager() {
  const [tab, setTab] = useState<Tab>("media");
  const [media, setMedia] = useState<Media[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(blankSettings);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [faqDraft, setFaqDraft] = useState(blankFaq);
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [bannerDraft, setBannerDraft] = useState(blankBanner);
  const [tutorialDraft, setTutorialDraft] = useState(blankTutorial);
  const [methodDraft, setMethodDraft] = useState(blankMethod);
  const [editingBanner, setEditingBanner] = useState<string | null>(null);
  const [editingTutorial, setEditingTutorial] = useState<string | null>(null);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [mediaAlt, setMediaAlt] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [mediaResponse, bannerResponse, tutorialResponse, methodResponse, settingsResponse, faqResponse] = await Promise.all([
      fetch("/api/admin/media"),
      fetch("/api/admin/banners"),
      fetch("/api/admin/tutoriales"),
      fetch("/api/admin/payment-methods"),
      fetch("/api/admin/site-settings"),
      fetch("/api/admin/faqs"),
    ]);
    if ([mediaResponse, bannerResponse, tutorialResponse, methodResponse, settingsResponse, faqResponse].some((response) => !response.ok)) {
      setMessage("No se pudieron cargar todos los módulos. Verifica tu sesión de administrador e inténtalo de nuevo.");
      return;
    }
    const [mediaData, bannerData, tutorialData, methodData, settingsData, faqData] = await Promise.all([
      mediaResponse.json(), bannerResponse.json(), tutorialResponse.json(), methodResponse.json(), settingsResponse.json(), faqResponse.json(),
    ]);
    setMedia(mediaData);
    setBanners(bannerData);
    setTutorials(tutorialData);
    setMethods(methodData);
    setSettings(settingsData);
    setFaqs(faqData);
  }

  useEffect(() => {
    load().catch((error) => {
      console.error("No se pudo cargar el gestor de contenido", error);
      setMessage("No pudimos conectar para cargar el contenido.");
    });
  }, []);

  async function request(url: string, method: string, body?: unknown) {
    const init: RequestInit = { method };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(data));
    return data;
  }

  async function saveMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("name", mediaName);
      form.set("altText", mediaAlt);
      if (mediaFile) form.set("image", mediaFile);
      else form.set("externalUrl", externalUrl);
      await request("/api/admin/media", "POST", form);
      setMediaName(""); setMediaAlt(""); setExternalUrl(""); setMediaFile(null);
      setMessage("Recurso guardado en la biblioteca multimedia.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el recurso.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request(editingBanner ? `/api/admin/banners/${editingBanner}` : "/api/admin/banners", editingBanner ? "PATCH" : "POST", {
        ...bannerDraft, linkUrl: bannerDraft.linkUrl || null, mediaId: bannerDraft.mediaId || null,
      });
      setBannerDraft(blankBanner); setEditingBanner(null); setMessage("Banner guardado."); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el banner.");
    } finally { setBusy(false); }
  }

  function editBanner(banner: Banner) {
    setBannerDraft({
      title: banner.title, description: banner.description, linkUrl: banner.linkUrl ?? "",
      mediaId: banner.mediaId ?? "", active: banner.active, sortOrder: banner.sortOrder,
    });
    setEditingBanner(banner.id);
    setTab("banners");
  }

  async function saveTutorial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const downloads = tutorialDraft.resources.split("\n").map((line) => line.split("|").map((part) => part.trim()))
      .filter((parts) => parts.some(Boolean))
      .map(([title, url, description = ""]) => ({ title, url, description }));
    try {
      await request(editingTutorial ? `/api/admin/tutoriales/${editingTutorial}` : "/api/admin/tutoriales", editingTutorial ? "PATCH" : "POST", {
        slug: tutorialDraft.slug, title: tutorialDraft.title, category: tutorialDraft.category,
        summary: tutorialDraft.summary, content: tutorialDraft.content,
        youtubeUrl: tutorialDraft.youtubeUrl || null, vipOnly: tutorialDraft.vipOnly,
        published: tutorialDraft.published, mediaIds: tutorialDraft.mediaIds, downloads,
      });
      setTutorialDraft(blankTutorial); setEditingTutorial(null); setMessage("Tutorial guardado."); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el tutorial.");
    } finally { setBusy(false); }
  }

  function editTutorial(tutorial: Tutorial) {
    setTutorialDraft({
      slug: tutorial.slug, title: tutorial.title, category: tutorial.category,
      summary: tutorial.summary, content: tutorial.content, youtubeUrl: tutorial.youtubeUrl ?? "",
      vipOnly: tutorial.vipOnly, published: tutorial.published,
      mediaIds: tutorial.media.map((item) => item.mediaId),
      resources: tutorial.downloads.map((item) => `${item.title} | ${item.url} | ${item.description}`).join("\n"),
    });
    setEditingTutorial(tutorial.id); setTab("tutorials");
  }

  async function saveMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request(editingMethod ? `/api/admin/payment-methods/${editingMethod}` : "/api/admin/payment-methods", editingMethod ? "PATCH" : "POST", methodDraft);
      setMethodDraft(blankMethod); setEditingMethod(null); setMessage("Método de pago guardado."); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el método.");
    } finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request("/api/admin/site-settings", "PATCH", settings);
      setMessage("Información del sitio y contactos guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally { setBusy(false); }
  }

  async function saveFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request(editingFaq ? `/api/admin/faqs/${editingFaq}` : "/api/admin/faqs", editingFaq ? "PATCH" : "POST", faqDraft);
      setFaqDraft(blankFaq); setEditingFaq(null); setMessage("Pregunta frecuente guardada."); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la pregunta.");
    } finally { setBusy(false); }
  }

  async function remove(url: string, label: string) {
    if (!window.confirm(`¿Eliminar ${label}? Si está asignado, se quitará de sus publicaciones.`)) return;
    setBusy(true); setMessage("");
    try {
      await request(url, "DELETE"); setMessage(`${label} eliminado.`); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar.");
    } finally { setBusy(false); }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "media", label: "Biblioteca multimedia" },
    { id: "banners", label: "Banners" },
    { id: "tutorials", label: "Tutoriales y descargas" },
    { id: "payments", label: "Métodos de pago" },
    { id: "site", label: "Inicio y contacto" },
    { id: "faqs", label: "Bot de preguntas frecuentes" },
  ];

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Contenido y configuración</h1>
        <p className="mt-1 text-sm text-stone-600">Administra imágenes, banners, tutoriales y pagos desde el sitio, sin editar archivos.</p>
      </div>
      {message && <p role="status" className="rounded bg-stone-100 p-3 text-sm text-stone-700">{message}</p>}
      <nav className="flex flex-wrap gap-2" aria-label="Módulos de administración">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={`rounded border px-3 py-2 text-sm ${tab === item.id ? "border-teal-800 bg-teal-800 text-white" : "border-stone-300 bg-white"}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "media" && (
        <div className="space-y-5">
          <form className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2" onSubmit={saveMedia}>
            <h2 className="font-medium sm:col-span-2">Agregar imagen o URL externa</h2>
            <input className={input} placeholder="Nombre de la imagen" value={mediaName} maxLength={120} required onChange={(event) => setMediaName(event.target.value)} />
            <input className={input} placeholder="Texto alternativo (accesibilidad)" value={mediaAlt} maxLength={300} onChange={(event) => setMediaAlt(event.target.value)} />
            <label className="space-y-1 text-sm">
              <span>Subir JPG, PNG, WEBP o SVG (máximo 5 MB)</span>
              <input className={input} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={(event) => { setMediaFile(event.target.files?.[0] ?? null); if (event.target.files?.[0]) setExternalUrl(""); }} />
            </label>
            <label className="space-y-1 text-sm">
              <span>O pegar URL de imagen externa</span>
              <input className={input} type="url" value={externalUrl} disabled={Boolean(mediaFile)} onChange={(event) => setExternalUrl(event.target.value)} />
            </label>
            <p className="text-xs text-stone-500 sm:col-span-2">Los SVG se limpian al subirlos. Los videos se agregan como enlaces de YouTube en los tutoriales; archivos grandes se enlazan externamente.</p>
            <button className={button} disabled={busy || (!mediaFile && !externalUrl)} type="submit">Guardar en biblioteca</button>
          </form>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((item) => (
              <article key={item.id} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
                <Image src={item.externalUrl ?? `/api/media/${item.id}`} alt={item.altText || item.name} width={480} height={270} unoptimized className="h-36 w-full rounded object-cover" />
                <p className="break-words text-sm font-medium">{item.name}</p>
                <button className="text-sm text-red-700 underline" disabled={busy} onClick={() => void remove(`/api/admin/media/${item.id}`, item.name)}>Eliminar</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "banners" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form className="space-y-3 rounded-lg border border-stone-200 bg-white p-4" onSubmit={saveBanner}>
            <h2 className="font-medium">{editingBanner ? "Editar banner" : "Crear banner"}</h2>
            <input className={input} placeholder="Título" value={bannerDraft.title} required onChange={(event) => setBannerDraft({ ...bannerDraft, title: event.target.value })} />
            <textarea className={input} rows={3} placeholder="Descripción" value={bannerDraft.description} onChange={(event) => setBannerDraft({ ...bannerDraft, description: event.target.value })} />
            <select className={input} value={bannerDraft.mediaId} onChange={(event) => setBannerDraft({ ...bannerDraft, mediaId: event.target.value })}>
              <option value="">Sin imagen</option>{media.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className={input} type="url" placeholder="Enlace (opcional)" value={bannerDraft.linkUrl} onChange={(event) => setBannerDraft({ ...bannerDraft, linkUrl: event.target.value })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bannerDraft.active} onChange={(event) => setBannerDraft({ ...bannerDraft, active: event.target.checked })} /> Publicar ahora</label>
            <input className={input} type="number" min={0} placeholder="Orden" value={bannerDraft.sortOrder} onChange={(event) => setBannerDraft({ ...bannerDraft, sortOrder: Number(event.target.value) })} />
            <button className={button} disabled={busy}>{editingBanner ? "Guardar cambios" : "Crear banner"}</button>
            {editingBanner && <button type="button" className="ml-3 text-sm underline" onClick={() => { setEditingBanner(null); setBannerDraft(blankBanner); }}>Cancelar</button>}
          </form>
          <div className="space-y-3">
            {banners.map((banner) => (
              <article key={banner.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="font-medium">{banner.title} · {banner.active ? "Publicado" : "Oculto"}</p>
                <p className="mt-1 text-sm text-stone-600">{banner.description}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <button className="underline" onClick={() => editBanner(banner)}>Editar</button>
                  <button className="text-red-700 underline" disabled={busy} onClick={() => void remove(`/api/admin/banners/${banner.id}`, "el banner")}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "tutorials" && (
        <div className="space-y-5">
          <form className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2" onSubmit={saveTutorial}>
            <h2 className="font-medium sm:col-span-2">{editingTutorial ? "Editar tutorial" : "Crear tutorial"}</h2>
            <input className={input} placeholder="Título" value={tutorialDraft.title} required onChange={(event) => setTutorialDraft({ ...tutorialDraft, title: event.target.value })} />
            <input className={input} placeholder="Enlace (slug-ejemplo)" value={tutorialDraft.slug} pattern="[a-z0-9-]+" required onChange={(event) => setTutorialDraft({ ...tutorialDraft, slug: event.target.value })} />
            <input className={input} placeholder="Categoría / marca (Samsung, Xiaomi…)" value={tutorialDraft.category} required onChange={(event) => setTutorialDraft({ ...tutorialDraft, category: event.target.value })} />
            <input className={input} type="url" placeholder="Enlace de YouTube (opcional)" value={tutorialDraft.youtubeUrl} onChange={(event) => setTutorialDraft({ ...tutorialDraft, youtubeUrl: event.target.value })} />
            <textarea className={`${input} sm:col-span-2`} rows={2} placeholder="Resumen" value={tutorialDraft.summary} onChange={(event) => setTutorialDraft({ ...tutorialDraft, summary: event.target.value })} />
            <textarea className={`${input} sm:col-span-2`} rows={8} placeholder="Contenido paso a paso (texto)" value={tutorialDraft.content} required onChange={(event) => setTutorialDraft({ ...tutorialDraft, content: event.target.value })} />
            <fieldset className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">Imágenes ilustrativas y pinouts</legend>
              <div className="grid gap-2 sm:grid-cols-2">{media.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={tutorialDraft.mediaIds.includes(item.id)} onChange={(event) => setTutorialDraft({
                    ...tutorialDraft,
                    mediaIds: event.target.checked ? [...tutorialDraft.mediaIds, item.id] : tutorialDraft.mediaIds.filter((id) => id !== item.id),
                  })} />
                  {item.name}
                </label>
              ))}</div>
            </fieldset>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span>Descargas externas, una por línea: Título | URL HTTPS | Descripción</span>
              <textarea className={input} rows={4} value={tutorialDraft.resources} onChange={(event) => setTutorialDraft({ ...tutorialDraft, resources: event.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tutorialDraft.vipOnly} onChange={(event) => setTutorialDraft({ ...tutorialDraft, vipOnly: event.target.checked })} /> Solo para usuarios registrados</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tutorialDraft.published} onChange={(event) => setTutorialDraft({ ...tutorialDraft, published: event.target.checked })} /> Publicar</label>
            <button className={button} disabled={busy}>{editingTutorial ? "Guardar cambios" : "Crear tutorial"}</button>
            {editingTutorial && <button type="button" className="text-sm underline" onClick={() => { setEditingTutorial(null); setTutorialDraft(blankTutorial); }}>Cancelar</button>}
          </form>
          <div className="space-y-2">
            {tutorials.map((tutorial) => (
              <article key={tutorial.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-stone-200 bg-white p-3">
                <p className="font-medium">{tutorial.title} · {tutorial.category} · {tutorial.published ? "Publicado" : "Borrador"}</p>
                <div className="flex gap-3 text-sm">
                  <button className="underline" onClick={() => editTutorial(tutorial)}>Editar</button>
                  <button className="text-red-700 underline" disabled={busy} onClick={() => void remove(`/api/admin/tutoriales/${tutorial.id}`, "el tutorial")}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form className="space-y-3 rounded-lg border border-stone-200 bg-white p-4" onSubmit={saveMethod}>
            <h2 className="font-medium">{editingMethod ? "Editar método" : "Agregar pago manual"}</h2>
            <input className={input} placeholder="Código (NEQUI, BREB, BINANCE, AIRTM)" value={methodDraft.code} disabled={Boolean(editingMethod)} required onChange={(event) => setMethodDraft({ ...methodDraft, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
            <input className={input} placeholder="Nombre visible" value={methodDraft.label} required onChange={(event) => setMethodDraft({ ...methodDraft, label: event.target.value })} />
            <textarea className={input} rows={5} placeholder="Para Nequi: número de destino. Para Bre-B: llave Bre-B y nombre del titular." value={methodDraft.instructions} required onChange={(event) => setMethodDraft({ ...methodDraft, instructions: event.target.value })} />
            <input className={input} type="number" min={0} placeholder="Orden" value={methodDraft.sortOrder} onChange={(event) => setMethodDraft({ ...methodDraft, sortOrder: Number(event.target.value) })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={methodDraft.active} onChange={(event) => setMethodDraft({ ...methodDraft, active: event.target.checked })} /> Disponible en el checkout</label>
            <button className={button} disabled={busy}>{editingMethod ? "Guardar cambios" : "Agregar método"}</button>
            {editingMethod && <button type="button" className="ml-3 text-sm underline" onClick={() => { setEditingMethod(null); setMethodDraft(blankMethod); }}>Cancelar</button>}
          </form>
          <div className="space-y-3">
            {methods.map((method) => (
              <article key={method.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="font-medium">{method.label} · {method.active ? "Activo" : "Desactivado"}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{method.instructions}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <button className="underline" onClick={() => { setMethodDraft(method); setEditingMethod(method.id); }}>Editar</button>
                  <button className="text-red-700 underline" disabled={busy} onClick={() => void remove(`/api/admin/payment-methods/${method.id}`, method.label)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "site" && (
        <form className="grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2" onSubmit={saveSettings}>
          <h2 className="font-medium sm:col-span-2">Portada y canales de atención</h2>
          <label className="space-y-1 text-sm"><span>Nombre del sitio</span><input className={input} value={settings.siteName} maxLength={100} required onChange={(event) => setSettings({ ...settings, siteName: event.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>Título principal</span><input className={input} value={settings.heroTitle} maxLength={180} required onChange={(event) => setSettings({ ...settings, heroTitle: event.target.value })} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span>Texto de portada</span><textarea className={input} rows={4} value={settings.heroDescription} maxLength={2000} onChange={(event) => setSettings({ ...settings, heroDescription: event.target.value })} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span>Aviso de compra</span><textarea className={input} rows={2} value={settings.heroNotice} maxLength={1000} onChange={(event) => setSettings({ ...settings, heroNotice: event.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>Correo de soporte</span><input className={input} type="email" value={settings.supportEmail} onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>WhatsApp con código de país</span><input className={input} type="tel" placeholder="+573001234567" value={settings.whatsappNumber} onChange={(event) => setSettings({ ...settings, whatsappNumber: event.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>Usuario de Telegram</span><input className={input} placeholder="@usuario" value={settings.telegramUsername} onChange={(event) => setSettings({ ...settings, telegramUsername: event.target.value })} /></label>
          <button className={button} disabled={busy}>Guardar información del sitio</button>
        </form>
      )}

      {tab === "faqs" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <form className="space-y-3 rounded-lg border border-stone-200 bg-white p-4" onSubmit={saveFaq}>
            <h2 className="font-medium">{editingFaq ? "Editar pregunta frecuente" : "Agregar pregunta al bot"}</h2>
            <input className={input} placeholder="Pregunta" maxLength={200} value={faqDraft.question} required onChange={(event) => setFaqDraft({ ...faqDraft, question: event.target.value })} />
            <textarea className={input} rows={5} placeholder="Respuesta" maxLength={1200} value={faqDraft.answer} required onChange={(event) => setFaqDraft({ ...faqDraft, answer: event.target.value })} />
            <input className={input} type="number" min={0} value={faqDraft.sortOrder} onChange={(event) => setFaqDraft({ ...faqDraft, sortOrder: Number(event.target.value) })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={faqDraft.active} onChange={(event) => setFaqDraft({ ...faqDraft, active: event.target.checked })} /> Mostrar en el bot</label>
            <button className={button} disabled={busy}>{editingFaq ? "Guardar cambios" : "Agregar pregunta"}</button>
            {editingFaq && <button type="button" className="ml-3 text-sm underline" onClick={() => { setEditingFaq(null); setFaqDraft(blankFaq); }}>Cancelar</button>}
          </form>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <article key={faq.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="font-medium">{faq.question} · {faq.active ? "Visible" : "Oculta"}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{faq.answer}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <button className="underline" onClick={() => { setFaqDraft(faq); setEditingFaq(faq.id); }}>Editar</button>
                  <button className="text-red-700 underline" disabled={busy} onClick={() => void remove(`/api/admin/faqs/${faq.id}`, "la pregunta frecuente")}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
