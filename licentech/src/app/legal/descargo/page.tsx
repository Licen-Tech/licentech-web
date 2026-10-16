import fs from "fs";
import path from "path";

export const metadata = { title: "Descargo de responsabilidad – LicenTech Colombia" };

const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <strong key={i}>{t}</strong> : t));

export default function Page() {
  const md = fs.readFileSync(path.join(process.cwd(), "legal/descargo-de-responsabilidad.md"), "utf8");
  return (
    <article className="max-w-2xl space-y-3 text-sm leading-relaxed">
      {md.split("\n").filter(Boolean).map((l, i) =>
        l.startsWith("# ") ? <h1 key={i} className="text-2xl font-semibold">{l.slice(2)}</h1>
        : l.startsWith("## ") ? <h2 key={i} className="pt-3 text-lg font-semibold">{l.slice(3)}</h2>
        : l.startsWith("> ") ? <p key={i} className="rounded bg-amber-50 p-3 text-amber-900">{bold(l.slice(2))}</p>
        : l.startsWith("- ") ? <li key={i} className="ml-5 list-disc">{bold(l.slice(2))}</li>
        : <p key={i}>{bold(l)}</p>,
      )}
    </article>
  );
}
