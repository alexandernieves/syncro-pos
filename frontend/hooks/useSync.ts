"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/lib/constants"
import { db } from "@/lib/db";
import { toast } from "sonner";

const API = API_URL;

export function useSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Update online status
  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  // Sync pending sales to server
  const syncPendingSales = useCallback(async () => {
    if (!navigator.onLine || syncing) return;
    
    const pending = await db.pendingSales
      .where("status")
      .equals("pending")
      .toArray();

    if (pending.length === 0) return;

    setSyncing(true);
    const token = localStorage.getItem("token");

    for (const sale of pending) {
      try {
        await db.pendingSales.update(sale.id!, { status: "syncing" });
        
        const res = await fetch(`${API}/sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(sale.data)
        });

        if (res.ok) {
          await db.pendingSales.delete(sale.id!);
          console.log(`[Sync] Sale ${sale.id} synced successfully`);
        } else {
          const err = await res.json();
          await db.pendingSales.update(sale.id!, { 
            status: "pending", 
            errorMessage: err.message || "Server Error" 
          });
        }
      } catch (error) {
        await db.pendingSales.update(sale.id!, { status: "pending" });
        break; // Network error or something, stop queue
      }
    }
    setSyncing(false);
  }, [syncing]);

  // Sync data whenever status goes online
  useEffect(() => {
    if (isOnline) {
      syncPendingSales();
    }
  }, [isOnline, syncPendingSales]);

  // Function to perform a "fresh" pull of products and clients
  const pullRemoteData = useCallback(async (forcedBranchId?: string | null) => {
    const token = localStorage.getItem("token");
    if (!token || !navigator.onLine) return;

    try {
      let currentBranchId = localStorage.getItem("currentBranchId") || "";
      if (forcedBranchId !== undefined) {
        currentBranchId = forcedBranchId || "";
      }
      
      const pUrl = currentBranchId ? `${API}/products?branchId=${currentBranchId}` : `${API}/products`;
      
      const [pRes, cRes] = await Promise.all([
        fetch(pUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (pRes.ok && cRes.ok) {
        const products = await pRes.json();
        const clients = await cRes.json();

        // Update Local DB
        await db.transaction("rw", [db.products, db.clients], async () => {
          // 1. OBTENER IDS DEL SERVIDOR
          const serverProductIds = products.map((p: any) => p.id);
          const serverClientIds = clients.map((c: any) => c.id);

          // 2. LIMPIEZA: BORRAR LOCALES QUE YA NO ESTÁN EN EL SERVIDOR
          await db.products.where("id").noneOf(serverProductIds).delete();
          await db.clients.where("id").noneOf(serverClientIds).delete();

          // 3. ACTUALIZAR O AÑADIR
          await db.products.bulkPut(products.map((p: any) => ({
            id: p.id,
            name: p.name,
            totalStock: p.totalStock,
            image: p.image,
            categoryName: p.category?.name,
            variants: p.variants || [],
            lastUpdated: Date.now()
          })));

          await db.clients.bulkPut(clients.map((c: any) => ({
            id: c.id,
            name: c.name,
            documentId: c.documentId,
            walletBalance: c.walletBalance || 0
          })));
        });
      }
    } catch (e) {
      console.error("[Sync] Error pulling data:", e);
    }
  }, []);

  return { 
    isOnline, 
    syncing, 
    syncPendingSales, 
    pullRemoteData 
  };
}
