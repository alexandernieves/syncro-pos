import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceSection } from "@/lib/central-finance-navigation";

export function FinanceSkeleton({ tab, mobile = false, session = false }: {
  tab?: FinanceSection["tab"];
  mobile?: boolean;
  session?: boolean;
}) {
  const summary = !tab || tab === "Resumen";

  return <div role="status" aria-busy="true" className="space-y-3">
    <span className="sr-only">{session ? "Abriendo Syncro Finanzas" : "Cargando datos de Finanzas"}</span>
    <div aria-hidden="true" className="space-y-3">
      {session && <div className="rounded-[26px] bg-[#F26B3A] p-5">
        <Skeleton className="h-5 w-28 rounded-full bg-white/35" />
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="space-y-2"><Skeleton className="h-7 w-36 bg-white/40" /><Skeleton className="h-4 w-28 bg-white/35" /></div>
          <Skeleton className="size-14 shrink-0 rounded-full bg-white/35" />
        </div>
      </div>}
      {summary ? <>
        <div className={mobile ? "grid grid-cols-2 gap-3" : "grid gap-3 sm:grid-cols-3"}>
          {[0, 1, 2].map(index => <div key={index} className={`space-y-3 rounded-[22px] border bg-card p-4 ${mobile && index === 0 ? "col-span-2" : ""}`}>
            <Skeleton className="h-4 w-24 max-w-full" /><Skeleton className={mobile && index === 0 ? "h-9 w-32" : "h-6 w-20"} />
          </div>)}
        </div>
        <div className="space-y-3 rounded-[22px] border bg-card p-4">
          <Skeleton className="h-5 w-40 max-w-full" /><Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-44 max-w-full rounded-full" />
        </div>
      </> : <div className="space-y-4 rounded-[22px] border bg-card p-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map(index => <div className="space-y-2" key={index}>
            <Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full rounded-xl" />
          </div>)}
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>}
      {[0, 1].map(index => <Skeleton key={index} className="h-12 w-full rounded-xl" />)}
    </div>
  </div>;
}
