"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventarioIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/inventario/almacen");
  }, [router]);

  return null;
}
