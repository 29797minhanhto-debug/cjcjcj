import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Plus, Settings, X } from "lucide-react";
import { AmountSheet } from "@/components/AmountSheet";
import {
  addSpend, closeCycle, cycleEnd, cycleRemainingDays, cycleStats, fmt, fmtDate, itemSpent, planCycle, removeSpend, startCycle, sum,
  type CycleItem,
} from "@/lib/cashflow";
import { setState, useAppState } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dòng Tiền — Quỹ đệm & chu kỳ" },
      { name: "description", content: "Quản lý dòng tiền cá nhân theo chu kỳ từ Quỹ Đệm." },
      { property: "og:title", content: "Dòng Tiền — Quỹ đệm & chu kỳ" },
      { property: "og:description", content: "Quản lý dòng tiền cá nhân theo chu kỳ từ Quỹ Đệm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

type Kind = "fixed" | "flex";
type SheetState = null | { mode: "income" } | { mode: Kind; item?: string };

function Home() {
  const st = useAppState();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const fixedOptions = useMemo(() => st?.cycle?.fixed.map((f) => ({ id: f.id, name: f.name })) ?? [], [st?.cycle]);
  const flexOptions = useMemo(() => st?.cycle?.flex.map((f) => ({ id: f.id, name: f.name })) ?? [], [st?.cycle]);
  const close = useCallback(() => setSheet(null), []);

  if (!st) return <div className="min-h-screen bg-background" />;
  const c = st.cycle;
  const stats = c ? cycleStats(c) : null;
  const plan = c ? null : planCycle(st.settings);
  const g = st.settings.groupNames;
  const kind: Kind | null = sheet && sheet.mode !== "income" ? sheet.mode : null;

  const spendList = (k: Kind) => (id?: string) => {
    const item = c?.[k].find((f) => f.id === id);
    if (!item || item.spends.length === 0) return null;
    return (
      <div className="mt-3 max-h-32 overflow-y-auto">
        {item.spends.map((sp, i) => (
          <div key={sp.at + i} className="flex h-9 items-center justify-between text-sm">
            <span className="text-muted-foreground">{new Date(sp.at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</span>
            <span className="flex items-center gap-1">
              <span className="num">{fmt(sp.amount)}</span>
              <Button variant="flat" size="flat" aria-label="Xoá lần chi" className="-mr-2 flex h-9 w-9 items-center justify-center border-0 bg-transparent text-muted-foreground" onClick={() => setState((s) => removeSpend(s, k, item.id, i))}><X size={16} /></Button>
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex h-12 items-center justify-between">
        <h1 className="text-lg font-bold">Dòng Tiền</h1>
        <Link to="/settings" aria-label="Cài đặt" className="card-flat flex h-10 w-10 items-center justify-center text-muted-foreground"><Settings size={20} /></Link>
      </header>

      {/* Quỹ Đệm */}
      <section className="card-flat mt-3 p-4">
        <div className="stripe stripe-buffer flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="label-caps">Quỹ Đệm</div>
            <div className={`num mt-0.5 text-3xl font-semibold leading-tight ${st.buffer < 0 ? "text-destructive" : ""}`}>{fmt(st.buffer)}</div>
          </div>
          <Button variant="flat" size="flat"
            aria-label="Nạp Quỹ Đệm"
            onClick={() => setSheet({ mode: "income" })}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-buffer text-accent-foreground"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Button>
        </div>
      </section>

      {/* Chu kỳ */}
      <section className="card-flat mt-3 p-4">
        <div className="flex items-center justify-between">
          {c ? (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Kết thúc: </span>
                <span className="num font-semibold text-foreground">{fmtDate(cycleEnd(c.start, c.days))}</span>
              </div>
              <div className="num text-sm text-muted-foreground">
                Còn <span className="font-semibold text-foreground">{cycleRemainingDays(c)}</span> ngày
              </div>
            </>
          ) : (
            <>
              <div className="label-caps">Kế hoạch</div>
              <div className="num text-sm text-muted-foreground">{st.settings.cycleDays} ngày</div>
            </>
          )}
        </div>

        {c && stats ? (
          <>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className={`num text-2xl font-semibold leading-tight ${stats.remaining < 0 ? "text-destructive" : ""}`}>{fmt(stats.remaining)}</div>
              <div className="num pb-0.5 text-sm text-muted-foreground">{fmt(stats.spent)} / {fmt(stats.budget)}</div>
            </div>
            <Bar value={stats.spent} max={stats.budget} color="bg-buffer" />

            <Group
              title={g.fixed}
              stripe="stripe-fixed"
              color="text-fixed"
              total={`${fmt(stats.fixedPaid)} / ${fmt(stats.fixedBudget)}`}
              action={<AddBtn label={`Ghi chi ${g.fixed}`} bg="bg-fixed" onClick={() => setSheet({ mode: "fixed" })} />}
            >
              {c.fixed.map((f) => (
                <FixedRow key={f.id} item={f}
                  onOpen={() => setSheet({ mode: "fixed", item: f.id })}
                />
              ))}
            </Group>

            <Group
              title={g.flex}
              stripe="stripe-flex"
              color="text-flex"
              total={`${fmt(stats.flexSpent)} / ${fmt(stats.flexBudget)}`}
              action={<AddBtn label={`Ghi chi ${g.flex}`} bg="bg-flex" onClick={() => setSheet({ mode: "flex" })} />}
            >
              {c.flex.map((f) => {
                const spent = itemSpent(f);
                return (
                  <Button variant="flat" size="flat"
                    key={f.id}
                    onClick={() => setSheet({ mode: "flex", item: f.id })}
                    className="block w-full whitespace-normal border-0 bg-transparent py-2.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{f.name}</span>
                      <Amounts spent={spent} budget={f.budget} />
                    </div>
                    <Bar value={spent} max={f.budget} color="bg-flex" thin />
                  </Button>
                );
              })}
            </Group>

            <Group title={g.saving} stripe="stripe-saving" color="text-saving" total={`+${fmt(stats.saved)}`}>
              {c.saving.map((f) => {
                const fund = st.funds.find((x) => x.id === f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">{f.name}</span>
                    <span className="num text-sm"><span className="text-saving">+{fmt(f.amount)}</span><span className="text-muted-foreground"> · {fmt(fund?.amount ?? 0)}</span></span>
                  </div>
                );
              })}
            </Group>

            {confirmClose ? (
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                <Button variant="flat" size="flat"
                  onClick={() => { setState((s) => closeCycle(s)); setConfirmClose(false); }}
                  className="h-14 whitespace-normal rounded-xl bg-buffer px-3 font-bold tracking-wide text-accent-foreground"
                >
                  HOÀN {fmt(stats.remaining)} VỀ ĐỆM
                </Button>
                <Button variant="flat" size="flat"
                  aria-label="Huỷ"
                  onClick={() => setConfirmClose(false)}
                  className="flex h-14 w-14 items-center justify-center rounded-xl bg-background text-muted-foreground"
                >
                  <X size={20} />
                </Button>
              </div>
            ) : (
              <Button variant="flat" size="flat"
                onClick={() => setConfirmClose(true)}
                className="mt-5 h-14 w-full rounded-xl bg-transparent font-bold tracking-wide text-buffer"
              >
                CHỐT CHU KỲ
              </Button>
            )}
          </>
        ) : plan && (
          <>
            <div className="mt-4 space-y-2.5 text-sm">
              <Row label={g.fixed} value={sum(plan.fixed.map((x) => x.budget))} stripe="stripe-fixed" />
              <Row label={g.flex} value={sum(plan.flex.map((x) => x.budget))} stripe="stripe-flex" />
              <Row label={g.saving} value={sum(plan.saving.map((x) => x.amount))} stripe="stripe-saving" />
              <div className="flex justify-between pt-1 font-semibold"><span>Tổng</span><span className="num">{fmt(plan.total)}</span></div>
            </div>
            <Button variant="flat" size="flat"
              onClick={() => setState((s) => startCycle(s))}
              className="mt-5 h-14 w-full rounded-xl bg-buffer font-bold tracking-wide text-accent-foreground"
            >
              BẮT ĐẦU CHU KỲ
            </Button>
          </>
        )}
      </section>

      {st.history.length > 0 && (
        <section className="card-flat mt-3 p-4">
          <div className="label-caps">Lịch sử</div>
          <div className="stripe stripe-buffer mt-2">
            {st.history.slice(0, 10).map((h) => (
              <div key={h.end} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span className="text-muted-foreground">{new Date(h.start).toLocaleDateString("vi-VN")} – {new Date(h.end).toLocaleDateString("vi-VN")}</span>
                <span className="num">{fmt(h.spent)} <span className="text-buffer">↩ {fmt(h.returned)}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AmountSheet
        open={sheet?.mode === "income"}
        title="Nạp Quỹ Đệm"
        accent="buffer"
        onClose={close}
        onSubmit={(n) => setState((s) => ({ ...s, buffer: s.buffer + n, incomes: [{ amount: n, at: new Date().toISOString() }, ...s.incomes] }))}
      />

      <AmountSheet
        open={kind !== null}
        title={kind === "fixed" ? g.fixed : g.flex}
        accent={kind ?? "flex"}
        options={kind === "fixed" ? fixedOptions : flexOptions}
        initialOption={sheet && sheet.mode !== "income" ? sheet.item : undefined}
        onClose={close}
        onSubmit={(n, id) => kind && id && setState((s) => addSpend(s, kind, id, n))}
        renderExtra={kind ? spendList(kind) : undefined}
      />
    </main>
  );
}

function FixedRow({ item, onOpen }: { item: CycleItem; onOpen: () => void }) {
  const spent = itemSpent(item);
  const done = spent >= item.budget;
  return (
    <div className="py-2.5">
      <Button variant="flat" size="flat" onClick={onOpen} className="block w-full min-w-0 whitespace-normal border-0 bg-transparent p-0 text-left">
        <div className="flex h-6 items-center justify-between gap-3">
          <span className={`min-w-0 truncate ${done ? "text-muted-foreground line-through" : ""}`}>{item.name}</span>
          <Amounts spent={spent} budget={item.budget} muted={done} />
        </div>
        <Bar value={spent} max={item.budget} color="bg-fixed" thin />
      </Button>
    </div>
  );
}

function Amounts({ spent, budget, muted }: { spent: number; budget: number; muted?: boolean }) {
  return (
    <span className="num shrink-0 text-sm">
      <span className={spent > budget ? "text-destructive" : muted ? "text-muted-foreground" : ""}>{fmt(spent)}</span>
      <span className="text-muted-foreground"> / {fmt(budget)}</span>
    </span>
  );
}

function AddBtn({ label, bg, onClick }: { label: string; bg: string; onClick: () => void }) {
  return (
    <Button variant="flat" size="flat" aria-label={label} onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg} text-accent-foreground`}>
      <Plus size={18} strokeWidth={2.5} />
    </Button>
  );
}

function Group({ title, color, stripe, total, action, children }: { title: string; color: string; stripe: string; total: string; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`stripe ${stripe} mt-4`}>
      <div className="flex h-10 items-center justify-between gap-2">
        <Button variant="flat" size="flat" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-10 min-w-0 flex-1 items-center gap-2 whitespace-normal border-0 bg-transparent p-0 text-left">
          <ChevronDown size={16} className={`shrink-0 ${color} transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className={`label-caps truncate ${color}`}>{title}</span>
        </Button>
        <div className="flex items-center gap-3"><span className="num text-xs text-muted-foreground">{total}</span>{action}</div>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

function Bar({ value, max, color, thin }: { value: number; max: number; color: string; thin?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`mt-2 w-full overflow-hidden rounded-full bg-track ${thin ? "h-1" : "h-1.5"}`}>
      <div className={`h-full rounded-full ${value > max ? "bg-destructive" : color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Row({ label, value, stripe }: { label: string; value: number; stripe: string }) {
  return (
    <div className={`stripe ${stripe} flex justify-between`}><span className="text-muted-foreground">{label}</span><span className="num">{fmt(value)}</span></div>
  );
}
