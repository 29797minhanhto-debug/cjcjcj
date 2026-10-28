export type Unit = "day" | "week" | "month" | "year";
export const UNIT_LABEL: Record<Unit, string> = { day: "ngày", week: "tuần", month: "tháng", year: "năm" };

export interface BudgetItem { id: string; name: string; amount: number }
/** `initial` = opening balance of the fund (số dư ban đầu). */
export interface SavingItem { id: string; name: string; percent: number; initial: number }
export interface Settings {
  cycleDays: number;
  initialBuffer: number;
  nextCycleStart?: string;
  groupNames: { fixed: string; flex: string; saving: string };
  fixed: BudgetItem[];
  flex: BudgetItem[];
  saving: SavingItem[];
}
export interface Spend { amount: number; at: string; id?: string }
export interface CycleItem { id: string; name: string; budget: number; spends: Spend[] }
export interface Cycle {
  start: string;
  days: number;
  fixed: CycleItem[];
  flex: CycleItem[];
  saving: { id: string; name: string; amount: number }[];
}
export interface Fund { id: string; name: string; amount: number }
export interface HistoryEntry { start: string; end: string; budget: number; spent: number; saved: number; returned: number }
export type LogKind = "income" | "expense";
/** Journal of every income/expense entered. `ref` links an expense to its item in the live cycle. */
export interface LogEntry { id: string; kind: LogKind; amount: number; at: string; label: string; ref?: { group: "fixed" | "flex"; item: string } }
/** Total balance snapshot typed in by the user. */
export interface BalancePoint { id: string; at: string; amount: number }
export interface AppState {
  log: LogEntry[];
  balances: BalancePoint[];
  settings: Settings;
  buffer: number;
  funds: Fund[];
  incomes: Spend[];
  cycle: Cycle | null;
  history: HistoryEntry[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

const k = 1;
export const defaultSettings = (): Settings => ({
  cycleDays: 7,
  initialBuffer: 10000 * k,
  groupNames: { fixed: "Cố định", flex: "Linh hoạt", saving: "Tích lũy" },
  fixed: [
    { id: "web", name: "Web", amount: 2100 * k },
    { id: "bhyt", name: "BHYT", amount: 342 * k },
    { id: "bhxe", name: "BH xe", amount: 126 * k },
    { id: "no", name: "Nợ", amount: 1000 * k },
    { id: "ccq", name: "CCQ", amount: 210 * k },
    { id: "an", name: "Ăn uống", amount: 130 * k },
  ],
  flex: [
    { id: "ps", name: "Phát sinh", amount: 90 * k },
    { id: "dt", name: "Nạp ĐT", amount: 30 * k },
    { id: "toc", name: "Cắt tóc", amount: 100 * k },
  ],
  saving: [
    { id: "qan", name: "Quỹ AN", percent: 15, initial: 0 },
    { id: "qlara", name: "Quỹ Lara", percent: 10, initial: 0 },
  ],
});

export const emptySettings = (): Settings => ({
  cycleDays: 7, initialBuffer: 0,
  groupNames: { fixed: "Cố định", flex: "Linh hoạt", saving: "Tích lũy" },
  fixed: [], flex: [], saving: [],
});

/** Fresh data from given settings: buffer = initialBuffer, funds = their opening balance, no cycle, no history. */
export const resetData = (settings: Settings): AppState => ({
  settings,
  buffer: settings.initialBuffer,
  funds: settings.saving.map((s) => ({ id: s.id, name: s.name, amount: s.initial || 0 })),
  incomes: [],
  cycle: null,
  history: [],
  log: [],
  balances: [],
});

export const defaultState = (): AppState => resetData(defaultSettings());

/** Amount of an item allocated to one cycle (amount is per cycle). */
export const perCycle = (it: BudgetItem) => Math.max(0, Math.round(it.amount || 0));

export const itemSpent = (it: CycleItem) => sum(it.spends.map((s) => s.amount));

export function planCycle(s: Settings) {
  const toItem = (i: BudgetItem): CycleItem => ({ id: i.id, name: i.name, budget: perCycle(i), spends: [] });
  const fixed = s.fixed.filter((i) => perCycle(i) > 0).map(toItem);
  const flex = s.flex.filter((i) => perCycle(i) > 0).map(toItem);
  const base = sum(fixed.map((f) => f.budget)) + sum(flex.map((f) => f.budget));

  const totalSavingPct = sum(s.saving.filter((i) => i.percent > 0).map((i) => i.percent));
  const fullCycleBudget = totalSavingPct < 100 && totalSavingPct > 0
    ? base / (1 - totalSavingPct / 100)
    : base;

  const saving = s.saving.filter((i) => i.percent > 0).map((i) => ({
    id: i.id,
    name: i.name,
    amount: Math.ceil((fullCycleBudget * i.percent) / 100),
  }));

  return { fixed, flex, saving, base, total: base + sum(saving.map((x) => x.amount)) };
}

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function startCycle(st: AppState, now?: Date): AppState {
  if (st.cycle) return st;
  const p = planCycle(st.settings);
  const funds = st.funds.map((f) => ({ ...f }));
  for (const sv of p.saving) {
    const f = funds.find((x) => x.id === sv.id);
    if (f) { f.amount += sv.amount; f.name = sv.name; }
    else funds.push({ id: sv.id, name: sv.name, amount: sv.amount });
  }
  const startDate = now || (st.settings.nextCycleStart ? fromDateInput(st.settings.nextCycleStart) : new Date());
  return {
    ...st,
    buffer: st.buffer - p.total,
    funds,
    cycle: {
      start: startDate.toISOString(),
      days: st.settings.cycleDays,
      fixed: p.fixed,
      flex: p.flex,
      saving: p.saving,
    },
  };
}

export function cycleStats(c: Cycle) {
  const fixedBudget = sum(c.fixed.map((f) => f.budget));
  const fixedPaid = sum(c.fixed.map(itemSpent));
  const flexBudget = sum(c.flex.map((f) => f.budget));
  const flexSpent = sum(c.flex.map(itemSpent));
  const budget = fixedBudget + flexBudget;
  const spent = fixedPaid + flexSpent;
  return { fixedBudget, fixedPaid, flexBudget, flexSpent, budget, spent, remaining: budget - spent, saved: sum(c.saving.map((s) => s.amount)) };
}

export function closeCycle(st: AppState, now = new Date()): AppState {
  if (!st.cycle) return st;
  const s = cycleStats(st.cycle);
  return {
    ...st,
    buffer: st.buffer + s.remaining,
    cycle: null,
    history: [{ start: st.cycle.start, end: now.toISOString(), budget: s.budget, spent: s.spent, saved: s.saved, returned: s.remaining }, ...st.history],
  };
}

/* ---------- Cycle item edits (fixed + flex share the same shape) ---------- */
type Group = "fixed" | "flex";
const mapItem = (st: AppState, g: Group, id: string, fn: (i: CycleItem) => CycleItem): AppState =>
  st.cycle ? { ...st, cycle: { ...st.cycle, [g]: st.cycle[g].map((i) => (i.id === id ? fn(i) : i)) } } : st;

export function addSpend(st: AppState, g: Group, id: string, amount: number, now = new Date()): AppState {
  const item = st.cycle?.[g].find((i) => i.id === id);
  if (!item || amount <= 0) return st;
  const sid = uid();
  const at = now.toISOString();
  const next = mapItem(st, g, id, (i) => ({ ...i, spends: [{ amount, at, id: sid }, ...i.spends] }));
  return { ...next, log: sortLog([{ id: sid, kind: "expense", amount, at, label: item.name, ref: { group: g, item: id } }, ...st.log]) };
}

export function removeSpend(st: AppState, g: Group, id: string, index: number): AppState {
  const sid = st.cycle?.[g].find((i) => i.id === id)?.spends[index]?.id;
  const next = mapItem(st, g, id, (i) => ({ ...i, spends: i.spends.filter((_, j) => j !== index) }));
  return sid ? { ...next, log: next.log.filter((l) => l.id !== sid) } : next;
}

/* ---------- Income + journal: editing a log entry keeps the buffer / live cycle in sync ---------- */
const sortLog = (l: LogEntry[]) => [...l].sort((a, b) => b.at.localeCompare(a.at));

export function addIncome(st: AppState, amount: number, now = new Date()): AppState {
  if (amount <= 0) return st;
  const id = uid();
  const at = now.toISOString();
  return {
    ...st,
    buffer: st.buffer + amount,
    incomes: [{ amount, at, id }, ...st.incomes],
    log: sortLog([{ id, kind: "income", amount, at, label: "Nạp Quỹ Đệm" }, ...st.log]),
  };
}

export function updateLog(st: AppState, id: string, patch: { amount: number; at: string }): AppState {
  const e = st.log.find((l) => l.id === id);
  if (!e) return st;
  const amount = Math.max(0, Math.round(patch.amount || 0));
  const at = patch.at;
  const log = sortLog(st.log.map((l) => (l.id === id ? { ...l, amount, at } : l)));
  const fix = (sp: Spend) => (sp.id === id ? { ...sp, amount, at } : sp);
  if (e.kind === "income") {
    return { ...st, log, buffer: st.buffer + amount - e.amount, incomes: st.incomes.map(fix) };
  }
  const next = e.ref ? mapItem(st, e.ref.group, e.ref.item, (i) => ({ ...i, spends: i.spends.map(fix) })) : st;
  return { ...next, log };
}

export function removeLog(st: AppState, id: string): AppState {
  const e = st.log.find((l) => l.id === id);
  if (!e) return st;
  const log = st.log.filter((l) => l.id !== id);
  if (e.kind === "income") {
    return { ...st, log, buffer: st.buffer - e.amount, incomes: st.incomes.filter((x) => x.id !== id) };
  }
  const next = e.ref ? mapItem(st, e.ref.group, e.ref.item, (i) => ({ ...i, spends: i.spends.filter((x) => x.id !== id) })) : st;
  return { ...next, log };
}

/** Sum of incomes and expenses whose time falls in [from, to] (inclusive local dates). */
export function rangeTotals(log: LogEntry[], from: Date, to: Date) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime() + 86400000;
  let income = 0, expense = 0;
  for (const l of log) {
    const t = new Date(l.at).getTime();
    if (t < a || t >= b) continue;
    if (l.kind === "income") income += l.amount; else expense += l.amount;
  }
  return { income, expense };
}

export const inRange = (at: string, from: Date, to: Date) => {
  const t = new Date(at).getTime();
  return t >= startOfDay(from).getTime() && t < startOfDay(to).getTime() + 86400000;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/* ---------- Total balance snapshots (typed by the user) ---------- */
const sortBal = (l: BalancePoint[]) => [...l].sort((a, b) => a.at.localeCompare(b.at));
export const upsertBalance = (st: AppState, p: { id?: string; at: string; amount: number }): AppState => {
  const amount = Math.round(p.amount || 0);
  const balances = p.id && st.balances.some((b) => b.id === p.id)
    ? st.balances.map((b) => (b.id === p.id ? { ...b, at: p.at, amount } : b))
    : [...st.balances, { id: uid(), at: p.at, amount }];
  return { ...st, balances: sortBal(balances) };
};
export const removeBalance = (st: AppState, id: string): AppState => ({ ...st, balances: st.balances.filter((b) => b.id !== id) });

/** Local "YYYY-MM-DDTHH:mm" for datetime-local inputs. */
export const toDateTimeInput = (d: Date) => `${toDateInput(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const fromDateTimeInput = (s: string) => {
  const [date, time = "00:00"] = s.split("T");
  const d = fromDateInput(date!);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h || 0, m || 0);
  return d;
};

/** Quick "đã trả đủ": records the remaining amount of a fixed item as one payment. */
export function payRemainder(st: AppState, id: string, now = new Date()): AppState {
  const it = st.cycle?.fixed.find((i) => i.id === id);
  if (!it) return st;
  return addSpend(st, "fixed", id, it.budget - itemSpent(it), now);
}

/* ---------- Opening balances: editing shifts the live balance by the difference, never wipes it ---------- */
export function setInitialBuffer(st: AppState, v: number): AppState {
  const value = Math.max(0, Math.round(v || 0));
  return { ...st, buffer: st.buffer + value - st.settings.initialBuffer, settings: { ...st.settings, initialBuffer: value } };
}

export function setSavingInitial(st: AppState, id: string, v: number): AppState {
  const item = st.settings.saving.find((s) => s.id === id);
  if (!item) return st;
  const value = Math.max(0, Math.round(v || 0));
  const delta = value - (item.initial || 0);
  const has = st.funds.some((f) => f.id === id);
  const funds = has
    ? st.funds.map((f) => (f.id === id ? { ...f, amount: f.amount + delta } : f))
    : [...st.funds, { id, name: item.name, amount: value }];
  return {
    ...st,
    funds,
    settings: { ...st.settings, saving: st.settings.saving.map((s) => (s.id === id ? { ...s, initial: value } : s)) },
  };
}

export const fmt = (n: number) => Math.round(n).toLocaleString("vi-VN");

/** Ngày kết thúc chu kỳ: ngày bắt đầu + (số ngày - 1). */
export function cycleEnd(start: string | Date, days: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + Math.max(1, days) - 1);
  return d;
}

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromDateInput = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m || 1) - 1, d || 1);
};

export function dayOfCycle(c: Cycle, now = new Date()) {
  const d = Math.floor((now.getTime() - new Date(c.start).getTime()) / 86400000) + 1;
  return Math.max(1, d);
}

export function cycleRemainingDays(c: Cycle, now = new Date()) {
  return Math.max(0, c.days - dayOfCycle(c, now));
}

/* ---------- Upgrade data saved by older versions ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeState(raw: any): AppState {
  const st = raw as AppState;
  const settings: Settings = {
    ...st.settings,
    saving: (st.settings?.saving ?? []).map((s) => ({ ...s, initial: Number(s.initial) || 0 })),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fixItem = (start: string) => (f: any): CycleItem => ({
    id: String(f.id), name: String(f.name), budget: Number(f.budget) || 0,
    spends: Array.isArray(f.spends) ? f.spends : f.paid ? [{ amount: Number(f.budget) || 0, at: start }] : [],
  });
  const withId = (sp: Spend): Spend => (sp.id ? sp : { ...sp, id: uid() });
  const incomes = (st.incomes ?? []).map(withId);
  const cycle = st.cycle
    ? { ...st.cycle, fixed: st.cycle.fixed.map(fixItem(st.cycle.start)), flex: st.cycle.flex.map(fixItem(st.cycle.start)) }
    : null;
  if (cycle) for (const g of ["fixed", "flex"] as const) cycle[g] = cycle[g].map((i) => ({ ...i, spends: i.spends.map(withId) }));
  // Older data had no journal: rebuild it from incomes and the live cycle's payments.
  const log: LogEntry[] = Array.isArray(st.log) ? st.log : sortLog([
    ...incomes.map((x): LogEntry => ({ id: x.id!, kind: "income", amount: x.amount, at: x.at, label: "Nạp Quỹ Đệm" })),
    ...(cycle ? (["fixed", "flex"] as const).flatMap((g) => cycle[g].flatMap((i) => i.spends.map((x): LogEntry => ({ id: x.id!, kind: "expense", amount: x.amount, at: x.at, label: i.name, ref: { group: g, item: i.id } })))) : []),
  ]);
  return {
    ...st,
    settings,
    funds: st.funds ?? [],
    incomes,
    history: st.history ?? [],
    cycle,
    log,
    balances: Array.isArray(st.balances) ? st.balances : [],
  };
}

/* ---------- Backup: plain, readable, hierarchical JSON with Vietnamese keys ---------- */
export function toBackup(st: AppState) {
  const s = st.settings;
  const item = (i: BudgetItem) => ({ mã: i.id, tên: i.name, số_tiền: i.amount });
  const spends = (l: Spend[]) => l.map((x) => ({ mã: x.id, thời_điểm: x.at, số_tiền: x.amount }));
  return {
    loại_tệp: "SAO LƯU DÒNG TIỀN CÁ NHÂN",
    phiên_bản: 2,
    thời_điểm_sao_lưu: new Date().toISOString(),
    cài_đặt: {
      số_ngày_chu_kỳ: s.cycleDays,
      số_dư_khởi_tạo_quỹ_đệm: s.initialBuffer,
      ngày_bắt_đầu_tiếp_theo: s.nextCycleStart,
      nhóm_cố_định: { tên_nhóm: s.groupNames.fixed, các_mục: s.fixed.map(item) },
      nhóm_linh_hoạt: { tên_nhóm: s.groupNames.flex, các_mục: s.flex.map(item) },
      nhóm_tích_lũy: { tên_nhóm: s.groupNames.saving, các_mục: s.saving.map((i) => ({ mã: i.id, tên: i.name, phần_trăm: i.percent, số_dư_ban_đầu: i.initial })) },
    },
    quỹ_đệm: { số_dư_hiện_tại: st.buffer },
    các_quỹ_tích_lũy: st.funds.map((f) => ({ mã: f.id, tên: f.name, số_dư: f.amount })),
    chu_kỳ_hiện_tại: st.cycle
      ? {
          bắt_đầu: st.cycle.start,
          số_ngày: st.cycle.days,
          cố_định: st.cycle.fixed.map((f) => ({ mã: f.id, tên: f.name, định_mức: f.budget, các_lần_chi: spends(f.spends) })),
          linh_hoạt: st.cycle.flex.map((f) => ({ mã: f.id, tên: f.name, định_mức: f.budget, các_lần_chi: spends(f.spends) })),
          tích_lũy: st.cycle.saving.map((f) => ({ mã: f.id, tên: f.name, số_tiền: f.amount })),
        }
      : null,
    các_lần_nạp_quỹ_đệm: spends(st.incomes),
    nhật_ký_thu_chi: st.log.map((l) => ({ mã: l.id, loại: l.kind === "income" ? "thu" : "chi", tên: l.label, thời_điểm: l.at, số_tiền: l.amount, ...(l.ref ? { nhóm: l.ref.group, mục: l.ref.item } : {}) })),
    tổng_số_dư: st.balances.map((b) => ({ mã: b.id, thời_điểm: b.at, số_tiền: b.amount })),
    lịch_sử_chu_kỳ: st.history.map((h) => ({
      bắt_đầu: h.start, kết_thúc: h.end, ngân_sách: h.budget, đã_chi: h.spent, tích_lũy: h.saved, hoàn_về_quỹ_đệm: h.returned,
    })),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function fromBackup(b: any): AppState {
  if (!b || !b.cài_đặt) throw new Error("Tệp không hợp lệ");
  const c = b.cài_đặt;
  const item = (i: any): BudgetItem => ({ id: String(i.mã ?? uid()), name: String(i.tên), amount: Number(i.số_tiền) || 0 });
  const spends = (l: any): Spend[] => (Array.isArray(l) ? l : []).map((x: any) => ({ at: x.thời_điểm, amount: Number(x.số_tiền) || 0, ...(x.mã ? { id: String(x.mã) } : {}) }));
  const settings: Settings = {
    cycleDays: Number(c.số_ngày_chu_kỳ) || 7,
    initialBuffer: Number(c.số_dư_khởi_tạo_quỹ_đệm) || 0,
    nextCycleStart: c.ngày_bắt_đầu_tiếp_theo,
    groupNames: { fixed: c.nhóm_cố_định?.tên_nhóm ?? "Cố định", flex: c.nhóm_linh_hoạt?.tên_nhóm ?? "Linh hoạt", saving: c.nhóm_tích_lũy?.tên_nhóm ?? "Tích lũy" },
    fixed: (c.nhóm_cố_định?.các_mục ?? []).map(item),
    flex: (c.nhóm_linh_hoạt?.các_mục ?? []).map(item),
    saving: (c.nhóm_tích_lũy?.các_mục ?? []).map((i: any) => ({ id: String(i.mã ?? uid()), name: String(i.tên), percent: Number(i.phần_trăm) || 0, initial: Number(i.số_dư_ban_đầu) || 0 })),
  };
  const cy = b.chu_kỳ_hiện_tại;
  const cycleItem = (f: any): CycleItem => {
    const budget = Number(f.định_mức) || 0;
    const list = f.các_lần_chi ? spends(f.các_lần_chi) : f.đã_trả ? [{ at: cy.bắt_đầu, amount: budget }] : [];
    return { id: String(f.mã), name: String(f.tên), budget, spends: list };
  };
  const hasLog = Array.isArray(b.nhật_ký_thu_chi);
  const restored: AppState = {
    log: hasLog ? b.nhật_ký_thu_chi.map((l: any): LogEntry => ({
      id: String(l.mã ?? uid()), kind: l.loại === "thu" ? "income" : "expense", label: String(l.tên ?? ""), at: l.thời_điểm, amount: Number(l.số_tiền) || 0,
      ...(l.nhóm && l.mục ? { ref: { group: l.nhóm, item: String(l.mục) } } : {}),
    })) : [],
    balances: (b.tổng_số_dư ?? []).map((x: any) => ({ id: String(x.mã ?? uid()), at: x.thời_điểm, amount: Number(x.số_tiền) || 0 })),
    settings,
    buffer: Number(b.quỹ_đệm?.số_dư_hiện_tại) || 0,
    funds: (b.các_quỹ_tích_lũy ?? []).map((f: any) => ({ id: String(f.mã), name: String(f.tên), amount: Number(f.số_dư) || 0 })),
    incomes: spends(b.các_lần_nạp_quỹ_đệm),
    cycle: cy
      ? {
          start: cy.bắt_đầu,
          days: Number(cy.số_ngày) || settings.cycleDays,
          fixed: (cy.cố_định ?? []).map(cycleItem),
          flex: (cy.linh_hoạt ?? []).map(cycleItem),
          saving: (cy.tích_lũy ?? []).map((f: any) => ({ id: String(f.mã), name: String(f.tên), amount: Number(f.số_tiền) || 0 })),
        }
      : null,
    history: (b.lịch_sử_chu_kỳ ?? []).map((h: any) => ({ start: h.bắt_đầu, end: h.kết_thúc, budget: +h.ngân_sách || 0, spent: +h.đã_chi || 0, saved: +h.tích_lũy || 0, returned: +h.hoàn_về_quỹ_đệm || 0 })),
  };
  return hasLog ? restored : normalizeState({ ...restored, log: undefined });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
