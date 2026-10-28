import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EntryEditor, Panel } from "@/components/Panel";
import {
  fmt, fromDateInput, fromDateTimeInput, inRange, rangeTotals, removeLog, toDateInput, toDateTimeInput, updateLog, type AppState,
} from "@/lib/cashflow";
import { setState } from "@/lib/store";

export function HistoryPanel({ open, state, onClose }: { open: boolean; state: AppState; onClose: () => void }) {
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [editing, setEditing] = useState<string | null>(null);
  const d = fromDateInput(day);
  const list = useMemo(() => state.log.filter((l) => inRange(l.at, d, d)), [state.log, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = rangeTotals(list, d, d);
  const shift = (n: number) => { const x = fromDateInput(day); x.setDate(x.getDate() + n); setDay(toDateInput(x)); setEditing(null); };

  return (
    <Panel open={open} title="Lịch sử thu chi" onClose={onClose}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <Button variant="flat" size="flat" aria-label="Ngày trước" onClick={() => shift(-1)} className="flex h-11 w-11 items-center justify-center rounded-lg bg-background text-muted-foreground"><ChevronLeft size={20} /></Button>
        <input type="date" value={day} onChange={(e) => { if (e.target.value) { setDay(e.target.value); setEditing(null); } }} aria-label="Chọn ngày" className="field text-center" />
        <Button variant="flat" size="flat" aria-label="Ngày sau" onClick={() => shift(1)} className="flex h-11 w-11 items-center justify-center rounded-lg bg-background text-muted-foreground"><ChevronRight size={20} /></Button>
      </div>

      <div className="mt-3 flex justify-between text-sm">
        <span>Thu <span className="num font-semibold text-buffer">+{fmt(t.income)}</span></span>
        <span>Chi <span className="num font-semibold text-fixed">−{fmt(t.expense)}</span></span>
      </div>

      <div className="stripe stripe-neutral mt-3 min-h-24">
        {list.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Không có giao dịch trong ngày này</div>}
        {list.map((l) => (
          <div key={l.id} className="border-b border-border last:border-b-0">
            <Button variant="flat" size="flat" onClick={() => setEditing(editing === l.id ? null : l.id)}
              className="flex h-12 w-full items-center justify-between gap-3 whitespace-normal border-0 bg-transparent p-0 text-left">
              <span className="min-w-0">
                <span className="block truncate">{l.label}</span>
                <span className="num text-xs text-muted-foreground">{new Date(l.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              <span className={`num shrink-0 font-semibold ${l.kind === "income" ? "text-buffer" : "text-fixed"}`}>{l.kind === "income" ? "+" : "−"}{fmt(l.amount)}</span>
            </Button>
            {editing === l.id && (
              <EntryEditor
                key={l.id + l.at + l.amount}
                amount={String(l.amount)}
                at={toDateTimeInput(new Date(l.at))}
                onSave={(n, at) => { setState((s) => updateLog(s, l.id, { amount: n, at: fromDateTimeInput(at).toISOString() })); setEditing(null); }}
                onDelete={() => { setState((s) => removeLog(s, l.id)); setEditing(null); }}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Sửa hoặc xoá khoản thu sẽ cập nhật Quỹ Đệm; khoản chi của chu kỳ đang chạy cũng được cập nhật theo.</p>
    </Panel>
  );
}
