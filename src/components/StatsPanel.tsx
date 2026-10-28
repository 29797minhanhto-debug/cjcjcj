import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EntryEditor, Panel } from "@/components/Panel";
import {
  fmt, fmtDate, fromDateInput, fromDateTimeInput, inRange, rangeTotals, removeBalance, toDateInput, toDateTimeInput, upsertBalance, type AppState,
} from "@/lib/cashflow";
import { setState } from "@/lib/store";

const monthStart = () => { const d = new Date(); return toDateInput(new Date(d.getFullYear(), d.getMonth(), 1)); };

function RangePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-muted-foreground">Từ ngày
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && onChange(e.target.value, to)} className="field mt-1" />
      </label>
      <label className="text-xs text-muted-foreground">Đến ngày
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && onChange(from, e.target.value)} className="field mt-1" />
      </label>
    </div>
  );
}

export function StatsPanel({ open, state, onClose }: { open: boolean; state: AppState; onClose: () => void }) {
  const [range, setRange] = useState(() => ({ from: monthStart(), to: toDateInput(new Date()) }));
  const [balRange, setBalRange] = useState(() => ({ from: monthStart(), to: toDateInput(new Date()) }));
  const [editing, setEditing] = useState<string | null>(null);

  const t = rangeTotals(state.log, fromDateInput(range.from), fromDateInput(range.to));
  const points = useMemo(
    () => state.balances.filter((b) => inRange(b.at, fromDateInput(balRange.from), fromDateInput(balRange.to))),
    [state.balances, balRange],
  );
  const data = points.map((p) => ({ t: new Date(p.at).getTime(), v: p.amount }));
  const first = points[0], last = points[points.length - 1];
  const change = first && last ? last.amount - first.amount : 0;

  return (
    <Panel open={open} title="Thống kê" onClose={onClose}>
      <RangePicker from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="stripe stripe-buffer rounded-lg bg-background p-3">
          <div className="label-caps">Tổng thu</div>
          <div className="num mt-1 text-xl font-semibold text-buffer">{fmt(t.income)}</div>
        </div>
        <div className="stripe stripe-fixed rounded-lg bg-background p-3">
          <div className="label-caps">Tổng chi</div>
          <div className="num mt-1 text-xl font-semibold text-fixed">{fmt(t.expense)}</div>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-muted-foreground">Chênh lệch</span>
        <span className={`num font-semibold ${t.income - t.expense < 0 ? "text-destructive" : ""}`}>{fmt(t.income - t.expense)}</span>
      </div>

      <div className="mt-6 flex h-10 items-center justify-between">
        <span className="label-caps">Tổng số dư</span>
        <Button variant="flat" size="flat" aria-label="Thêm số dư" onClick={() => setEditing(editing === "new" ? null : "new")}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-buffer text-accent-foreground"><Plus size={18} strokeWidth={2.5} /></Button>
      </div>
      {editing === "new" && (
        <EntryEditor
          amount=""
          at={toDateTimeInput(new Date())}
          saveLabel="THÊM"
          onSave={(n, at) => { setState((s) => upsertBalance(s, { amount: n, at: fromDateTimeInput(at).toISOString() })); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      )}
      <RangePicker from={balRange.from} to={balRange.to} onChange={(from, to) => setBalRange({ from, to })} />

      {last ? (
        <div className="mt-3 flex items-end justify-between">
          <span className="num text-2xl font-semibold">{fmt(last.amount)}</span>
          <span className={`num text-sm ${change < 0 ? "text-destructive" : "text-buffer"}`}>{change >= 0 ? "+" : ""}{fmt(change)}</span>
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-muted-foreground">Chưa có số dư trong khoảng này — bấm + để nhập</div>
      )}

      {data.length > 1 && (
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-buffer)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-buffer)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v) => new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Số dư"]}
                labelFormatter={(v: number) => fmtDate(new Date(v))}
                contentStyle={{ background: "var(--color-card)", border: "1.5px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="v" stroke="var(--color-buffer)" strokeWidth={2} fill="url(#balFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="stripe stripe-neutral mt-3">
        {[...points].reverse().map((p) => (
          <div key={p.id} className="border-b border-border last:border-b-0">
            <Button variant="flat" size="flat" onClick={() => setEditing(editing === p.id ? null : p.id)}
              className="flex h-11 w-full items-center justify-between gap-3 border-0 bg-transparent p-0 text-left">
              <span className="num text-sm text-muted-foreground">{fmtDate(p.at)} {new Date(p.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="num font-semibold">{fmt(p.amount)}</span>
            </Button>
            {editing === p.id && (
              <EntryEditor
                key={p.id + p.at + p.amount}
                amount={String(p.amount)}
                at={toDateTimeInput(new Date(p.at))}
                onSave={(n, at) => { setState((s) => upsertBalance(s, { id: p.id, amount: n, at: fromDateTimeInput(at).toISOString() })); setEditing(null); }}
                onDelete={() => { setState((s) => removeBalance(s, p.id)); setEditing(null); }}
              />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
