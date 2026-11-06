"use client";

import { useState } from "react";
import { ProductImg } from "@/components/ui";
import type { ProductImage } from "@/lib/types";

/** Large 4:5 main photo; thumbnails below when there's more than one, crossfading on change. */
export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-raised">
        {images.length ? (
          images.map((img, i) => (
            <ProductImg
              key={img.id}
              src={img.url}
              alt={i === active ? name : ""}
              eager={i === 0}
              className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}
            />
          ))
        ) : (
          <ProductImg src={null} alt={name} className="h-full w-full" />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-paper transition-[box-shadow,opacity] ${
                i === active ? "ring-ink" : "opacity-60 ring-transparent hover:opacity-100"
              }`}
              aria-label={`Show image ${i + 1} of ${images.length}`}
              aria-current={i === active}
            >
              <ProductImg src={img.url} alt="" className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
