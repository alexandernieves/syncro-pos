"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductosIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/productos/todos");
  }, [router]);

  return null;
}
