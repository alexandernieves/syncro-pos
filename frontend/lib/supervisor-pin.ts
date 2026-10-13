import { API_URL } from "@/lib/constants";

/** Checks the supervisor PIN on the server: the PIN itself never reaches the browser. */
export async function verifySupervisorPin(pin: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/settings/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ pin }),
  });
  if (res.status === 429) throw new Error("Demasiados intentos: espera un minuto");
  if (!res.ok) throw new Error("No se pudo verificar el PIN");
  return !!(await res.json()).ok;
}
