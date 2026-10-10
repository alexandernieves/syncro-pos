"use client";

import { useState } from "react";
import { IconArrowBackUp, IconChevronDown, IconCopy, IconInfoCircle, IconMoodSmile, IconPlus } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { WaTicks } from "@/components/chat/whatsapp-ui";

/** WhatsApp Web style conversation pieces: wallpaper, day dividers and message bubbles. */

// Our own doodle tile (outline icons), drawn very light over the beige background
const DOODLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240' fill='none' stroke='%23D6CDBE' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='.45'>
<path d='M22 30h26a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H34l-8 7v-7h-4a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z'/>
<path d='M96 24l4 8 9 1-6.5 6 1.5 9-8-4.3-8 4.3 1.5-9-6.5-6 9-1z'/>
<path d='M168 34c0-6 8-9 12-3 4-6 12-3 12 3 0 7-12 14-12 14s-12-7-12-14z'/>
<circle cx='212' cy='92' r='10'/><path d='M207 90h.01M217 90h.01M207 96c3 3 7 3 10 0'/>
<path d='M30 104l8-8 14 14-8 8z M38 96l4-4 14 14-4 4'/>
<path d='M92 92h20v28H92z M97 100h10 M97 106h10 M97 112h6'/>
<path d='M150 106a14 14 0 1 0 28 0 14 14 0 1 0-28 0 M164 96v10l6 4'/>
<path d='M24 170c6-10 18-10 24 0M28 178h16M36 160v-6'/>
<path d='M84 160h28l-4 22H88z M92 160v-6h12v6'/>
<path d='M150 166c0-8 6-12 12-12s12 4 12 12v10h-24z M158 176v4h8v-4'/>
<path d='M204 158l6 12h-12z M196 182h20'/>
<path d='M40 214c0-6 10-6 10 0s10 6 10 0'/>
<path d='M120 204l6 6-6 6-6-6z'/>
<path d='M186 210h18a5 5 0 0 0 0-10 8 8 0 0 0-15-2 6 6 0 0 0-3 12z'/>
</svg>`;

export const WA_WALLPAPER: React.CSSProperties = {
  backgroundColor: "#EFEAE2",
  backgroundImage: `url("data:image/svg+xml;utf8,${DOODLE_SVG.replace(/\n/g, "").replace(/#/g, "%23").replace(/%23C9BFAE/g, "%23C9BFAE")}")`,
  backgroundSize: "240px 240px",
};

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="sticky top-2 z-10 my-3 flex justify-center">
      <span className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] text-[#54656F] shadow-[0_1px_.5px_rgba(11,20,26,.13)] dark:bg-zinc-800 dark:text-zinc-300">{label}</span>
    </div>
  );
}

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** "Hoy", "Ayer", weekday this week, full date before that. */
export function dayLabel(value: string | Date) {
  const d = new Date(value);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" });
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const STATUS_LABEL: Record<string, string> = { SENT: "Enviado", DELIVERED: "Entregado", READ: "Leído", PLAYED: "Reproducido" };

type MessageBubbleProps = {
  msg: any;
  own: boolean;
  /** First of a run from the same sender: gets the tail and extra space above. */
  first: boolean;
  /** Name shown in replies to messages of the contact. */
  contactName: string;
  /** Hides the inline time (audio players show their own). */
  hideMeta?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  children: React.ReactNode;
};

function Tail({ own }: { own: boolean }) {
  return (
    <svg viewBox="0 0 8 13" width="8" height="13" className={cn("absolute top-0", own ? "-right-2 text-[#D9FDD3] dark:text-[#005C4B]" : "-left-2 text-white dark:text-zinc-800")} aria-hidden>
      {own ? <path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" /> : <path fill="currentColor" d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />}
    </svg>
  );
}

export function MessageBubble({ msg, own, first, contactName, hideMeta, onReply, onReact, children }: MessageBubbleProps) {
  const [reactOpen, setReactOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
  const reactions = [msg.contactReaction, msg.reaction].filter(Boolean) as string[];

  const reactionBar = (
    <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-800">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onReact(msg.reaction === emoji ? "" : emoji); setReactOpen(false); }}
          className={cn("flex size-10 items-center justify-center rounded-full text-[26px] transition-transform hover:scale-110", msg.reaction === emoji && "bg-black/[.06]")}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn("group/msg flex px-[6%]", own ? "justify-end" : "justify-start", first ? "mt-3" : "mt-0.5", reactions.length && "mb-4")}>
      <div className={cn("flex max-w-[65%] items-center gap-2", own ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "relative min-w-[90px] rounded-lg px-2 pb-2 pt-1.5 text-[14.2px] leading-[19px] text-[#111B21] shadow-[0_1px_.5px_rgba(11,20,26,.13)] dark:text-zinc-100",
            own ? "bg-[#D9FDD3] dark:bg-[#005C4B]" : "bg-white dark:bg-zinc-800",
            first && (own ? "rounded-tr-none" : "rounded-tl-none"),
          )}
        >
          {first && <Tail own={own} />}

          {/* Options arrow, like WhatsApp Web */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "absolute right-1 top-1 z-10 flex size-6 items-center justify-center rounded-full text-[#8696A0] opacity-0 transition-opacity group-hover/msg:opacity-100 data-[state=open]:opacity-100",
                  own ? "bg-[#D9FDD3] dark:bg-[#005C4B]" : "bg-white dark:bg-zinc-800",
                )}
                title="Opciones"
              >
                <IconChevronDown size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={own ? "end" : "start"} className="w-56 rounded-2xl border-none bg-white p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-900">
              {own && (
                <DropdownMenuItem onClick={() => setInfoOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconInfoCircle size={20} className="text-[#54656F]" /> Info del mensaje
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onReply} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                <IconArrowBackUp size={20} className="text-[#54656F]" /> Responder
              </DropdownMenuItem>
              {msg.text && (
                <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(msg.text)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconCopy size={20} className="text-[#54656F]" /> Copiar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setTimeout(() => setReactOpen(true), 50)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                <IconMoodSmile size={20} className="text-[#54656F]" /> Reaccionar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quoted message */}
          {msg.quotedText && (
            <div className="mb-1 mt-0.5 overflow-hidden rounded-md border-l-4 border-[#06CF9C] bg-black/[.05] px-2.5 py-1.5 dark:bg-white/10">
              <p className="text-[12.8px] font-medium text-[#06A57A]">{msg.quotedSenderType === "CLIENT" ? contactName : "Tú"}</p>
              <p className="line-clamp-2 text-[13px] text-[#667781] dark:text-zinc-300">{msg.quotedText}</p>
            </div>
          )}

          <div className="pr-1">
            {children}
            {/* Room for the time so it never overlaps the last line */}
            {!hideMeta && <span className={cn("inline-block h-3", own ? "w-[86px]" : "w-[68px]")} aria-hidden />}
          </div>

          {!hideMeta && (
            <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] leading-none text-[#667781] dark:text-zinc-400">
              {time}
              {own && <WaTicks status={msg.status} />}
            </span>
          )}

          {reactions.length > 0 && (
            <button
              type="button"
              onClick={() => setReactOpen(true)}
              className={cn("absolute -bottom-4 flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[15px] shadow-[0_1px_3px_rgba(11,20,26,.2)] dark:bg-zinc-800", own ? "right-2" : "left-2")}
            >
              {reactions.map((r, i) => <span key={i}>{r}</span>)}
              {reactions.length > 1 && <span className="ml-0.5 text-[11px] text-[#667781]">2</span>}
            </button>
          )}
        </div>

        {/* Quick reaction button next to the bubble */}
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#8696A0] opacity-0 shadow-sm transition-opacity hover:text-[#54656F] group-hover/msg:opacity-100 data-[state=open]:opacity-100 dark:bg-zinc-800"
              title="Reaccionar"
            >
              <IconMoodSmile size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-auto border-none bg-transparent p-0 shadow-none">
            {reactionBar}
          </PopoverContent>
        </Popover>
      </div>

      {/* Message info */}
      <Popover open={infoOpen} onOpenChange={setInfoOpen}>
        <PopoverTrigger asChild><span /></PopoverTrigger>
        <PopoverContent align="end" className="w-64 rounded-2xl p-4 text-[14px]">
          <p className="mb-3 font-medium text-[#111B21]">Info del mensaje</p>
          <div className="flex items-center justify-between text-[#3B4A54]">
            <span className="flex items-center gap-2"><WaTicks status={msg.status} /> {STATUS_LABEL[String(msg.status).toUpperCase()] ?? "Enviado"}</span>
            <span className="text-[12px] text-[#667781]">{new Date(msg.createdAt).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Reply preview shown above the input while answering a message. */
export function ReplyPreview({ msg, contactName, onCancel }: { msg: any; contactName: string; onCancel: () => void }) {
  return (
    <div className="flex items-stretch gap-2 px-2 pt-2">
      <div className="flex-1 overflow-hidden rounded-lg border-l-4 border-[#06CF9C] bg-[#F0F2F5] px-3 py-2 dark:bg-zinc-800">
        <p className="text-[12.8px] font-medium text-[#06A57A]">{msg.senderType === "CLIENT" ? contactName : "Tú"}</p>
        <p className="line-clamp-1 text-[13.5px] text-[#667781]">{msg.text || "Archivo"}</p>
      </div>
      <button type="button" onClick={onCancel} className="flex w-9 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5" title="Cancelar respuesta">
        <IconPlus size={22} className="rotate-45" />
      </button>
    </div>
  );
}
