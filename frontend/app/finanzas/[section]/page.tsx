import { notFound } from "next/navigation";
import { financeSections } from "@/lib/central-finance-navigation";
import FinanceApp from "../finance-app";

export function generateStaticParams() {
  return financeSections.map(({ slug }) => ({ section: slug }));
}

export default async function FinanceAppSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const selected = financeSections.find(item => item.slug === section);
  if (!selected) notFound();
  return <FinanceApp section={selected} />;
}
