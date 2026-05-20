import { db } from "./db";

/**
 * Clears all local authentication tokens, cookies, business preferences,
 * and completely wipes the IndexedDB data tables to prevent data leakage
 * when switching between different user accounts.
 */
export async function clearAuthSession() {
  if (typeof window !== "undefined") {
    // 1. Clear business/tenant and auth keys from localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("currentBranchId");
    localStorage.removeItem("businessName");
    localStorage.removeItem("selected-currency");

    // 2. Clear token cookie
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    // 3. Clear IndexedDB tables synchronously/asynchronously to ensure no data is left behind
    try {
      await Promise.all([
        db.products.clear(),
        db.clients.clear(),
        db.pendingSales.clear(),
        db.cache.clear(),
      ]);
      console.log("IndexedDB tables cleared successfully during logout.");
    } catch (error) {
      console.error("Failed to clear IndexedDB tables on logout:", error);
    }
  }
}
