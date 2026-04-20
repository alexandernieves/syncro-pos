"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ChartBarSales({ data }: { data: any[] }) {
  return (
    <Card className="border-none bg-gradient-to-t from-primary/5 to-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Productos Más Vendidos</CardTitle>
        <CardDescription className="text-xs">Volumen de ventas por artículo (Top 5)</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#79716b20" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={100} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#79716b', fontSize: 10, fontWeight: 'bold' }}
            />
            <Tooltip 
              cursor={{ fill: '#79716b10' }}
              contentStyle={{ backgroundColor: '#09090b', border: '1px solid #79716b30', borderRadius: '8px', fontSize: '11px' }}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
