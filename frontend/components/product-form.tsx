"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  IconPlus, IconBarcode, IconDeviceFloppy, IconX, IconArrowLeft, IconTrash, IconSettings
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type VariantForm = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  promoPrice: string;
  bulkPrice: string;
  stock: string;
  minStock: string;
};

const emptyVariant = (idx: number): VariantForm => ({
  name: `Variante ${idx + 1}`,
  sku: `SKU-${Date.now()}-${idx}`,
  barcode: "",
  price: "",
  cost: "",
  promoPrice: "",
  bulkPrice: "",
  stock: "0",
  minStock: "5",
});

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [isWeighable, setIsWeighable] = useState(false);
  const [variants, setVariants] = useState<VariantForm[]>([emptyVariant(0)]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!productId);
  const [image, setImage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [cRes, sRes] = await Promise.all([
          fetch(`${API}/categories`, { headers }),
          fetch(`${API}/suppliers`, { headers }),
        ]);
        if (cRes.ok) setCategories(await cRes.json());
        if (sRes.ok) setSuppliers(await sRes.json());

        if (productId) {
          const pRes = await fetch(`${API}/products/${productId}`, { headers });
          if (pRes.ok) {
            const p = await pRes.json();
            setName(p.name);
            setDescription(p.description || "");
            setCategoryId(p.categoryId || "");
            setSupplierId(p.supplierId || "");
            setIsWeighable(p.isWeighable || false);
            setImage(p.image || "");
            setVariants(p.variants.map((v: any) => ({
              ...v,
              barcode: v.barcode || "",
              price: String(v.price),
              cost: String(v.cost || ""),
              stock: String(v.stock),
              minStock: String(v.minStock),
              promoPrice: String(v.promoPrice || ""),
              bulkPrice: String(v.bulkPrice || ""),
            })));
          }
        }
      } catch (e) {} finally { setLoading(false); }
    };
    fetchData();
  }, [productId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${API}/uploads`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImage(data.url);
        toast.success("Imagen subida exitosamente");
      } else {
        toast.error("Error al subir la imagen");
      }
    } catch (e) {
      toast.error("Error de conexión al subir imagen");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!name) return toast.error("El nombre es obligatorio");
    if (variants.some(v => !v.price)) return toast.error("Todas las variantes deben tener precio");
    
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const url = productId ? `${API}/products/${productId}` : `${API}/products`;
      const method = productId ? "PUT" : "POST";
      
      const payload = {
        name,
        description,
        categoryId,
        supplierId,
        isWeighable,
        image,
        variants: variants.map(v => ({
          ...v,
          price: Number(v.price),
          cost: Number(v.cost),
          stock: Number(v.stock),
          minStock: Number(v.minStock),
          promoPrice: v.promoPrice ? Number(v.promoPrice) : null,
          bulkPrice: v.bulkPrice ? Number(v.bulkPrice) : null,
        }))
      };

      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Producto guardado correctamente");
        router.push("/dashboard/productos/todos");
      }
    } catch (e) {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><IconArrowLeft size={18}/></Button>
          <div>
            <h1 className="text-2xl font-black">{productId ? 'Editar Producto' : 'Nuevo Producto'}</h1>
            <p className="text-sm text-muted-foreground">Configuración de producto real (B2C)</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <IconDeviceFloppy size={18}/> {saving ? 'Guardando...' : 'Guardar Producto'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 bg-card rounded-2xl border shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Información General</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Producto</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Zapatos Deportivos XYZ" className="h-12 text-lg font-bold" />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descripción para el cliente" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{categories.map((c, idx) => <SelectItem key={c.id || c._id || idx} value={c.id || c._id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{suppliers.map((s, idx) => <SelectItem key={s.id || s._id || idx} value={s.id || s._id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-muted/10 mt-2">
                <div className="space-y-1">
                  <Label htmlFor="weighable-switch" className="font-bold text-sm cursor-pointer block">
                    Producto Pesable
                  </Label>
                  <p className="text-xs text-muted-foreground font-normal leading-relaxed max-w-[90%]">
                    Activa esta opción si este producto se vende por peso fraccionado (Ej: 1.250 Kg). El cajero deberá ingresar el peso manualmente al facturar.
                  </p>
                </div>
                <Switch 
                  id="weighable-switch" 
                  checked={isWeighable} 
                  onCheckedChange={setIsWeighable} 
                  className="data-[state=checked]:bg-emerald-500 shrink-0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Variantes y Precios</h2>
              <Button variant="outline" size="sm" onClick={() => setVariants([...variants, emptyVariant(variants.length)])} className="gap-2">
                <IconPlus size={14}/> Añadir Variante
              </Button>
            </div>

            {variants.map((v, idx) => (
              <div key={v.id || v.sku || idx} className="p-6 bg-card rounded-2xl border shadow-sm relative group animate-in fade-in slide-in-from-top-2">
                {variants.length > 1 && (
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setVariants(variants.filter((_, i) => i !== idx))}>
                    <IconTrash size={16}/>
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs">Nombre de Variante (Color/Talla/etc)</Label>
                    <Input value={v.name} onChange={e => {
                      const n = [...variants]; n[idx].name = e.target.value; setVariants(n);
                    }} placeholder="Ej: Rojo / 42" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">SKU</Label>
                    <Input value={v.sku} onChange={e => {
                      const n = [...variants]; n[idx].sku = e.target.value; setVariants(n);
                    }} className="font-mono text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Código de Barras</Label>
                    <div className="relative">
                      <IconBarcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={v.barcode} onChange={e => {
                        const n = [...variants]; n[idx].barcode = e.target.value; setVariants(n);
                      }} className="pl-9" placeholder="EAN-13" />
                    </div>
                  </div>

                  {/* Sección de Códigos Secundarios (Tags) */}
                  <div className="sm:col-span-3 space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Códigos de Barras Secundarios</Label>
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/10 rounded-xl border border-dashed border-muted-foreground/10">
                      {(v as any).secondaryBarcodes?.map((bc: string, bIdx: number) => (
                        <div key={`${bc}-${bIdx}`} className="bg-background border px-3 py-1 rounded-lg text-[10px] font-mono flex items-center gap-2">
                          {bc}
                          <button 
                            type="button"
                            className="text-destructive hover:scale-110 transition-transform"
                            onClick={() => {
                              const n = [...variants];
                              (n[idx] as any).secondaryBarcodes = (n[idx] as any).secondaryBarcodes.filter((_: any, i: number) => i !== bIdx);
                              setVariants(n);
                            }}
                          >
                            <IconX size={12}/>
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        className="text-[10px] font-bold text-primary px-3 py-1 hover:bg-primary/5 rounded-lg border border-dashed border-primary/20 transition-colors"
                        onClick={() => {
                          const code = prompt("Nuevo código secundario:");
                          if (code) {
                            const n = [...variants];
                            if (!(n[idx] as any).secondaryBarcodes) (n[idx] as any).secondaryBarcodes = [];
                            (n[idx] as any).secondaryBarcodes.push(code);
                            setVariants(n);
                          }
                        }}
                      >
                        + Añadir
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-primary">Precio Venta</Label>
                    <Input type="number" value={v.price} onChange={e => {
                      const n = [...variants]; n[idx].price = e.target.value; setVariants(n);
                    }} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Costo</Label>
                    <Input type="number" value={v.cost} onChange={e => {
                      const n = [...variants]; n[idx].cost = e.target.value; setVariants(n);
                    }} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Stock Inicial</Label>
                    <Input type="number" value={v.stock} onChange={e => {
                      const n = [...variants]; n[idx].stock = e.target.value; setVariants(n);
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Precio Promo</Label>
                    <Input type="number" value={v.promoPrice} onChange={e => {
                      const n = [...variants]; n[idx].promoPrice = e.target.value; setVariants(n);
                    }} className="border-orange-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Precio Mayor</Label>
                    <Input type="number" value={v.bulkPrice} onChange={e => {
                      const n = [...variants]; n[idx].bulkPrice = e.target.value; setVariants(n);
                    }} className="border-blue-200" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-card rounded-2xl border shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ayuda</h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>• Las variantes permiten gestionar tallas, colores o presentaciones de un mismo producto.</p>
              <p>• El <strong>Precio Promo</strong> tiene prioridad si está configurado.</p>
              <p>• El <strong>Precio Mayor</strong> se activa automáticamente en ventas por volumen (próximamente).</p>
            </div>
          </div>
          
          <div className="p-6 bg-card rounded-2xl border shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Imagen Colectiva</h2>
            <div className="relative border-2 border-dashed border-[#79716b]/30 rounded-xl bg-card hover:bg-muted/30 transition-colors flex flex-col items-center justify-center p-6 text-center cursor-pointer min-h-[200px]" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              {uploadingImage ? (
                <div className="space-y-2">
                  <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground font-medium">Subiendo a AWS S3...</p>
                </div>
              ) : image ? (
                <div className="space-y-4 relative w-full group">
                  <img src={image} alt="Producto" className="mx-auto max-h-[160px] object-contain rounded-md" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                    <p className="text-white text-sm font-bold flex items-center gap-2"><IconPlus size={16} /> Cambiar Imagen</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 mx-auto">
                    <IconPlus className="text-primary size-6" />
                  </div>
                  <p className="text-sm font-bold mb-1">Subir Imagen Colectiva</p>
                  <p className="text-xs text-muted-foreground px-4 leading-relaxed">Esta imagen representará el producto principal en el POS. Soporta JPG, PNG, WEBP.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
