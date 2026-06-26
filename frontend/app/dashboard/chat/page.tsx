"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import { io, Socket } from "socket.io-client";
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
  IconChevronDown, IconPin, IconArchive, IconEyeOff, IconStar, IconVolumeOff, IconMail, IconFolderPlus, IconBan, IconLock, IconEye, IconFolder, IconDotsVertical, IconMessagePlus
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
  if (!src.startsWith("data:")) {
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
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
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

  // New Chat Modal States
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customName, setCustomName] = useState("");

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
  const loadMessages = async (chatId: string) => {
    setLoadingMessages(true);
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
      if (res.ok) {
        const data = await res.json();
        if (data.base64) {
          setMessageMedia(prev => ({ ...prev, [msgId]: data.base64 }));
        }
      }
    } catch (e) {
      console.error("Error loading message media", e);
    }
  }, []);

  // 7. Handle file selection & base64 conversion & upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, fallbackType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 10MB");
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

  // Initialize Socket.io
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    const storedUser = JSON.parse(userStr || "{}");
    if (!storedUser.id) return;

    socketRef.current = io(API, {
      transports: ["websocket", "polling"],
      query: { userId: storedUser.id },
      reconnection: true,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;
    if (!socket) return;

    socket.on("connect", () => {
      console.log("Connected to WebSockets");
      // Join this business's private room for isolated real-time events
      if (storedUser.businessId) {
        socket.emit("joinBusiness", { businessId: storedUser.businessId });
      }
    });

    socket.on("whatsapp_newMessage", (msg: any) => {
      // If message belongs to active chat, append it
      if (activeChat && msg.chatId === activeChat.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      }
    });

    socket.on("whatsapp_chatUpdated", (updatedChat: any) => {
      setChats((prev) => {
        const filtered = prev.filter(c => c.id !== updatedChat.id);
        return [updatedChat, ...filtered];
      });
      setActiveChat((prev: any) => {
        if (prev && prev.id === updatedChat.id) {
          return updatedChat;
        }
        return prev;
      });
    });

    socket.on("whatsapp_chatDeleted", (data: any) => {
      setChats((prev) => prev.filter(c => c.id !== data.id));
      setActiveChat((prev: any) => {
        if (prev && prev.id === data.id) {
          return null;
        }
        return prev;
      });
    });

    socket.on("whatsapp_messageStatusUpdated", (data: any) => {
      if (activeChat && data.chatId === activeChat.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, status: data.status } : m))
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [activeChat]);

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
      const rate = parseFloat(customRate) || (paymentCurrency === "VES" ? (settings?.exchangeRate || 40) : 4000);
      setPaymentAmount(rate > 0 && paidAmountRaw ? (parseFloat(paidAmountRaw) / rate).toFixed(2) : "");
    }
  }, [paymentCurrency, paidAmountRaw, customRate, paymentOpen, settings]);

  // Poll status when QR Modal is Open
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (qrModalOpen) {
      interval = setInterval(async () => {
        const status = await checkConnectionStatus();
        if (status.connected) {
          toast.success("¡WhatsApp se ha conectado exitosamente!");
          setQrModalOpen(false);
          loadChats();
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

  // Open New Chat Modal & Load Clients
  const handleOpenNewChatModal = async () => {
    setNewChatOpen(true);
    setLoadingClients(true);
    setNewChatSearch("");
    setCustomPhone("");
    setCustomName("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setClientsList(await res.json());
      }
    } catch {
      toast.error("Error al cargar lista de clientes");
    } finally {
      setLoadingClients(false);
    }
  };

  // Select a Client to start a chat
  const handleSelectClientForChat = (client: any) => {
    if (!client.phone) {
      toast.error("Este cliente no tiene un teléfono registrado");
      return;
    }
    // Clean phone number (leave digits only)
    const cleanPhone = client.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Número de teléfono inválido");
      return;
    }

    // Set as active chat (using phone as the temp ID)
    handleSelectChat({
      id: cleanPhone,
      name: client.name,
      phone: cleanPhone,
      client: client
    });
    setNewChatOpen(false);
  };

  // Start chat with a custom number
  const handleStartCustomChat = () => {
    if (!customPhone.trim()) {
      toast.error("Ingresa un número de teléfono");
      return;
    }
    const cleanPhone = customPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Ingresa un número de teléfono válido (con código de país)");
      return;
    }

    handleSelectChat({
      id: cleanPhone,
      name: customName.trim() || `Contacto ${cleanPhone}`,
      phone: cleanPhone,
      client: null
    });
    setNewChatOpen(false);
  };

  // Select a conversation
  const handleSelectChat = (chat: any) => {
    setActiveChat(chat);
    setMobileView("chat");
    loadMessages(chat.id);
  };

  // Send a WhatsApp Message
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChat) return;
    setSendingMessage(true);
    const textToSend = inputText;
    setInputText("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/whatsapp/chats/${activeChat.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSend })
      });
      if (!res.ok) {
        toast.error("Error al despachar mensaje");
        setInputText(textToSend); // Restore text
      } else {
        loadChats(); // Refresh chat list updatedAt/lastMessage
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
        ? (parseFloat(customRate) || (paymentCurrency === "VES" ? settings?.exchangeRate : 4000))
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
    <div className="flex bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-2xl overflow-hidden h-[calc(100vh-var(--header-height,100px))] font-sans shadow-md">
      {showLockScreen ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconLock size={32} />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-850 dark:text-zinc-100">WhatsApp Bloqueado</h2>
              <p className="text-xs text-zinc-400">Ingresa tu PIN de seguridad para acceder al panel de chat.</p>
            </div>
            <Input
              type="password"
              placeholder="PIN de seguridad"
              className="text-center font-bold tracking-widest text-lg h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
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
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 animate-in fade-in duration-200">
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
              {/* ─── BARRA LATERAL IZQUIERDA: CHATS ──────────────────────────────── */}
              <aside className={`w-full md:w-[320px] xl:w-[350px] shrink-0 border-r border-zinc-200 dark:border-zinc-900 flex flex-col bg-white dark:bg-zinc-950/40 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
        {/* Header de Conexión estilo WhatsApp Web */}
        <div className="p-4 pb-3 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">WhatsApp</h1>
            <span
              className={`size-2.5 rounded-full shrink-0 ${connectionStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
              title={connectionStatus.connected ? "Conectado" : "Desconectado"}
            />
          </div>
          <div className="flex items-center gap-2">
            {!connectionStatus.connected && (
              <Button
                onClick={handleOpenQrModal}
                size="sm"
                className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-2 flex items-center gap-1 border-none shadow-sm shrink-0"
              >
                <IconBrandWhatsapp size={12} /> Conectar
              </Button>
            )}
            <button
              onClick={() => setNewChatOpen(true)}
              title="Nuevo chat"
              className="h-8 w-8 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-350 flex items-center justify-center transition-all shrink-0"
            >
              <IconMessagePlus size={18} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Menú"
                  className="h-8 w-8 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-350 flex items-center justify-center transition-all shrink-0"
                >
                  <IconDotsVertical size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={10}
                className="w-52 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
              >
                <DropdownMenuItem onClick={() => setNewChatOpen(true)} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconMessage size={14} className="text-zinc-500 dark:text-zinc-400" /> Nuevo chat
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleActionToast("Nuevo grupo")} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconFolderPlus size={14} className="text-zinc-500 dark:text-zinc-400" /> Nuevo grupo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleActionToast("Mensajes destacados")} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconStar size={14} className="text-zinc-500 dark:text-zinc-400" /> Mensajes destacados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleActionToast("Seleccionar chats")} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconCheck size={14} className="text-zinc-500 dark:text-zinc-400" /> Seleccionar chats
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMarkAllAsRead} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconMail size={14} className="text-zinc-500 dark:text-zinc-400" /> Marcar todos como leídos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAppLockOpen(true)} className="text-xs gap-2.5 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <IconLock size={14} className="text-zinc-500 dark:text-zinc-400" /> Bloqueo de aplicación
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                <DropdownMenuItem onClick={handleLogoutInstance} className="text-xs gap-2.5 cursor-pointer text-rose-650 focus:text-rose-500 focus:bg-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                  <IconBan size={14} className="text-rose-500" /> Desvincular WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Buscador */}
        {connectionStatus.connected && (
          <div className="p-3 pb-2 relative">
            <IconSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
            <Input
              placeholder="Buscar conversación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 rounded-xl border-zinc-200 dark:border-zinc-900 text-xs bg-zinc-50 dark:bg-zinc-950/40 text-foreground"
            />
          </div>
        )}

        {/* Filtros de Categorías / Listas */}
        {connectionStatus.connected && (
          <div className="px-3 pb-3 border-b border-zinc-150 dark:border-zinc-900 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => { setActiveTab("all"); setSpecialView("none"); }}
              className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                activeTab === "all" && specialView === "none"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => { setActiveTab("unread"); setSpecialView("none"); }}
              className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all shrink-0 flex items-center gap-1 ${
                activeTab === "unread" && specialView === "none"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              No leídos
              {chats.filter(c => c.isUnread).length > 0 && (
                <span className="text-[9px] bg-emerald-500 text-white rounded-full px-1.5 shrink-0">
                  {chats.filter(c => c.isUnread).length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab("favorites"); setSpecialView("none"); }}
              className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                activeTab === "favorites" && specialView === "none"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Favoritos
            </button>
            {activeTab.startsWith("list:") && (
              <button
                className="h-7 px-3 rounded-full text-[11px] font-bold transition-all shrink-0 bg-emerald-600 text-white shadow-sm flex items-center gap-1"
                onClick={() => setActiveTab("all")}
              >
                <span>{activeTab.replace("list:", "")}</span>
                <span className="text-[9px] opacity-75 font-black">×</span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center justify-center transition-all shrink-0">
                  <IconChevronDown size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={10}
                className="w-48 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
              >
                {customLists.map(listName => (
                  <DropdownMenuItem
                    key={listName}
                    onClick={() => { setActiveTab(`list:${listName}`); setSpecialView("none"); }}
                    className="text-xs cursor-pointer flex justify-between items-center text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 group/list"
                  >
                    <span className="truncate flex-1 pr-2">{listName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                        {chats.filter(c => c.lists?.includes(listName)).length}
                      </span>
                      <button
                        onClick={(e) => handleDeleteList(listName, e)}
                        className="text-zinc-400 hover:text-rose-500 transition-colors p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-0 group-hover/list:opacity-100 focus:opacity-100 shrink-0"
                        title="Eliminar lista"
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => setNewListDialogOpen(true)}
                  className="text-xs cursor-pointer text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <IconPlus size={14} className="text-emerald-600 dark:text-emerald-400" /> Nueva lista
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Lista de Conversaciones */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900/60 p-2 space-y-1">
          {/* Header de Vista Especial */}
          {specialView !== "none" && (
            <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-150 dark:border-zinc-900/80 mb-2 shrink-0">
              <button
                onClick={() => setSpecialView("none")}
                className="size-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <IconArrowLeft size={14} />
              </button>
              <span className="text-xs font-bold text-zinc-850 dark:text-zinc-100 uppercase tracking-wider">
                {specialView === "archived" ? "Chats Archivados" : "Chats Restringidos"}
              </span>
            </div>
          )}

          {/* Accesos rápidos a Archivados y Restringidos en Vista Principal */}
          {specialView === "none" && (
            <div className="space-y-1 pb-2 border-b border-zinc-150 dark:border-zinc-900/60 mb-2">
              {chats.some(c => c.isRestricted) && (
                <div
                  onClick={handleOpenRestrictedChats}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/30 text-zinc-650 dark:text-zinc-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-350 shrink-0">
                      <IconLock size={16} />
                    </div>
                    <span className="text-xs font-bold text-zinc-805 dark:text-zinc-200">Chats restringidos</span>
                  </div>
                  <span className="text-[10px] bg-zinc-150 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full px-2 py-0.5 font-bold">
                    {chats.filter(c => c.isRestricted).length}
                  </span>
                </div>
              )}
              {chats.some(c => c.isArchived) && (
                <div
                  onClick={() => setSpecialView("archived")}
                  className="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/30 text-zinc-650 dark:text-zinc-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-350 shrink-0">
                      <IconArchive size={16} />
                    </div>
                    <span className="text-xs font-bold text-zinc-805 dark:text-zinc-200">Archivados</span>
                  </div>
                  <span className="text-[10px] bg-zinc-150 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full px-2 py-0.5 font-bold">
                    {chats.filter(c => c.isArchived).length}
                  </span>
                </div>
              )}
            </div>
          )}

          {loadingChats ? (
            <div className="text-center py-12 text-zinc-400 text-xs tracking-wider uppercase animate-pulse font-semibold">Cargando chats...</div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">No hay conversaciones activas.</div>
          ) : (
            // Sort chats: pinned first, then by lastMessageTime/updatedAt desc
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
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectChat(c)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border group relative ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/25 dark:bg-emerald-500/5 text-emerald-800 dark:text-emerald-400"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-transparent text-zinc-650 dark:text-zinc-400"
                    }`}
                  >
                    {/* Left: Avatar */}
                    <div className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-800 shrink-0">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="Avatar" className="size-full object-cover" />
                      ) : (
                        <IconUser size={18} className="text-zinc-600 dark:text-zinc-300" />
                      )}
                    </div>

                    {/* Middle: Name and Last Message */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 self-stretch">
                      {/* Name Row */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {c.isPinned && <IconPin size={12} className="text-emerald-600 dark:text-emerald-400 rotate-45 shrink-0" />}
                        {c.isMuted && <IconVolumeOff size={12} className="text-zinc-400 shrink-0" />}
                        <p className={`text-xs font-bold truncate ${isActive ? "text-emerald-700 dark:text-emerald-350" : "text-zinc-800 dark:text-zinc-200"}`}>
                          {getChatDisplayName(c)}
                        </p>
                      </div>

                      {/* Last Message Row */}
                      <p className="text-[10px] text-zinc-400 truncate font-medium mt-1">
                        {c.lastMessage || "Sin mensajes"}
                      </p>
                    </div>

                    {/* Right: Time and Chevron / Actions */}
                    <div className="flex flex-col items-end justify-between py-0.5 self-stretch shrink-0 min-w-[65px] text-right">
                      {/* Time Row */}
                      <span className="text-[9px] text-zinc-400 font-medium font-mono shrink-0">
                        {c.lastMessageTime ? format(new Date(c.lastMessageTime), "hh:mm a") : ""}
                      </span>
                      
                      {/* Chevron / Badges Row */}
                      <div className="flex items-center gap-1 mt-1 shrink-0 relative min-h-[20px]">
                        {c.isUnread && (
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                        {hasDebt && (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-200/20 hover:bg-rose-500/10 text-[9px] h-4 px-1 font-bold shrink-0">
                            Fiado
                          </Badge>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-all opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 p-0.5 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 shrink-0"
                            >
                              <IconChevronDown size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            onClick={(e) => e.stopPropagation()}
                            side="right"
                            align="start"
                            sideOffset={10}
                            className="w-48 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                          >
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isArchived', c.isArchived)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconArchive size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isArchived ? "Desarchivar chat" : "Archivar chat"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isMuted', c.isMuted)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconVolumeOff size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isMuted ? "Desactivar silencio" : "Silenciar notificaciones"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isPinned', c.isPinned)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconPin size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isPinned ? "Desfijar chat" : "Fijar chat"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isUnread', c.isUnread)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconMail size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isUnread ? "Marcar como leído" : "Marcar como no leído"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isFavorite', c.isFavorite)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconStar size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isFavorite ? "Quitar de Favoritos" : "Añadir a Favoritos"}
                            </DropdownMenuItem>
                            
                            {customLists.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                  <IconFolderPlus size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> Añadir a la lista
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-44 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-250 dark:border-zinc-800 shadow-xl rounded-xl">
                                  {customLists.map(listName => {
                                    const isInList = c.lists?.includes(listName);
                                    return (
                                      <DropdownMenuItem key={listName} onClick={() => toggleChatList(c.id, listName)} className="text-xs flex justify-between items-center cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                        <span>{listName}</span>
                                        {isInList && <IconCheck size={12} className="text-emerald-500 shrink-0" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            )}
                            
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isRestricted', c.isRestricted)} className="text-xs gap-2 cursor-pointer text-zinc-750 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <IconLock size={14} className="text-zinc-500 dark:text-zinc-400 shrink-0" /> {c.isRestricted ? "Quitar restricción" : "Restringir chat"}
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />
                            
                            <DropdownMenuItem onClick={() => toggleChatProperty(c.id, 'isBlocked', c.isBlocked)} className="text-xs gap-2 cursor-pointer text-amber-600 focus:text-amber-500 focus:bg-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-950/20">
                              <IconBan size={14} className="text-amber-500 shrink-0" /> {c.isBlocked ? "Desbloquear" : "Bloquear"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleClearChat(c.id)} className="text-xs gap-2 cursor-pointer text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                              <IconTrash size={14} className="text-rose-500 shrink-0" /> Vaciar chat
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteChat(c.id)} className="text-xs gap-2 cursor-pointer text-rose-650 focus:text-rose-650 focus:bg-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                              <IconTrash size={14} className="text-rose-650 dark:text-rose-500 shrink-0" /> Eliminar chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </aside>

      {/* ─── AREA CENTRAL: CONVERSACIÓN ─────────────────────────────────── */}
      <main className={`flex-1 flex flex-col bg-white dark:bg-zinc-950/20 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            {/* Header del Chat */}
            <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-900 flex items-center justify-between bg-white dark:bg-zinc-950/40 shrink-0">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden size-8 -ml-2 text-zinc-400 hover:text-zinc-600"
                  onClick={() => setMobileView("list")}
                >
                  <IconArrowLeft size={18} />
                </Button>
                <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center overflow-hidden font-bold shrink-0">
                  {activeChat.avatarUrl || avatars[activeChat.id] ? (
                    <img src={activeChat.avatarUrl || avatars[activeChat.id]!} alt="Avatar" className="size-full object-cover" />
                  ) : (
                    getChatDisplayName(activeChat)?.charAt(0) || <IconUser size={16} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{getChatDisplayName(activeChat)}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">+{activeChat.phone}</p>
                </div>
              </div>
            </div>

            {/* Historial de Mensajes */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-xs text-zinc-400 font-semibold animate-pulse uppercase tracking-wider">
                  Cargando conversación...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs">
                  <IconMessage size={32} className="mb-2 opacity-50" />
                  Escribe un mensaje para iniciar la conversación.
                </div>
              ) : (
                messages.map((m) => {
                  const isAgent = m.senderType === "AGENT";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isAgent ? "justify-end" : "justify-start"} animate-in fade-in-30 duration-200`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm border ${
                          isAgent
                            ? "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-700/80 dark:border-emerald-700/40 rounded-tr-none"
                            : "bg-white text-zinc-800 border-zinc-150 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-850 rounded-tl-none"
                        }`}
                      >
                        {m.type === "text" ? (
                          <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        ) : (
                          <MediaMessageRenderer
                            msg={m}
                            messageMedia={messageMedia}
                            fetchMessageMedia={fetchMessageMedia}
                            senderAvatar={!isAgent && activeChat ? (activeChat.avatarUrl || avatars[activeChat.id]) : undefined}
                            senderFallback={!isAgent && activeChat ? (activeChat.name ? activeChat.name.substring(0, 2).toUpperCase() : undefined) : undefined}
                          />
                        )}
                        {!(m.type === "audio" || m.type === "AUDIO") && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`text-[8px] font-mono font-medium ${isAgent ? "text-emerald-100" : "text-zinc-400"}`}>
                              {format(new Date(m.createdAt), "hh:mm a")}
                            </span>
                            {isAgent && (
                              <span className="flex items-center">
                                {m.status === "READ" ? (
                                  <IconChecks size={13} className="text-sky-300 dark:text-sky-400 shrink-0" />
                                ) : m.status === "DELIVERED" ? (
                                  <IconChecks size={13} className="text-emerald-200/70 shrink-0" />
                                ) : (
                                  <IconCheck size={13} className="text-emerald-200/70 shrink-0" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>

            {/* Input de Envío estilo WhatsApp Web */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-950/60 flex items-center gap-2.5 shrink-0 relative">
              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-14 left-4 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 w-[290px]">
                  <div className="flex justify-between items-center mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Emojis Populares</span>
                    <button onClick={() => setShowEmojiPicker(false)} className="text-[10px] text-zinc-400 hover:text-zinc-650 font-bold">Cerrar</button>
                  </div>
                  <div className="grid grid-cols-8 gap-2 max-h-[160px] overflow-y-auto">
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setInputText(prev => prev + emoji);
                          inputRef.current?.focus();
                        }}
                        className="text-lg hover:scale-125 transition-transform duration-100 p-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment Menu Popover */}
              {showAttachMenu && (
                <div className="absolute bottom-14 left-12 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1.5 w-[160px] flex flex-col">
                  <button
                    onClick={() => { imageInputRef.current?.click(); }}
                    className="px-3.5 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    <IconPhoto size={15} className="text-blue-500" /> Imagen / Video
                  </button>
                  <button
                    onClick={() => { docInputRef.current?.click(); }}
                    className="px-3.5 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    <IconFileText size={15} className="text-emerald-500" /> Documento
                  </button>
                </div>
              )}

              {/* Hidden Inputs */}
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={(e) => handleFileSelect(e, "image")}
              />
              <input
                type="file"
                ref={docInputRef}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={(e) => handleFileSelect(e, "document")}
              />

              {isRecording ? (
                // Recording Panel
                <div className="flex-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 h-10 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-rose-500">Grabando...</span>
                    <span className="text-xs font-mono text-zinc-500 font-medium ml-2">
                      {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:
                      {(recordingDuration % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => stopRecording(true)}
                      className="size-8 text-rose-500 hover:text-rose-600 hover:bg-rose-100/50 dark:hover:bg-rose-950/30 rounded-full"
                    >
                      <IconTrash size={16} />
                    </Button>
                    <Button
                      onClick={() => stopRecording(false)}
                      className="size-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center p-0"
                    >
                      <IconSend size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                // Standard Input Bar
                <div className="flex-1 flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full px-2 py-0.5 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-shadow">
                  {/* Emoji Button inside the wrapper */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
                    className={`size-7 rounded-full shrink-0 ${showEmojiPicker ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 hover:text-zinc-750"}`}
                  >
                    <IconMoodSmile size={18} />
                  </Button>
                  
                  {/* Plus Button inside the wrapper */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
                    className={`size-7 rounded-full shrink-0 ${showAttachMenu ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 hover:text-zinc-750"}`}
                  >
                    <IconPlus size={18} />
                  </Button>

                  {/* Text Input */}
                  <Input
                    ref={inputRef}
                    placeholder="Escribe un mensaje de WhatsApp..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => { setShowEmojiPicker(false); setShowAttachMenu(false); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 h-7 text-xs text-zinc-850 dark:text-zinc-150"
                  />

                  {/* Action button inside the wrapper */}
                  {inputText.trim() ? (
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendingMessage}
                      className="size-7 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center justify-center p-0 border-none shadow-sm shrink-0"
                    >
                      <IconSend size={12} />
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      className="size-7 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300 rounded-full flex items-center justify-center p-0 border-none shadow-sm shrink-0"
                    >
                      <IconMicrophone size={13} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-zinc-400 text-xs">
            <IconBrandWhatsapp size={48} className="mb-3 opacity-30 text-emerald-500" />
            Selecciona un chat en la barra lateral para comenzar.
          </div>
        )}
      </main>

      {/* ─── BARRA LATERAL DERECHA: FICHA DEL CLIENTE ────────────────────── */}
      {activeChat && activeChat.client && (
        <aside className="w-[280px] xl:w-[320px] shrink-0 border-l border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/40 p-4 flex flex-col gap-4 overflow-y-auto hidden lg:flex">
          <div className="flex flex-col items-center text-center pb-3 border-b border-zinc-150 dark:border-zinc-900">
            <div className="size-14 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden font-bold text-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 shrink-0">
              {activeChat.avatarUrl || avatars[activeChat.id] ? (
                <img src={activeChat.avatarUrl || avatars[activeChat.id]!} alt="Avatar" className="size-full object-cover" />
              ) : (
                activeChat.client.name.charAt(0)
              )}
            </div>
            <h4 className="text-xs font-bold text-zinc-850 dark:text-zinc-100 mt-2.5 truncate max-w-full">
              {activeChat.client.name}
            </h4>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{activeChat.client.documentId || "Sin RIF"}</p>
          </div>

          <div className="space-y-3 flex-1">
            {/* Score */}
            <div className="flex justify-between items-center text-[10px] border-b border-zinc-100 dark:border-zinc-900/60 pb-2">
              <span className="text-zinc-400 font-bold uppercase tracking-tight">Syncro Score</span>
              {(() => {
                const stars = Math.round((activeChat.client.creditScore || 0) / 20);
                const color = stars >= 4 ? "text-emerald-500" : stars >= 2 ? "text-amber-400" : "text-rose-400";
                return (
                  <div className={`flex items-center gap-0.5 ${color} font-black`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>{stars}/5</span>
                  </div>
                );
              })()}
            </div>

            {/* Financial indicators */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-200/20 space-y-1">
                <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest">Deuda Actual</span>
                <p className="text-sm font-black text-rose-600 dark:text-rose-455 tabular-nums">${activeChat.client.currentDebt.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-200/20 space-y-1">
                <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Límite Autorizado</span>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {activeChat.client.creditLimit === 0 ? "Tradicional" : `$${activeChat.client.creditLimit.toFixed(0)}`}
                </p>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2 pt-2 text-[10px]">
              <span className="font-bold text-zinc-400 uppercase tracking-widest block">Información de Contacto</span>
              {activeChat.client.phone && (
                <div className="flex items-center gap-1.5 text-zinc-650 dark:text-zinc-350">
                  <IconDeviceMobile size={12} className="text-zinc-400 shrink-0" />
                  <span>{activeChat.client.phone}</span>
                </div>
              )}
              {activeChat.client.email && (
                <div className="flex items-center gap-1.5 text-zinc-650 dark:text-zinc-350">
                  <IconUser size={12} className="text-zinc-400 shrink-0" />
                  <span className="truncate">{activeChat.client.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4 border-t border-zinc-150 dark:border-zinc-900 shrink-0">
            {activeChat.client.currentDebt > 0 && (
              <>
                <Button
                  onClick={handleSendReminder}
                  disabled={sendingMessage}
                  className="w-full h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <IconAlertCircle size={14} className="text-amber-500" /> Enviar Cobro WhatsApp
                </Button>
                <Button
                  onClick={handleOpenPayment}
                  className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 border-none shadow-md"
                >
                  <IconCash size={14} /> Registrar Abono
                </Button>
              </>
            )}
          </div>
        </aside>
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
              Escanea el código QR desde la aplicación de WhatsApp de tu teléfono (Dispositivos Vinculados).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6 min-h-[220px]">
            {loadingQr ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="size-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider animate-pulse">Generando instancia...</p>
              </div>
            ) : qrCode ? (
              <div className="p-3 bg-white rounded-xl border border-zinc-200 shadow-inner">
                {/* QR Code Container */}
                <img src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-[180px] h-[180px]" />
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
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconMessage size={18} className="text-emerald-500" /> Iniciar Nueva Conversación
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Selecciona un cliente registrado o ingresa un número de WhatsApp personalizado para iniciar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Custom Phone section */}
            <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-950/20 space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Número Personalizado</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Ej. 584121234567"
                  className="rounded-xl h-9 text-xs"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                />
                <Input
                  placeholder="Nombre opcional"
                  className="rounded-xl h-9 text-xs"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <Button
                onClick={handleStartCustomChat}
                className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs border-none shadow-sm"
              >
                Iniciar Chat Manual
              </Button>
            </div>

            {/* Clients List search section */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Buscar Cliente Registrado</Label>
              <Input
                placeholder="Buscar por nombre o documento..."
                className="rounded-xl h-9 text-xs"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
              />

              <div className="max-h-[180px] overflow-y-auto border border-zinc-150 dark:border-zinc-900 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-900/60">
                {loadingClients ? (
                  <div className="text-center py-6 text-zinc-400 text-xs animate-pulse font-semibold">Cargando clientes...</div>
                ) : clientsList.length === 0 ? (
                  <div className="text-center py-6 text-zinc-450 text-xs">No hay clientes registrados</div>
                ) : (
                  (() => {
                    const filtered = clientsList.filter(c => 
                      c.name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                      c.documentId?.includes(newChatSearch)
                    );
                    if (filtered.length === 0) {
                      return <div className="text-center py-6 text-zinc-450 text-xs">Sin coincidencias</div>;
                    }
                    return filtered.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectClientForChat(c)}
                        className="p-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200">{c.name}</p>
                          <p className="text-[10px] text-zinc-450 font-mono">{c.documentId || "Sin RIF"}</p>
                        </div>
                        {c.phone ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-mono font-bold">
                            +{c.phone}
                          </span>
                        ) : (
                          <span className="text-[9px] text-rose-500 font-bold">Sin teléfono</span>
                        )}
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setNewChatOpen(false)}
              className="w-full h-10 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-xl"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE ABONO ─────────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-205">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-500">
              <IconCash size={20} /> Recibir Abono
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Registra un pago para <strong>{activeChat?.client?.name}</strong> — Deuda actual: <strong className="text-rose-500">${activeChat?.client?.currentDebt?.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Moneda de Pago</Label>
              <select
                value={paymentCurrency}
                onChange={(e: any) => { setPaymentCurrency(e.target.value); setPaidAmountRaw(""); setCustomRate(""); }}
                className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-semibold px-3 outline-none"
              >
                <option value="USD">Dólares (USD)</option>
                <option value="VES">Bolívares (VES)</option>
                <option value="COP">Pesos Colombianos (COP)</option>
              </select>
            </div>
            {paymentCurrency !== "USD" && (
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tasa de Cambio</Label>
                <Input
                  type="number"
                  className="rounded-xl h-10 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs"
                  placeholder={paymentCurrency === "VES" ? `BCV: ${settings?.exchangeRate || 40}` : "Aprox. 4000"}
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Monto Recibido ({paymentCurrency})</Label>
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
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                  <IconInfoCircle size={12} /> Equivalente USD
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">${paymentAmount || "0.00"}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Concepto / Notas</Label>
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
              {isSubmittingPayment ? "Procesando..." : "Confirmar Abono"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE NUEVA LISTA ──────────────────────────────────────── */}
      <Dialog open={newListDialogOpen} onOpenChange={setNewListDialogOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconFolderPlus size={18} className="text-emerald-500" /> Crear Nueva Lista
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Ingresa el nombre de la lista para agrupar tus conversaciones de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-bold text-zinc-500">Nombre de la lista</Label>
            <Input
              placeholder="Ej. Clientes VIP, Prospectos..."
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
              Crear Lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG DE CONFIGURACIÓN DE BLOQUEO (PIN) ────────────────────── */}
      <Dialog open={appLockOpen} onOpenChange={setAppLockOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-sm border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
              <IconLock size={18} className="text-emerald-500" /> Configurar Bloqueo de App
            </DialogTitle>
            <DialogDescription className="text-xs mt-1">
              Establece un PIN numérico para proteger tus conversaciones. Déjalo vacío para desactivar el bloqueo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-bold text-zinc-500">PIN de Seguridad (4+ dígitos)</Label>
            <Input
              type="password"
              placeholder="Ingresa PIN o deja vacío para desactivar"
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              className="h-10 rounded-xl text-xs text-center font-bold tracking-widest bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
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
              className="h-10 rounded-xl text-xs text-center font-bold tracking-widest bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-850 dark:text-zinc-150"
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
