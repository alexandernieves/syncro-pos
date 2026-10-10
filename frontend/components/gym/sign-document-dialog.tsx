"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoader2, IconPrinter } from "@tabler/icons-react";
import { toast } from "sonner";
import { gymApi } from "@/lib/gym";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad, type SignaturePadHandle } from "@/components/gym/signature-pad";

/** The member reads the document on the reception screen and signs it there. */
export function SignDocumentDialog({ memberId, templateId, onClose, onSigned }: { memberId: string; templateId: string | null; onClose: () => void; onSigned: () => void }) {
  const [doc, setDoc] = useState<{ title: string; version: number; body: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    setDoc(null);
    setAccepted(false);
    setEmpty(true);
    if (templateId) gymApi<{ title: string; version: number; body: string }>(`/members/${memberId}/documents/${templateId}`).then(setDoc).catch((e) => toast.error(e.message));
  }, [memberId, templateId]);

  const sign = async () => {
    const signature = pad.current?.toDataURL();
    if (!signature || !templateId) return;
    setSaving(true);
    try {
      await gymApi(`/members/${memberId}/documents/${templateId}/sign`, { method: "POST", json: { signature, accepted } });
      toast.success(`Documento firmado: ${doc?.title}`);
      onSigned();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!templateId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc?.title ?? "Documento"}</DialogTitle>
          <DialogDescription>Que el socio lo lea, marque que lo acepta y firme en la pantalla.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
          {doc ? doc.body : <IconLoader2 className="mx-auto animate-spin text-muted-foreground" />}
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
          Leí el documento y estoy de acuerdo con lo que dice.
        </label>
        <SignaturePad ref={pad} className="h-44" onChange={setEmpty} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={sign} disabled={saving || !doc || !accepted || empty} className="gap-2">{saving && <IconLoader2 size={16} className="animate-spin" />} Firmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Signed = { id: string; title: string; version: number; body: string; signerName: string; signerDocument: string | null; signatureUrl: string; method: string; signedAt: string; member: { memberNumber: number } };

/** A signed copy, as it was accepted, ready to print. */
export function SignedDocumentDialog({ signatureId, onClose }: { signatureId: string | null; onClose: () => void }) {
  const [s, setS] = useState<Signed | null>(null);
  useEffect(() => {
    setS(null);
    if (signatureId) gymApi<Signed>(`/signatures/${signatureId}`).then(setS).catch((e) => toast.error(e.message));
  }, [signatureId]);

  const print = () => {
    if (!s) return;
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(s.title)}</title><style>body{font:14px/1.6 system-ui,sans-serif;max-width:640px;margin:40px auto;color:#111}h1{font-size:20px}p{white-space:pre-wrap}.sig{margin-top:40px;border-top:1px solid #ccc;padding-top:12px}img{max-height:110px}small{color:#666}</style></head><body><h1>${esc(s.title)}</h1><p>${esc(s.body)}</p><div class="sig"><img src="${s.signatureUrl}" alt=""><div>${esc(s.signerName)}${s.signerDocument ? ` · ${esc(s.signerDocument)}` : ""}</div><small>Firmado el ${new Date(s.signedAt).toLocaleString("es-VE")} · versión ${s.version} · ${s.method === "PORTAL" ? "desde la app del socio" : "en recepción"} · socio n.º ${s.member.memberNumber}</small></div><script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={!!signatureId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s?.title ?? "Documento firmado"}</DialogTitle>
          {s && <DialogDescription>Versión {s.version} · firmado el {new Date(s.signedAt).toLocaleString("es-VE", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })} {s.method === "PORTAL" ? "desde la app" : "en recepción"}</DialogDescription>}
        </DialogHeader>
        {s ? (
          <>
            <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">{s.body}</div>
            <div className="flex items-end gap-4">
              <img src={s.signatureUrl} alt="Firma" className="h-24 rounded-lg bg-white p-2 ring-1 ring-border" />
              <div className="text-sm">
                <p className="font-medium">{s.signerName}</p>
                {s.signerDocument && <p className="text-muted-foreground">{s.signerDocument}</p>}
              </div>
            </div>
          </>
        ) : (
          <IconLoader2 className="mx-auto animate-spin text-muted-foreground" />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={print} disabled={!s} className="gap-2"><IconPrinter size={16} /> Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
