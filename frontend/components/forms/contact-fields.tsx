"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { type PhoneCountry, cleanNationalInput, countryFromAccount, searchPhoneCountries, splitInternational, toWhatsAppNumber } from "@/lib/phone-countries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const fieldShell = "flex h-9 w-full items-stretch overflow-hidden rounded-md border bg-background text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50";

// ── Dial code selector ───────────────────────────────────────────────────────

/** Dial code selector with search by country name or code. */
export function CountryPicker({ value, onChange }: { value: PhoneCountry; onChange: (country: PhoneCountry) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchPhoneCountries(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, searchPhoneCountries("").indexOf(value)));
  }, [open, value]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (country: PhoneCountry) => {
    onChange(country);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-full shrink-0 items-center gap-1 rounded-l-lg border-r px-2.5 text-xs font-semibold text-muted-foreground tabular-nums hover:bg-muted/50" title={value.name}>
          <span className="text-sm leading-none">{value.flag}</span> +{value.code}
          <IconChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <IconSearch size={14} className="text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (results[active]) pick(results[active]); }
            }}
            placeholder="Buscar país o código"
            className="h-10 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
          {results.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No encontramos ese país</p>}
          {results.map((country, index) => (
            <button
              key={country.iso}
              type="button"
              data-index={index}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(country)}
              className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm", index === active && "bg-muted", country.iso === value.iso && "font-semibold")}
            >
              <span className="text-base leading-none">{country.flag}</span>
              <span className="flex-1 truncate">{country.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">+{country.code}</span>
              {country.iso === value.iso && <IconCheck size={14} className="text-emerald-600" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export type FieldState = { value: string; valid: boolean };

/**
 * WhatsApp number: country with search + national number. Reports the full number (+58412…)
 * and whether it's a valid mobile for that country. An empty field counts as valid (optional).
 */
export function PhoneField({ value, onChange, accountCountry, autoFocus }: { value: string; onChange: (s: FieldState) => void; accountCountry?: string | null; autoFocus?: boolean }) {
  const fallback = countryFromAccount(accountCountry);
  const [country, setCountry] = useState<PhoneCountry>(fallback);
  const [national, setNational] = useState("");
  const [touched, setTouched] = useState(false);
  const last = useRef<string | null>(null);

  // Load an existing number (+584121234567) into country + national
  useEffect(() => {
    if (value === last.current) return;
    const split = value ? splitInternational(value, fallback) : null;
    setCountry(split?.country ?? fallback);
    setNational(split ? split.national : value || "");
    last.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (c: PhoneCountry, n: string) => {
    const full = n.trim() ? toWhatsAppNumber(n, c) : "";
    const out = full ?? "";
    last.current = out;
    onChange({ value: out, valid: !n.trim() || !!full });
  };
  const invalid = touched && !!national.trim() && !toWhatsAppNumber(national, country);

  return (
    <div className="space-y-1">
      <div className={cn(fieldShell, invalid && "border-destructive")}>
        <CountryPicker value={country} onChange={(c) => { setCountry(c); emit(c, national); }} />
        <input
          autoFocus={autoFocus}
          value={national}
          inputMode="tel"
          placeholder={country.example}
          onBlur={() => setTouched(true)}
          onChange={(e) => {
            const raw = e.target.value;
            const intl = splitInternational(raw, country);
            const c = intl?.country ?? country;
            const n = cleanNationalInput(intl ? intl.national : raw, c);
            if (intl) setCountry(c);
            setNational(n);
            emit(c, n);
          }}
          className="min-w-0 flex-1 bg-transparent px-3 tabular-nums outline-none"
        />
      </div>
      {invalid && <p className="text-xs text-destructive">No es un celular válido de {country.name}. Ej.: {country.example}</p>}
    </div>
  );
}

// ── Cédula / RIF ─────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES: [string, string][] = [
  ["V", "Venezolano"],
  ["E", "Extranjero"],
  ["J", "Jurídico"],
  ["C", "Comunal"],
  ["G", "Gubernamental"],
];
const isPerson = (t: string) => t === "V" || t === "E";

/** "V-12345678" or "" (empty) from type + digits; null when it isn't valid. */
export function buildDocument(type: string, digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  // People: 6 to 9 digits. Companies, communes and government (RIF): 8 or 9 digits.
  return (isPerson(type) ? /^\d{6,9}$/ : /^\d{8,9}$/).test(d) ? `${type}-${d}` : null;
}

function DocumentTypePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-full shrink-0 items-center gap-1 border-r px-2.5 text-sm font-semibold hover:bg-muted/50" title={DOCUMENT_TYPES.find(([k]) => k === value)?.[1]}>
          {value}
          <IconChevronDown size={12} className="opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {DOCUMENT_TYPES.map(([k, label]) => (
          <button key={k} type="button" onClick={() => { onChange(k); setOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", k === value && "font-semibold")}>
            <span className="w-4 font-bold">{k}</span>
            <span className="flex-1">{label}</span>
            {k === value && <IconCheck size={14} className="text-emerald-600" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Small "(opcional)" next to a field label. */
export function Optional() {
  return <span className="font-normal text-muted-foreground">{OPTIONAL_TEXT}</span>;
}
const OPTIONAL_TEXT = "(opcional)";

/** Cédula or RIF with its type (V, E, J, C, G) and digits only. An empty field counts as valid. */
export function DocumentField({ value, onChange }: { value: string; onChange: (s: FieldState) => void }) {
  const [type, setType] = useState("V");
  const [digits, setDigits] = useState("");
  const [touched, setTouched] = useState(false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (value === last.current) return;
    const m = /^([VEJCGP])[-\s]?(\d+)$/i.exec((value || "").trim());
    setType(m ? m[1].toUpperCase() : "V");
    setDigits(m ? m[2] : (value || "").replace(/\D/g, ""));
    last.current = value;
  }, [value]);

  const emit = (t: string, d: string) => {
    const doc = buildDocument(t, d);
    last.current = doc ?? "";
    onChange({ value: doc ?? "", valid: doc !== null });
  };
  const invalid = touched && buildDocument(type, digits) === null;

  return (
    <div className="space-y-1">
      <div className={cn(fieldShell, invalid && "border-destructive")}>
        <DocumentTypePicker value={type} onChange={(t) => { setType(t); emit(t, digits); }} />
        <input
          value={digits}
          inputMode="numeric"
          placeholder={isPerson(type) ? "12345678" : "123456789"}
          onBlur={() => setTouched(true)}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "").slice(0, 9);
            setDigits(d);
            emit(type, d);
          }}
          className="min-w-0 flex-1 bg-transparent px-3 tabular-nums outline-none"
        />
      </div>
      {invalid && <p className="text-xs text-destructive">{isPerson(type) ? "La cédula tiene entre 6 y 9 números" : "El RIF tiene 8 o 9 números"}</p>}
    </div>
  );
}

// ── Email ────────────────────────────────────────────────────────────────────

export const EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "hotmail.es", "outlook.es", "yahoo.es", "proton.me"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const OTHER = "__other__";

/** User part + a list of common domains, or a custom domain (company emails). An empty field counts as valid. */
export function EmailField({ value, onChange }: { value: string; onChange: (s: FieldState) => void }) {
  const [user, setUser] = useState("");
  const [domain, setDomain] = useState(EMAIL_DOMAINS[0]);
  const [custom, setCustom] = useState("");
  const [touched, setTouched] = useState(false);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (value === last.current) return;
    const [u, d] = (value || "").split("@");
    setUser(u || "");
    if (d && EMAIL_DOMAINS.includes(d.toLowerCase())) { setDomain(d.toLowerCase()); setCustom(""); }
    else if (d) { setDomain(OTHER); setCustom(d); }
    last.current = value;
  }, [value]);

  const full = (u: string, d: string, c: string) => (u.trim() ? `${u.trim()}@${(d === OTHER ? c : d).trim().replace(/^@/, "")}`.toLowerCase() : "");
  const emit = (u: string, d: string, c: string) => {
    const email = full(u, d, c);
    last.current = email;
    onChange({ value: email, valid: !email || EMAIL_RE.test(email) });
  };
  const email = full(user, domain, custom);
  const invalid = touched && !!email && !EMAIL_RE.test(email);

  return (
    <div className="space-y-1">
      <div className={cn(fieldShell, invalid && "border-destructive")}>
        <input
          value={user}
          placeholder="nombre"
          onBlur={() => setTouched(true)}
          onChange={(e) => {
            // Typing or pasting a full address splits it into user and domain
            const raw = e.target.value.replace(/\s/g, "");
            if (raw.includes("@")) {
              const [u, d = ""] = raw.split("@");
              const known = EMAIL_DOMAINS.find((x) => x === d.toLowerCase());
              setUser(u);
              if (known) { setDomain(known); emit(u, known, custom); }
              else if (d) { setDomain(OTHER); setCustom(d); emit(u, OTHER, d); }
              else emit(u, domain, custom);
              return;
            }
            setUser(raw);
            emit(raw, domain, custom);
          }}
          className="min-w-0 flex-1 bg-transparent px-3 outline-none"
        />
        <span className="flex items-center border-l bg-muted/40 px-2 text-muted-foreground">@</span>
        {domain === OTHER ? (
          <input
            autoFocus
            value={custom}
            placeholder="empresa.com"
            onBlur={() => setTouched(true)}
            onChange={(e) => { const c = e.target.value.replace(/[\s@]/g, ""); setCustom(c); emit(user, OTHER, c); }}
            className="w-32 min-w-0 bg-transparent px-2 outline-none sm:w-40"
          />
        ) : null}
        <select
          value={domain}
          onChange={(e) => { setDomain(e.target.value); emit(user, e.target.value, custom); }}
          className={cn("shrink-0 cursor-pointer border-l bg-transparent px-2 text-sm outline-none", domain === OTHER && "w-24")}
        >
          {EMAIL_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value={OTHER}>Otro dominio…</option>
        </select>
      </div>
      {invalid && <p className="text-xs text-destructive">Revisa el correo: falta el dominio o tiene un error</p>}
    </div>
  );
}
