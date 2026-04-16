import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import data from "./data.json";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, CardAction 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconTrendingUp, IconTrendingDown, IconCheck } from "@tabler/icons-react";

export default function Page() {
  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
      {/* Premium Dashboard Metrics */}
      <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Revenue</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
              $1,250.00
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                <IconTrendingUp size={12} />
                +12.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Trending up this month <IconTrendingUp className="size-3 text-emerald-500" />
            </div>
            <div className="text-muted-foreground/60 font-medium italic">
              Visitors for the last 6 months
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Customers</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-rose-600">
              1,234
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-rose-500/20 text-rose-600 bg-rose-500/5">
                <IconTrendingDown size={12} />
                -20%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Down 20% this period <IconTrendingDown className="size-3 text-rose-500" />
            </div>
            <div className="text-muted-foreground/60 font-medium italic">
              Acquisition needs attention
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Accounts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-emerald-600">
              45,678
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                <IconTrendingUp size={12} />
                +12.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Strong user retention <IconTrendingUp className="size-3 text-emerald-500" />
            </div>
            <div className="text-muted-foreground/60 font-medium italic">Engagement exceed targets</div>
          </CardFooter>
        </Card>

        <Card className="@container/card shadow-sm border-none">
          <CardHeader>
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Growth Rate</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl text-amber-600">
              4.5%
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="gap-1 border-amber-500/20 text-amber-600 bg-amber-500/5">
                <IconTrendingUp size={12} />
                +4.5%
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-[10px] pb-5">
            <div className="line-clamp-1 flex gap-2 font-bold text-muted-foreground uppercase tracking-tight">
              Steady performance increase <IconTrendingUp className="size-3 text-amber-500" />
            </div>
            <div className="text-muted-foreground/60 font-medium italic">Meets growth projections</div>
          </CardFooter>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <div className="px-4 lg:px-6">
        <DataTable data={data} />
      </div>
    </div>
  );
}
