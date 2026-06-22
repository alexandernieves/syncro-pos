"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "@/lib/constants";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconTruck,
  IconMapPin,
  IconPhone,
  IconCheck,
  IconX,
  IconSearch,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconCalendar,
  IconUser,
  IconPackage,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";

const API = API_URL;
const MAPBOX_TOKEN = "pk.eyJ1Ijoic3luY3JvcG9zIiwiYSI6ImNtcW80eHJoazF0MjQycXB6b2Q2c3loc3UifQ.RuEyWvPOieOxbOXf9Rq8rQ";

interface ProductItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
}

interface DeliveryOrder {
  id: string;
  clientId: string;
  businessId: string;
  products: ProductItem[];
  total: number;
  lat: number;
  lng: number;
  address: string | null;
  status: 'PENDING' | 'APPROVED' | 'SHIPPED' | 'ON_THE_WAY' | 'DELIVERED' | 'REJECTED' | 'CANCELLED';
  phone: string | null;
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Load Mapbox GL CDN dynamically
  useEffect(() => {
    if ((window as any).mapboxgl) {
      setMapboxLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js";
    script.async = true;
    script.onload = () => {
      setMapboxLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      // Keep CDN script loaded for other pages to reuse
    };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/delivery-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        // Sync selected order update if it is currently selected
        if (selectedOrder) {
          const updated = data.find((o: DeliveryOrder) => o.id === selectedOrder.id);
          if (updated) {
            setSelectedOrder(updated);
          }
        }
      } else {
        toast.error("Error al cargar pedidos de delivery");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000); // Autorefresh every 15s
    return () => clearInterval(interval);
  }, [selectedOrder?.id]);

  // Update/render map when selectedOrder changes and Mapbox is loaded
  useEffect(() => {
    if (!mapboxLoaded || !selectedOrder || !mapContainerRef.current) return;

    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const lng = selectedOrder.lng;
    const lat = selectedOrder.lat;

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: [lng, lat],
        zoom: 14,
      });

