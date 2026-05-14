"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { IconCheck, IconCrown, IconInfinity, IconReceipt, IconShieldCheck, IconSparkles, IconCreditCard } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default function FacturacionPage() {
  const [billingCycle, setBillingCycle] = useState<"mensual" | "anual">("mensual")

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Suscripción y Facturación
          </h2>
          <p className="text-muted-foreground mt-1">
            Gestiona tu plan SaaS, cuotas de uso y métodos de pago.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Plan Overview */}
        <Card className="lg:col-span-2 border-primary/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-background to-primary/5 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-32 bg-primary/10 rounded-full blur-[100px] -mr-16 -mt-16 pointer-events-none" />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  Plan Actual <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 font-bold uppercase tracking-wider">Gratis (Ilimitado)</Badge>
                </CardTitle>
                <CardDescription>
                  Estás disfrutando de la fase beta con acceso total.
                </CardDescription>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <IconSparkles size={24} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 p-4 rounded-xl bg-background/50 border backdrop-blur-sm">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Sucursales</span>
                  <IconInfinity size={18} className="text-primary" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">Ilimitado</span>
                </div>
                <Progress value={100} className="h-1.5 bg-primary/20" indicatorColor="bg-primary" />
              </div>
              
              <div className="space-y-2 p-4 rounded-xl bg-background/50 border backdrop-blur-sm">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Usuarios</span>
                  <IconInfinity size={18} className="text-primary" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">Ilimitado</span>
                </div>
                <Progress value={100} className="h-1.5 bg-primary/20" indicatorColor="bg-primary" />
              </div>

              <div className="space-y-2 p-4 rounded-xl bg-background/50 border backdrop-blur-sm">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Facturación</span>
                  <IconInfinity size={18} className="text-primary" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold">Ilimitado</span>
                </div>
                <Progress value={100} className="h-1.5 bg-primary/20" indicatorColor="bg-primary" />
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-500/10 p-3 rounded-lg border border-green-500/20">
              <IconShieldCheck className="text-green-500" size={18} />
              <span>Tu cuenta está en estado <strong>activo y sin restricciones</strong>. Más adelante te notificaremos antes de aplicar cargos.</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions / Payment Method */}
        <Card className="flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <IconCreditCard size={18} /> Método de Pago
            </CardTitle>
            <CardDescription>
              Aún no necesitas registrar una tarjeta.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-muted rounded-xl mx-6 mb-6 bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <IconCreditCard className="text-primary/50" size={24} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin tarjeta registrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Añade una tarjeta para estar listo cuando termine el periodo gratuito.</p>
            <Button variant="outline" size="sm" className="w-full" disabled>
              Añadir Tarjeta (Próximamente)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Planes Disponibles</h3>
          <div className="flex items-center p-1 bg-muted rounded-lg">
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${billingCycle === "mensual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBillingCycle("mensual")}
            >
              Mensual
            </button>
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${billingCycle === "anual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBillingCycle("anual")}
            >
              Anual <span className="text-[10px] uppercase tracking-wider text-green-500 font-bold ml-1">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Free Plan */}
          <Card className="relative border-primary bg-primary/5 shadow-md shadow-primary/10 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wider">
              Tu Plan Actual
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Plan Base</CardTitle>
              <CardDescription>Ideal para comenzar tu negocio.</CardDescription>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold">
                $0 <span className="ml-1 text-xl font-medium text-muted-foreground">/mes</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {[
                  "Usuarios ilimitados (Por ahora)",
                  "Sucursales ilimitadas (Por ahora)",
                  "Soporte básico por correo",
                  "Integración con BCV automática",
                  "Módulo de punto de venta (POS)",
                  "Control de inventario estándar",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="rounded-full p-1 bg-primary/20 text-primary">
                      <IconCheck size={14} stroke={3} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-primary/20 text-primary hover:bg-primary/30 font-bold" variant="secondary" disabled>
                Plan Activo
              </Button>
            </CardFooter>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-muted opacity-80 transition-all duration-300 hover:opacity-100">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2 text-muted-foreground">
                <IconCrown size={24} className="text-yellow-500" /> Plan Premium
              </CardTitle>
              <CardDescription>Funciones avanzadas para negocios en crecimiento.</CardDescription>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold opacity-50">
                ${billingCycle === "mensual" ? "29" : "278"} <span className="ml-1 text-xl font-medium text-muted-foreground">/{billingCycle === "mensual" ? "mes" : "año"}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "Todo lo del Plan Base",
                  "Múltiples sucursales y bodegas",
                  "Roles y permisos avanzados",
                  "Reportes contables exportables",
                  "Soporte prioritario 24/7",
                  "Integración con WhatsApp y Correo",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="rounded-full p-1 bg-muted-foreground/20 text-muted-foreground">
                      <IconCheck size={14} stroke={3} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline" disabled>
                Próximamente
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <div className="pt-6">
        <h3 className="text-xl font-bold mb-4">Historial de Pagos</h3>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4 text-muted-foreground">
              <IconReceipt size={32} />
            </div>
            <h4 className="text-lg font-medium">No hay facturas aún</h4>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Estás en un plan gratuito. Tus recibos de pago aparecerán aquí cuando adquieras una suscripción paga.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
