"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartData = [
  { month: "Enero", ingresos: 186, egresos: 80 },
  { month: "Febrero", ingresos: 305, egresos: 200 },
  { month: "Marzo", ingresos: 237, egresos: 120 },
  { month: "Abril", ingresos: 73, egresos: 190 },
  { month: "Mayo", ingresos: 209, egresos: 130 },
  { month: "Junio", ingresos: 214, egresos: 140 },
]

const chartConfig = {
  ingresos: {
    label: "Ingresos",
    color: "var(--primary)",
  },
  egresos: {
    label: "Egresos",
    color: "var(--rose-500)",
  },
} satisfies ChartConfig

export function ChartBarAccounting() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Caja Mensual</CardTitle>
        <CardDescription>Comparativa de ingresos vs egresos (USD)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={4} />
            <Bar dataKey="egresos" fill="var(--color-egresos)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
