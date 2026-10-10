"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrowLeft, IconBackspace, IconGridDots, IconLoader2, IconMessagePlus, IconSearch, IconUserPlus } from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { countryFromAccount, formatWhatsAppNumber, splitInternational, toWhatsAppNumber } from "@/lib/phone-countries";
import { WaAvatar, WaIconButton } from "@/components/chat/whatsapp-ui";

type Contact = { id: string; name: string; phone: string; documentId?: string | null; [key: string]: any };
type Picked = { phone: string; name: string; client?: Contact };

type NewChatPanelProps = {
  onClose: () => void;
  /** Opens the chat with that client (or a number that isn't a client yet). */
  onPick: (contact: Picked) => void;
  /** Country of the account, to read local numbers. */
  country?: string | null;
  className?: string;
};

type View = "contacts" | "dialpad" | "contact";

const PAGE_SIZE = 40;

const KEYS: [string, string][] = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Letter a contact is listed under; "#" for names that don't start with a letter. */
const groupLetter = (name: string) => {
  const first = fold(name.trim()).charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};

function PanelHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex h-[64px] shrink-0 items-center gap-4 px-4">
      <WaIconButton title="Volver" onClick={onBack} className="-ml-1 text-[#111B21]">
        <IconArrowLeft size={22} />
      </WaIconButton>
      <h2 className="flex-1 text-[17px] text-[#111B21] dark:text-zinc-100">{title}</h2>
      {right}
    </div>
  );
}

function ActionRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-4 py-2.5 text-left hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60">
      <span className="flex size-[49px] shrink-0 items-center justify-center rounded-full bg-[#1DAA61] text-white">{icon}</span>
      <span className="text-[16px] text-[#111B21] dark:text-zinc-100">{label}</span>
    </button>
  );
}

