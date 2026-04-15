import { ProductForm } from "@/components/product-form";

// In Next.js App Router, params are accessed asynchronously or automatically if synchronous isn't strict, but recent versions use `params` as a promise string sometimes. We'll use React.use() if needed, but for simplicity we can just receive `params`.
export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  return (
    <div className="p-4 lg:p-6">
      <ProductForm productId={p.id} />
    </div>
  );
}
