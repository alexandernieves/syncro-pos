import { notFound } from "next/navigation";
import { financeSections } from "@/lib/central-finance-navigation";
import FinanceWorkspace from "./finance-workspace";

export default function FinancePage() {
  const section = financeSections.find(item => item.slug === "resumen-personal");
  if (!section) notFound();

  return <FinanceWorkspace section={section} />;
}
