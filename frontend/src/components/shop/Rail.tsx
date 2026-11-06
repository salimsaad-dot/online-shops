"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A titled, horizontally swipeable row with scroll-snap. On mouse devices, round arrow buttons page
 * through it; they disable at either end.
 */
export function Rail({ title, href, linkLabel = "View all", children }: { title: string; href?: string; linkLabel?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  // Arrows only for mouse users on wider screens; phones swipe
  const arrow = "hidden h-10 w-10 items-center justify-center rounded-full border border-line-strong text-ink transition-colors hover:bg-raised disabled:opacity-30 sm:[@media(hover:hover)]:inline-flex";

  return (
    <section>
      <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4">
        <h2 className="display min-w-0 text-[2rem] leading-tight sm:text-5xl">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={href} className="mr-2 text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              {linkLabel}
            </Link>
          )}
          <button onClick={() => page(-1)} disabled={edges.start} className={arrow} aria-label="Previous">
            <ArrowLeft size={18} strokeWidth={1.5} aria-hidden />
          </button>
          <button onClick={() => page(1)} disabled={edges.end} className={arrow} aria-label="Next">
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>
      {/* Edge-aligned with the page container, but free to bleed to the screen edge as you swipe */}
      <div ref={ref} className="rail mt-6 flex gap-4 overflow-x-auto pb-2 lg:gap-6">
        {children}
      </div>
    </section>
  );
}
