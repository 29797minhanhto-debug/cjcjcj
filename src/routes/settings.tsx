import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import {
  cycleEnd, emptySettings, fmt, fmtDate, fromBackup, fromDateInput, resetData, setInitialBuffer, setSavingInitial, toBackup, toDateInput, uid,
  type BudgetItem, type Settings,
  defaultState,
} from "@/lib/cashflow";
import { setState, useAppState } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Cài đặt — Dòng Tiền" },
      { name: "description", content: "Tuỳ chỉnh nhóm, định mức, tỷ lệ tích lũy, chu kỳ và sao lưu." },
      { property: "og:title", content: "Cài đặt — Dòng Tiền" },
      { property: "og:description", content: "Tuỳ chỉnh nhóm, định mức, tỷ lệ tích lũy, chu kỳ và sao lưu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const ROW = "grid grid-cols-[minmax(0,1fr)_7rem_2.75rem] items-center gap-2";

function SettingsPage() {
  const st = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState<null | "reset" | "wipe">(null);
  if (!st) return <div className="min-h-screen bg-background" />;
  const s = st.settings;

  const upd = (fn: (s: Settings) => Settings) => setState((a) => ({ ...a, settings: fn(a.settings) }));
  const updItems = (key: "fixed" | "flex", fn: (l: BudgetItem[]) => BudgetItem[]) => upd((x) => ({ ...x, [key]: fn(x[key]) }));
  const setGroupName = (k: keyof Settings["groupNames"], v: string) => upd((x) => ({ ...x, groupNames: { ...x.groupNames, [k]: v } }));

  // Cập nhật số ngày: đồng bộ cả cài đặt và chu kỳ đang chạy để ngày kết thúc cập nhật ngay
  const setCycleDays = (days: number) => {
    const d = Math.max(1, days);
    setState((a) => ({
      ...a,
      settings: { ...a.settings, cycleDays: d },
      cycle: a.cycle ? { ...a.cycle, days: d } : null,
    }));
  };

  // Cập nhật ngày bắt đầu: đồng bộ ngay để tính lại ngày kết thúc lập tức
  const setStartDate = (dateStr: string) => {
    const d = fromDateInput(dateStr);
    setState((a) => ({
      ...a,
      settings: { ...a.settings, nextCycleStart: dateStr },
      cycle: a.cycle ? { ...a.cycle, start: d.toISOString() } : null,
    }));
  };

  const activeDays = st.cycle ? st.cycle.days : s.cycleDays;
  const activeStartDate = st.cycle
    ? toDateInput(new Date(st.cycle.start))
    : (s.nextCycleStart || toDateInput(new Date()));
  const activeEndDate = fmtDate(cycleEnd(fromDateInput(activeStartDate), activeDays));

  const exportBackup = () => {
    const text = JSON.stringify(toBackup(st), null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dongtien-saoluu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Đã xuất tệp sao lưu");
  };
  const importBackup = async (f: File) => {
    try {
      const next = fromBackup(JSON.parse(await f.text()));
      setState(() => next);
      setMsg("Đã khôi phục");
    } catch {
      setMsg("Tệp không hợp lệ");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex h-12 items-center gap-3">
        <Link to="/" aria-label="Quay lại" className="card-flat flex h-10 w-10 items-center justify-center text-muted-foreground"><ArrowLeft size={20} /></Link>
        <h1 className="text-lg font-bold">Cài đặt</h1>
      </header>

      <Card title="Chu kỳ & Quỹ Đệm" stripe="stripe-buffer" color="text-buffer">
        <Field label="Số ngày chu kỳ">
          <NumInput value={activeDays} onChange={setCycleDays} />
        </Field>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Ngày bắt đầu</span>
            <input
              type="date"
              className="field w-full text-sm"
              value={activeStartDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
            />
          </label>
          <div>
            <span className="mb-1 block text-sm text-muted-foreground">Ngày kết thúc</span>
            <div className="num py-2 text-sm font-semibold">{activeEndDate}</div>
          </div>
        </div>

        <Field label="Số dư ban đầu Quỹ Đệm" hint={`Hiện có ${fmt(st.buffer)}`}>
          <NumInput value={s.initialBuffer} onChange={(v) => setState((a) => setInitialBuffer(a, v))} />
        </Field>
      </Card>

      <Card title={s.groupNames.fixed} stripe="stripe-fixed" color="text-fixed">
        <Field label="Tên nhóm"><input className="field" value={s.groupNames.fixed} onChange={(e) => setGroupName("fixed", e.target.value)} /></Field>
        <ItemList k="fixed" color="text-fixed" s={s} updItems={updItems} />
      </Card>

      <Card title={s.groupNames.flex} stripe="stripe-flex" color="text-flex">
        <Field label="Tên nhóm"><input className="field" value={s.groupNames.flex} onChange={(e) => setGroupName("flex", e.target.value)} /></Field>
        <ItemList k="flex" color="text-flex" s={s} updItems={updItems} />
      </Card>

      <Card title={s.groupNames.saving} stripe="stripe-saving" color="text-saving">
        <Field label="Tên nhóm"><input className="field" value={s.groupNames.saving} onChange={(e) => setGroupName("saving", e.target.value)} /></Field>
        <div className="space-y-2">
          <ColHead left="Tên quỹ" right="Tỷ lệ" />
          <div className="space-y-4">
          {s.saving.map((it) => {
            const fund = st.funds.find((f) => f.id === it.id);
            return (
              <div key={it.id} className="space-y-2">
                <div className={ROW}>
                  <input className="field" aria-label="Tên quỹ" value={it.name} onChange={(e) => upd((x) => ({ ...x, saving: x.saving.map((y) => y.id === it.id ? { ...y, name: e.target.value } : y) }))} />
                  <div className="relative">
                    <NumInput label="Tỷ lệ phần trăm" className="pr-7" value={it.percent} onChange={(v) => upd((x) => ({ ...x, saving: x.saving.map((y) => y.id === it.id ? { ...y, percent: Math.min(99, v) } : y) }))} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">%</span>
                  </div>
                  <TrashBtn onClick={() => upd((x) => ({ ...x, saving: x.saving.filter((y) => y.id !== it.id) }))} />
                </div>
                <div className={ROW}>
                  <div className="min-w-0 pl-1 leading-tight">
                    <div className="text-sm text-muted-foreground">Số dư ban đầu</div>
                    <div className="num truncate text-xs text-muted-foreground/80">Hiện có <span className="text-saving">{fmt(fund?.amount ?? 0)}</span></div>
                  </div>
                  <NumInput label={`Số dư ban đầu ${it.name}`} value={it.initial} onChange={(v) => setState((a) => setSavingInitial(a, it.id, v))} />
                </div>
              </div>
            );
          })}
          </div>
          <AddBtn color="text-saving" onClick={() => upd((x) => ({ ...x, saving: [...x.saving, { id: uid(), name: "Quỹ mới", percent: 0, initial: 0 }] }))} />
        </div>
      </Card>

      <Card title="Sao lưu" stripe="stripe-neutral" color="text-foreground">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="flat" size="flat" onClick={exportBackup} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-buffer px-2 font-semibold text-accent-foreground"><Download size={18} /> Xuất</Button>
          <Button variant="flat" size="flat" onClick={() => fileRef.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-background px-2 font-semibold"><Upload size={18} /> Khôi phục</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); }} />
        {confirm === "reset" ? (
          <div className="space-y-2 rounded-lg bg-background p-3 text-sm">
            <p className="font-semibold text-destructive">Khôi phục về dữ liệu mẫu?</p>
            <p className="text-xs text-muted-foreground">Toàn bộ chi tiêu hiện tại và lịch sử sẽ được tạo lại theo cài đặt ban đầu.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="flat" size="flat" onClick={() => { setState(() => defaultState()); setConfirm(null); setMsg("Đã khôi phục dữ liệu mẫu"); }} className="h-9 flex-1 rounded bg-destructive text-xs font-semibold text-destructive-foreground">Đồng ý</Button>
              <Button variant="flat" size="flat" onClick={() => setConfirm(null)} className="h-9 flex-1 rounded bg-secondary text-xs">Huỷ</Button>
            </div>
          </div>
        ) : confirm === "wipe" ? (
          <div className="space-y-2 rounded-lg bg-background p-3 text-sm">
            <p className="font-semibold text-destructive">Xoá toàn bộ dữ liệu?</p>
            <p className="text-xs text-muted-foreground">Toàn bộ ngân sách, số dư và chu kỳ sẽ về 0. Hãy sao lưu trước.</p>
            <div className="flex gap-2 pt-1">
              <Button variant="flat" size="flat" onClick={() => { setState(() => resetData(emptySettings())); setConfirm(null); setMsg("Đã xoá toàn bộ dữ liệu"); }} className="h-9 flex-1 rounded bg-destructive text-xs font-semibold text-destructive-foreground">Đồng ý</Button>
              <Button variant="flat" size="flat" onClick={() => setConfirm(null)} className="h-9 flex-1 rounded bg-secondary text-xs">Huỷ</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="flat" size="flat" onClick={() => setConfirm("reset")} className="flex min-h-12 items-center justify-center gap-2 whitespace-normal rounded-lg bg-background px-2 py-2 text-sm font-semibold leading-tight"><RotateCcw size={18} className="shrink-0" /> Khởi tạo lại dữ liệu</Button>
            <Button variant="flat" size="flat" onClick={() => setConfirm("wipe")} className="flex min-h-12 items-center justify-center gap-2 whitespace-normal rounded-lg border-destructive bg-transparent px-2 py-2 text-sm font-semibold leading-tight text-destructive"><Trash2 size={18} className="shrink-0" /> Xoá toàn bộ</Button>
          </div>
        )}
        {msg && <div className="text-center text-sm text-muted-foreground" role="status">{msg}</div>}
      </Card>
    </main>
  );
}

function ItemList({ k, color, s, updItems }: { k: "fixed" | "flex"; color: string; s: Settings; updItems: (key: "fixed" | "flex", fn: (l: BudgetItem[]) => BudgetItem[]) => void }) {
  return (
    <div className="space-y-2">
      <ColHead left="Tên mục" right="Định mức" />
      <div className="space-y-2">
        {s[k].map((it) => (
          <div key={it.id} className={ROW}>
            <input className="field" aria-label="Tên mục" value={it.name} onChange={(e) => updItems(k, (l) => l.map((x) => x.id === it.id ? { ...x, name: e.target.value } : x))} />
            <NumInput label={`Định mức ${it.name}`} value={it.amount} onChange={(v) => updItems(k, (l) => l.map((x) => x.id === it.id ? { ...x, amount: v } : x))} />
            <TrashBtn onClick={() => updItems(k, (l) => l.filter((x) => x.id !== it.id))} />
          </div>
        ))}
        <AddBtn color={color} onClick={() => updItems(k, (l) => [...l, { id: uid(), name: "Mục mới", amount: 0 }])} />
      </div>
    </div>
  );
}

function ColHead({ left, right }: { left: string; right: string }) {
  return (
    <div className={`${ROW} -mt-1 text-xs leading-none text-muted-foreground`}>
      <span className="pl-1">{left}</span>
      <span className="pr-1 text-right">{right}</span>
      <span />
    </div>
  );
}

function TrashBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="flat" size="flat" aria-label="Xoá" className="icon-btn" onClick={onClick}><Trash2 size={18} /></Button>
  );
}

function AddBtn({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <Button variant="flat" size="flat" onClick={onClick}
      className={`flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border-dashed bg-transparent text-sm font-semibold ${color}`}><Plus size={16} /> Thêm</Button>
  );
}

function Card({ title, stripe, color, children }: { title: string; stripe: string; color: string; children: React.ReactNode }) {
  return (
    <section className="card-flat mt-3 p-4">
      <div className={`stripe ${stripe} space-y-3`}>
        <div className={`label-caps ${color}`}>{title}</div>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {hint && <span className="num text-xs">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, label, className = "" }: { value: number; onChange: (v: number) => void; label?: string; className?: string }) {
  return (
    <input inputMode="numeric" aria-label={label} placeholder="0" className={`field num text-right ${className}`} value={value ? value.toLocaleString("vi-VN") : ""}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 13)) || 0)} />
  );
}
