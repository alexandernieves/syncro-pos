"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    IconChevronLeft, IconChevronRight, IconLock, IconMapPin, IconMessageCircle, IconSend, IconStar, IconStarFilled, IconTrophy, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { API_URL as API } from "@/lib/constants";

/**
 * Syncro Credit → Préstamos: a P2P market like Binance's. The person sees how much they can borrow
 * right now (their level, the platform cap and each lender's own limit decide it), every lender's
 * offer with the range open to them, and the lender's reputation. Asking opens a chat with the
 * lender; once the cash is collected both sides rate each other.
 */
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const whole = (n: number) => (Number.isInteger(n) ? `$${n}` : money(n));
const every = (d: number) => (d === 7 ? "semanales" : d === 15 || d === 14 ? "quincenales" : d === 30 ? "mensuales" : `cada ${d} días`);
const AV_COLORS = ["#F26B3A", "#2F7DFF", "#1F9D5B", "#8C6CF0", "#E8A72B", "#45413A"];
const headers = () => ({ Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("client_token") || "" : ""}` });
const json = { "Content-Type": "application/json" };
const ago = (d: string) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    return new Date(d).toLocaleDateString("es-VE", { day: "numeric", month: "short" });
};
const responseText = (mins: number | null | undefined) =>
    mins == null ? null : mins < 60 ? `responde en ~${Math.max(1, mins)} min` : mins < 1440 ? `responde en ~${Math.round(mins / 60)} h` : `responde en ~${Math.round(mins / 1440)} d`;

function BizAvatar({ b, size = 44 }: { b: any; size?: number }) {
    const color = AV_COLORS[[...String(b?.id || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
    return (
        <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-2xl text-white" style={{ width: size, height: size, background: color, fontWeight: 800, fontSize: size * 0.36 }}>
            {b?.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={b.logo} alt="" className="absolute inset-0 size-full bg-white object-cover" />
                : (String(b?.name || "?").trim().charAt(0) || "?").toUpperCase()}
        </span>
    );
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
    return (
        <span className="inline-flex items-center gap-px text-amber-400" aria-label={`${value} de 5 estrellas`}>
            {[1, 2, 3, 4, 5].map((i) => (i <= Math.round(value) ? <IconStarFilled key={i} size={size} /> : <IconStar key={i} size={size} className="text-zinc-300" />))}
        </span>
    );
}

/** "★ 4.8 (12) · 98% · 15 entregados · responde en ~10 min" */
function LenderLine({ s, className = "" }: { s: any; className?: string }) {
    if (!s) return null;
    const parts = [
        s.reviews ? null : "Nuevo",
        s.delivered ? `${s.delivered} entregado${s.delivered === 1 ? "" : "s"}` : null,
        responseText(s.responseMins),
    ].filter(Boolean);
    return (
        <span className={`flex flex-wrap items-center gap-x-1.5 text-[12px] text-zinc-500 ${className}`}>
            {s.reviews > 0 && (
                <>
                    <IconStarFilled size={12} className="text-amber-400" />
                    <b className="text-zinc-800">{s.stars.toFixed(1)}</b>
                    <span>({s.reviews}) · {s.positive}% positivo</span>
                    {parts.length > 0 && <span>·</span>}
                </>
            )}
            <span>{parts.join(" · ")}</span>
        </span>
    );
}

function Sheet({ onClose, children, busy = false }: { onClose: () => void; children: React.ReactNode; busy?: boolean }) {
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" onClick={() => !busy && onClose()}>
            <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-background px-5 pt-3 animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                {children}
            </div>
        </div>,
        document.body,
    );
}

const BLOCK_TEXT: Record<string, string> = {
    late: "Ponte al día con tus cuotas para pedir",
    count: "Ya tienes el máximo de préstamos de tu nivel",
    global: "Ya usaste todo el cupo de tu nivel",
    open: "Ya tienes una solicitud con este comercio",
    suspended: "Tu cuenta con este comercio está pausada",
};

export function LoansMarket({ onBack, onLevels, onUnread }: { onBack: () => void; onLevels: () => void; onUnread?: (n: number) => void }) {
    const [market, setMarket] = useState<any | null>(null);
    const [reqs, setReqs] = useState<any[]>([]);
    const [pick, setPick] = useState<any | null>(null);
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);
    const [profile, setProfile] = useState<any | null>(null);
    const [review, setReview] = useState<{ loan: any; stars: number; comment: string } | null>(null);
    const [chat, setChat] = useState<any | null>(null);

    const loadMarket = useCallback(async () => {
        try {
            const r = await fetch(`${API}/portal-lending/offers`, { headers: headers() });
            if (r.ok) setMarket(await r.json());
        } catch { /* offline */ }
    }, []);
    const loadReqs = useCallback(async () => {
        try {
            const r = await fetch(`${API}/portal-lending/requests`, { headers: headers() });
            if (r.ok) {
                const list = await r.json();
                setReqs(list);
                onUnread?.(list.reduce((a: number, l: any) => a + (l.unread || 0), 0));
            }
        } catch { /* offline */ }
    }, [onUnread]);
    useEffect(() => {
        loadMarket();
        loadReqs();
        // the approval, the PIN and new messages arrive on their own
        const t = setInterval(() => { loadReqs(); }, 15000);
        const m = setInterval(loadMarket, 60000);
        return () => { clearInterval(t); clearInterval(m); };
    }, [loadMarket, loadReqs]);

    const openPick = (o: any) => {
        setPick(o);
        setAmount(String(Math.floor(o.forYou.max)));
    };
    const pickAmount = Number(amount) || 0;
    const pickOk = !!pick && pickAmount >= pick.forYou.min - 0.005 && pickAmount <= pick.forYou.max + 0.005;
    const pickTotal = pick ? Math.round(pickAmount * (1 + pick.interestPct / 100) * 100) / 100 : 0;
    const chips = useMemo(() => {
        if (!pick) return [];
        const { min, max } = pick.forYou;
        const steps = [5, 10, 20, 25, 30, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];
        const out = [Math.ceil(min), ...steps.filter((v) => v > min && v < max), Math.floor(max)];
        const uniq = [...new Set(out)].filter((v) => v >= min - 0.005 && v <= max + 0.005);
        // a handful, spread out, always with the minimum and the maximum
        if (uniq.length <= 6) return uniq;
        const mid = uniq.slice(1, -1);
        const pickN = 4;
        return [uniq[0], ...Array.from({ length: pickN }, (_, i) => mid[Math.round((i * (mid.length - 1)) / (pickN - 1))]), uniq[uniq.length - 1]].filter((v, i, a) => a.indexOf(v) === i);
    }, [pick]);

    const send = async () => {
        if (!pick || !pickOk) return;
        setBusy(true);
        try {
            const r = await fetch(`${API}/portal-lending/request`, { method: "POST", headers: { ...headers(), ...json }, body: JSON.stringify({ offerId: pick.id, amount: pickAmount }) });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(b.message || "No se pudo enviar la solicitud");
            toast.success(`Solicitud enviada a ${pick.business?.name}. Puedes escribirle por el chat.`);
            setPick(null);
            await Promise.all([loadReqs(), loadMarket()]);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    const cancel = async (id: string) => {
        if (!window.confirm("¿Cancelar esta solicitud?")) return;
        const r = await fetch(`${API}/portal-lending/requests/${id}/cancel`, { method: "POST", headers: headers() }).catch(() => null);
        if (r?.ok) { toast.success("Solicitud cancelada"); loadReqs(); loadMarket(); }
        else toast.error("No se pudo cancelar");
    };
    const openProfile = async (businessId: string) => {
        setProfile({ loading: true });
        const r = await fetch(`${API}/portal-lending/lenders/${businessId}`, { headers: headers() }).catch(() => null);
        if (r?.ok) setProfile(await r.json());
        else { setProfile(null); toast.error("No se pudo abrir el perfil"); }
    };
    const sendReview = async () => {
        if (!review || !review.stars) return;
        setBusy(true);
        try {
            const r = await fetch(`${API}/portal-lending/loans/${review.loan.id}/review`, { method: "POST", headers: { ...headers(), ...json }, body: JSON.stringify({ stars: review.stars, comment: review.comment }) });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(b.message || "No se pudo guardar");
            toast.success("¡Gracias por tu calificación!");
            setReview(null);
            loadReqs();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    if (chat) return <LoanChat loan={chat} onClose={() => { setChat(null); loadReqs(); }} />;

    const m = market;
    const offers: any[] = m?.offers || [];
    const usedPct = m ? Math.min(100, (m.owed / Math.max(1, m.cap)) * 100) : 0;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-28">
            <div className="flex items-center gap-3 pt-1">
                <button onClick={onBack} aria-label="Volver" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/25 text-white transition active:scale-95">
                    <IconChevronLeft size={20} stroke={2.4} />
                </button>
                <div className="min-w-0">
                    <h2 className="truncate text-[22px] leading-tight text-white" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Préstamos</h2>
                    <p className="truncate text-[12.5px] font-semibold text-white/85">Efectivo de comercios cerca de ti</p>
                </div>
            </div>

            {/* What you can borrow now */}
            <div className="mt-5 rounded-[26px] bg-white p-5 shadow-[0_18px_40px_-20px_rgba(90,30,5,0.35)]">
                {!m ? (
                    <div className="h-[132px] animate-pulse rounded-2xl bg-zinc-100" />
                ) : m.block ? (
                    <div className="flex items-start gap-3">
                        <img src="/nubi/nubi-sad.webp" alt="" className="h-14 w-14 shrink-0 object-contain" />
                        <div>
                            <p className="text-[15px] font-bold text-zinc-900">{m.block === "late" ? "Tienes cuotas atrasadas" : "Llegaste a tu límite por ahora"}</p>
                            <p className="mt-1 text-[13px] leading-snug text-zinc-600">{m.blockText}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-[13px] font-semibold text-zinc-500">Puedes pedir hasta</p>
                        <p className="mt-0.5 text-[44px] leading-none text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>{money(m.maxAnywhere)}</p>
                        <p className="mt-1.5 text-[12.5px] text-zinc-500">{m.maxAnywhere > 0 ? "Elige un anuncio: cada comercio te presta según tu nivel." : "Por ahora ningún anuncio te alcanza."}</p>
                    </>
                )}
                {m && (
                    <div className="mt-4 space-y-2.5 border-t border-zinc-100 pt-3.5">
                        <div className="flex items-center justify-between text-[12.5px]">
                            <span className="flex items-center gap-1.5 text-zinc-600"><IconTrophy size={14} className="text-amber-500" />Nivel <b className="text-zinc-900">{m.level} · {m.levelName}</b></span>
                            <button onClick={onLevels} className="font-semibold text-primary">Ver niveles</button>
                        </div>
                        <div>
                            <div className="flex justify-between text-[12px] text-zinc-500">
                                <span>Debes {money(m.owed)} de {whole(m.cap)} de tu nivel</span>
                                <span>{m.active}/{m.maxActive} préstamos</span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-primary" style={{ width: `${usedPct}%` }} /></div>
                        </div>
                        {m.next && (
                            <p className="text-[12px] leading-snug text-zinc-500">
                                Paga a tiempo {money(Math.max(0, m.next.missing))} más para subir a <b className="text-zinc-800">{m.next.name}</b>: los comercios te prestan más.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* My loans: requests, approved with PIN, running; chat and rating */}
            {reqs.length > 0 && (
                <>
                    <h3 className="mt-6 text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Mis préstamos</h3>
                    <div className="mt-3 space-y-2.5">
                        {reqs.map((q) => {
                            const approved = q.status === "APPROVED_PENDING_DISBURSEMENT";
                            const until = q.pinExpiresAt ? new Date(q.pinExpiresAt) : null;
                            const chip: Record<string, [string, string]> = {
                                REQUESTED: ["En revisión", "bg-amber-50 text-amber-700"],
                                APPROVED_PENDING_DISBURSEMENT: ["Aprobado", "bg-emerald-50 text-emerald-700"],
                                EXPIRED: ["PIN vencido", "bg-zinc-100 text-zinc-500"],
                                REJECTED: ["No aprobado", "bg-rose-50 text-rose-600"],
                                PENDING: ["En curso", "bg-sky-50 text-sky-700"],
                                OVERDUE: ["Atrasado", "bg-rose-50 text-rose-600"],
                                PAID: ["Pagado", "bg-emerald-50 text-emerald-700"],
                            };
                            const [label, cls] = chip[q.status] ?? [q.status, "bg-zinc-100 text-zinc-600"];
                            return (
                                <div key={q.id} className={`rounded-[22px] border bg-white p-4 ${approved ? "border-emerald-200" : "border-zinc-200"}`}>
                                    <div className="flex items-center gap-3">
                                        <BizAvatar b={q.business} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[15px] font-bold text-zinc-900">{q.business?.name || "Comercio"}</p>
                                            <p className="text-[12.5px] text-zinc-500">
                                                {money(q.amount)} · {q.status === "PENDING" || q.status === "OVERDUE" ? `resta ${money(q.remainingBalance)}` : `devuelves ${money(q.totalToPay)}`}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{label}</span>
                                    </div>
                                    {approved && q.pin && (
                                        <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-center">
                                            <p className="text-[12px] font-semibold text-emerald-700">Muestra este PIN en la caja</p>
                                            <p className="mt-1 font-mono text-[38px] tracking-[0.25em] text-zinc-900" style={{ fontWeight: 800 }}>{q.pin}</p>
                                            {until && <p className="mt-1 text-[12px] text-emerald-800/80">Vale hasta {until.toLocaleString("es-VE", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>}
                                            {q.branch?.location && (
                                                <p className="mt-2 flex items-center justify-center gap-1 text-[12.5px] font-semibold text-zinc-700"><IconMapPin size={14} className="text-primary" />{q.branch.name ? `${q.branch.name} · ` : ""}{q.branch.location}</p>
                                            )}
                                        </div>
                                    )}
                                    {q.status === "REJECTED" && q.rejectReason && <p className="mt-2 text-[12.5px] text-rose-600">Motivo: {q.rejectReason}</p>}
                                    {q.status === "EXPIRED" && <p className="mt-2 text-[12.5px] text-zinc-500">No lo retiraste a tiempo. Puedes pedirlo de nuevo.</p>}
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <button onClick={() => setChat(q)} className="relative inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-zinc-200 px-3.5 py-1.5 text-[12.5px] font-bold text-zinc-700 transition active:scale-95">
                                            <IconMessageCircle size={15} /> Chat
                                            {q.unread > 0 && <span className="grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10.5px] text-white">{q.unread}</span>}
                                        </button>
                                        {q.canReview && (q.myReview ? (
                                            <button onClick={() => setReview({ loan: q, stars: q.myReview.stars, comment: q.myReview.comment || "" })} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] font-semibold text-zinc-500">
                                                Tu calificación <Stars value={q.myReview.stars} size={12} />
                                            </button>
                                        ) : (
                                            <button onClick={() => setReview({ loan: q, stars: 0, comment: "" })} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-[12.5px] font-bold text-amber-700 transition active:scale-95">
                                                <IconStarFilled size={13} /> Calificar
                                            </button>
                                        ))}
                                        {(q.status === "REQUESTED" || approved) && (
                                            <button onClick={() => cancel(q.id)} className="ml-auto text-[12.5px] font-semibold text-zinc-500">Cancelar</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* The market */}
            <h3 className="mt-6 text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Anuncios</h3>
            <div className="mt-3 space-y-2.5">
                {m && !offers.length && (
                    <div className="rounded-[22px] border border-dashed border-zinc-300 bg-white/70 p-6 text-center">
                        <img src="/nubi/nubi-thinking.webp" alt="" className="mx-auto h-16 w-16 object-contain" />
                        <p className="mt-2 text-[15px] font-bold text-zinc-900">Aún no hay anuncios</p>
                        <p className="mt-1 text-[13px] text-zinc-500">Cuando un comercio publique préstamos aparecerán aquí.</p>
                    </div>
                )}
                {offers.map((o: any) => {
                    const why = o.blocked === "level" || o.blocked === "limit"
                        ? (o.unlockName ? `Se desbloquea en nivel ${o.unlockLevel} · ${o.unlockName}` : "Tu límite no alcanza todavía")
                        : o.blocked && BLOCK_TEXT[o.blocked];
                    return (
                        <div key={o.id} className={`rounded-[22px] border border-zinc-200 bg-white p-4 ${o.eligible ? "" : "opacity-70"}`}>
                            <button onClick={() => openProfile(o.business.id)} className="flex w-full items-center gap-3 text-left">
                                <BizAvatar b={o.business} />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1 truncate text-[15px] font-bold text-zinc-900">{o.business?.name}<IconChevronRight size={15} className="shrink-0 text-zinc-400" /></span>
                                    <LenderLine s={o.lender} />
                                </span>
                            </button>
                            <div className="mt-3 flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-zinc-500">{o.name} · anuncio de {whole(o.minAmount)} a {whole(o.maxAmount)}</p>
                                    {o.forYou ? (
                                        <p className="mt-0.5 text-[20px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                                            Para ti: {o.forYou.min === o.forYou.max ? whole(o.forYou.max) : `${whole(o.forYou.min)} – ${whole(o.forYou.max)}`}
                                        </p>
                                    ) : (
                                        <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-zinc-500"><IconLock size={14} />{why}</p>
                                    )}
                                    <p className="mt-1 text-[12px] text-zinc-500">{o.interestPct}% de interés · {o.installments} cuota{o.installments > 1 ? "s" : ""} {every(o.frequencyDays)}</p>
                                </div>
                                {o.forYou && (
                                    <button onClick={() => openPick(o)} className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-bold text-white transition active:scale-95">Pedir</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Request: pick the amount inside the range open to you */}
            {pick && (
                <Sheet onClose={() => setPick(null)} busy={busy}>
                    <div className="flex items-center gap-3">
                        <BizAvatar b={pick.business} />
                        <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-zinc-900">{pick.business?.name}</p>
                            <LenderLine s={pick.lender} />
                        </div>
                    </div>
                    <p className="mt-4 text-[13px] font-semibold text-zinc-500">¿Cuánto quieres? Puedes de {whole(pick.forYou.min)} a {whole(pick.forYou.max)}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-[30px] text-zinc-400" style={{ fontWeight: 800 }}>$</span>
                        <input
                            inputMode="decimal"
                            aria-label="Monto del préstamo"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                            className="w-full bg-transparent text-[40px] leading-none text-zinc-900 outline-none"
                            style={{ fontWeight: 800, letterSpacing: "-0.045em" }}
                        />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {chips.map((v) => (
                            <button key={v} onClick={() => setAmount(String(v))} className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[13px] font-bold transition active:scale-95 ${pickAmount === v ? "border-primary bg-primary text-white" : "border-zinc-200 bg-white text-zinc-700"}`}>
                                {whole(v)}
                            </button>
                        ))}
                    </div>
                    {!pickOk && amount !== "" && <p className="mt-2 text-[12.5px] font-semibold text-rose-600">Debe ser entre {whole(pick.forYou.min)} y {whole(pick.forYou.max)}.</p>}
                    <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
                        {[
                            ["Recibes", money(pickAmount)],
                            ["Devuelves", money(pickTotal)],
                            ["Cuotas", `${pick.installments} ${every(pick.frequencyDays)} de ${money(pickTotal / Math.max(1, pick.installments))}`],
                            ["Interés", `${pick.interestPct}% · ${money(pickTotal - pickAmount)}`],
                        ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                                <span className="text-zinc-500">{k}</span>
                                <span className="text-right font-bold text-zinc-900">{v}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">El comercio revisa tu solicitud y puedes hablar con él por el chat. Si la aprueba, te aparece un <b className="text-zinc-700">PIN</b> para retirar el efectivo en su caja.</p>
                    <button onClick={send} disabled={busy || !pickOk} className="mt-4 h-14 w-full rounded-full bg-primary text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60">
                        {busy ? "Enviando…" : `Pedir ${money(pickAmount)}`}
                    </button>
                    <button onClick={() => setPick(null)} disabled={busy} className="mt-2 h-11 w-full rounded-full text-[14px] font-semibold text-zinc-500">Ahora no</button>
                </Sheet>
            )}

            {/* Lender profile: reputation and comments */}
            {profile && (
                <Sheet onClose={() => setProfile(null)}>
                    {profile.loading ? (
                        <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <BizAvatar b={profile.business} size={52} />
                                <div className="min-w-0">
                                    <p className="truncate text-[18px] text-zinc-900" style={{ fontWeight: 800 }}>{profile.business?.name}</p>
                                    <p className="text-[12px] text-zinc-500">En Syncro desde {new Date(profile.business?.createdAt).toLocaleDateString("es-VE", { month: "long", year: "numeric" })}</p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                {[
                                    [profile.reviews ? profile.stars.toFixed(1) : "—", profile.reviews ? `${profile.reviews} calificaciones` : "Sin calificaciones"],
                                    [profile.reviews ? `${profile.positive}%` : "—", "positivas"],
                                    [String(profile.delivered ?? 0), "préstamos entregados"],
                                ].map(([v, k]) => (
                                    <div key={k} className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                                        <p className="text-[20px] text-zinc-900" style={{ fontWeight: 800 }}>{v}</p>
                                        <p className="text-[11px] leading-tight text-zinc-500">{k}</p>
                                    </div>
                                ))}
                            </div>
                            {responseText(profile.responseMins) && <p className="mt-2 text-center text-[12px] text-zinc-500">Normalmente {responseText(profile.responseMins)}</p>}
                            <h4 className="mt-5 text-[15px] font-bold text-zinc-900">Comentarios</h4>
                            <div className="mt-2 space-y-2">
                                {!profile.comments?.length && <p className="rounded-2xl bg-white p-4 text-center text-[13px] text-zinc-500 ring-1 ring-zinc-200">Todavía nadie ha dejado comentarios.</p>}
                                {profile.comments?.map((c: any, i: number) => (
                                    <div key={i} className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-[13px] font-bold text-zinc-800">{c.by} <Stars value={c.stars} size={12} /></span>
                                            <span className="text-[11px] text-zinc-400">{ago(c.createdAt)}</span>
                                        </div>
                                        {c.comment && <p className="mt-1 text-[13px] leading-snug text-zinc-600">{c.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </Sheet>
            )}

            {/* Rate the lender */}
            {review && (
                <Sheet onClose={() => setReview(null)} busy={busy}>
                    <div className="flex items-center gap-3">
                        <BizAvatar b={review.loan.business} />
                        <div>
                            <p className="text-[13px] font-semibold text-zinc-500">¿Cómo te fue con</p>
                            <p className="text-[18px] text-zinc-900" style={{ fontWeight: 800 }}>{review.loan.business?.name}?</p>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <button key={i} aria-label={`${i} estrella${i > 1 ? "s" : ""}`} onClick={() => setReview({ ...review, stars: i })} className="transition active:scale-90">
                                {i <= review.stars ? <IconStarFilled size={38} className="text-amber-400" /> : <IconStar size={38} className="text-zinc-300" />}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-center text-[13px] font-semibold text-zinc-500">{["Toca las estrellas", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][review.stars]}</p>
                    <textarea
                        value={review.comment}
                        onChange={(e) => setReview({ ...review, comment: e.target.value.slice(0, 400) })}
                        placeholder="Cuéntales a otros cómo fue (opcional)"
                        rows={3}
                        className="mt-4 w-full resize-none rounded-2xl border border-zinc-200 bg-white p-3.5 text-[14px] text-zinc-900 outline-none focus:border-primary"
                    />
                    <button onClick={sendReview} disabled={busy || !review.stars} className="mt-3 h-14 w-full rounded-full bg-primary text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-60">
                        {busy ? "Guardando…" : "Enviar calificación"}
                    </button>
                </Sheet>
            )}
        </div>
    );
}

/** The chat with the lender about one loan (it refreshes every few seconds while open) */
function LoanChat({ loan, onClose }: { loan: any; onClose: () => void }) {
    const [data, setData] = useState<any | null>(null);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const end = useRef<HTMLDivElement | null>(null);
    const count = useRef(0);

    const load = useCallback(async () => {
        try {
            const r = await fetch(`${API}/portal-lending/loans/${loan.id}/messages`, { headers: headers() });
            if (r.ok) setData(await r.json());
        } catch { /* offline */ }
    }, [loan.id]);
    useEffect(() => {
        load();
        const t = setInterval(load, 4000);
        return () => clearInterval(t);
    }, [load]);
    useEffect(() => {
        const n = data?.messages?.length ?? 0;
        if (n !== count.current) { count.current = n; end.current?.scrollIntoView({ behavior: "smooth" }); }
    }, [data]);

    const send = async () => {
        const t = text.trim();
        if (!t || sending) return;
        setSending(true);
        try {
            const r = await fetch(`${API}/portal-lending/loans/${loan.id}/messages`, { method: "POST", headers: { ...headers(), ...json }, body: JSON.stringify({ text: t }) });
            const b = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(b.message || "No se pudo enviar");
            setText("");
            await load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSending(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[210] flex flex-col bg-background animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
                <button onClick={onClose} aria-label="Cerrar chat" className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-700 active:scale-95"><IconX size={18} /></button>
                <BizAvatar b={loan.business} size={38} />
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-zinc-900">{loan.business?.name}</p>
                    <p className="text-[12px] text-zinc-500">Préstamo de {money(loan.amount)}</p>
                </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                <p className="mx-auto max-w-[280px] rounded-xl bg-amber-50 px-3 py-2 text-center text-[11.5px] leading-snug text-amber-800">
                    Habla solo por aquí. Nunca compartas tu contraseña ni pagues fuera de los datos que muestra la app.
                </p>
                {!data && <div className="mx-auto mt-6 h-6 w-24 animate-pulse rounded-full bg-zinc-200" />}
                {data?.messages?.length === 0 && <p className="pt-6 text-center text-[13px] text-zinc-400">Escribe el primer mensaje.</p>}
                {data?.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.fromClient ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${msg.fromClient ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white text-zinc-900 ring-1 ring-zinc-200"}`}>
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            <p className={`mt-0.5 text-right text-[10.5px] ${msg.fromClient ? "text-white/75" : "text-zinc-400"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })}
                                {msg.fromClient && (msg.readAt ? " · Visto" : "")}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={end} />
            </div>
            <div className="flex items-end gap-2 border-t border-zinc-200 bg-white px-3 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 1000))}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Escribe un mensaje"
                    rows={1}
                    aria-label="Mensaje"
                    className="max-h-28 min-h-[44px] flex-1 resize-none rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[14.5px] text-zinc-900 outline-none focus:border-primary"
                />
                <button onClick={send} disabled={sending || !text.trim()} aria-label="Enviar" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white transition active:scale-95 disabled:opacity-50">
                    <IconSend size={19} />
                </button>
            </div>
        </div>,
        document.body,
    );
}
