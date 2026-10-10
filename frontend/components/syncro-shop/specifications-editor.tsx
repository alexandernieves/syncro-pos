"use client";

import { IconPlus, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Specification = { label: string; value: string };

const SUGGESTIONS = ["Marca", "Material", "Medidas", "Peso", "Color", "Contenido", "Origen", "Garantía"];
const MAX_SPECS = 30;

type SpecificationsEditorProps = {
  value: Specification[];
  onChange: (value: Specification[]) => void;
};

/** Editable "feature: value" list shown as the specifications table in Syncro Shop. */
export function SpecificationsEditor({ value, onChange }: SpecificationsEditorProps) {
  const update = (index: number, field: keyof Specification, text: string) => {
    onChange(value.map((spec, i) => (i === index ? { ...spec, [field]: text } : spec)));
  };
  const add = (label = "") => {
    if (value.length >= MAX_SPECS) return;
    onChange([...value, { label, value: "" }]);
  };
  const unusedSuggestions = SUGGESTIONS.filter(
    (s) => !value.some((spec) => spec.label.trim().toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Agrega datos como material, medidas o garantía. Se muestran como tabla en la ficha del producto en Syncro Shop.
        </p>
      )}

      {value.map((spec, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={spec.label}
            onChange={(e) => update(index, "label", e.target.value)}
            placeholder="Característica"
            className="h-9 text-xs font-semibold bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background w-2/5"
          />
          <Input
            value={spec.value}
            onChange={(e) => update(index, "value", e.target.value)}
            placeholder="Valor"
            className="h-9 text-xs bg-muted/20 border-transparent focus:border-primary/20 focus:bg-background flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-rose-500"
            title="Quitar"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <IconX size={14} />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add()}
          disabled={value.length >= MAX_SPECS}
          className="h-7 gap-1 text-[11px] font-semibold border-primary/20 hover:bg-primary/5"
        >
          <IconPlus size={12} /> Agregar
        </Button>
        {unusedSuggestions.slice(0, 5).map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => add(label)}
            className="h-7 px-2.5 rounded-md border border-dashed text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}
