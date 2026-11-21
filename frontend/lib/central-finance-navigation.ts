export const financeGroups = [
  {
    title: "Contabilidad",
    workspace: "company",
    sections: [
      { slug: "libro-diario", title: "Libro diario", tab: "Libro diario" },
      { slug: "estados-financieros", title: "Estados financieros", tab: "Estados financieros" },
    ],
  },
  {
    title: "Finanzas",
    workspace: "company",
    sections: [
      { slug: "tesoreria", title: "Tesorería", tab: "Resumen" },
      { slug: "presupuesto-empresa", title: "Presupuesto de empresa", tab: "Presupuesto" },
      { slug: "deudas-empresa", title: "Deudas de empresa", tab: "Deudas" },
    ],
  },
  {
    title: "Mis finanzas",
    workspace: "personal",
    sections: [
      { slug: "resumen-personal", title: "Resumen personal", tab: "Resumen" },
      { slug: "gastos-personales", title: "Gastos", tab: "Gastos" },
      { slug: "presupuesto-personal", title: "Presupuesto", tab: "Presupuesto" },
      { slug: "movimientos-personales", title: "Movimientos", tab: "Libro diario" },
      { slug: "deudas-personales", title: "Deudas", tab: "Deudas" },
    ],
  },
] as const;

export const financeSections = financeGroups.flatMap(group =>
  group.sections.map(section => ({ ...section, workspace: group.workspace, group: group.title })),
);

export type FinanceSection = (typeof financeSections)[number];

export function financeUrl(slug: string) {
  return "/dashboard/syncro/finanzas/" + slug;
}
