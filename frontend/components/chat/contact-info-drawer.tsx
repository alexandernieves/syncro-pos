"use client";

import { useMemo } from "react";
import {
  IconAddressBook,
  IconAlertCircle,
  IconBan,
  IconBell,
  IconCash,
  IconChevronRight,
  IconCircleMinus,
  IconDownload,
  IconHeart,
  IconHeartOff,
  IconId,
  IconPhoto,
  IconSearch,
  IconStarFilled,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatWhatsAppNumber } from "@/lib/phone-countries";
import { WaAvatar } from "@/components/chat/whatsapp-ui";

type ContactInfoDrawerProps = {
  chat: any;
  displayName: string;
  avatarSrc?: string | null;
  messages: any[];
  /** Media already downloaded for messages without a stored file. */
  messageMedia: Record<string, string>;
  customLists: string[];
  sending?: boolean;
  onClose: () => void;
  onSearch: () => void;
  onToggle: (property: "isMuted" | "isFavorite" | "isBlocked", current: boolean) => void;
  onToggleList: (listName: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onSendReminder: () => void;
  onOpenPayment: () => void;
  className?: string;
};

const MEDIA_UNAVAILABLE = "__unavailable__";

function Row({ icon, label, hint, onClick, right, danger }: { icon: React.ReactNode; label: string; hint?: string; onClick?: () => void; right?: React.ReactNode; danger?: boolean }) {
  return (
    // A div, not a button: some rows hold a switch, and buttons can't be nested
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick?.())}
      className={cn("flex w-full cursor-pointer items-center gap-6 rounded-xl px-6 py-3.5 text-left outline-none transition-colors hover:bg-[#F5F6F6] focus-visible:bg-[#F5F6F6] dark:hover:bg-zinc-800/60", danger && "text-[#EA0038]")}
    >
      <span className={cn("shrink-0", danger ? "text-[#EA0038]" : "text-[#54656F]")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[16px]", danger ? "text-[#EA0038]" : "text-[#111B21] dark:text-zinc-100")}>{label}</span>
        {hint && <span className="block text-[14px] text-[#667781]">{hint}</span>}
      </span>
      {right}
    </div>
  );
}

const Divider = () => <div className="mx-6 my-2 h-px bg-[#E9EDEF] dark:bg-zinc-800" />;

/** WhatsApp Web "Info del contacto" panel, with the Syncro client data. */
export function ContactInfoDrawer(props: ContactInfoDrawerProps) {
  const { chat, displayName, avatarSrc, messages, messageMedia, customLists, sending, onClose, onSearch, onToggle, onToggleList, onClear, onDelete, onSendReminder, onOpenPayment, className } = props;
  const client = chat.client;
  const phone = chat.phone ? formatWhatsAppNumber(`+${String(chat.phone).replace(/\D/g, "")}`) : "";

  const media = useMemo(
    () =>
      messages
        .filter((m) => m.type === "image" || m.type === "document" || m.type === "video")
        .map((m) => {
          const raw = m.mediaUrl || messageMedia[m.id];
          const src = !raw || raw === MEDIA_UNAVAILABLE ? null : /^(data:|https?:|\/)/.test(raw) ? raw : `data:image/jpeg;base64,${raw}`;
          return { id: m.id, type: m.type, src, text: m.text };
        })
        .reverse(),
    [messages, messageMedia],
  );

  const stars = client ? Math.round((client.creditScore || 0) / 20) : 0;
  const debt = Number(client?.currentDebt || 0);

  const exportChat = () => {
    const lines = messages.map((m) => {
      const when = new Date(m.createdAt).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
      const who = m.senderType === "CLIENT" ? displayName : "Tú";
      return `[${when}] ${who}: ${m.text || `<${m.type}>`}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Chat de WhatsApp con ${displayName}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <aside className={cn("flex flex-col border-l border-[#E9EDEF] bg-white dark:border-zinc-900 dark:bg-zinc-950", className)}>
      <div className="flex h-[64px] shrink-0 items-center gap-6 px-6">
        <button type="button" onClick={onClose} title="Cerrar" className="-ml-2 flex size-10 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5">
          <IconX size={22} />
        </button>
        <h2 className="text-[16px] text-[#111B21] dark:text-zinc-100">Info del contacto</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Profile */}
        <div className="flex flex-col items-center px-6 pb-5 pt-4 text-center">
          <WaAvatar src={avatarSrc} seed={chat.id} size={200} />
          <p className="mt-4 text-[24px] text-[#111B21] dark:text-zinc-100">{displayName}</p>
          <p className="mt-1 text-[16px] text-[#667781] tabular-nums">{phone}</p>
          <div className="mt-5 flex gap-3">
            <ActionButton icon={<IconSearch size={22} />} label="Buscar" onClick={onSearch} />
            {client && debt > 0 && <ActionButton icon={<IconAlertCircle size={22} />} label="Cobrar" onClick={onSendReminder} disabled={sending} />}
            {client && debt > 0 && <ActionButton icon={<IconCash size={22} />} label="Abono" onClick={onOpenPayment} />}
          </div>
        </div>

        {/* Syncro client */}
        {client ? (
          <>
            <Divider />
            <div className="px-6 py-3">
              <p className="text-[14px] text-[#667781]">Cliente en Syncro</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-6">
                  <IconId size={22} className="shrink-0 text-[#54656F]" />
                  <span className="flex-1 text-[16px] text-[#111B21] dark:text-zinc-100">{client.documentId || "Sin cédula registrada"}</span>
                </div>
                {client.hasAccount && (
                  <div className="flex items-center gap-6">
                    <IconStarFilled size={22} className={cn("shrink-0", stars >= 4 ? "text-[#1DAA61]" : stars >= 2 ? "text-amber-400" : "text-rose-400")} />
                    <span className="flex-1 text-[16px] text-[#111B21] dark:text-zinc-100">Syncro Score</span>
                    <span className="text-[15px] text-[#667781]">{stars}/5</span>
                  </div>
                )}
              </div>
              {/* Credit data only for clients with SyncroCredit or who owe something */}
              {client.hasAccount || debt > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#FFF0F2] px-4 py-3 dark:bg-rose-500/10">
                    <p className="text-[13px] text-[#C12A4B]">Deuda actual</p>
                    <p className="text-[19px] font-semibold text-[#C12A4B] tabular-nums">${debt.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-[#E7F8EE] px-4 py-3 dark:bg-emerald-500/10">
                    <p className="text-[13px] text-[#15603E]">{client.hasAccount ? "Límite autorizado" : "Crédito"}</p>
                    <p className="text-[19px] font-semibold text-[#15603E] tabular-nums">
                      {client.hasAccount && Number(client.creditLimit) > 0 ? `$${Number(client.creditLimit).toFixed(0)}` : "Fiado tradicional"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-[#F0F2F5] px-4 py-3 text-[14px] text-[#667781] dark:bg-zinc-800">Sin crédito. Este cliente no tiene SyncroCredit activo ni deudas.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <Divider />
            <p className="px-6 py-3 text-[14px] text-[#667781]">Este número no está vinculado a un cliente de Syncro.</p>
          </>
        )}

        {/* Files */}
        <Divider />
        <Row icon={<IconPhoto size={22} />} label="Archivos, enlaces y documentos" right={<span className="text-[14px] text-[#667781]">{media.length}</span>} />
        {media.length > 0 && (
          <div className="grid grid-cols-4 gap-2 px-6 pb-3">
            {media.slice(0, 4).map((m) => (
              <div key={m.id} className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-[#F0F2F5] dark:bg-zinc-800">
                {m.src && m.type === "image" ? (
                  <img src={m.src} alt="" className="size-full object-cover" />
                ) : (
                  <span className="px-1 text-center text-[11px] text-[#667781] line-clamp-3">{m.type === "document" ? m.text || "Documento" : "Archivo"}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <Divider />
        <Row
          icon={<IconBell size={22} />}
          label="Silenciar notificaciones"
          onClick={() => onToggle("isMuted", !!chat.isMuted)}
          right={<Switch checked={!!chat.isMuted} onCheckedChange={() => onToggle("isMuted", !!chat.isMuted)} onClick={(e) => e.stopPropagation()} />}
        />

        <Divider />
        <Row
          icon={chat.isFavorite ? <IconHeartOff size={22} /> : <IconHeart size={22} />}
          label={chat.isFavorite ? "Eliminar de favoritos" : "Añadir a favoritos"}
          onClick={() => onToggle("isFavorite", !!chat.isFavorite)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div>
              <Row icon={<IconAddressBook size={22} />} label="Cambiar de lista" hint={chat.lists?.length ? chat.lists.join(", ") : undefined} right={<IconChevronRight size={18} className="text-[#8696A0]" />} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none bg-white p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-900">
            {customLists.length === 0 && <p className="px-3 py-2 text-[14px] text-[#667781]">Aún no tienes listas. Créalas desde el menú de la lista de chats.</p>}
            {customLists.map((name) => (
              <DropdownMenuItem key={name} onClick={() => onToggleList(name)} className="justify-between gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                <span className="truncate">{name}</span>
                {chat.lists?.includes(name) && <span className="text-[#1DAA61]">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Row icon={<IconDownload size={22} />} label="Exportar chat" onClick={exportChat} />

        <Divider />
        <Row icon={<IconCircleMinus size={22} />} label="Vaciar chat" onClick={onClear} danger />
        <Row icon={<IconBan size={22} />} label={chat.isBlocked ? `Desbloquear a ${displayName}` : `Bloquear a ${displayName}`} onClick={() => onToggle("isBlocked", !!chat.isBlocked)} danger />
        <Row icon={<IconTrash size={22} />} label="Eliminar chat" onClick={onDelete} danger />
      </div>
    </aside>
  );
}

function ActionButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-2 disabled:opacity-50">
      <span className="flex h-12 w-[72px] items-center justify-center rounded-2xl bg-[#F0F2F5] text-[#111B21] transition-colors hover:bg-[#E4E7EA] dark:bg-zinc-800 dark:text-zinc-100">{icon}</span>
      <span className="text-[14px] text-[#111B21] dark:text-zinc-200">{label}</span>
    </button>
  );
}
