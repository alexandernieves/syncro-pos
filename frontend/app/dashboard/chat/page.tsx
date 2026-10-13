"use client";
import { cn } from "@/lib/utils";
import { NewChatPanel } from "@/components/chat/new-chat-panel";
import { WaAvatar, WaChip, WaIconButton, WaPreview, formatChatTime } from "@/components/chat/whatsapp-ui";
import { DayDivider, MessageBubble, ReplyPreview, WA_WALLPAPER, dayLabel } from "@/components/chat/conversation-ui";
import { formatWhatsAppNumber } from "@/lib/phone-countries";
import { ContactInfoDrawer } from "@/components/chat/contact-info-drawer";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import type { Socket } from "socket.io-client";
import { connectSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  IconBrandWhatsapp, IconSend, IconUser, IconReceipt, IconSettings,
  IconAlertCircle, IconCheck, IconChecks, IconDeviceMobile, IconHistory,
  IconCash, IconReload, IconSearch, IconArrowLeft, IconInfoCircle, IconMessage,
  IconMoodSmile, IconPlus, IconPhoto, IconFileText, IconMicrophone, IconTrash, IconDownload,
  IconChevronDown, IconPin, IconArchive, IconEyeOff, IconStar, IconVolumeOff, IconMail, IconFolderPlus, IconBan, IconLock, IconEye, IconFolder, IconDotsVertical, IconMessagePlus,
  IconPhotoOff, IconMessageCircle, IconAddressBook, IconLogout, IconLoader2, IconBellOff, IconPinnedOff, IconMessageDots, IconHeart, IconCircleMinus, IconPaperclip, IconX,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { WhatsAppAudioPlayer } from "@/components/ui/whatsapp-audio-player";

const API = API_URL;


const EMOJIS = [
  // Smilies & Emotion
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", 
  "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", 
  "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", 
  "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", 
  // Gestures & Body
  "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", 
  "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️",
  // Hearts & Symbols
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
  // Miscellaneous
  "🔥", "✨", "🌟", "⭐", "🎉", "🎈", "🚀", "💡", "📢", "💬", "✔️", "❌", "⚠️", "⏳", "💵", "📦"
];

// CustomAudioPlayer removed in favor of reusable WhatsAppAudioPlayer

const MEDIA_UNAVAILABLE = "__unavailable__";

/** "últ. vez hoy a las 3:20 p. m." like WhatsApp. */
function lastSeenLabel(value: string) {
  const d = new Date(value);
  const time = d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return `Últ. vez hoy a las ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Últ. vez ayer a las ${time}`;
  return `Últ. vez el ${d.toLocaleDateString("es-VE", { day: "numeric", month: "short" })} a las ${time}`;
}

function MediaMessageRenderer({
  msg,
  messageMedia,
  fetchMessageMedia,
  senderAvatar,
  senderFallback
}: {
  msg: any;
  messageMedia: Record<string, string>;
  fetchMessageMedia: (id: string) => void;
  senderAvatar?: string | null;
  senderFallback?: string;
}) {
  useEffect(() => {
    if (msg.type !== "text" && !msg.mediaUrl && !messageMedia[msg.id]) {
      fetchMessageMedia(msg.id);
    }
  }, [msg.id, msg.type, msg.mediaUrl, messageMedia, fetchMessageMedia]);

  const base64 = msg.mediaUrl || messageMedia[msg.id];

  if (base64 === MEDIA_UNAVAILABLE) {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 py-1 text-xs italic opacity-70">
          <IconPhotoOff size={14} /> Archivo no disponible en Syncro
        </p>
        {msg.text && !/^\[(Archivo|image|audio|video|document)/i.test(msg.text) && <p className="mt-1 leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
      </div>
    );
  }

  if (!base64) {
    return (
      <div className="flex items-center gap-2 py-2 text-zinc-400">
        <div className="size-4 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full" />
        <span>Cargando archivo...</span>
      </div>
    );
  }

  // Detect mime type or format
  let src = base64;
  // Stored files come as a link; Evolution media comes as raw base64
  if (!src.startsWith("data:") && !/^(https?:)?\/\//.test(src) && !src.startsWith("/")) {
    // Determine mime based on msg.type
    let mime = "image/jpeg";
    if (msg.type === "audio") mime = "audio/ogg";
    else if (msg.type === "video") mime = "video/mp4";
    else if (msg.type === "document") mime = "application/pdf";
    src = `data:${mime};base64,${base64}`;
  }

  if (msg.type === "image") {
    return (
      <div className="space-y-1">
        <img
          src={src}
          alt="Imagen"
          className="rounded-lg max-w-full max-h-[300px] object-contain cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
          onClick={() => {
            const win = window.open();
            if (win) {
              win.document.write(`<iframe src="${src}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
            }
          }}
        />
        {msg.text && msg.text !== "Imagen" && <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
      </div>
    );
  }

  if (msg.type === "audio" || msg.type === "AUDIO") {
    const isAgent = msg.senderType === "AGENT";
    const isRead = msg.status === "READ";
    const timestamp = format(new Date(msg.createdAt), "hh:mm a");
    return (
      <WhatsAppAudioPlayer
        src={src}
        isAgent={isAgent}
        senderAvatar={senderAvatar}
        senderFallback={senderFallback}
        isRead={isRead}
        status={msg.status}
        timestamp={timestamp}
      />
    );
  }

  if (msg.type === "video") {
    return (
      <div className="space-y-1">
        <video controls src={src} className="rounded-lg max-w-full max-h-[300px]" />
        {msg.text && msg.text !== "Video" && <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
      </div>
    );
  }

  // Document or other files
  const displayName = msg.text && msg.text !== "Documento" ? msg.text : `archivo.${msg.type === 'document' ? 'pdf' : 'bin'}`;
  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-150 dark:border-zinc-800">
      <div className="flex items-center gap-2 min-w-0">
        <IconFileText size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">{displayName}</span>
      </div>
      <a href={src} download={displayName} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shrink-0">
        <IconDownload size={14} />
      </a>
    </div>
  );
}

export default function WhatsAppChatPage() {
  const [chats, setChats] = useState<any[]>([]);
  const chatsRef = useRef<any[]>([]);
  chatsRef.current = chats;
  // Contact presence per chat (online, typing, recording) as WhatsApp reports it
  const [presenceByChat, setPresenceByChat] = useState<Record<string, { presence: string; at: number; lastSeen: string | null }>>({});
  const [, setPresenceTick] = useState(0);
  useEffect(() => {
    // "escribiendo…" fades by itself if WhatsApp never sends "paused"
    const timer = setInterval(() => setPresenceTick((t) => t + 1), 4000);
    return () => clearInterval(timer);
  }, []);
  const presenceOf = (chat: any) => {
    if (!chat) return null;
    const entry = presenceByChat[chat.id] || presenceByChat[String(chat.phone || "").replace(/\D/g, "")];
    if (!entry) return null;
    const fresh = Date.now() - entry.at < 15000;
    if ((entry.presence === "composing" || entry.presence === "recording") && !fresh) return { ...entry, presence: "available" };
    return entry;
  };
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  // Message being answered, and search inside the open chat
  const [replyTo, setReplyTo] = useState<any>(null);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Caching states
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [messageMedia, setMessageMedia] = useState<Record<string, string>>({});
  const fetchingAvatarsRef = useRef<Set<string>>(new Set());

  // Premium Features States
  const [activeTab, setActiveTab] = useState<string>("all"); // "all", "unread", "favorites", "list:ListName"
  const [specialView, setSpecialView] = useState<"none" | "archived" | "restricted">("none");
  const [customLists, setCustomLists] = useState<string[]>([]);
  const [newListDialogOpen, setNewListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  // UI / Menus
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Voice Note Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Connection & QR
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; state: string }>({ connected: false, state: "DISCONNECTED" });
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // "Nuevo chat" contact list over the sidebar
  const [newChatOpen, setNewChatOpen] = useState(false);

  // Abono Modal
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState<"USD" | "VES" | "COP">("USD");
  const [paidAmountRaw, setPaidAmountRaw] = useState("");
  const [customRate, setCustomRate] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // App Lock States
  const [appLockOpen, setAppLockOpen] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [restrictedUnlockOpen, setRestrictedUnlockOpen] = useState(false);
  const [restrictedUnlockInput, setRestrictedUnlockInput] = useState("");

  // Reusable Confirmation Dialog States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmDescription(description);
    setOnConfirmAction(() => onConfirm);
    setConfirmOpen(true);
  };

  // Chat display helper
  const getChatDisplayName = (chat: any) => {
    if (!chat) return "";
    const name = chat.name || "";
    if (name.startsWith("Contacto ")) {
      return name.replace("Contacto ", "");
    }
    return name || chat.phone || "";
  };

  const [mobileView, setMobileView] = useState<"list" | "chat">("list");


  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  // 1. Fetch connection status
  const checkConnectionStatus = useCallback(async (showToast = false) => {
    setCheckingStatus(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectionStatus(data);
        if (showToast) {
          if (data.connected) {
            toast.success("WhatsApp está conectado");
          } else {
            toast.info(`WhatsApp desconectado: ${data.state}`);
          }
        }
        return data;
      }
    } catch {
      if (showToast) toast.error("Error al consultar estado de WhatsApp");
    } finally {
      setCheckingStatus(false);
    }
    return { connected: false, state: "ERROR" };
  }, []);

  // 2. Fetch chats list
  const loadChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch {
      toast.error("Error al cargar chats de WhatsApp");
    } finally {
      setLoadingChats(false);
    }
  }, []);

  // Load custom lists from localStorage
  useEffect(() => {
    const savedLists = localStorage.getItem("whatsapp_custom_lists");
    if (savedLists) {
      try {
        setCustomLists(JSON.parse(savedLists));
      } catch {
        setCustomLists(["Cliente viejos"]);
      }
    } else {
      setCustomLists(["Cliente viejos"]);
      localStorage.setItem("whatsapp_custom_lists", JSON.stringify(["Cliente viejos"]));
    }
  }, []);

  // Check App Lock on load
  useEffect(() => {
    const savedLock = localStorage.getItem("whatsapp_app_lock");
    if (savedLock) {
      setShowLockScreen(true);
    }
  }, []);

  // Chat Actions API calls
  const toggleChatProperty = async (chatId: string, property: string, currentValue: any) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${chatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [property]: !currentValue })
      });
      if (res.ok) {
        const updatedChat = await res.json();
        setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
        if (activeChat?.id === chatId) {
          setActiveChat(updatedChat);
        }
        toast.success("Chat actualizado");
      } else {
        toast.error("Error al actualizar chat");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const toggleChatList = async (chatId: string, listName: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const currentLists = chat.lists || [];
    const updatedLists = currentLists.includes(listName)
      ? currentLists.filter((l: string) => l !== listName)
      : [...currentLists, listName];
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${chatId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lists: updatedLists })
      });
      if (res.ok) {
        const updatedChat = await res.json();
        setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
        if (activeChat?.id === chatId) {
          setActiveChat(updatedChat);
        }
        toast.success(currentLists.includes(listName) ? `Eliminado de ${listName}` : `Añadido a ${listName}`);
      }
    } catch {
      toast.error("Error al actualizar listas");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success("Todos los chats marcados como leídos");
        setChats(prev => prev.map(c => ({ ...c, isUnread: false })));
      } else {
        toast.error("Error al marcar como leídos");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleLogoutInstance = () => {
    showConfirm(
      "Desvincular WhatsApp",
      "¿Estás seguro de que deseas desvincular tu WhatsApp? Se desconectará la instancia y deberás escanear el código QR nuevamente para vincular.",
      async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API}/whatsapp/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success("WhatsApp desvinculado correctamente");
            setConnectionStatus({ connected: false, state: "DISCONNECTED" });
          } else {
            toast.error("Error al desvincular WhatsApp");
          }
        } catch {
          toast.error("Error de conexión");
        }
      }
    );
  };

  const handleActionToast = (action: string) => {
    toast.info(`Función "${action}" disponible en la versión móvil vinculada`);
  };

  const handleSaveAppLock = () => {
    const pin = lockPassword.trim();
    if (!pin) {
      localStorage.removeItem("whatsapp_app_lock");
      toast.success("Bloqueo de aplicación desactivado");
    } else {
      localStorage.setItem("whatsapp_app_lock", pin);
      toast.success("Bloqueo de aplicación activado correctamente");
    }
    setAppLockOpen(false);
    setLockPassword("");
  };

  const handleUnlockApp = () => {
    const savedLock = localStorage.getItem("whatsapp_app_lock");
    if (unlockInput === savedLock) {
      setShowLockScreen(false);
      setUnlockInput("");
      toast.success("Aplicación desbloqueada");
    } else {
      toast.error("PIN incorrecto");
    }
  };

  const handleOpenRestrictedChats = () => {
    const savedLock = localStorage.getItem("whatsapp_app_lock");
    if (savedLock) {
      setRestrictedUnlockOpen(true);
    } else {
      setSpecialView("restricted");
    }
  };

  const handleVerifyRestrictedLock = () => {
    const savedLock = localStorage.getItem("whatsapp_app_lock");
    if (restrictedUnlockInput === savedLock) {
      setSpecialView("restricted");
      setRestrictedUnlockOpen(false);
      setRestrictedUnlockInput("");
      toast.success("Chats restringidos desbloqueados");
    } else {
      toast.error("PIN incorrecto");
    }
  };

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    if (customLists.includes(name)) {
      toast.error("La lista ya existe");
      return;
    }
    const updated = [...customLists, name];
    setCustomLists(updated);
    localStorage.setItem("whatsapp_custom_lists", JSON.stringify(updated));
    setNewListName("");
    setNewListDialogOpen(false);
    toast.success(`Lista "${name}" creada`);
    setActiveTab(`list:${name}`);
  };

  const handleDeleteList = (listName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      "Eliminar Lista",
      `¿Estás seguro de que deseas eliminar la lista "${listName}"?`,
      () => {
        const updated = customLists.filter(l => l !== listName);
        setCustomLists(updated);
        localStorage.setItem("whatsapp_custom_lists", JSON.stringify(updated));
        if (activeTab === `list:${listName}`) {
          setActiveTab("all");
        }
        toast.success(`Lista "${listName}" eliminada`);
      }
    );
  };

  const handleClearChat = (chatId: string) => {
    showConfirm(
      "Vaciar Chat",
      "¿Estás seguro de que deseas vaciar este chat? Se borrarán todos los mensajes.",
      async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API}/whatsapp/chats/${chatId}/clear`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success("Chat vaciado");
            if (activeChat?.id === chatId) {
              setMessages([]);
            }
            loadChats();
          } else {
            toast.error("Error al vaciar chat");
          }
        } catch {
          toast.error("Error de conexión");
        }
      }
    );
  };

  const handleDeleteChat = (chatId: string) => {
    showConfirm(
      "Eliminar Chat",
      "¿Estás seguro de que deseas eliminar este chat? Se borrará la conversación de tu lista.",
      async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${API}/whatsapp/chats/${chatId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success("Conversación eliminada");
            if (activeChat?.id === chatId) {
              setActiveChat(null);
              setMessages([]);
            }
            setChats(prev => prev.filter(c => c.id !== chatId));
          } else {
            toast.error("Error al eliminar conversación");
          }
        } catch {
          toast.error("Error de conexión");
        }
      }
    );
  };

  // 3. Load active chat messages
  const loadMessages = async (chatId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages(await res.json());
        setTimeout(scrollToBottom, 100);
      }
    } catch {
      toast.error("Error al cargar historial de mensajes");
    } finally {
      setLoadingMessages(false);
    }
  };

  // 4. Fetch general settings (exchange rate, etc)
  const fetchSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setSettings(await res.json());
    } catch { /* silent */ }
  }, []);

  // 5. Fetch profile picture from backend/Evolution API
  const fetchAvatar = useCallback(async (chatId: string) => {
    if (fetchingAvatarsRef.current.has(chatId)) return;
    fetchingAvatarsRef.current.add(chatId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${chatId}/avatar`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvatars(prev => ({ ...prev, [chatId]: data.profilePictureUrl || null }));
      } else {
        setAvatars(prev => ({ ...prev, [chatId]: null }));
      }
    } catch {
      setAvatars(prev => ({ ...prev, [chatId]: null }));
    }
  }, []);

  // 6. Fetch message media content on demand
  const fetchMessageMedia = useCallback(async (msgId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/messages/${msgId}/media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res.ok ? await res.json().catch(() => null) : null;
      // Evolution doesn't keep every file: mark it so the bubble stops loading
      setMessageMedia(prev => ({ ...prev, [msgId]: data?.base64 || MEDIA_UNAVAILABLE }));
    } catch (e) {
      console.error("Error loading message media", e);
      setMessageMedia(prev => ({ ...prev, [msgId]: MEDIA_UNAVAILABLE }));
    }
  }, []);

  // 7. Handle file selection & base64 conversion & upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, fallbackType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 10mb");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(",")[1];
      
      let mediatype = fallbackType;
      if (file.type.startsWith("image/")) mediatype = "image";
      else if (file.type.startsWith("video/")) mediatype = "video";
      else if (file.type.startsWith("audio/")) mediatype = "audio";
      else mediatype = "document";

      setSendingMessage(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/whatsapp/chats/${activeChat.id}/send-media`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            mediatype,
            media: base64Data,
            fileName: file.name,
            caption: mediatype === "image" ? `Imagen: ${file.name}` : undefined
          })
        });

        if (res.ok) {
          toast.success("Archivo enviado");
          loadChats();
          loadMessages(activeChat.id);
        } else {
          toast.error("Error al enviar el archivo");
        }
      } catch {
        toast.error("Error de conexión");
      } finally {
        setSendingMessage(false);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  // 8. Start recording voice note
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (isCancelledRef.current) {
           isCancelledRef.current = false;
           return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(",")[1];
          
          setSendingMessage(true);
          try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/whatsapp/chats/${activeChat.id}/send-media`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                mediatype: "audio",
                media: base64Data,
                fileName: "nota-de-voz.mp3",
              })
            });

            if (res.ok) {
              toast.success("Nota de voz enviada");
              loadChats();
              loadMessages(activeChat.id);
            } else {
              toast.error("Error al enviar la nota de voz");
            }
          } catch {
            toast.error("Error de conexión");
          } finally {
            setSendingMessage(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      isCancelledRef.current = false;

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error starting voice recording", err);
      toast.error("Permiso denegado o error al acceder al micrófono");
    }
  };

  // 9. Stop voice recording
  const stopRecording = (cancel = false) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    isCancelledRef.current = cancel;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Auto load profile pictures for chat list
  useEffect(() => {
    chats.forEach(c => {
      if (avatars[c.id] === undefined) {
        fetchAvatar(c.id);
      }
    });
  }, [chats, fetchAvatar, avatars]);

  // Auto load profile picture for active chat
  useEffect(() => {
    if (activeChat && avatars[activeChat.id] === undefined) {
      fetchAvatar(activeChat.id);
    }
  }, [activeChat, fetchAvatar, avatars]);

  // Real time (Socket.IO): one connection for the whole page; the open chat is read from a ref
  const activeChatRef = useRef<any>(null);
  activeChatRef.current = activeChat;

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (!storedUser.id) return;

    // The backend only accepts authenticated sockets and takes the business from the token
    const socket = connectSocket({ auth: { token: localStorage.getItem("token") } });
    socketRef.current = socket;

    const joinRoom = () => socket.emit("joinBusiness", {});
    socket.on("connect", joinRoom);

    // A chat opened from the contacts has the phone as a temporary id until its first message
    const isOpenChat = (chatId: string, phone?: string) => {
      const open = activeChatRef.current;
      if (!open) return false;
      return open.id === chatId || (!!phone && String(open.phone || open.id).replace(/\D/g, "") === String(phone).replace(/\D/g, ""));
    };

    socket.on("whatsapp_newMessage", (msg: any) => {
      const chatInList = chatsRef.current.find((c) => c.id === msg.chatId);
      const open = isOpenChat(msg.chatId, chatInList?.phone);
      if (open && msg.senderType === "CLIENT" && document.visibilityState === "visible") {
        markOpenChatRead(msg.chatId);
      }
      if (open) {
        setMessages((prev) => {
          // Same message again with more data (stored file, reaction, status)
          if (prev.some((m) => m.id === msg.id)) return prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 80);
      }
      // Chat list: last message preview, order and unread mark
      setChats((prev) => {
        const chat = prev.find((c) => c.id === msg.chatId);
        if (!chat) return prev;
        const isNewest = !chat.messages?.[0] || chat.messages[0].id === msg.id || new Date(msg.createdAt) >= new Date(chat.messages[0].createdAt);
        if (!isNewest) return prev;
        const updated = {
          ...chat,
          messages: [msg],
          lastMessage: msg.text || chat.lastMessage,
          lastMessageTime: msg.createdAt,
          isUnread: chat.isUnread || (!open && msg.senderType === "CLIENT"),
        };
        return [updated, ...prev.filter((c) => c.id !== msg.chatId)];
      });
    });

    socket.on("whatsapp_chatUpdated", (updatedChat: any) => {
      // Events can carry only part of the chat: merge, never replace
      setChats((prev) => {
        const existing = prev.find((c) => c.id === updatedChat.id);
        const merged = { ...existing, ...updatedChat, client: updatedChat.client ?? existing?.client, messages: updatedChat.messages ?? existing?.messages };
        return [merged, ...prev.filter((c) => c.id !== updatedChat.id)];
      });
      const open = activeChatRef.current;
      if (open && isOpenChat(updatedChat.id, updatedChat.phone)) {
        const becameReal = open.id !== updatedChat.id;
        setActiveChat((prev: any) => ({ ...prev, ...updatedChat, client: updatedChat.client ?? prev?.client }));
        // The temporary chat now has its real id: load what was saved under it
        if (becameReal) loadMessages(updatedChat.id, true);
      }
    });

    socket.on("whatsapp_presence", (data: any) => {
      const entry = { presence: data.presence, at: Date.now(), lastSeen: data.lastSeen ?? null };
      setPresenceByChat((prev) => ({ ...prev, [data.chatId]: entry, [String(data.phone).replace(/\D/g, "")]: entry }));
    });

    socket.on("whatsapp_chatDeleted", (data: any) => {
      setChats((prev) => prev.filter((c) => c.id !== data.id));
      setActiveChat((prev: any) => (prev && prev.id === data.id ? null : prev));
    });

    socket.on("whatsapp_messageStatusUpdated", (data: any) => {
      setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, status: data.status } : m)));
      setChats((prev) => prev.map((c) => (c.id === data.chatId && c.messages?.[0]?.id === data.messageId ? { ...c, messages: [{ ...c.messages[0], status: data.status }] } : c)));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Initial Data
  useEffect(() => {
    checkConnectionStatus();
    loadChats();
    fetchSettings();
  }, [checkConnectionStatus, loadChats, fetchSettings]);

  // Currency Conversion in Abono Modal
  useEffect(() => {
    if (!paymentOpen) return;
    if (paymentCurrency === "USD") {
      setPaymentAmount(paidAmountRaw);
    } else {
      const rate = parseFloat(customRate) || (paymentCurrency === "VES" ? (settings?.exchangeRate || 40) : (Number(settings?.copRateManual) || Number(settings?.exchangeRateCop) || 4000));
      setPaymentAmount(rate > 0 && paidAmountRaw ? (parseFloat(paidAmountRaw) / rate).toFixed(2) : "");
    }
  }, [paymentCurrency, paidAmountRaw, customRate, paymentOpen, settings]);

  // Poll status when QR Modal is Open
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (qrModalOpen) {
      let ticks = 0;
      interval = setInterval(async () => {
        const status = await checkConnectionStatus();
        if (status.connected) {
          toast.success("¡WhatsApp se ha conectado exitosamente!");
          setQrModalOpen(false);
          loadChats();
          return;
        }
        // WhatsApp replaces the code about every 20 s: keep showing the current one
        ticks += 1;
        if (ticks % 4 === 0) {
          try {
            const res = await fetch(`${API}/whatsapp/qr`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
            const data = res.ok ? await res.json() : null;
            if (data?.qr) setQrCode(data.qr);
          } catch {}
        }
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrModalOpen, checkConnectionStatus, loadChats]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Get QR Code
  const handleOpenQrModal = async () => {
    setLoadingQr(true);
    setQrModalOpen(true);
    setQrCode(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/qr`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "CONNECTED") {
          toast.success("WhatsApp ya está conectado");
          setQrModalOpen(false);
          checkConnectionStatus();
        } else {
          setQrCode(data.qr);
        }
      } else {
        toast.error("Error al obtener código QR");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoadingQr(false);
    }
  };

  // Read receipts (the contact sees blue ticks) and our presence towards the contact
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markOpenChatRead = (chatId: string) => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(() => {
      fetch(`${API}/whatsapp/chats/${chatId}/read`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }).catch(() => {});
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, isUnread: false } : c)));
    }, 600);
  };
  const sendPresence = (chatId: string, presence: "composing" | "paused" | "available") => {
    fetch(`${API}/whatsapp/chats/${chatId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify({ presence }),
    }).catch(() => {});
  };
  const typingRef = useRef<{ lastSent: number; idle: ReturnType<typeof setTimeout> | null }>({ lastSent: 0, idle: null });
  const notifyTyping = (text: string) => {
    const chat = activeChatRef.current;
    if (!chat) return;
    const typing = typingRef.current;
    if (typing.idle) clearTimeout(typing.idle);
    if (!text.trim()) {
      if (typing.lastSent) { sendPresence(chat.id, "paused"); typing.lastSent = 0; }
      return;
    }
    if (Date.now() - typing.lastSent > 4000) {
      sendPresence(chat.id, "composing");
      typing.lastSent = Date.now();
    }
    typing.idle = setTimeout(() => { sendPresence(chat.id, "paused"); typing.lastSent = 0; }, 3500);
  };

  // Select a conversation
  const handleSelectChat = (chat: any) => {
    // Subscribes to the contact's presence and sends the read receipts
    sendPresence(chat.id, "available");
    markOpenChatRead(chat.id);
    setReplyTo(null);
    setChatSearchOpen(false);
    setChatSearch("");
    setActiveChat(chat);
    setMobileView("chat");
    loadMessages(chat.id);
  };

  // Reaction on a message (empty emoji removes ours)
  const handleReactToMessage = async (msg: any, emoji: string) => {
    const before = msg.reaction ?? null;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reaction: emoji || null } : m)));
    try {
      const res = await fetch(`${API}/whatsapp/messages/${msg.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reaction: before } : m)));
      toast.error((e as Error).message || "No se pudo enviar la reacción");
    }
  };

  // Send a WhatsApp Message
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat) return;
    setSendingMessage(true);
    const textToSend = inputText;
    setInputText("");
    if (typingRef.current.idle) clearTimeout(typingRef.current.idle);
    typingRef.current.lastSent = 0;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${activeChat.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSend, quotedMessageId: replyTo?.id })
      });
      if (!res.ok) {
        toast.error("Error al despachar mensaje");
        setInputText(textToSend); // Restore text
      } else {
        setReplyTo(null);
        // Show our bubble right away; the socket event for it is merged by id
        const sent = await res.json().catch(() => null);
        if (sent?.id) {
          setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
          setTimeout(scrollToBottom, 80);
          if (sent.chatId && activeChat.id !== sent.chatId) {
            setActiveChat((prev: any) => (prev ? { ...prev, id: sent.chatId } : prev));
            loadChats();
          }
        }
      }
    } catch {
      toast.error("Error de conexión");
      setInputText(textToSend);
    } finally {
      setSendingMessage(false);
    }
  };

  // Send Cobro Reminder
  const handleSendReminder = async () => {
    if (!activeChat || !activeChat.client || activeChat.client.currentDebt <= 0) return;
    const client = activeChat.client;
    const text = `Hola *${client.name}*, te recordamos que tienes una cuenta por cobrar (deuda pendiente) de *${client.currentDebt.toFixed(2)} USD* en Ph Químicos. Agradecemos puedas reportar tu abono o pago móvil al portal. ¡Feliz día!`;
    
    setSendingMessage(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${activeChat.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        toast.success("Recordatorio de pago enviado");
        loadChats();
      } else {
        toast.error("Error al enviar recordatorio");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSendingMessage(false);
    }
  };

  // Register Payment
  const handleOpenPayment = () => {
    if (!activeChat || !activeChat.client) return;
    const client = activeChat.client;
    setPaymentAmount(client.currentDebt.toString());
    setPaidAmountRaw(client.currentDebt.toString());
    setPaymentCurrency("USD");
    setCustomRate("");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { toast.error("Monto inválido"); return; }
    setIsSubmittingPayment(true);
    try {
      const token = localStorage.getItem("token");
      const calculatedRate = paymentCurrency !== "USD"
        ? (parseFloat(customRate) || (paymentCurrency === "VES" ? settings?.exchangeRate : (Number(settings?.copRateManual) || Number(settings?.exchangeRateCop) || 4000)))
        : undefined;
      const res = await fetch(`${API}/clients/${activeChat.client.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          notes: paymentNotes || "Abono desde chat WhatsApp",
          paidCurrency: paymentCurrency,
          paidAmount: parseFloat(paidAmountRaw) || parseFloat(paymentAmount),
          exchangeRate: calculatedRate,
        }),
      });
      if (res.ok) {
        toast.success("Pago registrado y deuda actualizada");
        setPaymentOpen(false);
        // Refresh active chat data to update debt visual in sidebar
        const refreshedChatRes = await fetch(`${API}/whatsapp/chats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (refreshedChatRes.ok) {
          const chatsData = await refreshedChatRes.json();
          setChats(chatsData);
          const updatedChat = chatsData.find((c: any) => c.id === activeChat.id);
          if (updatedChat) setActiveChat(updatedChat);
        }
      } else {
        toast.error("Error al registrar pago");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Filtered Chats
  const filteredChats = chats.filter(c => {
    // 1. Search term match
    const nameMatch = getChatDisplayName(c).toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = c.phone?.includes(searchTerm) || false;
    const clientMatch = c.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesSearch = nameMatch || phoneMatch || clientMatch;
    if (!matchesSearch) return false;

    // 2. Special view filters
    if (specialView === "archived") {
      return c.isArchived;
    }
    if (specialView === "restricted") {
      return c.isRestricted;
    }

    // When in main view (specialView === "none"), exclude archived and restricted chats
    if (c.isArchived || c.isRestricted) {
      return false;
    }

    // 3. Tab filters
    if (activeTab === "unread") {
      return c.isUnread;
    }
    if (activeTab === "favorites") {
      return c.isFavorite;
    }
    if (activeTab.startsWith("list:")) {
      const listName = activeTab.replace("list:", "");
      return c.lists?.includes(listName) || false;
    }

    return true;
  });

  return (
    <div
      className={cn(
        "relative flex overflow-hidden h-[calc(100vh-100px)] font-sans",
      )}
    >
      {showLockScreen ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconLock size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-850 dark:text-zinc-100">WhatsApp bloqueado</h2>
              <p className="text-xs text-zinc-400">Ingresa tu PIN de seguridad para acceder al panel de chat.</p>
            </div>
            <Input
              type="password"
              placeholder="PIN de seguridad"
              className="text-center font-bold text-lg h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
              value={unlockInput}
              onChange={(e) => setUnlockInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleUnlockApp();
                }
              }}
            />
            <Button
              onClick={handleUnlockApp}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md border-none"
            >
              Desbloquear
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!connectionStatus.connected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
                <div className="size-20 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <IconBrandWhatsapp size={48} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-zinc-850 dark:text-zinc-100 tracking-tight">WhatsApp no conectado</h2>
                  <p className="text-xs text-zinc-550 dark:text-zinc-400 max-w-sm leading-relaxed font-medium">
                    Vincula tu número de WhatsApp para poder interactuar con tus clientes, gestionar sus deudas y enviar comprobantes directamente desde aquí.
                  </p>
                </div>
                <Button
                  onClick={handleOpenQrModal}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg border-none flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <IconBrandWhatsapp size={16} />
                  Conectar WhatsApp
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ─── BARRA LATERAL IZQUIERDA: CHATS (estilo WhatsApp Web) ───────── */}
              <nav className="hidden w-16 shrink-0 flex-col items-center justify-between border-r border-[#E9EDEF] bg-[#F7F5F3] py-3 dark:border-zinc-900 dark:bg-zinc-950 md:flex">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    title="Chats"
                    onClick={() => { setNewChatOpen(false); setSpecialView("none"); setActiveTab("all"); }}
                    className={cn("relative flex size-10 items-center justify-center rounded-full transition-colors", !newChatOpen && specialView === "none" ? "bg-black/[.06] text-[#111B21] dark:bg-white/10 dark:text-white" : "text-[#54656F] hover:bg-black/5")}
                  >
                    <IconMessageCircle size={22} />
                    {chats.filter(c => c.isUnread && !c.isArchived).length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-semibold text-white ring-2 ring-[#F7F5F3] dark:ring-zinc-950">
                        {chats.filter(c => c.isUnread && !c.isArchived).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    title="Contactos"
                    onClick={() => setNewChatOpen(true)}
                    className={cn("flex size-10 items-center justify-center rounded-full transition-colors", newChatOpen ? "bg-black/[.06] text-[#111B21] dark:bg-white/10 dark:text-white" : "text-[#54656F] hover:bg-black/5")}
                  >
                    <IconAddressBook size={22} />
                  </button>
                  <button
                    type="button"
                    title="Archivados"
                    onClick={() => { setNewChatOpen(false); setSpecialView("archived"); }}
                    className={cn("flex size-10 items-center justify-center rounded-full transition-colors", !newChatOpen && specialView === "archived" ? "bg-black/[.06] text-[#111B21] dark:bg-white/10 dark:text-white" : "text-[#54656F] hover:bg-black/5")}
                  >
                    <IconArchive size={22} />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <button type="button" title="Bloqueo de aplicación" onClick={() => setAppLockOpen(true)} className="flex size-10 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5">
                    <IconLock size={21} />
                  </button>
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#16140F] text-white" title="WhatsApp del negocio conectado">
                    <IconBrandWhatsapp size={19} />
                  </span>
                </div>
              </nav>

              <aside className={`w-full md:w-[360px] xl:w-[400px] relative shrink-0 border-r border-[#E9EDEF] dark:border-zinc-900 flex flex-col bg-white dark:bg-zinc-950 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
        {newChatOpen && (
          <NewChatPanel
            className="absolute inset-0 z-20 animate-in slide-in-from-left-4 fade-in duration-150"
            country={settings?.country}
            onClose={() => setNewChatOpen(false)}
            onPick={({ phone, name, client }) => {
              handleSelectChat({ id: phone, name, phone, client });
              setNewChatOpen(false);
            }}
          />
        )}

        {/* Encabezado */}
        <div className="flex h-[64px] shrink-0 items-center justify-between pl-5 pr-3">
          {specialView === "none" ? (
            <h1 className="text-[22px] font-bold tracking-tight text-[#1DAA61]">WhatsApp</h1>
          ) : (
            <div className="flex items-center gap-4">
              <WaIconButton title="Volver" onClick={() => setSpecialView("none")} className="-ml-2 text-[#111B21]">
                <IconArrowLeft size={22} />
              </WaIconButton>
              <h1 className="text-[17px] text-[#111B21] dark:text-zinc-100">{specialView === "archived" ? "Archivados" : "Chats restringidos"}</h1>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!connectionStatus.connected && (
              <Button onClick={handleOpenQrModal} size="sm" className="mr-1 h-8 gap-1 rounded-full border-none bg-[#1DAA61] px-3 text-xs font-semibold text-white hover:bg-[#189a57]">
                <IconBrandWhatsapp size={14} /> Conectar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" title="Menú" className="flex size-10 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5 data-[state=open]:bg-black/5 dark:text-zinc-300">
                  <IconDotsVertical size={22} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-60 rounded-2xl border-none p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] bg-white dark:bg-zinc-900">
                <DropdownMenuItem onClick={() => setNewChatOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconMessagePlus size={20} className="text-[#54656F]" /> Nuevo chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNewListDialogOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconFolderPlus size={20} className="text-[#54656F]" /> Nueva lista
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMarkAllAsRead} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconMail size={20} className="text-[#54656F]" /> Marcar todos como leídos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAppLockOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                  <IconLock size={20} className="text-[#54656F]" /> Bloqueo de aplicación
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-[#E9EDEF] dark:bg-zinc-800" />
                <DropdownMenuItem onClick={handleLogoutInstance} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#EA0038] focus:text-[#EA0038]">
                  <IconLogout size={20} /> Desvincular WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              title="Nuevo chat"
              className="ml-1 flex size-10 items-center justify-center rounded-full bg-[#1DAA61] text-white shadow-sm transition-colors hover:bg-[#189a57]"
            >
              <IconMessagePlus size={20} />
            </button>
          </div>
        </div>

        {/* Buscador */}
        {connectionStatus.connected && (
          <div className="shrink-0 px-3 pb-2">
            <label className="flex h-10 items-center gap-3 rounded-full bg-[#F0F2F5] px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1DAA61] dark:bg-zinc-900">
              <IconSearch size={18} className="shrink-0 text-[#54656F]" />
              <input
                placeholder="Buscar un chat o iniciar uno nuevo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[#111B21] outline-none placeholder:text-[#667781] dark:text-zinc-100"
              />
            </label>
          </div>
        )}

        {/* Filtros */}
        {connectionStatus.connected && specialView === "none" && (
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-3 pb-2 pt-1 scrollbar-none">
            <WaChip active={activeTab === "all"} onClick={() => setActiveTab("all")}>Todos</WaChip>
            <WaChip active={activeTab === "unread"} onClick={() => setActiveTab("unread")}>
              No leídos
              {chats.filter(c => c.isUnread && !c.isArchived).length > 0 && (
                <span className="text-[12px] opacity-80">{chats.filter(c => c.isUnread && !c.isArchived).length}</span>
              )}
            </WaChip>
            <WaChip active={activeTab === "favorites"} onClick={() => setActiveTab("favorites")}>Favoritos</WaChip>
            {activeTab.startsWith("list:") && (
              <WaChip active onClick={() => setActiveTab("all")}>
                {activeTab.replace("list:", "")} <span className="text-[12px]">×</span>
              </WaChip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#D1D7DB] text-[#54656F] hover:bg-[#F5F6F6] data-[state=open]:bg-[#F5F6F6] dark:border-zinc-700">
                  <IconChevronDown size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="w-56 rounded-2xl border-none p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] bg-white dark:bg-zinc-900">
                {customLists.map(listName => (
                  <DropdownMenuItem
                    key={listName}
                    onClick={() => setActiveTab(`list:${listName}`)}
                    className="group/list flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200"
                  >
                    <span className="flex-1 truncate">{listName}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[12px] text-[#667781]">{chats.filter(c => c.lists?.includes(listName)).length}</span>
                      <button
                        onClick={(e) => handleDeleteList(listName, e)}
                        className="rounded p-0.5 text-[#8696A0] opacity-0 hover:text-[#EA0038] group-hover/list:opacity-100"
                        title="Eliminar lista"
                      >
                        <IconTrash size={14} />
                      </button>
                    </span>
                  </DropdownMenuItem>
                ))}
                {customLists.length > 0 && <DropdownMenuSeparator className="my-1 bg-[#E9EDEF] dark:bg-zinc-800" />}
                <DropdownMenuItem onClick={() => setNewListDialogOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#008069]">
                  <IconPlus size={18} /> Nueva lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto pb-2">
          {specialView === "none" && chats.some(c => c.isRestricted) && (
            <button type="button" onClick={handleOpenRestrictedChats} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60">
              <span className="flex w-[49px] justify-center text-[#54656F]"><IconLock size={20} /></span>
              <span className="flex-1 text-[16px] text-[#111B21] dark:text-zinc-100">Chats restringidos</span>
              <span className="text-[12px] text-[#667781]">{chats.filter(c => c.isRestricted).length}</span>
            </button>
          )}
          {specialView === "none" && chats.some(c => c.isArchived) && (
            <button type="button" onClick={() => setSpecialView("archived")} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60">
              <span className="flex w-[49px] justify-center text-[#54656F]"><IconArchive size={20} /></span>
              <span className="flex-1 text-[16px] text-[#111B21] dark:text-zinc-100">Archivados</span>
              <span className="text-[12px] font-medium text-[#1DAA61]">{chats.filter(c => c.isArchived).length}</span>
            </button>
          )}

          {loadingChats ? (
            <div className="flex justify-center py-12 text-[#8696A0]"><IconLoader2 size={22} className="animate-spin" /></div>
          ) : filteredChats.length === 0 ? (
            <div className="px-8 py-12 text-center text-[14px] text-[#667781]">
              {searchTerm ? "No se encontraron chats." : specialView === "archived" ? "No hay chats archivados." : "Aún no hay conversaciones. Toca el botón verde para escribirle a un cliente."}
            </div>
          ) : (
            // Pinned first, then by last message
            [...filteredChats]
              .sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                const timeA = new Date(a.lastMessageTime || a.updatedAt).getTime();
                const timeB = new Date(b.lastMessageTime || b.updatedAt).getTime();
                return timeB - timeA;
              })
              .map((c) => {
                const isActive = activeChat?.id === c.id;
                const hasDebt = c.client && c.client.currentDebt > 0;
                const avatarSrc = c.avatarUrl || avatars[c.id];
                const last = c.messages?.[0];
                const menuItem = "gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200";
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectChat(c)}
                    className={cn(
                      "group relative mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 transition-colors",
                      isActive ? "bg-[#F0F2F5] dark:bg-zinc-800" : "hover:bg-[#F5F6F6] dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <WaAvatar src={avatarSrc} seed={c.id} />
                    <div className="flex min-w-0 flex-1 flex-col justify-center py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[16px] text-[#111B21] dark:text-zinc-100">{getChatDisplayName(c)}</p>
                        <span className={cn("shrink-0 text-[12px]", c.isUnread ? "font-medium text-[#1DAA61]" : "text-[#667781]")}>
                          {formatChatTime(c.lastMessageTime)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 text-[14px] text-[#667781]">
                          {["composing", "recording"].includes(presenceOf(c)?.presence ?? "")
                            ? <span className="text-[#1DAA61]">{presenceOf(c)?.presence === "recording" ? "Grabando audio…" : "Escribiendo…"}</span>
                            : <WaPreview message={last} fallback={c.lastMessage} />}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[#8696A0]">
                          {hasDebt && <span className="rounded-full bg-[#FFE5E9] px-1.5 text-[11px] font-medium text-[#C12A4B]">Fiado</span>}
                          {c.isMuted && <IconBellOff size={17} />}
                          {c.isUnread && <span className="size-[18px] rounded-full bg-[#25D366]" title="No leído" />}
                          {c.isPinned && <IconPin size={17} />}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="-mr-1 w-0 overflow-hidden text-[#8696A0] opacity-0 transition-all group-hover:w-6 group-hover:opacity-100 data-[state=open]:w-6 data-[state=open]:opacity-100"
                                title="Opciones del chat"
                              >
                                <IconChevronDown size={20} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              onClick={(e) => e.stopPropagation()}
                              align="start"
                              sideOffset={6}
                              className="w-64 rounded-2xl border-none p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] bg-white dark:bg-zinc-900"
                            >
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isArchived', c.isArchived)} className={menuItem}>
                                <IconArchive size={20} className="text-[#54656F]" /> {c.isArchived ? "Desarchivar chat" : "Archivar chat"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isMuted', c.isMuted)} className={menuItem}>
                                <IconBellOff size={20} className="text-[#54656F]" /> {c.isMuted ? "Activar notificaciones" : "Silenciar notificaciones"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isPinned', c.isPinned)} className={menuItem}>
                                {c.isPinned ? <IconPinnedOff size={20} className="text-[#54656F]" /> : <IconPin size={20} className="text-[#54656F]" />} {c.isPinned ? "Desfijar chat" : "Fijar chat"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isUnread', c.isUnread)} className={menuItem}>
                                <IconMessageDots size={20} className="text-[#54656F]" /> {c.isUnread ? "Marcar como leído" : "Marcar como no leído"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isFavorite', c.isFavorite)} className={menuItem}>
                                <IconHeart size={20} className="text-[#54656F]" /> {c.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className={menuItem}>
                                  <IconAddressBook size={20} className="text-[#54656F]" /> Añadir a la lista
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-52 rounded-2xl border-none p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] bg-white dark:bg-zinc-900">
                                  {customLists.map(listName => (
                                    <DropdownMenuItem key={listName} onClick={() => toggleChatList(c.id, listName)} className={cn(menuItem, "justify-between")}>
                                      <span className="truncate">{listName}</span>
                                      {c.lists?.includes(listName) && <IconCheck size={16} className="text-[#1DAA61]" />}
                                    </DropdownMenuItem>
                                  ))}
                                  {customLists.length > 0 && <DropdownMenuSeparator className="my-1 bg-[#E9EDEF] dark:bg-zinc-800" />}
                                  <DropdownMenuItem onClick={() => setNewListDialogOpen(true)} className={cn(menuItem, "text-[#008069]")}>
                                    <IconPlus size={18} /> Nueva lista
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isRestricted', c.isRestricted)} className={menuItem}>
                                <IconLock size={20} className="text-[#54656F]" /> {c.isRestricted ? "Quitar restricción" : "Restringir chat"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 bg-[#E9EDEF] dark:bg-zinc-800" />
                              <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isBlocked', c.isBlocked)} className={menuItem}>
                                <IconBan size={20} className="text-[#54656F]" /> {c.isBlocked ? "Desbloquear" : "Bloquear"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleClearChat(c.id)} className={menuItem}>
                                <IconCircleMinus size={20} className="text-[#54656F]" /> Vaciar chat
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteChat(c.id)} className={cn(menuItem, "text-[#EA0038] focus:text-[#EA0038]")}>
                                <IconTrash size={20} /> Eliminar chat
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </aside>

      {/* ─── AREA CENTRAL: CONVERSACIÓN (estilo WhatsApp Web) ───────────── */}
      <main className={`flex-1 min-w-0 flex flex-col bg-[#EFEAE2] dark:bg-zinc-950 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            {/* Encabezado del chat */}
            <div className="flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-[#E9EDEF] bg-white px-4 dark:border-zinc-900 dark:bg-zinc-950">
              <div className="flex min-w-0 items-center gap-3">
                <WaIconButton title="Volver" onClick={() => setMobileView("list")} className="-ml-2 md:hidden">
                  <IconArrowLeft size={22} />
                </WaIconButton>
                <button type="button" onClick={() => setContactInfoOpen(true)} className="flex min-w-0 items-center gap-3 text-left" title="Info del contacto">
                  <WaAvatar src={activeChat.avatarUrl || avatars[activeChat.id]} seed={activeChat.id} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] text-[#111B21] dark:text-zinc-100">{getChatDisplayName(activeChat)}</span>
                    {(() => {
                      const p = presenceOf(activeChat);
                      if (p?.presence === "composing") return <span className="block truncate text-[13px] text-[#1DAA61]">Escribiendo…</span>;
                      if (p?.presence === "recording") return <span className="block truncate text-[13px] text-[#1DAA61]">Grabando audio…</span>;
                      if (p?.presence === "available") return <span className="block truncate text-[13px] text-[#667781]">En línea</span>;
                      if (p?.lastSeen) return <span className="block truncate text-[13px] text-[#667781]">{lastSeenLabel(p.lastSeen)}</span>;
                      return <span className="block truncate text-[13px] text-[#667781]">{contactInfoOpen ? (activeChat.phone ? formatWhatsAppNumber(`+${String(activeChat.phone).replace(/\D/g, "")}`) : "") : "Haz clic aquí para ver la info del contacto"}</span>;
                    })()}
                  </span>
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {chatSearchOpen && (
                  <input
                    autoFocus
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && (setChatSearchOpen(false), setChatSearch(""))}
                    placeholder="Buscar en el chat"
                    className="h-9 w-56 rounded-full bg-[#F0F2F5] px-4 text-[14px] outline-none placeholder:text-[#667781] dark:bg-zinc-900"
                  />
                )}
                <WaIconButton title="Buscar en el chat" onClick={() => { setChatSearchOpen((v) => !v); setChatSearch(""); }}>
                  <IconSearch size={22} />
                </WaIconButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" title="Menú" className="flex size-10 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5 data-[state=open]:bg-black/5 dark:text-zinc-300">
                      <IconDotsVertical size={22} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={6} className="w-60 rounded-2xl border-none bg-white p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-900">
                    <DropdownMenuItem onClick={() => setContactInfoOpen(true)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconInfoCircle size={20} className="text-[#54656F]" /> Info del contacto
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleChatProperty(activeChat.id, "isMuted", activeChat.isMuted)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconBellOff size={20} className="text-[#54656F]" /> {activeChat.isMuted ? "Activar notificaciones" : "Silenciar notificaciones"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleChatProperty(activeChat.id, "isFavorite", activeChat.isFavorite)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconHeart size={20} className="text-[#54656F]" /> {activeChat.isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleChatProperty(activeChat.id, "isArchived", activeChat.isArchived)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconArchive size={20} className="text-[#54656F]" /> {activeChat.isArchived ? "Desarchivar chat" : "Archivar chat"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setActiveChat(null)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconX size={20} className="text-[#54656F]" /> Cerrar chat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 bg-[#E9EDEF] dark:bg-zinc-800" />
                    <DropdownMenuItem onClick={() => handleClearChat(activeChat.id)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#3B4A54] dark:text-zinc-200">
                      <IconCircleMinus size={20} className="text-[#54656F]" /> Vaciar chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDeleteChat(activeChat.id)} className="gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-[#EA0038] focus:text-[#EA0038]">
                      <IconTrash size={20} /> Eliminar chat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto pb-3 dark:bg-zinc-950" style={WA_WALLPAPER}>
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-[#667781]"><IconLoader2 size={24} className="animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6">
                  <span className="rounded-lg bg-[#FFEECD] px-4 py-2 text-center text-[12.5px] text-[#54656F] shadow-[0_1px_.5px_rgba(11,20,26,.13)]">
                    Escribe un mensaje para iniciar la conversación.
                  </span>
                </div>
              ) : (
                (() => {
                  const term = chatSearch.trim().toLowerCase();
                  const visible = term ? messages.filter((m) => (m.text || "").toLowerCase().includes(term)) : messages;
                  if (term && visible.length === 0) {
                    return <div className="flex justify-center pt-10"><span className="rounded-lg bg-white px-4 py-2 text-[13px] text-[#667781] shadow-sm">No hay mensajes con “{chatSearch}”</span></div>;
                  }
                  const contactName = getChatDisplayName(activeChat);
                  return visible.map((m, i) => {
                    const own = m.senderType !== "CLIENT";
                    const prev = visible[i - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    const first = newDay || !prev || (prev.senderType !== "CLIENT") !== own;
                    const isAudio = m.type === "audio" || m.type === "AUDIO";
                    return (
                      <React.Fragment key={m.id}>
                        {newDay && <DayDivider label={dayLabel(m.createdAt)} />}
                        <MessageBubble
                          msg={m}
                          own={own}
                          first={first}
                          contactName={contactName}
                          hideMeta={isAudio}
                          onReply={() => { setReplyTo(m); inputRef.current?.focus(); }}
                          onReact={(emoji) => handleReactToMessage(m, emoji)}
                        >
                          {m.type === "text" ? (
                            <span className="whitespace-pre-wrap break-words">{m.text}</span>
                          ) : (
                            <MediaMessageRenderer
                              msg={m}
                              messageMedia={messageMedia}
                              fetchMessageMedia={fetchMessageMedia}
                              senderAvatar={!own ? (activeChat.avatarUrl || avatars[activeChat.id]) : undefined}
                              senderFallback={!own && activeChat.name ? activeChat.name.substring(0, 2).toUpperCase() : undefined}
                            />
                          )}
                        </MessageBubble>
                      </React.Fragment>
                    );
                  });
                })()
              )}
              <div ref={scrollRef} />
            </div>

            {/* Barra para escribir */}
            <div className="relative shrink-0 px-3 pb-3 pt-1" style={WA_WALLPAPER}>
              {/* Emojis */}
              {showEmojiPicker && (
                <div className="absolute bottom-[72px] left-4 z-50 w-[320px] rounded-2xl bg-white p-3 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-900">
                  <div className="grid max-h-[220px] grid-cols-8 gap-1 overflow-y-auto">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => { setInputText(prev => prev + emoji); inputRef.current?.focus(); }}
                        className="flex size-9 items-center justify-center rounded-lg text-[22px] hover:bg-[#F0F2F5]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjuntar */}
              {showAttachMenu && (
                <div className="absolute bottom-[72px] left-4 z-50 w-52 rounded-2xl bg-white p-2 shadow-[0_4px_24px_rgba(11,20,26,.18)] dark:bg-zinc-900">
                  <button type="button" onClick={() => docInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] text-[#3B4A54] hover:bg-[#F5F6F6] dark:text-zinc-200">
                    <IconFileText size={20} className="text-[#7F66FF]" /> Documento
                  </button>
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] text-[#3B4A54] hover:bg-[#F5F6F6] dark:text-zinc-200">
                    <IconPhoto size={20} className="text-[#007BFC]" /> Fotos y videos
                  </button>
                </div>
              )}

              <input type="file" ref={imageInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => handleFileSelect(e, "image")} />
              <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={(e) => handleFileSelect(e, "document")} />

              <div className="rounded-[26px] bg-white shadow-[0_1px_2px_rgba(11,20,26,.12)] dark:bg-zinc-900">
                {replyTo && <ReplyPreview msg={replyTo} contactName={getChatDisplayName(activeChat)} onCancel={() => setReplyTo(null)} />}
                {isRecording ? (
                  <div className="flex h-[52px] items-center gap-3 px-3">
                    <button type="button" onClick={() => stopRecording(true)} title="Descartar" className="flex size-10 items-center justify-center rounded-full text-[#54656F] hover:bg-black/5">
                      <IconTrash size={22} />
                    </button>
                    <span className="size-2.5 rounded-full bg-[#EA0038]" />
                    <span className="flex-1 text-[15px] tabular-nums text-[#3B4A54] dark:text-zinc-200">
                      {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:{(recordingDuration % 60).toString().padStart(2, "0")}
                    </span>
                    <button type="button" onClick={() => stopRecording(false)} title="Enviar audio" className="flex size-10 items-center justify-center rounded-full bg-[#1DAA61] text-white hover:bg-[#189a57]">
                      <IconSend size={19} />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-[52px] items-center gap-1 px-2">
                    <WaIconButton title="Adjuntar" onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }} className={cn(showAttachMenu && "bg-black/5")}>
                      <IconPaperclip size={23} className="-rotate-45" />
                    </WaIconButton>
                    <WaIconButton title="Emojis" onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }} className={cn(showEmojiPicker && "bg-black/5")}>
                      <IconMoodSmile size={23} />
                    </WaIconButton>
                    <input
                      ref={inputRef}
                      placeholder="Escribe un mensaje"
                      value={inputText}
                      onChange={(e) => { setInputText(e.target.value); notifyTyping(e.target.value); }}
                      onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                        if (e.key === "Escape") setReplyTo(null);
                      }}
                      className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[15px] text-[#111B21] outline-none placeholder:text-[#667781] dark:text-zinc-100"
                    />
                    {inputText.trim() ? (
                      <button type="button" onClick={handleSendMessage} disabled={sendingMessage} title="Enviar" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1DAA61] text-white transition-colors hover:bg-[#189a57] disabled:opacity-60">
                        <IconSend size={19} />
                      </button>
                    ) : (
                      <WaIconButton title="Grabar audio" onClick={startRecording}>
                        <IconMicrophone size={23} />
                      </WaIconButton>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#F7F5F3] px-8 text-center dark:bg-zinc-950">
            <span className="flex size-20 items-center justify-center rounded-full bg-[#D9FDD3] text-[#1DAA61]"><IconBrandWhatsapp size={40} /></span>
            <p className="text-[22px] font-light text-[#41525D] dark:text-zinc-200">WhatsApp de tu negocio</p>
            <p className="max-w-md text-[14px] text-[#667781]">Elige un chat para leer y responder. Las facturas que envías desde el punto de venta también aparecen aquí.</p>
          </div>
        )}
      </main>

      {/* ─── INFO DEL CONTACTO (drawer) ─────────────────────────────────── */}
      {activeChat && contactInfoOpen && (
        <ContactInfoDrawer
          className="absolute inset-y-0 right-0 z-30 w-full max-w-[420px] shadow-[-8px_0_24px_rgba(11,20,26,.12)] animate-in slide-in-from-right-8 fade-in duration-200 xl:static xl:w-[400px] xl:shrink-0 xl:shadow-none"
          chat={activeChat}
          displayName={getChatDisplayName(activeChat)}
          avatarSrc={activeChat.avatarUrl || avatars[activeChat.id]}
          messages={messages}
          messageMedia={messageMedia}
          customLists={customLists}
          sending={sendingMessage}
          onClose={() => setContactInfoOpen(false)}
          onSearch={() => { setChatSearchOpen(true); setChatSearch(""); }}
          onToggle={(property, current) => toggleChatProperty(activeChat.id, property, current)}
          onToggleList={(listName) => toggleChatList(activeChat.id, listName)}
          onClear={() => handleClearChat(activeChat.id)}
          onDelete={() => { setContactInfoOpen(false); handleDeleteChat(activeChat.id); }}
          onSendReminder={handleSendReminder}
          onOpenPayment={handleOpenPayment}
        />
      )}
            </>
          )}

      {/* ─── DIALOG DE ESCANEO DE QR ───────────────────────────────────── */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconBrandWhatsapp size={20} className="text-emerald-500" /> Vincular WhatsApp Web
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Escanea el código QR desde la aplicación de WhatsApp de tu teléfono (dispositivos vinculados).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6 min-h-[220px]">
            {loadingQr ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="size-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-[10px] text-zinc-400 font-semibold animate-pulse">Generando instancia...</p>
              </div>
            ) : qrCode ? (
              <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-inner">
                {/* QR Code Container */}
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR code" className="w-[180px] h-[180px]" />
              </div>
            ) : (
              <div className="text-xs text-rose-500 flex items-center gap-1">
                <IconAlertCircle size={16} /> No se pudo generar el QR. Por favor reintenta.
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setQrModalOpen(false)}
            className="w-full h-11 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl"
          >
            Cerrar
          </Button>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE NUEVO CHAT ───────────────────────────────────────── */}
      {/* ─── DIALOG DE ABONO ─────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-205">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-500">
              <IconCash size={20} /> Recibir abono
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Registra un pago para <strong>{activeChat?.client?.name}</strong> — Deuda actual: <strong className="text-rose-500">${activeChat?.client?.currentDebt?.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-zinc-400">Moneda de pago</Label>
              <select
                value={paymentCurrency}
                onChange={(e: any) => { setPaymentCurrency(e.target.value); setPaidAmountRaw(""); setCustomRate(""); }}
                className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold px-3 outline-none"
              >
                <option value="USD">Dólares (USD)</option>
                <option value="VES">Bolívares (VES)</option>
                <option value="COP">Pesos colombianos (COP)</option>
              </select>
            </div>
            {paymentCurrency !== "USD" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-zinc-400">Tasa de cambio</Label>
                <Input
                  type="number"
                  className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs"
                  placeholder={paymentCurrency === "VES" ? `BCV: ${settings?.exchangeRate || 40}` : `COP: ${Number(settings?.copRateManual) || Number(settings?.exchangeRateCop) || 4000}`}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-zinc-400">Monto recibido ({paymentCurrency})</Label>
              <Input
                type="number"
                className="rounded-xl h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-base font-bold text-center"
                value={paidAmountRaw}
                onChange={(e) => setPaidAmountRaw(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {paymentCurrency !== "USD" && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex justify-between items-center text-xs">
                <span className="text-[10px] font-black text-emerald-500 flex items-center gap-1">
                  <IconInfoCircle size={12} /> Equivalente USD
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">${paymentAmount || "0.00"}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-zinc-400">Concepto / notas</Label>
              <Input
                placeholder="Ej. Pago móvil, efectivo..."
                className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl h-11 border-zinc-200 dark:border-zinc-850 bg-transparent">Cancelar</Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={isSubmittingPayment}
              className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-none"
            >
              {isSubmittingPayment ? "Procesando..." : "Confirmar abono"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE NUEVA LISTA ──────────────────────────────────────── */}
      <Dialog open={newListDialogOpen} onOpenChange={setNewListDialogOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconFolderPlus size={18} className="text-emerald-500" /> Crear nueva lista
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Ingresa el nombre de la lista para agrupar tus conversaciones de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-bold text-zinc-500">Nombre de la lista</Label>
            <Input
              placeholder="Ej. Clientes vip, prospectos..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateList();
                }
              }}
              className="h-10 rounded-xl text-xs"
            />
          </div>

          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={() => { setNewListDialogOpen(false); setNewListName(""); }}
              className="flex-1 h-10 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateList}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold border-none"
            >
              Crear lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE CONFIGURACIÓN DE BLOQUEO (PIN) ────────────────────── */}
      <Dialog open={appLockOpen} onOpenChange={setAppLockOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconLock size={18} className="text-emerald-500" /> Configurar bloqueo de app
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Establece un PIN numérico para proteger tus conversaciones. Déjalo vacío para desactivar el bloqueo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-bold text-zinc-500">PIN de seguridad (4+ dígitos)</Label>
            <Input
              type="password"
              placeholder="Ingresa PIN o deja vacío para desactivar"
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              className="h-10 rounded-xl text-xs text-center font-bold bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveAppLock();
                }
              }}
            />
          </div>

          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={() => { setAppLockOpen(false); setLockPassword(""); }}
              className="flex-1 h-10 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAppLock}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold border-none"
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG PARA DESBLOQUEAR CHATS RESTRINGIDOS ────────────────── */}
      <Dialog open={restrictedUnlockOpen} onOpenChange={setRestrictedUnlockOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200 text-center">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center justify-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconLock size={18} className="text-emerald-500" /> Confirmar PIN
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Ingresa el PIN de seguridad para acceder a los chats restringidos.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Input
              type="password"
              placeholder="PIN de seguridad"
              value={restrictedUnlockInput}
              onChange={(e) => setRestrictedUnlockInput(e.target.value)}
              className="h-10 rounded-xl text-xs text-center font-bold bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerifyRestrictedLock();
                }
              }}
            />
          </div>

          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={() => { setRestrictedUnlockOpen(false); setRestrictedUnlockInput(""); }}
              className="flex-1 h-10 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleVerifyRestrictedLock}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold border-none"
            >
              Acceder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE CONFIRMACIÓN CUSTOM ──────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconAlertCircle size={18} className="text-amber-500 shrink-0" /> {confirmTitle || "Confirmación"}
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              {confirmDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2.5 pt-3">
            <Button
              variant="outline"
              onClick={() => { setConfirmOpen(false); setOnConfirmAction(null); }}
              className="flex-1 h-10 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl animate-in duration-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (onConfirmAction) onConfirmAction();
                setConfirmOpen(false);
                setOnConfirmAction(null);
              }}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold border-none animate-in duration-100"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>)}
    </div>
  );
}
