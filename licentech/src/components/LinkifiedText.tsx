import type { ReactNode } from "react";

const urlPattern = /https?:\/\/[^\s<>"']+/gi;

export default function LinkifiedText({ text, className = "" }: { text: string; className?: string }) {
  const content: ReactNode[] = [];
  let previousIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    const fullUrl = match[0];
    const index = match.index ?? 0;
    let url = fullUrl;
    while (/[.,!?;:)\]}]$/.test(url)) url = url.slice(0, -1);
    let validUrl = false;
    try {
      const parsed = new URL(url);
      validUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      validUrl = false;
    }
    if (!url || !validUrl) continue;

    if (index > previousIndex) content.push(text.slice(previousIndex, index));
    content.push(
      <a key={`${index}-${url}`} href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-800 underline">
        {url}
      </a>,
    );
    if (fullUrl.length > url.length) content.push(fullUrl.slice(url.length));
    previousIndex = index + fullUrl.length;
  }
  if (previousIndex < text.length) content.push(text.slice(previousIndex));

  return <p className={className}>{content}</p>;
}
