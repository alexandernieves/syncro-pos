"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side guard for /dashboard/syncro/* pages. Defense-in-depth only —
 * the backend independently enforces role === 'syncropos' on every request.
 * This just avoids showing a broken/empty admin page to the wrong user.
 */
export function useRequireSyncroAdmin() {
  const router = useRouter();

  useEffect(() => {
    const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const userStr = isPwa ? sessionStorage.getItem("user") : localStorage.getItem("user");
    try {
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || user.role !== "syncropos") {
        router.replace("/dashboard");
      }
    } catch {
      router.replace("/dashboard");
    }
  }, [router]);
}
