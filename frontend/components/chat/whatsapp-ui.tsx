"use client";

import { IconCheck, IconChecks, IconFileText, IconMicrophone, IconPhoto, IconUser, IconVideo } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/** Small pieces shared by the WhatsApp Web style chat sidebar. */

const AVATAR_TINTS = [
  "bg-[#FFD9DE] text-[#C12A4B]",
  "bg-[#E6DEFF] text-[#5E47D2]",
  "bg-[#D6EAF8] text-[#2D7CB8]",
  "bg-[#D9FDD3] text-[#1F8A4C]",
  "bg-[#FFE9C7] text-[#B5651D]",
  "bg-[#D7F5F2] text-[#13867A]",
];

function tintFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function WaAvatar({ src, seed, size = 49, className }: { src?: string | null; seed: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full", !src && tintFor(seed), className)}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <IconUser size={size * 0.46} stroke={2.2} className="translate-y-[1px]" />}
    </span>
  );
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Like WhatsApp: time today, "ayer", weekday this week, date before that. */
export function formatChatTime(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (d.getTime() >= startOfToday) return d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
  if (d.getTime() >= startOfToday - day) return "ayer";
  if (d.getTime() >= startOfToday - 6 * day) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Ticks for messages we sent: one grey (sent), two grey (delivered), two blue (read). */
export function WaTicks({ status, className }: { status?: string | null; className?: string }) {
  const s = (status || "").toUpperCase();
  if (s === "READ" || s === "PLAYED") return <IconChecks size={16} className={cn("shrink-0 text-[#53BDEB]", className)} />;
  if (s === "DELIVERED" || s === "DELIVERY_ACK") return <IconChecks size={16} className={cn("shrink-0 text-[#8696A0]", className)} />;
  return <IconCheck size={16} className={cn("shrink-0 text-[#8696A0]", className)} />;
}

const MEDIA_LABEL: Record<string, { icon: typeof IconPhoto; label: string }> = {
  image: { icon: IconPhoto, label: "Foto" },
  video: { icon: IconVideo, label: "Video" },
  audio: { icon: IconMicrophone, label: "Audio" },
  document: { icon: IconFileText, label: "Documento" },
};

/** Last message preview: ticks if we sent it, an icon for media, then the text. */
export function WaPreview({ message, fallback }: { message?: any; fallback?: string }) {
  const text = message?.text ?? fallback ?? "";
  const type = String(message?.type || "text").toLowerCase();
  const media = MEDIA_LABEL[type];
  const ownMessage = message?.senderType === "AGENT" || message?.senderType === "BOT";
  const cleanText = media && /^\[(Archivo|image|audio|video|document)/i.test(text) ? "" : text;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {ownMessage && <WaTicks status={message?.status} />}
      {media && <media.icon size={16} className="shrink-0 text-[#8696A0]" />}
      <span className="truncate">{cleanText.split("\n")[0] || (media ? media.label : "Sin mensajes")}</span>
    </span>
  );
}

/** Filter chip of the chat list. */
export function WaChip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[14px] transition-colors",
        active
          ? "border-[#D9FDD3] bg-[#D9FDD3] font-medium text-[#15603E] dark:border-[#103529] dark:bg-[#103529] dark:text-[#D9FDD3]"
          : "border-[#D1D7DB] bg-white text-[#54656F] hover:bg-[#F5F6F6] dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Round icon button used in the sidebar headers. */
export function WaIconButton({ title, onClick, children, className }: { title: string; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10", className)}
    >
      {children}
    </button>
  );
}
