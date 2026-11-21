import { financeSections } from "@/lib/central-finance-navigation";
import FinanceApp from "./finance-app";

export default function FinanceAppPage() {
  const section = financeSections.find(item => item.slug === "resumen-personal")!;
  return <FinanceApp section={section} />;
}
