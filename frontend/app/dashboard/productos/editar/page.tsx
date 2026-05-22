"use client";

import { useSearchParams } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { Suspense } from "react";

function EditProductContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  if (!id) return <div>ID de producto no proporcionado</div>;

  return (
    <div className="p-4 lg:p-6">
      <ProductForm productId={id} />
    </div>
  );
}

export default function EditarProductoPage() {
  return (
    <Suspense fallback={<div>Cargando editor...</div>}>
      <EditProductContent />
    </Suspense>
  );
}
