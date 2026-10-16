import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TutorialsPage() {
  const tutorials = await prisma.tutorial.findMany({
    where: { published: true },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    select: { slug: true, title: true, category: true, summary: true, vipOnly: true, youtubeUrl: true },
  });
  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm font-medium text-teal-800">LICENTECH · CENTRO DE APRENDIZAJE</p>
        <h1 className="mt-1 text-3xl font-semibold">Tutoriales y recursos</h1>
        <p className="mt-2 text-sm text-stone-600">Guías organizadas por fabricante y recursos publicados por el equipo LicenTech.</p>
      </div>
      {tutorials.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-stone-500">Pronto publicaremos tutoriales.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tutorials.map((tutorial) => (
            <Link key={tutorial.slug} href={`/tutoriales/${tutorial.slug}`} className="rounded-lg border border-stone-200 bg-white p-5 hover:border-teal-700">
              <p className="text-xs font-medium uppercase text-teal-800">{tutorial.category}{tutorial.vipOnly ? " · VIP" : ""}</p>
              <h2 className="mt-2 text-lg font-semibold">{tutorial.title}</h2>
              {tutorial.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{tutorial.summary}</p>}
              <span className="mt-3 inline-block text-sm underline">{tutorial.youtubeUrl ? "Ver tutorial y video" : "Ver guía"}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
