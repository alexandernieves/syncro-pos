import { notFound } from "next/navigation";
import { financeSections } from "@/lib/central-finance-navigation";
import FinanceWorkspace from "../finance-workspace";

export function generateStaticParams() {
  return financeSections.map(({ slug }) => ({ section: slug }));
}

export default async function FinanceSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const selected = financeSections.find(item => item.slug === section);
  if (!selected) notFound();

  return <FinanceWorkspace section={selected} />;
}
