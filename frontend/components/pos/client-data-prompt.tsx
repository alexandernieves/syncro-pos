"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconBrandWhatsapp, IconCheck, IconChevronDown, IconId, IconLoader2, IconSearch } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  type PhoneCountry,
  cleanNationalInput,
  countryFromAccount,
  formatWhatsAppNumber,
  searchPhoneCountries,
  splitInternational,
  toWhatsAppNumber,
} from "@/lib/phone-countries";
import { CountryPicker } from "@/components/forms/contact-fields";

// ── Venezuelan ID (cédula / RIF) ─────────────────────────────────────────────

const ID_PREFIXES = ["V", "E", "J", "G", "P"] as const;
type IdPrefix = (typeof ID_PREFIXES)[number];

/** V-12345678 style id, or null if it doesn't look valid. Outside Venezuela any id of 4+ characters is accepted. */
export function normalizeDocumentId(prefix: IdPrefix, raw: string, venezuelan: boolean): string | null {
  if (!venezuelan) {
    const free = raw.trim().toUpperCase();
    return free.replace(/[^A-Z0-9]/g, "").length >= 4 ? free : null;
  }
  const digits = raw.replace(/\D/g, "");
  // People: 6 to 9 digits. Companies and government: 8 or 9 digits (with check digit).
  const ok = prefix === "V" || prefix === "E" ? /^\d{6,9}$/.test(digits) : /^\d{8,9}$/.test(digits);
  return ok ? `${prefix}-${digits}` : null;
}

// ── Prompt ───────────────────────────────────────────────────────────────────

type PromptClient = { id: string; name?: string; phone?: string | null; documentId?: string | null };

type ClientDataPromptProps = {
  client: PromptClient;
  /** Country of the Syncro account: default dial code and id format. */
  country?: string | null;
  /** Other clients, to warn when the id already belongs to someone else. */
  knownClients?: PromptClient[];
  onSaved: (patch: { phone?: string; documentId?: string }, client: any) => void;
  className?: string;
};

export const clientIsMissingData = (client?: PromptClient | null) => !!client && (!client.phone?.trim() || !client.documentId?.trim());

