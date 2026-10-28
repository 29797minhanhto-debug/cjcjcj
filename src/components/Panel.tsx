import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { X } from "lucide-react";

/** Bottom sheet window shared by the history and stats panels. */
export function Panel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <Button variant="flat" size="flat" aria-label="Đóng" className="absolute inset-0 border-0 bg-overlay" onClick={onClose} />
      <div className="relative mx-auto flex max-h-[90vh] w-full max-w-md animate-in slide-in-from-bottom duration-200 flex-col rounded-t-2xl border-[1.5px] border-b-0 bg-card pt-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-track" aria-hidden />
        <div className="flex h-10 items-center justify-between px-4">
          <span className="label-caps">{title}</span>
          <Button variant="flat" size="flat" aria-label="Đóng" onClick={onClose} className="-mr-2 flex h-10 w-10 items-center justify-center border-0 bg-transparent text-muted-foreground"><X size={20} /></Button>
        </div>
        <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** Inline editor for an amount + date/time, used by history rows and balance points. */
export function EntryEditor({ amount, at, onSave, onDelete, onCancel, saveLabel = "LƯU" }: {
  amount: string; at: string;
  onSave: (amount: number, at: string) => void;
  onDelete?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  return (
    <form
      className="grid grid-cols-2 gap-2 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const n = Number(String(f.get("amount")).replace(/\D/g, ""));
        const t = String(f.get("at"));
        if (n > 0 && t) onSave(n, t);
      }}
    >
      <input name="amount" inputMode="numeric" defaultValue={amount} placeholder="Số tiền" aria-label="Số tiền" className="field num col-span-2" />
      <input name="at" type="datetime-local" defaultValue={at} aria-label="Ngày giờ" className="field col-span-2" required />
      <Button variant="flat" size="flat" type="submit" className={`h-11 rounded-lg bg-buffer font-bold text-accent-foreground ${onDelete || onCancel ? "" : "col-span-2"}`}>{saveLabel}</Button>
      {onDelete ? (
        <Button variant="flat" size="flat" type="button" onClick={onDelete} className="h-11 rounded-lg bg-background font-bold text-destructive">XOÁ</Button>
      ) : onCancel ? (
        <Button variant="flat" size="flat" type="button" onClick={onCancel} className="h-11 rounded-lg bg-background font-bold text-muted-foreground">HUỶ</Button>
      ) : null}
    </form>
  );
}
