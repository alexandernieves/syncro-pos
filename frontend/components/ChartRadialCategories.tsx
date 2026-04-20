"use client"

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"

const COLORS = ["#79716b", "hsl(var(--primary))", "#10b981", "#f59e0b", "#6366f1"];

export function ChartRadialCategories({ sales }: { sales: any[] }) {
  const categoryData = React.useMemo(() => {
    const counts: any = {};
    sales.forEach(s => {
      s.items?.forEach((it: any) => {
        const cat = it.variant?.product?.category?.name || "Otros";
        counts[cat] = (counts[cat] || 0) + (it.subtotal || (it.quantity * it.price) || 0);
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sales]);

  return (
    <Card className="border-none bg-gradient-to-t from-primary/5 to-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Distribución de Ingresos</CardTitle>
        <CardDescription className="text-xs">Ventas por categoría de productos</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
               contentStyle={{ backgroundColor: '#09090b', border: '1px solid #79716b30', borderRadius: '8px', fontSize: '11px' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
