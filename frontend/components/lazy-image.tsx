"use client";

import React, { useState, useRef, useEffect } from "react";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Optional low-quality placeholder shown while loading (data-URI or tiny URL) */
  placeholder?: string;
  /** Wrapper className (applied to the outer span) */
  wrapperClassName?: string;
}

/**
 * LazyImage — Intersection-Observer-based lazy image with a blur-up reveal.
 *
 * Features:
 * - Only starts loading when the element is close to entering the viewport (300 px threshold).
 * - Shows a shimmer skeleton while loading.
 * - If a `placeholder` prop (low-quality thumbnail or data:URI) is provided, it is shown
 *   blurred while the full image loads, then crossfades.
 * - Falls back gracefully: if JS is off the native `loading="lazy"` still applies.
 */
export default function LazyImage({
  src,
  alt,
  placeholder,
  className = "",
  wrapperClassName = "",
  ...rest
}: LazyImageProps) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" } // pre-load 300px before visible
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`block relative overflow-hidden ${wrapperClassName}`}
      style={{ display: "contents" }}
    >
      {/* Shimmer skeleton shown before image loads */}
      {!loaded && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800"
          style={{ backgroundSize: "200% 100%" }}
        />
      )}

      {/* Low-quality blurred placeholder */}
      {placeholder && !loaded && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={`${className} absolute inset-0 w-full h-full object-cover blur-md scale-105 transition-opacity duration-300`}
          style={{ opacity: inView ? 1 : 0 }}
        />
      )}

      {/* Main image — only rendered once in-view */}
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          {...rest}
        />
      )}
    </span>
  );
}