/** Asks once for whatever the selected client is missing (WhatsApp and/or cédula) and saves it on the client. */
export function ClientDataPrompt({ client, country, knownClients, onSaved, className }: ClientDataPromptProps) {
  const accountCountry = useMemo(() => countryFromAccount(country), [country]);
  const venezuelan = accountCountry.iso === "VE";
  const needsPhone = !client.phone?.trim();
  const needsDocument = !client.documentId?.trim();

  const [dialCountry, setDialCountry] = useState<PhoneCountry>(accountCountry);
  const [phone, setPhone] = useState("");
  const [idPrefix, setIdPrefix] = useState<IdPrefix>("V");
  const [idValue, setIdValue] = useState("");
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhone("");
    setIdValue("");
    setIdPrefix("V");
    setDialCountry(accountCountry);
  }, [client.id, accountCountry]);

  const whatsapp = needsPhone ? toWhatsAppNumber(phone, dialCountry) : null;
  const phoneError = needsPhone && !whatsapp && phone.replace(/\D/g, "").length >= dialCountry.example.replace(/\D/g, "").length;
  const documentId = needsDocument ? normalizeDocumentId(idPrefix, idValue, venezuelan) : null;
  const documentError = needsDocument && !documentId && idValue.replace(/\D/g, "").length >= 10;
  const ready = (!needsPhone || !!whatsapp) && (!needsDocument || !!documentId);

  const handlePhoneChange = (raw: string) => {
    const intl = splitInternational(raw, dialCountry);
    if (intl) {
      setDialCountry(intl.country);
      setPhone(cleanNationalInput(intl.national, intl.country));
      return;
    }
    setPhone(cleanNationalInput(raw, dialCountry));
  };

  const handleIdChange = (raw: string) => {
    if (!venezuelan) return setIdValue(raw);
    // Typed with the letter (V-12345678): move it to the selector
    const m = raw.trim().toUpperCase().match(/^([VEJGP])[\s-]*(.*)$/);
    if (m) {
      setIdPrefix(m[1] as IdPrefix);
      setIdValue(m[2].replace(/\D/g, ""));
      return;
    }
    setIdValue(raw.replace(/\D/g, ""));
  };

  const save = async () => {
    if (needsPhone && !whatsapp) return toast.error(`Escribe un WhatsApp válido de ${dialCountry.name}, por ejemplo ${dialCountry.example}`);
    if (needsDocument && !documentId) return toast.error(venezuelan ? "Escribe una cédula o RIF válido, por ejemplo V-12345678" : "Escribe el documento de identidad");
    const owner = documentId && knownClients?.find((c) => c.id !== client.id && c.documentId?.replace(/\W/g, "").toUpperCase() === documentId.replace(/\W/g, ""));
    if (owner) return toast.error(`Esa cédula ya está registrada a nombre de ${owner.name || "otro cliente"}`);

    const patch: { phone?: string; documentId?: string } = {};
    if (needsPhone && whatsapp) patch.phone = whatsapp;
    if (needsDocument && documentId) patch.documentId = documentId;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      onSaved(patch, await res.json());
      toast.success(`Datos guardados para ${client.name || "el cliente"}`);
    } catch {
      toast.error("No se pudieron guardar los datos. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    save();
  };

  if (!needsPhone && !needsDocument) return null;

  const fieldBox = (error: boolean) =>
    cn(
      "flex h-9 min-w-0 items-center rounded-lg border bg-background focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/15",
      error && "border-rose-400",
    );

  return (
    <div className={cn("space-y-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3", className)}>
      {needsDocument && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconId size={16} className="text-emerald-600" /> {venezuelan ? "Cédula o RIF" : "Documento de identidad"}
          </p>
          <div className={fieldBox(documentError)}>
            {venezuelan && (
              <select
                value={idPrefix}
                onChange={(e) => setIdPrefix(e.target.value as IdPrefix)}
                className="h-full shrink-0 cursor-pointer rounded-l-lg border-r bg-transparent px-2 text-xs font-semibold text-muted-foreground outline-none hover:bg-muted/50"
                title="Tipo de documento"
              >
                {ID_PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <input
              autoFocus
              inputMode={venezuelan ? "numeric" : "text"}
              value={idValue}
              onChange={(e) => handleIdChange(e.target.value)}
              onKeyDown={onEnter}
              placeholder={venezuelan ? "12345678" : "Número de documento"}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none"
            />
          </div>
        </div>
      )}

      {needsPhone && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconBrandWhatsapp size={16} className="text-emerald-600" /> WhatsApp
          </p>
          <div className={fieldBox(phoneError)}>
            <CountryPicker
              value={dialCountry}
              onChange={(next) => {
                setDialCountry(next);
                setPhone((v) => cleanNationalInput(v, next));
                setTimeout(() => phoneRef.current?.focus(), 0);
              }}
            />
            <input
              ref={phoneRef}
              autoFocus={!needsDocument}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyDown={onEnter}
              placeholder={dialCountry.example}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none"
            />
          </div>
          {whatsapp && <p className="text-[11px] text-emerald-700">Se guardará como {formatWhatsAppNumber(whatsapp)}</p>}
          {phoneError && <p className="text-[11px] text-rose-600">Ese número no parece un WhatsApp de {dialCountry.name}. Ejemplo: {dialCountry.example}</p>}
        </div>
      )}

      {documentError && <p className="text-[11px] text-rose-600">Revisa la cédula o RIF. Ejemplo: V-12345678</p>}

      <button
        type="button"
        onClick={save}
        disabled={!ready || saving}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
      >
        {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />}
        Guardar
      </button>
    </div>
  );
}