/** WhatsApp Web style "Nuevo chat" panel over the chat list: clients with WhatsApp, a dial pad and a new contact form. */
export function NewChatPanel({ onClose, onPick, country, className }: NewChatPanelProps) {
  const accountCountry = useMemo(() => countryFromAccount(country), [country]);
  const [view, setView] = useState<View>("contacts");
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [dial, setDial] = useState("");
  const dialRef = useRef<HTMLInputElement>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "contacts") onClose();
      else setView("contacts");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, view]);

  useEffect(() => {
    if (view === "contacts") searchRef.current?.focus();
    if (view === "dialpad") dialRef.current?.focus();
  }, [view]);

  const load = async (q: string, nextPage: number) => {
    const id = ++requestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter: "whatsapp", sort: "name", page: String(nextPage), pageSize: String(PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`${API_URL}/clients/directory?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (id !== requestRef.current) return;
      setContacts((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      if (id === requestRef.current && nextPage === 1) setContacts([]);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => load(query, 1), 250);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Old records may be saved as 0414…: read them with the account's country code
  const fullNumber = (phone: string) =>
    phone.trim().startsWith("+") ? `+${phone.replace(/\D/g, "")}` : toWhatsAppNumber(phone, accountCountry) || `+${phone.replace(/\D/g, "")}`;

  const parseNumber = (raw: string) => {
    if (!/\d{7,}/.test(raw.replace(/\D/g, ""))) return null;
    const intl = splitInternational(raw, accountCountry);
    return intl ? toWhatsAppNumber(intl.national, intl.country) : toWhatsAppNumber(raw, accountCountry);
  };

  const typedNumber = parseNumber(query);
  const typedIsClient = typedNumber && contacts.some((c) => fullNumber(c.phone) === typedNumber);
  const dialNumber = parseNumber(dial);

  const pickNumber = (number: string) => onPick({ phone: number.replace(/\D/g, ""), name: formatWhatsAppNumber(number) });

  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const letter = groupLetter(c.name);
      map.set(letter, [...(map.get(letter) ?? []), c]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)));
  }, [contacts]);

  const saveContact = async () => {
    const number = parseNumber(contactPhone);
    if (!contactName.trim()) return toast.error("Escribe el nombre del contacto");
    if (!number) return toast.error(`Escribe un WhatsApp válido, por ejemplo ${accountCountry.example}`);
    setSavingContact(true);
    try {
      const res = await fetch(`${API_URL}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ name: contactName.trim(), phone: number }),
      });
      if (!res.ok) throw new Error();
      const client = await res.json();
      toast.success(`${client.name} quedó guardado en tus clientes`);
      onPick({ phone: number.replace(/\D/g, ""), name: client.name, client });
    } catch {
      toast.error("No se pudo guardar el contacto");
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className={cn("flex flex-col bg-white dark:bg-zinc-950", className)}>
      {view === "contacts" && (
        <>
          <PanelHeader
            title="Nuevo chat"
            onBack={onClose}
            right={
              <WaIconButton title="Marcar un número" onClick={() => setView("dialpad")}>
                <IconGridDots size={22} />
              </WaIconButton>
            }
          />
          <div className="shrink-0 px-3 pb-2">
            <label className="flex h-10 items-center gap-3 rounded-full border-2 border-[#1DAA61] bg-white px-4 dark:bg-zinc-900">
              <IconSearch size={18} className="text-[#54656F]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nombre, cédula o número"
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111B21] outline-none placeholder:text-[#667781] dark:text-zinc-100"
              />
              {loading && <IconLoader2 size={16} className="animate-spin text-[#8696A0]" />}
            </label>
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            {!query && <ActionRow icon={<IconUserPlus size={24} />} label="Nuevo contacto" onClick={() => setView("contact")} />}

            {typedNumber && !typedIsClient && (
              <button type="button" onClick={() => pickNumber(typedNumber)} className="flex w-full items-center gap-4 px-4 py-2.5 text-left hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60">
                <span className="flex size-[49px] shrink-0 items-center justify-center rounded-full bg-[#1DAA61] text-white">
                  <IconMessagePlus size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] text-[#111B21] dark:text-zinc-100">Escribir a {formatWhatsAppNumber(typedNumber)}</span>
                  <span className="block text-[14px] text-[#667781]">No está en tus clientes</span>
                </span>
              </button>
            )}

            {!loading && contacts.length === 0 && (
              <p className="px-8 py-10 text-center text-[14px] text-[#667781]">
                {query ? "No hay clientes con WhatsApp que coincidan." : "Aún no tienes clientes con WhatsApp. Se registran en el punto de venta al cobrar."}
              </p>
            )}

            {groups.map(([letter, items]) => (
              <div key={letter}>
                <p className="px-8 pb-2 pt-6 text-[15px] text-[#008069] dark:text-emerald-400">{letter}</p>
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPick({ phone: fullNumber(c.phone).replace(/\D/g, ""), name: c.name, client: c })}
                    className="flex w-full items-center gap-4 px-4 text-left hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60"
                  >
                    <WaAvatar seed={c.id} src={c.avatarUrl} />
                    <span className="min-w-0 flex-1 border-b border-[#E9EDEF] py-3.5 dark:border-zinc-800">
                      <span className="block truncate text-[16px] text-[#111B21] dark:text-zinc-100">{c.name}</span>
                      <span className="block truncate text-[14px] text-[#667781] tabular-nums">
                        {formatWhatsAppNumber(fullNumber(c.phone))}
                        {c.documentId ? ` · ${c.documentId}` : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {page < totalPages && (
              <div className="px-4 pt-3">
                <button
                  type="button"
                  onClick={() => load(query, page + 1)}
                  disabled={loading}
                  className="h-10 w-full rounded-full border border-[#D1D7DB] text-[14px] text-[#008069] hover:bg-[#F5F6F6] disabled:opacity-50 dark:border-zinc-700"
                >
                  {loading ? "Cargando…" : "Ver más clientes"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {view === "dialpad" && (
        <>
          <PanelHeader title="Número de teléfono" onBack={() => setView("contacts")} />
          <div className="shrink-0 px-5">
            <input
              ref={dialRef}
              value={dial}
              onChange={(e) => setDial(e.target.value.replace(/[^\d+\s-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && dialNumber && pickNumber(dialNumber)}
              inputMode="tel"
              placeholder="Número de teléfono"
              className="h-12 w-full rounded-xl border-2 border-[#1DAA61] bg-white px-4 text-[17px] text-[#111B21] outline-none tabular-nums placeholder:text-[#667781] dark:bg-zinc-900 dark:text-zinc-100"
            />
            <p className="mt-5 text-center text-[15px] text-[#667781]">
              {dialNumber ? formatWhatsAppNumber(dialNumber) : `Ingresa un número de teléfono para iniciar un chat. Sin código de país se usa +${accountCountry.code}.`}
            </p>
          </div>
          <div className="mx-auto mt-6 grid w-full max-w-[320px] grid-cols-3 gap-y-2 px-4">
            {KEYS.map(([digit, letters]) => (
              <button
                key={digit}
                type="button"
                onClick={() => setDial((d) => d + digit)}
                className="flex h-[68px] flex-col items-center justify-center rounded-full text-[#111B21] hover:bg-[#F5F6F6] dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="text-[26px] leading-none">{digit}</span>
                <span className="mt-1 h-3 text-[11px] text-[#667781]">{letters}</span>
              </button>
            ))}
            <button type="button" onClick={() => setDial((d) => (d.includes("+") ? d : `+${d}`))} className="flex h-[68px] items-center justify-center rounded-full text-[26px] text-[#111B21] hover:bg-[#F5F6F6] dark:text-zinc-100 dark:hover:bg-zinc-800">
              +
            </button>
            <button type="button" onClick={() => setDial((d) => d + "0")} className="flex h-[68px] items-center justify-center rounded-full text-[26px] text-[#111B21] hover:bg-[#F5F6F6] dark:text-zinc-100 dark:hover:bg-zinc-800">
              0
            </button>
            <button type="button" onClick={() => setDial((d) => d.slice(0, -1))} title="Borrar" className="flex h-[68px] items-center justify-center rounded-full text-[#111B21] hover:bg-[#F5F6F6] dark:text-zinc-100 dark:hover:bg-zinc-800">
              <IconBackspace size={26} />
            </button>
          </div>
          {dialNumber && (
            <div className="px-5 pt-4">
              <button type="button" onClick={() => pickNumber(dialNumber)} className="h-11 w-full rounded-full bg-[#1DAA61] text-[15px] font-medium text-white hover:bg-[#189a57]">
                Iniciar chat
              </button>
            </div>
          )}
        </>
      )}

      {view === "contact" && (
        <>
          <PanelHeader title="Nuevo contacto" onBack={() => setView("contacts")} />
          <div className="space-y-5 px-6 pt-4">
            <label className="block space-y-1.5">
              <span className="text-[13px] text-[#008069]">Nombre</span>
              <input
                autoFocus
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-11 w-full border-b-2 border-[#D1D7DB] bg-transparent text-[16px] text-[#111B21] outline-none focus:border-[#1DAA61] dark:text-zinc-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[13px] text-[#008069]">WhatsApp</span>
              <div className="flex items-center gap-2 border-b-2 border-[#D1D7DB] focus-within:border-[#1DAA61]">
                <span className="text-[15px] text-[#667781]">{accountCountry.flag} +{accountCountry.code}</span>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveContact()}
                  inputMode="tel"
                  placeholder={accountCountry.example}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-[#111B21] outline-none tabular-nums placeholder:text-[#8696A0] dark:text-zinc-100"
                />
              </div>
              <span className="block text-[12px] text-[#667781]">Se guarda como cliente en Syncro. Para otro país, escríbelo con +.</span>
            </label>
            <button
              type="button"
              onClick={saveContact}
              disabled={savingContact}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1DAA61] text-[15px] font-medium text-white hover:bg-[#189a57] disabled:opacity-50"
            >
              {savingContact && <IconLoader2 size={16} className="animate-spin" />} Guardar y abrir chat
            </button>
          </div>
        </>
      )}
    </div>
  );
}
