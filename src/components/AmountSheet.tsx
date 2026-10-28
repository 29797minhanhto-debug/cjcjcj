import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { Delete, X } from "lucide-react";
import { fmt } from "@/lib/cashflow";

export interface SheetOption { id: string; name: string }
export type SheetAccent = "buffer" | "fixed" | "flex";

const ACCENT: Record<SheetAccent, { text: string; bg: string }> = {
  buffer: { text: "text-buffer", bg: "bg-buffer" },
  fixed: { text: "text-fixed", bg: "bg-fixed" },
  flex: { text: "text-flex", bg: "bg-flex" },
};

export function AmountSheet({
  open, title, accent, options, initialOption, onClose, onSubmit, renderExtra,
}: {
  open: boolean;
  title: string;
  accent: SheetAccent;
  options?: SheetOption[] | undefined;
  initialOption?: string | undefined;
  onClose: () => void;
  onSubmit: (amount: number, optionId?: string) => void;
  renderExtra?: ((optionId?: string) => React.ReactNode) | undefined;
}) {
  const [val, setVal] = useState("");
  const [opt, setOpt] = useState<string | undefined>(initialOption);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Reset only when the sheet opens — deleting a payment inside must not jump the selection.
  useEffect(() => {
    if (open) { setVal(""); setOpt(initialOption ?? optionsRef.current?.[0]?.id); }
  }, [open, initialOption]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const n = Number(val || 0);
  const press = (k: string) => {
    if (k === "del") return setVal((v) => v.slice(0, -1));
    setVal((v) => (v + k).replace(/^0+/, "").slice(0, 12));
  };
  const a = ACCENT[accent];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <Button variant="flat" size="flat" aria-label="Đóng" className="absolute inset-0 border-0 bg-overlay" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md animate-in slide-in-from-bottom duration-200 rounded-t-2xl border-[1.5px] border-b-0 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-track" aria-hidden />
        <div className="flex h-10 items-center justify-between">
          <span className={`label-caps ${a.text}`}>{title}</span>
          <Button variant="flat" size="flat" aria-label="Đóng" onClick={onClose} className="-mr-2 flex h-10 w-10 items-center justify-center border-0 bg-transparent text-muted-foreground"><X size={20} /></Button>
        </div>
        <div className={`num mt-1 text-right text-4xl font-semibold leading-tight ${n > 0 ? a.text : "text-muted-foreground"}`}>{fmt(n)}</div>
        {options && options.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {options.map((o) => (
              <Button variant="flat" size="flat" key={o.id} onClick={() => setOpt(o.id)}
                className={`h-9 whitespace-normal rounded-lg px-3 text-sm ${opt === o.id ? `${a.bg} font-semibold text-accent-foreground` : "bg-background text-foreground"}`}>
                {o.name}
              </Button>
            ))}
          </div>
        )}
        {renderExtra?.(opt)}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"].map((k) => (
            <Button variant="flat" size="flat" key={k} aria-label={k === "del" ? "Xoá số" : undefined} onClick={() => press(k)}
              className="num flex h-14 items-center justify-center rounded-lg bg-background text-xl font-medium active:bg-muted">
              {k === "del" ? <Delete size={22} /> : k}
            </Button>
          ))}
        </div>
        <Button variant="flat" size="flat" disabled={n <= 0 || (options && !opt)} onClick={() => { onSubmit(n, opt); onClose(); }}
          className={`mt-3 h-14 w-full rounded-lg text-base font-bold tracking-wide text-accent-foreground disabled:opacity-40 ${a.bg}`}>
          XÁC NHẬN
        </Button>
      </div>
    </div>
  );
}
