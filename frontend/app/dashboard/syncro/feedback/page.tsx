"use client";

import React, { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants"
import { 
  IconThumbUp, 
  IconThumbDown, 
  IconSearch, 
  IconSparkles, 
  IconBuildingStore, 
  IconCalendar,
  IconMessageCircle,
  IconTrendingUp,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { 
  Card,
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardAction,
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const API = API_URL;

export default function AiFeedbackAuditPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState<"ALL" | "LIKE" | "DISLIKE">("ALL");

  const fetchFeedback = async () => {
    try {
      const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
      const token = isPwa ? sessionStorage.getItem("token") : localStorage.getItem("token");
      const res = await fetch(`${API}/ai-agent/feedback`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data);
      } else {
        toast.error("No se pudo cargar el historial de feedback");
      }
    } catch (error) {
      console.error("Error fetching AI feedback:", error);
      toast.error("Error de conexión al cargar feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const filteredFeedbacks = feedbacks.filter((fb) => {
    const matchesSearch = 
      fb.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fb.response && fb.response.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (fb.comment && fb.comment.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (fb.business?.name && fb.business.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRating = ratingFilter === "ALL" || fb.rating === ratingFilter;

    return matchesSearch && matchesRating;
  });

  const totalCount = feedbacks.length;
  const likesCount = feedbacks.filter(f => f.rating === "LIKE").length;
  const dislikesCount = feedbacks.filter(f => f.rating === "DISLIKE").length;
  const approvalRate = totalCount > 0 ? Math.round((likesCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Auditoría de Feedback de IA <IconSparkles size={24} className="text-primary animate-pulse" />
          </h1>
          <p className="text-muted-foreground">Monitorea y analiza el desempeño y las opiniones de los usuarios sobre Syncro IA.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pregunta, respuesta o negocio..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border/30 shrink-0">
            <Button
              variant={ratingFilter === "ALL" ? "default" : "ghost"}
              size="sm"
              onClick={() => setRatingFilter("ALL")}
              className="h-8 text-xs font-semibold px-3.5 rounded-lg"
            >
              Todos
            </Button>
            <Button
              variant={ratingFilter === "LIKE" ? "default" : "ghost"}
              size="sm"
              onClick={() => setRatingFilter("LIKE")}
              className={cn(
                "h-8 text-xs font-semibold px-3 rounded-lg gap-1",
                ratingFilter === "LIKE" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "hover:text-emerald-500 hover:bg-emerald-500/5"
              )}
            >
              <IconThumbUp size={12} /> Likes
            </Button>
            <Button
              variant={ratingFilter === "DISLIKE" ? "default" : "ghost"}
              size="sm"
              onClick={() => setRatingFilter("DISLIKE")}
              className={cn(
                "h-8 text-xs font-semibold px-3 rounded-lg gap-1",
                ratingFilter === "DISLIKE" ? "bg-rose-600 hover:bg-rose-700 text-white" : "hover:text-rose-500 hover:bg-rose-500/5"
              )}
            >
              <IconThumbDown size={12} /> Dislikes
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Total Evaluaciones</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {totalCount}
            </CardTitle>
            <CardAction>
              <IconMessageCircle className="size-5 text-muted-foreground/50" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
            <span>Interacciones calificadas por usuarios</span>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-emerald-500/5 to-card shadow-xs border-emerald-500/10">
          <CardHeader>
            <CardDescription>Calificaciones Positivas</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-emerald-500">
              {likesCount}
            </CardTitle>
            <CardAction>
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <IconThumbUp className="size-4 text-emerald-500" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
            <span>Respuestas útiles y precisas</span>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-rose-500/5 to-card shadow-xs border-rose-500/10">
          <CardHeader>
            <CardDescription>Calificaciones Negativas</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-rose-500">
              {dislikesCount}
            </CardTitle>
            <CardAction>
              <div className="size-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <IconThumbDown className="size-4 text-rose-500" />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
            <span>Respuestas para revisar y mejorar</span>
          </CardFooter>
        </Card>

        <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
          <CardHeader>
            <CardDescription>Tasa de Aprobación</CardDescription>
            <CardTitle className={cn(
              "text-2xl font-bold tabular-nums",
              approvalRate >= 80 ? "text-emerald-500" : approvalRate >= 50 ? "text-amber-500" : "text-rose-500"
            )}>
              {approvalRate}%
            </CardTitle>
            <CardAction>
              <IconTrendingUp className="size-5 text-muted-foreground/50" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
            <span>Porcentaje de satisfacción general</span>
          </CardFooter>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle>Comentarios y Respuestas de IA</CardTitle>
          <CardDescription>Audita el historial de mensajes de la IA y el feedback recibido.</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border/40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground mt-4">Cargando registros de feedback...</p>
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border/40 text-muted-foreground">
            <IconMessageCircle size={48} className="opacity-20 mb-3" />
            <p className="text-sm font-semibold">No se encontró feedback registrado.</p>
            <p className="text-xs text-muted-foreground/80">Las interacciones calificadas por tus clientes aparecerán aquí.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/10 font-semibold uppercase tracking-tight text-[10px] text-muted-foreground">
                  <TableHead className="px-4 h-10 w-[20%]">Negocio</TableHead>
                  <TableHead className="px-4 h-10 w-[35%]">Prompt original del usuario</TableHead>
                  <TableHead className="px-4 h-10 w-[35%]">Respuesta de Syncro IA</TableHead>
                  <TableHead className="px-4 h-10 w-[10%] text-center">Calificación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedbacks.map((fb) => (
                  <TableRow key={fb.id} className="hover:bg-muted/30 border-border/5 transition-colors border-b">
                    <TableCell className="px-4 py-3.5 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-xs text-foreground uppercase tracking-tight flex items-center gap-1.5">
                          <IconBuildingStore size={12} className="text-primary/70 shrink-0" />
                          {fb.business?.name || "Negocio General"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/75 flex items-center gap-1">
                          <IconCalendar size={10} className="shrink-0" />
                          {format(new Date(fb.createdAt), "dd MMM yyyy, h:mm a", { locale: es })}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-top">
                      <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-xl p-2.5 border border-border/20">
                        {fb.prompt}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-top">
                      <div className="space-y-2">
                        <div className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-primary/5 dark:bg-primary/10 rounded-xl p-2.5 border border-primary/20">
                          {fb.response}
                        </div>
                        {fb.comment && (
                          <div className="text-[11px] text-rose-500 font-medium bg-rose-500/5 border border-rose-500/10 rounded-lg p-2.5 flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-black tracking-wider opacity-60">Comentario del usuario:</span>
                            <span className="italic">"{fb.comment}"</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 align-top text-center">
                      <div className="flex justify-center">
                        {fb.rating === "LIKE" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-extrabold uppercase text-[9px] gap-1 px-2.5 py-1">
                            <IconThumbUp size={10} /> Útil
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-500/10 border-rose-500/20 text-rose-500 font-extrabold uppercase text-[9px] gap-1 px-2.5 py-1">
                            <IconThumbDown size={10} /> Corregir
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