      markerRef.current = new mapboxgl.Marker({ color: "#f59e0b" })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    } else {
      // Re-center map and update marker
      mapRef.current.setCenter([lng, lat]);
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#f59e0b" })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
      }
    }
  }, [selectedOrder, mapboxLoaded]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/delivery-orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        let statusText = "actualizado";
        if (status === "APPROVED") statusText = "Aprobado";
        else if (status === "REJECTED") statusText = "Rechazado";
        else if (status === "SHIPPED") statusText = "Marcado como Salida de Tienda";
        else if (status === "ON_THE_WAY") statusText = "Marcado como En Camino";
        else if (status === "DELIVERED") statusText = "Entregado";
        else if (status === "CANCELLED") statusText = "Cancelado";

        toast.success(`Pedido de delivery ${statusText} con éxito`);
        loadOrders();
      } else {
        toast.error("Error al actualizar estado del pedido");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar definitivamente este pedido de delivery? Se borrará también de la vista del cliente en su portal.")) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/delivery-orders/${orderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        toast.success("Pedido de delivery eliminado con éxito");
        setSelectedOrder(null);
        loadOrders();
      } else {
        toast.error("Error al eliminar pedido de delivery");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      (order.clientName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.address?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.phone || "").includes(searchTerm);

    const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "APPROVED":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "SHIPPED":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "ON_THE_WAY":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "REJECTED":
        return "bg-rose-500/10 text-rose-600 border-rose-500/20";
      case "CANCELLED":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Pendiente";
      case "APPROVED":
        return "Aprobado";
      case "SHIPPED":
        return "Salida de Tienda";
      case "ON_THE_WAY":
        return "En Camino";
      case "DELIVERED":
        return "Entregado";
      case "REJECTED":
        return "Rechazado";
      case "CANCELLED":
        return "Cancelado por Cliente";
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-background font-sans">
      {/* Header bar */}
      <div className="border-b px-6 py-4 flex flex-row items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <IconTruck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Pedidos a Domicilio (Delivery)</h1>
            <p className="text-xs font-medium text-muted-foreground">Gestiona las solicitudes de despacho y confirma ubicaciones mediante mapas.</p>
          </div>
        </div>
        <Button onClick={loadOrders} variant="outline" size="sm" className="gap-2">
          <IconRefresh size={16} /> Refrescar
        </Button>
      </div>

      {/* Main split viewport */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Order List & Filters */}
        <div className="w-full md:w-[400px] border-r flex flex-col bg-card shrink-0 h-1/2 md:h-full">
          {/* Filters & search */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="text"
                placeholder="Buscar cliente, teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-lg bg-muted/40 border-none text-xs font-medium"
              />
            </div>
            {/* Horizontal Filter Buttons */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {["ALL", "PENDING", "APPROVED", "SHIPPED", "ON_THE_WAY", "DELIVERED", "REJECTED", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 transition-all border ${
                    statusFilter === st
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  {st === "ALL" ? "Todos" : getStatusLabel(st)}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading && orders.length === 0 ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 flex flex-col items-center justify-center text-center opacity-40 gap-3">
                <IconClipboardList size={36} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-bold">No hay pedidos</p>
                  <p className="text-xs text-muted-foreground">No se encontraron solicitudes para este filtro.</p>
                </div>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 flex flex-col gap-2.5 cursor-pointer transition-all hover:bg-muted/30 ${
                    selectedOrder?.id === order.id ? "bg-primary/5 border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{order.clientName || "Cliente PWA"}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{order.phone || "—"}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold uppercase px-2 py-0.5 ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground/80 font-mono">
                      {order.products?.length || 0} art. • <span className="text-emerald-600 font-extrabold">${order.total.toFixed(2)}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <IconCalendar size={11} />
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {order.address && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 flex items-center gap-1 bg-muted/35 p-1 rounded">
                      <IconMapPin size={11} className="shrink-0" />
                      {order.address}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active View / Map / Details */}
        <div className="flex-1 flex flex-col bg-muted/10 overflow-y-auto h-1/2 md:h-full">
          {selectedOrder ? (
            <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {/* Order Info & Status Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-2xl border shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{selectedOrder.clientName || "Pedido de Delivery"}</h2>
                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 ${getStatusColor(selectedOrder.status)}`}>
                      {getStatusLabel(selectedOrder.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <IconCalendar size={13} />
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {selectedOrder.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-rose-500/5 hover:bg-rose-50/80 border-rose-500/20 text-rose-600 gap-1.5 h-9 px-4 font-bold text-xs"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "REJECTED")}
                        disabled={isProcessing}
                      >
                        <IconX size={15} /> Rechazar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 px-4 font-bold text-xs shadow-sm shadow-primary/20"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "APPROVED")}
                        disabled={isProcessing}
                      >
                        <IconCheck size={15} /> Aprobar Envío
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "APPROVED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-rose-500/5 hover:bg-rose-50/80 border-rose-500/20 text-rose-600 gap-1.5 h-9 px-4 font-bold text-xs"
                        onClick={() => {
                          if (window.confirm("¿Seguro que deseas cancelar este pedido de delivery?")) {
                            handleUpdateStatus(selectedOrder.id, "CANCELLED");
                          }
                        }}
                        disabled={isProcessing}
                      >
                        <IconX size={15} /> Cancelar Pedido
                      </Button>
                      <Button
                        size="sm"
                        className="bg-indigo-500 hover:bg-indigo-600 text-white gap-1.5 h-9 px-4 font-bold text-xs shadow-sm shadow-indigo-500/20"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "SHIPPED")}
                        disabled={isProcessing}
                      >
                        <IconCheck size={15} /> Marcar Salida de Tienda
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "SHIPPED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-rose-500/5 hover:bg-rose-50/80 border-rose-500/20 text-rose-600 gap-1.5 h-9 px-4 font-bold text-xs"
                        onClick={() => {
                          if (window.confirm("¿Seguro que deseas cancelar este pedido de delivery?")) {
                            handleUpdateStatus(selectedOrder.id, "CANCELLED");
                          }
                        }}
                        disabled={isProcessing}
                      >
                        <IconX size={15} /> Cancelar Pedido
                      </Button>
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-9 px-4 font-bold text-xs shadow-sm shadow-orange-500/20"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "ON_THE_WAY")}
                        disabled={isProcessing}
                      >
                        <IconCheck size={15} /> Marcar En Camino
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "ON_THE_WAY" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-rose-500/5 hover:bg-rose-50/80 border-rose-500/20 text-rose-600 gap-1.5 h-9 px-4 font-bold text-xs"
                        onClick={() => {
                          if (window.confirm("¿Seguro que deseas cancelar este pedido de delivery?")) {
                            handleUpdateStatus(selectedOrder.id, "CANCELLED");
                          }
                        }}
                        disabled={isProcessing}
                      >
                        <IconX size={15} /> Cancelar Pedido
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 h-9 px-4 font-bold text-xs shadow-sm shadow-emerald-500/20"
                        onClick={() => handleUpdateStatus(selectedOrder.id, "DELIVERED")}
                        disabled={isProcessing}
                      >
                        <IconCheck size={15} /> Marcar como Entregado
                      </Button>
                    </>
                  )}
                  {selectedOrder.status === "DELIVERED" && (
                    <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                      <IconCircleCheck size={14} /> Entregado con Éxito
                    </span>
                  )}
                  {selectedOrder.status === "REJECTED" && (
                    <span className="text-rose-600 text-xs font-bold flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                      <IconCircleX size={14} /> Solicitud Rechazada
                    </span>
                  )}
                  {selectedOrder.status === "CANCELLED" && (
                    <span className="text-zinc-500 text-xs font-bold flex items-center gap-1 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-200">
                      <IconCircleX size={14} /> Cancelado por el Cliente
                    </span>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-rose-500/10 hover:bg-rose-600 hover:text-white border-rose-200 text-rose-600 gap-1.5 h-9 px-3.5 font-bold text-xs"
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    disabled={isProcessing}
                  >
                    <IconTrash size={15} /> Eliminar
                  </Button>
                </div>
              </div>



              {/* Grid: Left: Items, Right: Delivery Pin & Coordinates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Details Card */}
                <Card className="border shadow-xs">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <IconClipboardList size={16} className="text-primary" /> Detalle del Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                      {selectedOrder.products?.map((item, idx) => (
                        <div key={idx} className="p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.quantity} x ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <span className="text-xs font-extrabold text-foreground tabular-nums">
                            ${(item.quantity * item.price).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-muted/40 p-4 border-t flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground uppercase">Total del Pedido</span>
                      <span className="text-base font-black text-emerald-600 tabular-nums">
                        ${selectedOrder.total.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Shipping info */}
                <Card className="border shadow-xs flex flex-col">
                  <CardHeader className="py-4 border-b">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <IconUser size={16} className="text-primary" /> Información de Envío
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cliente</span>
                        <p className="text-xs font-semibold text-foreground">{selectedOrder.clientName || "PWA User"}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Teléfono</span>
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <IconPhone size={13} className="text-muted-foreground" />
                          <a href={`tel:${selectedOrder.phone}`} className="hover:underline text-primary">
                            {selectedOrder.phone || "—"}
                          </a>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dirección de Entrega</span>
                      <p className="text-xs font-medium text-foreground bg-muted/30 p-2.5 rounded-lg border">
                        {selectedOrder.address || "No especificada por texto"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border border-dashed text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Latitud</span>
                        <p className="font-mono font-semibold text-foreground/80 mt-0.5">{selectedOrder.lat.toFixed(6)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Longitud</span>
                        <p className="font-mono font-semibold text-foreground/80 mt-0.5">{selectedOrder.lng.toFixed(6)}</p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-primary/20 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground gap-2 font-bold text-xs mt-1"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedOrder.lat},${selectedOrder.lng}`, "_blank")}
                    >
                      <IconMapPin size={15} /> Ver en Google Maps
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Mapbox Locator Map Container */}
              <Card className="border shadow-xs overflow-hidden flex flex-col">
                <CardHeader className="py-4 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <IconMapPin size={16} className="text-primary" /> Ubicación del Delivery (Mapa)
                  </CardTitle>
                </CardHeader>
                <div className="relative h-[300px] w-full bg-muted flex items-center justify-center">
                  {!mapboxLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card">
                      <span className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground">Cargando Mapbox...</span>
                    </div>
                  )}
                  <div ref={mapContainerRef} className="w-full h-full" />
                </div>
              </Card>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 p-12 gap-4">
              <div className="size-20 rounded-3xl bg-muted flex items-center justify-center shadow-inner">
                <IconTruck size={40} className="text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-foreground">Detalle del Delivery</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Selecciona una solicitud de la barra lateral izquierda para evaluar la ubicación de entrega, revisar los artículos y gestionar el despacho.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
