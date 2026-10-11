import type { DemoPhoto } from "@/lib/demo/data";

export function PhotoCard({ photo, lang, size = "lg" }: { photo: DemoPhoto; lang: "en" | "es"; size?: "sm" | "md" | "lg" }) {
  const heights = { sm: "h-32", md: "h-48", lg: "h-72 sm:h-96" } as const;
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${photo.gradient} ${heights[size]}`}>
      <img
        src={photo.image}
        alt={photo.caption[lang]}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent px-4 py-3">
        <p className="text-primary-foreground font-medium drop-shadow">{photo.caption[lang]}</p>
      </div>
    </div>
  );
}
