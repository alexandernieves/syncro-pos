"use client"

import { TrendingUp } from "lucide-react"
import { LabelList, RadialBar, RadialBarChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  { browser: "chrome", visitors: 275, fill: "var(--primary)" },
  { browser: "safari", visitors: 200, fill: "var(--rose-500)" },
  { browser: "firefox", visitors: 187, fill: "#2662d9" },
  { browser: "edge", visitors: 173, fill: "#e23670" },
  { browser: "other", visitors: 90, fill: "#af57db" },
]

const chartConfig = {
  visitors: {
    label: "Monto",
  },
  chrome: {
    label: "Servicios",
    color: "var(--primary)",
  },
  safari: {
    label: "Alquiler",
    color: "var(--rose-500)",
  },
  firefox: {
    label: "Proveedores",
    color: "hsl(var(--chart-3))",
  },
  edge: {
    label: "Personal",
    color: "hsl(var(--chart-4))",
  },
  other: {
    label: "Otros",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig

export function ChartRadialAccounting() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Gastos por Categoría</CardTitle>
        <CardDescription>Distribución porcentual del mes</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={-90}
            endAngle={380}
            innerRadius={30}
            outerRadius={110}
          >
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="browser" />}
            />
            <RadialBar dataKey="visitors" background>
              <LabelList
                position="insideStart"
                dataKey="browser"
                className="fill-white capitalize font-bold text-[10px]"
                fontSize={11}
              />
            </RadialBar>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Incremento de 5.2% esta semana <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Datos proyectados al cierre de mes
        </div>
      </CardFooter>
    </Card>
  )
}
