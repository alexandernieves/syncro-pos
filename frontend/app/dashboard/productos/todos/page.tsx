"use client";
import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconPlus, IconPencil, IconTrash,
  IconPackage, IconBarcode, IconTag,
  IconEye, IconBuilding, IconList,
  IconTrendingUp, IconAlertCircle, IconBolt, IconScan, IconCamera,
  IconArrowRight, IconX, IconLayoutGrid, IconLayoutList,
  IconDownload, IconUpload, IconFileText, IconDeviceFloppy, IconArrowLeft
} from "@tabler/icons-react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/context/CurrencyContext";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = API_URL;

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  secondaryBarcodes?: string[];
  price: number;
  cost?: number;
  promoPrice?: number;
  bulkPrice?: number;
  stock: number;
  minStock: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  totalStock: number;
  status: 'CRITICAL' | 'LOW' | 'NORMAL';
  image?: string;
  category?: { id: string, name: string };
  supplier?: { id: string, name: string };
  variants: Variant[];
};

type WaitlistItem = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
  createdAt: string;
};


export default function ProductosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualBarcodeOpen, setManualBarcodeOpen] = useState(false);
  const [manualBarcodeValue, setManualBarcodeValue] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const scannerInputRef = React.useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickFormData, setQuickFormData] = useState({ name: "", price: "", stock: "" });
  const [isDetected, setIsDetected] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [gridSearch, setGridSearch] = useState('');
  const [gridPage, setGridPage] = useState(1);
  const [gridPageSize, setGridPageSize] = useState(10);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistItems, setWaitlistItems] = useState<WaitlistItem[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);

  const { isOnline, pullRemoteData } = useSync();
  const { currency, exchangeRate, formatPrice } = useCurrency();

  const load = useCallback(async () => {
    setLoading(true);
    
    // 1. Load from LOCAL DB first
    try {
      const localProducts = await db.products.toArray();
      if (localProducts.length > 0) {
        setProducts(localProducts as any);
      }
    } catch (e) {
      console.error("Local load error", e);
    } finally {
      if (products.length > 0) setLoading(false);
    }

    // 2. If online, sync with remote
    if (navigator.onLine) {
      try {
        await pullRemoteData(null);
        const updatedProducts = await db.products.toArray();
        setProducts(updatedProducts as any);
      } catch (e) {
        toast.error("Error al sincronizar productos");
      }
    }
    
    setLoading(false);
  }, [pullRemoteData, products.length]);

  useEffect(() => { load(); }, [load]);

  // Auto-focus hidden input for laser scanner
  useEffect(() => {
    if (scannerOpen && !useCamera) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scannerOpen, useCamera]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Editing states inside the Drawer
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editIsWeighable, setEditIsWeighable] = useState(false);
  const [editImage, setEditImage] = useState("");
  const [editVariants, setEditVariants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editFileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch categories and suppliers on mount for select dropdowns
  useEffect(() => {
    const fetchSelects = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [cRes, sRes] = await Promise.all([
          fetch(`${API}/categories`, { headers }),
          fetch(`${API}/suppliers`, { headers }),
        ]);
        if (cRes.ok) setCategories(await cRes.json());
        if (sRes.ok) setSuppliers(await sRes.json());
      } catch (e) {
        console.error("Error loading categories/suppliers", e);
      }
    };
    fetchSelects();
  }, []);

  const openDetail = async (p: Product, startInEditMode = false) => { 
    setSelectedProduct(p); 
    setIsEditing(startInEditMode);
    
    // Initialize editing state from selected product
    setEditName(p.name || "");
    setEditDescription(p.description || "");
    setEditCategoryId((p as any).categoryId || p.category?.id || "");
    setEditSupplierId((p as any).supplierId || p.supplier?.id || "");
    setEditIsWeighable((p as any).isWeighable || false);
    setEditImage(p.image || "");
    setEditVariants(p.variants ? p.variants.map((v: any) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode || "",
      secondaryBarcodes: v.secondaryBarcodes || [],
      price: String(v.price),
      cost: String(v.cost || ""),
      stock: String(v.stock),
      minStock: String(v.minStock),
      promoPrice: String(v.promoPrice || ""),
      bulkPrice: String(v.bulkPrice || ""),
    })) : []);

    setDetailOpen(true); 
    
    // Fetch stats
    try {
      const res = await fetch(`${API}/products/${p.id}/stats`);
      if (res.ok) setStats(await res.json());
    } catch (e) {}
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setEditImage(data.url);
        toast.success("Imagen subida exitosamente");
      } else {
        toast.error("Error al subir la imagen");
      }
    } catch (e) {
      toast.error("Error de conexión al subir imagen");
    } finally {
      setUploadingImage(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  const handleAddVariant = () => {
    const idx = editVariants.length;
    const newVar = {
      name: `Variante ${idx + 1}`,
      sku: `SKU-${Date.now()}-${idx}`,
      barcode: "",
      secondaryBarcodes: [],
      price: "",
      cost: "",
      promoPrice: "",
      bulkPrice: "",
      stock: "0",
      minStock: "5",
    };
    setEditVariants([...editVariants, newVar]);
  };

  const handleRemoveVariant = (idx: number) => {
    setEditVariants(editVariants.filter((_, i) => i !== idx));
  };

  const handleSaveChanges = async () => {
    if (!selectedProduct) return;
    if (!editName.trim()) return toast.error("El nombre es obligatorio");
    if (editVariants.length === 0) return toast.error("Debe tener al menos una variante");
    if (editVariants.some(v => !v.name.trim())) return toast.error("Todas las variantes deben tener un nombre");
    if (editVariants.some(v => !v.price || isNaN(Number(v.price)) || Number(v.price) < 0)) return toast.error("Todas las variantes deben tener un precio válido");
    
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const url = `${API}/products/${selectedProduct.id}`;
      
      const payload = {
        name: editName,
        description: editDescription,
        categoryId: editCategoryId || null,
        supplierId: editSupplierId || null,
        isWeighable: editIsWeighable,
        image: editImage || null,
        variants: editVariants.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode || "",
          secondaryBarcodes: v.secondaryBarcodes || [],
          price: Number(v.price),
          cost: v.cost ? Number(v.cost) : null,
          stock: Number(v.stock),
          minStock: Number(v.minStock),
          promoPrice: v.promoPrice ? Number(v.promoPrice) : null,
          bulkPrice: v.bulkPrice ? Number(v.bulkPrice) : null,
        }))
      };

      const res = await fetch(url, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Producto actualizado correctamente");
        setDetailOpen(false);
        load(); // Refresh products list
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.message || "Error al actualizar producto");
      }
    } catch (e) {
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  };

  const loadWaitlist = async () => {
    setLoadingWaitlist(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/products/waitlist/all`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setWaitlistItems(await res.json());
      setWaitlistOpen(true);
    } catch (e) {
      toast.error("Error al cargar lista de espera");
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const handleApproveWaitlist = (item: WaitlistItem) => {
    setQuickFormData({
      name: item.name,
      price: item.price.toString(),
      stock: item.stock.toString()
    });
    setScannedBarcodes([item.barcode]);
    setWaitlistOpen(false);
    setQuickCreateOpen(true);
    
    // Suggest deleting from waitlist once approved
    // Actually, I'll delete it when handleQuickSave finishes.
    (window as any)._pendingWaitlistId = item.id;
  };

  const onScanComplete = async (barcode: string) => {
    try {
      setIsDetected(true);
      const audio = new Audio("/scanner.mp3");
      audio.play().catch(e => console.error("Error playing audio", e));

      const res = await fetch(`${API}/products/validate-barcode/${barcode}`);
      const isAvailable = await res.json();
      
      if (!isAvailable) {
        toast.error(`El código ${barcode} ya existe en el sistema`);
        setIsDetected(false);
        return;
      }

      // Si estamos en medio de una creación rápida, añadimos a la lista existente
      if (quickCreateOpen) {
          setScannedBarcodes(prev => {
              if (prev.includes(barcode)) return prev;
              return [...prev, barcode];
          });
          toast.success("Código adicional capturado");
          setTimeout(() => {
              setScannerOpen(false);
              setUseCamera(false);
              setIsDetected(false);
          }, 800);
          return;
      }

      setScannedBarcodes([barcode]);
      
      // Salto inmediato a creación
      setTimeout(() => {
        setScannerOpen(false);
        setUseCamera(false);
        setIsDetected(false);
        setQuickCreateOpen(true);
      }, 500);
    } catch (e) {
      toast.error("Error al validar el código");
      setIsDetected(false);
    }
  };

  const handleReScan = () => {
      // Validar inputs primero
      if (!quickFormData.name.trim()) return toast.warning("Ingrese el nombre del producto primero");
      if (!quickFormData.price || parseFloat(quickFormData.price) <= 0) return toast.warning("Ingrese un precio válido");
      if (quickFormData.stock === "") return toast.warning("Ingrese la existencia inicial");

      setScannerOpen(true);
  };

  const handleStartScanner = () => {
    setScannedBarcodes([]);
    setScannerOpen(true);
  };

  const finalizeScan = () => {
    if (scannedBarcodes.length === 0) {
      toast.error("No has escaneado ningún código");
      return;
    }
    setScannerOpen(false);
    setUseCamera(false);
    setQuickCreateOpen(true);
  };

  useEffect(() => {
    if (!scannerOpen) {
      setUseCamera(false);
    }
  }, [scannerOpen]);

  // Manejar entrada de teclado (pistola) globalmente cuando el modal está abierto
  useEffect(() => {
    if (!scannerOpen || useCamera) return;

    let buffer = "";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (buffer.length > 3) {
          onScanComplete(buffer);
        }
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scannerOpen, useCamera, scannedBarcodes]);

  useEffect(() => {
    let html5QrCode: any = null;

    const startScanner = async () => {
      try {
        // Retry mechanism
        let element = null;
        for (let i = 0; i < 10; i++) {
          element = document.getElementById("reader");
          if (element) break;
          await new Promise(r => setTimeout(r, 100));
        }

        if (!element) return;

        // Soporte completo para todos los formatos de códigos de barras comunes
        const formatsToSupport = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; 

        html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 60,
            qrbox: 250,
            aspectRatio: 1.0, // Cambiado a 1.0 para maximizar el área de captura
            disableFlip: true,
            rememberLastUsedCamera: true,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            },
            videoConstraints: {
                width: { min: 1280, ideal: 1920, max: 3840 }, // Forzamos alta resolución (hasta 4K)
                height: { min: 720, ideal: 1080, max: 2160 },
                facingMode: "environment",
                focusMode: "continuous",
                // Habilitamos controles avanzados de zoom si el navegador lo permite
                advanced: [{ 
                    focusMode: "continuous",
                    // @ts-ignore
                    whiteBalanceMode: "continuous",
                    // @ts-ignore
                    exposureMode: "continuous"
                }] as any
            }
          },
          (decodedText: string) => {
            onScanComplete(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera error", err);
      }
    };

    if (useCamera && scannerOpen) {
      startScanner();
    }

    return () => {
      if (html5QrCode) {
        const cleanup = async () => {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
        };
        cleanup().catch(e => {});
      }
    };
  }, [useCamera, scannerOpen]);

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcodeValue && !scannedBarcodes.includes(manualBarcodeValue)) {
      setScannedBarcodes([...scannedBarcodes, manualBarcodeValue]);
      toast.success("Código agregado manualmente");
    }
    setManualBarcodeValue("");
    setManualBarcodeOpen(false);
  };

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const payload = { 
          name: quickFormData.name, 
          price: Number(quickFormData.price), 
          stock: Number(quickFormData.stock),
          barcodes: scannedBarcodes
        };
        console.log('[Frontend] QuickCreate Payload:', payload);
        const res = await fetch(`${API}/products/quick-create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      if (res.ok) {
        toast.success("Producto creado exitosamente");
        
        // Remove from waitlist if came from there
        const pendingId = (window as any)._pendingWaitlistId;
        if (pendingId) {
          const token = localStorage.getItem("token");
          await fetch(`${API}/products/waitlist/${pendingId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
          (window as any)._pendingWaitlistId = null;
        }

        setQuickCreateOpen(false);
        setQuickFormData({ name: "", price: "", stock: "" });
        setScannedBarcodes([]);
        load();
      }
    } catch (e) {
      toast.error("Error al guardar producto");
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection);
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} productos?`);
    if (!confirmed) return;

    toast.promise(
      async () => {
        const token = localStorage.getItem("token");
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
          try {
            const res = await fetch(`${API}/products/${id}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
              await db.products.delete(id);
              successCount++;
            } else {
              failCount++;
            }
          } catch (e) {
            failCount++;
          }
        }

        setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
        setRowSelection({});
        
        if (failCount > 0) {
          throw new Error(`Se eliminaron ${successCount} productos, pero ${failCount} fallaron (posiblemente por historial de ventas).`);
        }
        return true;
      },
      {
        loading: "Eliminando productos seleccionados...",
        success: "Productos eliminados correctamente",
        error: (err) => err.message,
      }
    );
  };

  const handleBulkExport = () => {
    const selectedIds = Object.keys(rowSelection);
    const dataToExport = products
      .filter(p => selectedIds.includes(p.id))
      .map(p => ({
        ID: p.id,
        Nombre: p.name,
        Descripcion: p.description,
        Categoria: p.category?.name || "",
        Stock_Total: p.totalStock,
        Estado: p.status,
        Precio_Venta: p.variants?.[0]?.price || 0,
        SKU: p.variants?.[0]?.sku || "",
        Codigo_Barras: p.variants?.[0]?.barcode || ""
      }));

    if (dataToExport.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Seleccion_Productos");
    XLSX.writeFile(wb, `Syncro_Seleccion_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Exportación de selección completada");
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    const deletingId = productToDelete.id;
    console.log('[Frontend] Deleting Product:', { id: deletingId, name: productToDelete.name });
    
    toast.promise(
      async () => {
        const token = localStorage.getItem("token");
        const url = `${API}/products/${deletingId}`;
        console.log('[Frontend] DELETE Request to:', url);
        
        const res = await fetch(url, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json().catch(() => ({}));
        console.log('[Frontend] Server Response:', data);

        if (!res.ok) {
          console.error('[Frontend] Global Deletion Error Body:', data);
          throw new Error(data.message || "Error al eliminar en servidor");
        }

        // IMPORTANT: Also remove from LOCAL DB
        try {
          await db.products.delete(deletingId);
          console.log('[Frontend] Deleted from local DB');
        } catch (localErr) {
          console.error('[Frontend] Error deleting from local DB:', localErr);
        }

        // Update local state immediately
        setProducts(prev => prev.filter(p => p.id !== deletingId));
        setProductToDelete(null);
        return true;
      },
      {
        loading: "Eliminando producto...",
        success: "Producto eliminado correctamente",
        error: (err) => err.message,
      }
    );
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Producto",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div
            className="flex items-center gap-3 cursor-pointer group/row"
            onClick={() => openDetail(p)}
          >
            <div className="bg-muted size-12 rounded-lg overflow-hidden flex items-center justify-center border shrink-0 group-hover/row:border-primary/50 transition-colors">
              {p.image ? (
                <img src={p.image} alt={p.name} className="size-full object-cover" />
              ) : (
                <IconPackage size={24} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight text-foreground group-hover/row:text-primary transition-colors">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {p.variants?.length || 0} variantes
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "price",
      header: "Precio",
      cell: ({ row }) => {
        const p = row.original;
        const price = p.variants?.[0]?.price || 0;
        return (
          <div className="flex flex-col">
            <span className="font-bold text-sm text-foreground">{formatPrice(price)}</span>
            {currency !== "VES" && (
              <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">
                Bs {(price * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.category?.name || "Sin categoría"}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado Stock",
      cell: ({ row }) => {
        const { status, totalStock } = row.original;
        return (
          <Badge variant={status === 'CRITICAL' ? "destructive" : status === 'LOW' ? "warning" : "secondary"} className="font-bold">
            {totalStock} unid. {status && status !== 'NORMAL' && `(${status})`}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" className="size-8 text-primary" title="Ver ficha" onClick={() => openDetail(p)}>
              <IconEye size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" title="Editar producto" onClick={() => openDetail(p, true)}>
              <IconPencil size={15} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50" title="Eliminar producto" onClick={() => setProductToDelete(p)}>
              <IconTrash size={15} />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleExport = () => {
    try {
      const selectedIds = Object.keys(rowSelection);
      const isSelected = selectedIds.length > 0;
      
      const productsToExport = isSelected 
        ? products.filter(p => selectedIds.includes(p.id)) 
        : products;

      if (productsToExport.length === 0) return toast.info("No hay productos para exportar");

      const dataToExport = productsToExport.map(p => ({
        ID: p.id,
        Nombre: p.name,
        Descripcion: p.description,
        Categoria: p.category?.name || "",
        Stock_Total: p.totalStock,
        Estado: p.status,
        Precio_Venta: p.variants?.[0]?.price || 0,
        SKU: p.variants?.[0]?.sku || "",
        Codigo_Barras: p.variants?.[0]?.barcode || ""
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Productos");
      XLSX.writeFile(wb, `Syncro_Productos_${isSelected ? 'Seleccion_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(isSelected ? "Selección exportada exitosamente" : "Catálogo completo exportado");
    } catch (e) {
      toast.error("Error al exportar datos");
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log("Importing rows:", rows);
        
        let successCount = 0;
        const token = localStorage.getItem("token");

        for (const row of rows as any[]) {
          const payload = {
            name: row.Nombre || row.name || row.Producto || "Sin nombre",
            price: Number(row.Precio_USD || row.Precio || row.Precio_Venta || row.price || 0),
            cost: Number(row.Costo_USD || row.Costo || row.cost || 0),
            stock: Number(row.Stock || row.Existencia || row.stock || 0),
            sku: row.SKU || row.sku || "",
            barcodes: row.Codigo_Barras || row.barcode ? [String(row.Codigo_Barras || row.barcode)] : [],
            categoryName: row.Categoria || row.category || "",
            isWeighable: !!(row.Pesable || row.isWeighable || false),
            description: row.Descripcion || row.description || "",
            branchId: localStorage.getItem("currentBranchId") || ""
          };

          const res = await fetch(`${API}/products/quick-create`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          if (res.ok) successCount++;
        }

        toast.success(`Importación finalizada: ${successCount} productos creados`);
        setImportOpen(false);
        load();
      } catch (err) {
        toast.error("Error al procesar el archivo");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { Nombre: "Ejemplo Producto", Precio_Venta: 100.50, Stock: 50, Codigo_Barras: "123456789" }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "plantilla_importacion_syncro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(gridSearch.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(gridSearch.toLowerCase())
  );
  const totalGridPages = Math.max(1, Math.ceil(filteredProducts.length / gridPageSize));
  const paginatedGridProducts = filteredProducts.slice(
    (gridPage - 1) * gridPageSize,
    gridPage * gridPageSize
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading">SYNCRO RETAIL HUB</h1>
            <Badge variant="outline" className={cn(
              "hidden sm:inline-flex text-[10px] h-5 py-0 px-1.5 font-bold uppercase tracking-wider",
              isOnline ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
            )}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Gestión avanzada de productos y variantes</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden bg-muted/40 p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                viewMode === 'table'
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Vista tabla"
            >
              <IconLayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                viewMode === 'grid'
                  ? "bg-background shadow-sm text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Vista cuadrícula"
            >
              <IconLayoutGrid size={16} />
            </button>
          </div>
          <Button variant="outline" className="gap-2 border-primary/20 text-muted-foreground" onClick={handleExport}>
            <IconDownload size={16} /> Exportar
          </Button>
          <Button variant="outline" className="gap-2 border-primary/20 text-muted-foreground" onClick={() => setImportOpen(true)}>
            <IconUpload size={16} /> Importar
          </Button>
          <Button variant="outline" className="gap-2 border-primary/20 text-primary" onClick={handleStartScanner}>
            <IconScan size={16} /> Escaneo
          </Button>
          <Button variant="outline" className="gap-2 border-primary/20 text-orange-500 hover:bg-orange-500/10" onClick={loadWaitlist}>
            <IconList size={16} /> Lista de Espera 
            {waitlistItems.length > 0 && <Badge className="ml-1 px-1 h-4 bg-orange-500">{waitlistItems.length}</Badge>}
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20" onClick={() => router.push("/dashboard/productos/nuevo")}>
            <IconPlus size={16} /> Nuevo Producto
          </Button>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <PosTable
          columns={columns}
          data={products}
          loading={loading}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row) => row.id}
          searchPlaceholder="Buscar por nombre, SKU o código de barras..."
          bulkActions={
            Object.keys(rowSelection).length > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 gap-2 font-bold text-xs"
                onClick={handleBulkDelete}
              >
                <IconTrash size={14} /> Eliminar ({Object.keys(rowSelection).length})
              </Button>
            )
          }
        />
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="flex flex-col gap-4">
          {/* Search bar for grid */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
              <input
                type="text"
                placeholder="Buscar por nombre o categoría..."
                value={gridSearch}
                onChange={e => { setGridSearch(e.target.value); setGridPage(1); }}
                className="w-full h-9 pl-9 pr-4 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            {Object.keys(rowSelection).length > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-9 gap-2 font-bold text-xs px-4 shadow-lg shadow-rose-500/10"
                onClick={handleBulkDelete}
              >
                <IconTrash size={14} /> Eliminar Seleccionados ({Object.keys(rowSelection).length})
              </Button>
            )}
          </div>

          {/* Skeleton grid */}
          {loading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Product cards */}
          {!loading && (
            <>
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                  <IconPackage size={48} stroke={1} />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {paginatedGridProducts.map(p => {
                  const statusColor =
                    p.status === 'CRITICAL'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      : p.status === 'LOW'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                  const price = p.variants?.[0]?.price ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="group relative rounded-2xl border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
                      onClick={() => openDetail(p)}
                    >
                      {/* Product image */}
                      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="size-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <IconPackage size={40} className="text-muted-foreground/30" stroke={1.2} />
                        )}
                        {/* Stock badge overlay */}
                        <div className={cn("absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full border", statusColor)}>
                          {p.totalStock} u.
                        </div>
                        {/* Hover actions overlay */}
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); openDetail(p); }}
                            className="size-8 rounded-full bg-background border shadow-sm flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                            title="Ver ficha"
                          >
                            <IconEye size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); openDetail(p, true); }}
                            className="size-8 rounded-full bg-background border shadow-sm flex items-center justify-center hover:bg-foreground hover:text-background transition-colors"
                            title="Editar"
                          >
                            <IconPencil size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setProductToDelete(p); }}
                            className="size-8 rounded-full bg-background border shadow-sm flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                            title="Eliminar"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                        
                        {/* Selector para modo Grid */}
                        <div 
                          className={cn(
                            "absolute top-2 left-2 z-20 transition-opacity duration-200",
                            Object.keys(rowSelection).length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                          onClick={e => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={!!rowSelection[p.id]}
                            onCheckedChange={(val) => {
                              setRowSelection(prev => {
                                const next = { ...prev };
                                if (val) next[p.id] = true;
                                else delete next[p.id];
                                return next;
                              });
                            }}
                            className="bg-background shadow-md border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          />
                        </div>
                      </div>

                      {/* Card info */}
                      <div className="p-3 space-y-1.5">
                        <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">{p.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md truncate max-w-[70%]">
                            {p.category?.name || 'Sin categoría'}
                          </span>
                          <span className="text-sm font-bold text-primary">${price}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination footer — same style as the table */}
              {filteredProducts.length > 0 && (
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{filteredProducts.length} registro(s)</span>
                  <div className="flex items-center gap-4">
                    {/* Rows per page */}
                    <div className="flex items-center gap-2">
                      <span>Filas por página</span>
                      <select
                        value={gridPageSize}
                        onChange={e => { setGridPageSize(Number(e.target.value)); setGridPage(1); }}
                        className="h-7 rounded-md border bg-background px-2 text-xs cursor-pointer outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {[10, 20, 30, 50].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {/* Page info */}
                    <span>Página {gridPage} de {totalGridPages}</span>
                    {/* Nav buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setGridPage(1)}
                        disabled={gridPage === 1}
                        className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Primera página"
                      >
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2 7.5L7.5 2M2 7.5L7.5 13M2 7.5H13M8.5 2L14 7.5M8.5 13L14 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button
                        onClick={() => setGridPage(p => Math.max(1, p - 1))}
                        disabled={gridPage === 1}
                        className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Anterior"
                      >
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M9 11L5 7.5L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button
                        onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                        disabled={gridPage === totalGridPages}
                        className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Siguiente"
                      >
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M6 4L10 7.5L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button
                        onClick={() => setGridPage(totalGridPages)}
                        disabled={gridPage === totalGridPages}
                        className="size-7 flex items-center justify-center rounded-md border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Última página"
                      >
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M13 7.5L7.5 2M13 7.5L7.5 13M13 7.5H2M6.5 2L1 7.5M6.5 13L1 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style jsx global>{`
        * {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        }
        #reader {
          position: relative;
          background: #000;
          width: 100% !important;
          height: 100% !important;
        }
        #reader video, 
        #reader canvas,
        #reader div {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            object-position: center !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
        }
        #reader__scan_region {
            background: transparent !important;
        }
        #reader__dashboard {
            display: none !important;
        }
        #reader__scan_region svg rect {
            display: none !important;
        }
        #qr-shaded-region {
            display: none !important;
        }
        @keyframes scanline {
            0% { top: 10%; opacity: 0; }
            50% { top: 90%; opacity: 1; }
            100% { top: 10%; opacity: 0; }
        }
        .animate-scanline {
            position: absolute;
            background: linear-gradient(to bottom, transparent, currentColor, transparent);
            box-shadow: 0 0 25px currentColor;
            height: 4px !important;
            filter: blur(1px);
            animation: scanline 2.5s ease-in-out infinite;
        }
        .hide-close-btn button[class*="absolute"] {
            display: none !important;
        }
      `}</style>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto hide-close-btn">
          {selectedProduct && (
            <div className="space-y-6 py-4 px-4 md:px-6">
              {!isEditing ? (
                <>
                  {/* VIEW MODE LAYOUT */}
                  <SheetHeader className="relative">
                    <div className="absolute top-0 right-0">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 h-8 text-xs font-bold text-primary border-primary/20 hover:bg-primary/5 shadow-sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <IconPencil size={14} /> Editar Producto
                      </Button>
                    </div>
                    <div className="flex items-start gap-4 pr-20">
                      <div className="size-24 bg-muted rounded-2xl overflow-hidden border-2 border-primary/10 shrink-0">
                        {selectedProduct.image ? <img src={selectedProduct.image} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center opacity-20"><IconPackage size={40}/></div>}
                      </div>
                      <div className="flex-1">
                         <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{selectedProduct.category?.name || "Retail"}</Badge>
                            {selectedProduct.supplier && (
                               <Badge className="bg-primary/10 text-primary border-primary/20">{selectedProduct.supplier.name}</Badge>
                            )}
                         </div>
                         <SheetTitle className="text-3xl font-black leading-none mb-2">{selectedProduct.name}</SheetTitle>
                         <p className="text-muted-foreground text-sm line-clamp-2">{selectedProduct.description || "Sin descripción de producto disponible."}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                     <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                       <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Stock Total</p>
                       <p className="text-2xl font-black">{selectedProduct.totalStock}</p>
                     </div>
                     <div className="bg-muted/50 p-4 rounded-2xl border">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Costo Estim.</p>
                       <p className="text-2xl font-black">${selectedProduct.variants?.[0]?.cost || 0}</p>
                     </div>
                     <div className="bg-muted/50 p-4 rounded-2xl border">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ventas (7d)</p>
                       <p className="text-2xl font-black">{stats?.totalSoldLast7Days || 0}</p>
                     </div>
                     <div className="bg-muted/50 p-4 rounded-2xl border">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Margen</p>
                       <p className="text-2xl font-black">
                         {selectedProduct.variants?.[0]?.cost 
                            ? `${Math.round(((selectedProduct.variants[0].price - selectedProduct.variants[0].cost) / selectedProduct.variants[0].price) * 100)}%` 
                            : "0%"}
                       </p>
                     </div>
                   </div>
                  </SheetHeader>

                  <Tabs defaultValue="variantes">
                    <TabsList className="w-full bg-muted/30 p-1 rounded-xl">
                      <TabsTrigger value="variantes" className="flex-1 rounded-lg">Variantes</TabsTrigger>
                      <TabsTrigger value="stats" className="flex-1 rounded-lg">Inteligencia</TabsTrigger>
                    </TabsList>

                    <TabsContent value="variantes" className="mt-6 space-y-4">
                      {selectedProduct.variants?.map((v: any, idx) => (
                         <div key={v.id || v.sku || idx} className="p-5 rounded-2xl border bg-card hover:border-primary/40 transition-all flex flex-col gap-4 group">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="size-12 bg-muted rounded-xl flex items-center justify-center font-black text-sm text-primary">
                                  {v.name.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-black text-sm uppercase tracking-tight">{v.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                                    <IconBarcode size={12}/> {v.sku} {v.barcode && `| ${v.barcode}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">Precio Unit.</p>
                                 <p className="font-black text-xl text-primary leading-none">${v.price}</p>
                              </div>
                           </div>

                           <div className="grid grid-cols-3 gap-2 py-3 border-y border-dashed">
                              <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Costo</p>
                                <p className="font-bold text-sm text-foreground">${v.cost || 0}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Utilidad</p>
                                <p className="font-bold text-sm text-green-600">${(v.price - (v.cost || 0)).toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Existencia</p>
                                <p className={cn(
                                  "font-bold text-sm",
                                  v.stock <= v.minStock ? "text-destructive" : "text-foreground"
                                )}>{v.stock} unid.</p>
                              </div>
                           </div>

                           {v.secondaryBarcodes && v.secondaryBarcodes.length > 0 && (
                              <div className="space-y-2">
                                 <p className="text-[9px] font-bold text-muted-foreground uppercase">Códigos Adicionales</p>
                                 <div className="flex flex-wrap gap-1.5">
                                    {v.secondaryBarcodes.map((bc: string) => (
                                       <Badge key={bc} variant="secondary" className="text-[9px] font-mono py-0 px-2 rounded-md bg-muted/50 border-none">
                                          {bc}
                                       </Badge>
                                    ))}
                                 </div>
                              </div>
                           )}
                         </div>
                       ))}
                    </TabsContent>

                    <TabsContent value="stats" className="mt-6 space-y-6">
                      <div className="p-6 rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><IconTrendingUp size={18} className="text-primary"/> Rendimiento de Venta</h3>
                        <div className="space-y-4 text-sm">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Ventas Totales (Acumulado)</span>
                            <span className="font-bold">{stats?.totalQuantitySold || 0} unidades</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Última Venta</span>
                            <span className="font-bold">{stats?.lastSale ? new Date(stats.lastSale).toLocaleDateString() : 'Sin ventas'}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Precio Promedio Venta</span>
                            <span className="font-bold text-primary">${stats?.averagePrice || 0}</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              ) : (
                <>
                  {/* EDIT MODE LAYOUT */}
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between pb-4 border-b border-border/60">
                      <div>
                        <h2 className="text-xl font-black">Editar Producto</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Modifica los detalles generales y variantes.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setIsEditing(false)} 
                          className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                          disabled={saving}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleSaveChanges} 
                          className="h-9 px-5 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <div className="size-3.5 rounded-full border border-primary-foreground border-t-transparent animate-spin" />
                              <span>Guardando...</span>
                            </>
                          ) : (
                            <>
                              <IconDeviceFloppy size={14}/>
                              <span>Guardar</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-5">
                        {/* Información General */}
                        <div className="p-5 bg-card rounded-2xl border shadow-sm space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Información General</h3>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Nombre del Producto</Label>
                              <Input 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                placeholder="Ej: Zapatos Deportivos XYZ" 
                                className="h-10 text-sm font-bold bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all" 
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Descripción</Label>
                              <Input 
                                value={editDescription} 
                                onChange={e => setEditDescription(e.target.value)} 
                                placeholder="Breve descripción para el cliente" 
                                className="h-10 text-sm bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Categoría</Label>
                                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                                  <SelectTrigger className="h-10 bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all">
                                    <SelectValue placeholder="Seleccionar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c, idx) => (
                                      <SelectItem key={c.id || c._id || idx} value={c.id || c._id}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Proveedor</Label>
                                <Select value={editSupplierId} onValueChange={setEditSupplierId}>
                                  <SelectTrigger className="h-10 bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all">
                                    <SelectValue placeholder="Seleccionar..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {suppliers.map((s, idx) => (
                                      <SelectItem key={s.id || s._id || idx} value={s.id || s._id}>
                                        {s.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3.5 border border-border/50 rounded-xl bg-muted/10">
                              <div className="space-y-0.5">
                                <Label htmlFor="edit-weighable-switch" className="font-bold text-xs cursor-pointer block">
                                  Producto Pesable
                                </Label>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                  Activa si se vende por peso fraccionado (Ej: Kg).
                                </p>
                              </div>
                              <Switch 
                                id="edit-weighable-switch" 
                                checked={editIsWeighable} 
                                onCheckedChange={setEditIsWeighable} 
                                className="data-[state=checked]:bg-emerald-500 shrink-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Imagen Lateral */}
                      <div className="space-y-5">
                        <div className="p-5 bg-card rounded-2xl border shadow-sm space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Imagen del Producto</h3>
                          <div 
                            className="relative border-2 border-dashed border-primary/20 hover:border-primary/40 rounded-2xl bg-muted/5 hover:bg-muted/10 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer min-h-[140px] group overflow-hidden"
                            onClick={() => editFileInputRef.current?.click()}
                          >
                            <input 
                              type="file" 
                              ref={editFileInputRef} 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleEditImageUpload} 
                            />
                            {uploadingImage ? (
                              <div className="space-y-2">
                                <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
                                <p className="text-[11px] text-muted-foreground font-medium">Subiendo...</p>
                              </div>
                            ) : editImage ? (
                              <div className="relative w-full flex items-center justify-center">
                                <img src={editImage} alt="Producto" className="max-h-[110px] object-contain rounded-lg" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                  <p className="text-white text-[10px] font-bold flex items-center gap-1"><IconPlus size={12} /> Cambiar Imagen</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 mx-auto">
                                  <IconPlus className="text-primary size-5" />
                                </div>
                                <p className="text-xs font-bold">Subir Imagen</p>
                                <p className="text-[10px] text-muted-foreground">PNG, JPG o WEBP</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Variantes */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Variantes y Precios</h3>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleAddVariant} 
                          className="gap-1.5 h-8 text-xs font-semibold border-primary/20 hover:bg-primary/5"
                        >
                          <IconPlus size={14}/> Añadir Variante
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {editVariants.map((v, idx) => (
                          <div 
                            key={v.id || v.sku || idx} 
                            className="p-5 bg-card rounded-2xl border shadow-sm relative group animate-in fade-in slide-in-from-top-2"
                          >
                            {editVariants.length > 1 && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" 
                                onClick={() => handleRemoveVariant(idx)}
                              >
                                <IconTrash size={15}/>
                              </Button>
                            )}
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Nombre de Variante</Label>
                                <Input 
                                  value={v.name} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].name = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  placeholder="Ej: Rojo / 42" 
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">SKU</Label>
                                <Input 
                                  value={v.sku} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].sku = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  className="h-9 text-xs font-mono bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Código de Barras principal</Label>
                                <div className="relative">
                                  <IconBarcode size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <Input 
                                    value={v.barcode} 
                                    onChange={e => {
                                      const n = [...editVariants]; 
                                      n[idx].barcode = e.target.value; 
                                      setEditVariants(n);
                                    }} 
                                    className="h-9 text-xs pl-9 bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all" 
                                    placeholder="EAN-13" 
                                  />
                                </div>
                              </div>

                              {/* Códigos Adicionales */}
                              <div className="sm:col-span-2 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Códigos de Barras Secundarios</Label>
                                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/10 rounded-xl border border-dashed border-muted-foreground/10">
                                  {v.secondaryBarcodes?.map((bc: string, bIdx: number) => (
                                    <div key={`${bc}-${bIdx}`} className="bg-background border px-2 py-1 rounded-lg text-[9px] font-mono flex items-center gap-1.5">
                                      {bc}
                                      <button 
                                        type="button"
                                        className="text-destructive hover:scale-110 transition-transform"
                                        onClick={() => {
                                          const n = [...editVariants];
                                          n[idx].secondaryBarcodes = n[idx].secondaryBarcodes.filter((_: any, i: number) => i !== bIdx);
                                          setEditVariants(n);
                                        }}
                                      >
                                        <IconX size={10}/>
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    type="button"
                                    className="text-[9px] font-bold text-primary px-2 py-1 hover:bg-primary/5 rounded-lg border border-dashed border-primary/20 transition-colors"
                                    onClick={() => {
                                      const code = prompt("Nuevo código secundario:");
                                      if (code) {
                                        const n = [...editVariants];
                                        if (!n[idx].secondaryBarcodes) n[idx].secondaryBarcodes = [];
                                        n[idx].secondaryBarcodes.push(code);
                                        setEditVariants(n);
                                      }
                                    }}
                                  >
                                    + Añadir
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-primary font-bold">Precio Venta</Label>
                                <Input 
                                  type="number" 
                                  value={v.price} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].price = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  placeholder="0.00" 
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all font-bold text-primary"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Costo</Label>
                                <Input 
                                  type="number" 
                                  value={v.cost} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].cost = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  placeholder="0.00" 
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Stock Inicial</Label>
                                <Input 
                                  type="number" 
                                  value={v.stock} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].stock = e.target.value; 
                                    setEditVariants(n);
                                  }}
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold font-mono">Stock Mínimo</Label>
                                <Input 
                                  type="number" 
                                  value={v.minStock} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].minStock = e.target.value; 
                                    setEditVariants(n);
                                  }}
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Precio Promo</Label>
                                <Input 
                                  type="number" 
                                  value={v.promoPrice} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].promoPrice = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all border-orange-200/50" 
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground font-semibold">Precio Mayor</Label>
                                <Input 
                                  type="number" 
                                  value={v.bulkPrice} 
                                  onChange={e => {
                                    const n = [...editVariants]; 
                                    n[idx].bulkPrice = e.target.value; 
                                    setEditVariants(n);
                                  }} 
                                  className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background transition-all border-blue-200/50" 
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 🟢 MODAL: ESCANEO MEJORADO */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className={cn("overflow-hidden bg-black/95 border-white/10 shadow-2xl p-0 transition-all duration-300", useCamera ? "sm:max-w-[320px]" : "sm:max-w-md")}>
          <DialogHeader className="sr-only">
             <DialogTitle>Captura de Código de Barras</DialogTitle>
          </DialogHeader>
          
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 size-8 rounded-full bg-black/50 hover:bg-white/10 text-white z-50" onClick={() => setScannerOpen(false)}>
            <IconX size={16} />
          </Button>

          <div className={cn("relative w-full flex flex-col items-center justify-center transition-all duration-300", useCamera ? "h-[320px]" : "h-[360px] sm:h-[400px]")}>
            {!useCamera ? (
              <div className="flex flex-col items-center w-full max-w-[280px] text-center space-y-6 pt-4 animate-in zoom-in-95 duration-500">
                <input 
                  ref={scannerInputRef}
                  autoFocus
                  className="opacity-0 absolute top-0 left-0 size-1 pointer-events-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val) onScanComplete(val);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  onBlur={() => {
                    if (scannerOpen && !useCamera) {
                       setTimeout(() => scannerInputRef.current?.focus(), 100);
                    }
                  }}
                />
                <div className="w-full flex flex-col items-center justify-center py-12 gap-8 bg-muted/10 border border-muted/20 rounded-2xl relative overflow-hidden">
                   <div className="size-24 rounded-xl bg-background border border-muted/50 shadow-sm flex items-center justify-center text-muted-foreground relative z-10">
                     <IconBarcode size={48} stroke={1.2} />
                   </div>
                   <div className="text-center space-y-2 relative z-10">
                     <p className="font-semibold text-lg tracking-tight">
                        {quickCreateOpen ? `Escaneando para: ${quickFormData.name}` : "Escáner Listo"}
                     </p>
                     <p className="text-[11px] text-muted-foreground/50 font-normal tracking-tight">Esperando lector láser...</p>
                   </div>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mx-auto size-14 hover:bg-primary/5 transition-all group" 
                  onClick={() => setUseCamera(true)}
                  title="Usar Cámara"
                >
                  <IconCamera size={32} className="text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-500" />
                </Button>
              </div>
            ) : (
                <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
                    <div className={cn(
                        "relative w-full h-full rounded-xl overflow-hidden border shadow-2xl bg-black flex items-center justify-center",
                        isDetected ? "border-green-500" : "border-white/10"
                    )}>
                        {/* the #reader container must be square-ish so the camera stretches nicely */}
                        <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:min-h-full [&_#qr-shaded-region]:hidden"></div>
                        
                        {/* Láser Minimalista (Oscilante) */}
                        <div className={cn(
                            "absolute inset-x-8 z-10 animate-scanline transition-all duration-300 h-0.5 shadow-[0_0_8px_currentColor]",
                            isDetected ? "text-green-500 bg-green-500" : "text-primary bg-primary"
                        )} />
                        
                        {/* Esquinas Rectangulares Transparentes */}
                        <div className="absolute inset-6 z-20 pointer-events-none opacity-40 mix-blend-difference filter drop-shadow-md">
                            <div className={cn("absolute top-0 left-0 size-8 border-t-2 border-l-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute top-0 right-0 size-8 border-t-2 border-r-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 left-0 size-8 border-b-2 border-l-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 right-0 size-8 border-b-2 border-r-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                        </div>

                        {isDetected && (
                            <div className="absolute inset-0 bg-green-500/20 z-10 animate-in fade-in zoom-in duration-300" />
                        )}
                    </div>

                    {/* Contexto de Escaneo Iterativo */}
                    {quickCreateOpen && quickFormData.name && (
                        <div className="absolute bottom-4 left-0 right-0 text-center animate-in fade-in slide-in-from-top-1 duration-500 z-50 pointer-events-none">
                            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest bg-black/50 backdrop-blur px-3 py-1.5 rounded-full inline-block">
                                Asignando a: <span className="text-white">{quickFormData.name}</span>
                            </p>
                        </div>
                    )}
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 🔵 MODAL: CREACIÓN RÁPIDA (CON BARCODES) */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="sm:max-w-lg overflow-hidden border-none shadow-2xl">
          <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
             <IconPlus size={150} />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-normal">NUEVO REGISTRO</DialogTitle>
            <DialogDescription className="font-normal opacity-70">
                Complete los detalles finales para dar de alta el producto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickSave} className="space-y-6 pt-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="q-name" className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Nombre del Producto</Label>
                <Input 
                  id="q-name" 
                  placeholder="Ej. Bebida Energética 500ml" 
                  className="h-12 text-lg font-medium bg-muted/50 border-transparent focus:border-primary/30 focus:bg-background transition-all"
                  required 
                  value={quickFormData.name}
                  onChange={(e) => setQuickFormData({...quickFormData, name: e.target.value})}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Códigos de Barras Asignados</Label>
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-2xl border border-dashed border-muted-foreground/20">
                  {scannedBarcodes.map((code, idx) => (
                    <div key={`${code}-${idx}`} className="bg-background border px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-2 group animate-in zoom-in-95 duration-200">
                      <IconBarcode size={14} className="text-primary/60" />
                      <span className="font-mono font-medium text-sm">{code}</span>
                      <button 
                        type="button"
                        onClick={() => setScannedBarcodes(scannedBarcodes.filter(c => c !== code))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    title="Escanear otro código"
                    className="size-9 rounded-xl border border-dashed border-primary/30 text-primary/60 hover:bg-primary/5 transition-all items-center justify-center flex"
                    onClick={handleReScan}
                  >
                    <IconScan size={18}/>
                  </button>
                  <button 
                    type="button"
                    title="Agregar código manualmente"
                    className="size-9 rounded-xl border border-transparent text-muted-foreground/30 hover:text-muted-foreground transition-all items-center justify-center flex"
                    onClick={() => {
                        setManualBarcodeValue("");
                        setManualBarcodeOpen(true);
                    }}
                  >
                    <IconPlus size={18}/>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="q-price" className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Precio de Venta</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">$</span>
                    <Input 
                      id="q-price" 
                      type="number" 
                      step="0.01" 
                      className="h-12 pl-8 font-mono text-lg font-medium bg-muted/50 border-transparent transition-all"
                      placeholder="0.00" 
                      required 
                      value={quickFormData.price}
                      onChange={(e) => setQuickFormData({...quickFormData, price: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="q-stock" className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Existencia Inicial</Label>
                  <Input 
                    id="q-stock" 
                    type="number" 
                    className="h-12 font-mono text-lg font-medium bg-muted/50 border-transparent transition-all"
                    placeholder="0" 
                    required 
                    value={quickFormData.stock}
                    onChange={(e) => setQuickFormData({...quickFormData, stock: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" className="h-10 px-6 rounded-xl font-medium text-xs text-muted-foreground/60" onClick={() => setQuickCreateOpen(false)}>
                Descartar
              </Button>
              <Button type="submit" className="h-10 px-8 rounded-xl font-semibold text-xs uppercase tracking-tight bg-primary text-primary-foreground shadow-sm">
                Confirmar Registro
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* MODAL ELIMINACION */}
      <Dialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar producto?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará <span className="font-semibold text-foreground">"{productToDelete?.name}"</span> permanentemente del catálogo. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
             <Button variant="ghost" onClick={() => setProductToDelete(null)}>Cancelar</Button>
             <Button 
                variant="destructive" 
                onClick={handleDelete}
             >
                Eliminar
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🟠 MODAL: ENTRADA MANUAL DE CÓDIGO */}
      <Dialog open={manualBarcodeOpen} onOpenChange={setManualBarcodeOpen}>
        <DialogContent className="sm:max-w-[400px] border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBarcode className="text-primary" size={20}/>
              Código Manual
            </DialogTitle>
            <DialogDescription>
              Ingrese el número del código de barras del producto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualBarcodeSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="manual-code" className="text-[10px] uppercase font-bold text-muted-foreground">Número de Código</Label>
              <Input
                id="manual-code"
                autoFocus
                placeholder="Ej. 750123456789"
                value={manualBarcodeValue}
                onChange={(e) => setManualBarcodeValue(e.target.value)}
                className="h-12 text-xl font-mono tracking-widest text-center bg-muted/50 border-transparent focus:border-primary/30"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-tight">
                Agregar Código
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🟢 MODAL: IMPORTACIÓN MASIVA */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <IconUpload className="text-primary" /> Importar Productos
            </DialogTitle>
            <DialogDescription>
              Carga tus productos masivamente desde un archivo Excel o CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div 
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group",
                isImporting ? "opacity-50 pointer-events-none" : "hover:border-primary/50 hover:bg-primary/5"
              )}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleImport(file);
              }}
            >
              <input 
                id="file-input" 
                type="file" 
                className="hidden" 
                accept=".csv, .xlsx" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
              <div className="size-16 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <IconFileText size={32} className="text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">Haz clic o arrastra tu archivo aquí</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-1">Soporta .XLSX y .CSV</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                variant="link" 
                className="text-[11px] h-auto p-0 text-muted-foreground hover:text-primary flex items-center gap-1.5"
                onClick={downloadTemplate}
              >
                <IconDownload size={14} /> Descargar plantilla de ejemplo
              </Button>
              <p className="text-[9px] text-muted-foreground italic leading-relaxed">
                * El sistema es flexible: detectará automáticamente columnas como "Nombre", "Precio" y "Stock". Las variantes y códigos adicionales son detectados si existen.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: WAITLIST MANAGEMENT */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconList className="text-orange-500" /> Productos en Lista de Espera
            </DialogTitle>
            <DialogDescription>
              Estos productos fueron vendidos en el POS pero aún no están registrados formalmente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingWaitlist ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : waitlistItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No hay productos en espera</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-right">Precio</th>
                      <th className="p-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlistItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 font-mono text-[10px]">{item.barcode}</td>
                        <td className="p-2 text-right">${item.price.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary h-7 px-2"
                            onClick={() => handleApproveWaitlist(item)}
                          >
                            Aprobar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaitlistOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
