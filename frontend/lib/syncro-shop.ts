import { toast } from "sonner";

export interface SyncroShopVendor {
  email: string;
  name: string;
  businessName?: string;
  phoneNumber?: string;
}

export interface SyncroShopItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  price: number;
  imageSrc?: string;
  stock?: number;
  isPublished?: boolean;
}

export async function syncToSyncroShop(item: SyncroShopItem, isPublished: boolean = true) {
  try {
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") || "{}" : "{}";
    const userObj = JSON.parse(userStr);

    const vendor: SyncroShopVendor = {
      email: userObj.email || "vendedor@syncro.test",
      name: userObj.name || userObj.businessName || "Comerciante Syncro",
      businessName: userObj.businessName || "Tienda Syncro",
      phoneNumber: userObj.phone || userObj.phoneNumber || undefined,
    };

    const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || "https://syncro.shop";
    const res = await fetch(`${shopUrl}/api/syncro/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer syncro_secret_key_2026",
      },
      body: JSON.stringify({
        vendor,
        item: {
          ...item,
          isPublished,
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (isPublished) {
        toast.success(`Publicado con éxito en Syncro Shop 🛒`);
      } else {
        toast.info("Producto despublicado de Syncro Shop");
      }
      return data;
    } else {
      console.warn("Syncro Shop Sync Warning:", data.error || data.details);
      return null;
    }
  } catch (err) {
    console.error("Failed to sync product to Syncro Shop:", err);
    return null;
  }
}
