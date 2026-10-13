"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Expenses now go through "Ingresos y egresos", with the staff rules and the review. */
export default function GastosPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/contabilidad/movimientos"); }, [router]);
  return null;
}
