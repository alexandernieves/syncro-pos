/** A message as WhatsApp would show it: the template with sample values, *bold* rendered. */
export function WhatsAppPreview({ text, vars }: { text: string; vars: Record<string, string> }) {
  const rendered = Object.entries(vars).reduce((t, [k, v]) => t.split(`{${k}}`).join(v), text);
  const parts = rendered.split(/(\*[^*\n]+\*)/g);
  return (
    <div className="rounded-xl bg-[#EFEAE2] p-3">
      <div className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#D9FDD3] px-3 py-2 text-[13px] leading-snug text-[#111B21] shadow-sm">
        {parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") ? <strong key={i}>{p.slice(1, -1)}</strong> : <span key={i}>{p}</span>))}
      </div>
    </div>
  );
}
