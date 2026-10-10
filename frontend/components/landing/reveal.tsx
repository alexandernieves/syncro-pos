"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades a block in once, the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      // Fires as soon as the block starts crossing into the lower part of the
      // screen, not once it's already mostly on-screen — so the motion plays
      // out while you're still scrolling toward it, not as a pop once you arrive.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[850ms] ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100 blur-none" : "translate-y-10 opacity-0 blur-[2px]"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
