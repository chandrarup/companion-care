import { useEffect, useState } from "react";
import { DEMO_PHOTOS, type DemoPhoto } from "./data";

// Photos a demo visitor adds. Browser-only (nothing is uploaded to a server): resized to a small JPEG and kept in
// sessionStorage, so they show in the caregiver gallery AND the patient slideshow for the rest of the session.
const KEY = "demo.photos";
const listeners = new Set<() => void>();
type Stored = { id: string; caption: string; image: string };

function read(): Stored[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: Stored[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full: keep going without persisting */ }
  listeners.forEach((l) => l());
}

async function shrink(file: File, max = 1000): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("not an image"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function addDemoPhoto(file: File, caption: string) {
  const image = await shrink(file);
  write([...read(), { id: crypto.randomUUID(), caption: caption.trim() || "A family photo", image }]);
}
export function removeDemoPhoto(id: string) {
  write(read().filter((p) => p.id !== id));
}

/** The built-in synthetic photos plus any the visitor added. */
export function useDemoPhotos(): (DemoPhoto & { added?: boolean })[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const extra = typeof window === "undefined" ? [] : read();
  return [
    ...DEMO_PHOTOS,
    ...extra.map((p) => ({
      id: p.id,
      caption: { en: p.caption, es: p.caption },
      gradient: "from-muted via-card to-muted",
      emoji: "📷",
      image: p.image,
      added: true,
    })),
  ];
}
