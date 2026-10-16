import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { youtubeEmbedUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function TutorialPage({ params }: { params: { slug: string } }) {
  const tutorial = await prisma.tutorial.findUnique({
    where: { slug: params.slug },
    include: {
      media: { orderBy: { position: "asc" }, include: { media: true } },
      downloads: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!tutorial || !tutorial.published) notFound();
  if (tutorial.vipOnly) {
    const session = await getSession();
    if (!session || !(await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } }))) {
      redirect(`/login?next=${encodeURIComponent(`/tutoriales/${tutorial.slug}`)}`);
    }
  }

  const video = youtubeEmbedUrl(tutorial.youtubeUrl);
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link href="/tutoriales" className="text-sm text-teal-800 underline">Volver a tutoriales</Link>
      <header>
        <p className="text-sm font-medium text-teal-800">{tutorial.category}{tutorial.vipOnly ? " · VIP" : ""}</p>
        <h1 className="mt-1 text-3xl font-semibold">{tutorial.title}</h1>
        {tutorial.summary && <p className="mt-3 text-stone-600">{tutorial.summary}</p>}
      </header>
      {video && (
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            className="h-full w-full"
            src={video}
            title={`Video: ${tutorial.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      <div className="whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-5 text-sm leading-7">{tutorial.content}</div>
      {tutorial.media.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {tutorial.media.map(({ id, media }) => (
            <figure key={id} className="rounded-lg border border-stone-200 bg-white p-2">
              <Image src={media.externalUrl ?? `/api/media/${media.id}`} alt={media.altText || media.name} width={720} height={480} unoptimized className="max-h-96 w-full rounded object-contain" />
              <figcaption className="p-2 text-sm text-stone-600">{media.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {tutorial.downloads.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Recursos y descargas</h2>
          <ul className="mt-3 space-y-3">
            {tutorial.downloads.map((resource) => (
              <li key={resource.id}>
                <a href={resource.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-800 underline">{resource.title}</a>
                {resource.description && <p className="text-sm text-stone-600">{resource.description}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-stone-500">Descarga únicamente archivos de fuentes legítimas y verifica que sean compatibles con tu dispositivo.</p>
        </section>
      )}
    </article>
  );
}
