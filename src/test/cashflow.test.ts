import { describe, expect, it } from "vitest";
import {
  addSpend, closeCycle, cycleStats, defaultState, fromBackup, normalizeState, payRemainder, perCycle, planCycle,
  resetData, setInitialBuffer, setSavingInitial, startCycle, toBackup,
} from "@/lib/cashflow";

describe("cashflow", () => {
  it("item amount is used as-is per cycle; empty items are skipped", () => {
    expect(perCycle({ id: "a", name: "a", amount: 100 })).toBe(100);
    const s = defaultState().settings;
    s.fixed = [{ id: "a", name: "a", amount: 100 }, { id: "b", name: "b", amount: 0 }];
    expect(planCycle(s).fixed.map((f) => f.id)).toEqual(["a"]);
  });

  it("reset sets buffer exactly to initial buffer", () => {
    const s = defaultState().settings;
    s.initialBuffer = 500;
    const r = resetData(s);
    expect(r.buffer).toBe(500);
    expect(r.cycle).toBeNull();
    expect(r.funds.every((f) => f.amount === 0)).toBe(true);
  });

  it("savings are % of the whole cycle (fixed+flex+saving) and leave the buffer on start", () => {
    const s = defaultState();
    s.settings.fixed = [{ id: "f", name: "f", amount: 100000 }];
    s.settings.flex = [{ id: "x", name: "x", amount: 100000 }];
    s.settings.cycleDays = 1;
    const st = startCycle(s);
    // 200.000 is 75% of the cycle → whole cycle ≈ 266.667; 15% ≈ 40.000, 10% ≈ 26.667 (rounded up)
    expect(st.funds.find((f) => f.id === "qan")!.amount).toBeGreaterThanOrEqual(40000);
    expect(st.funds.find((f) => f.id === "qan")!.amount).toBeLessThanOrEqual(40001);
    expect(st.funds.find((f) => f.id === "qlara")!.amount).toBe(26667);
    expect(s.buffer - st.buffer).toBe(200000 + st.funds.find((f) => f.id === "qan")!.amount + 26667);
  });

  it("closing returns unspent money to the buffer", () => {
    const s = defaultState();
    s.settings.fixed = [{ id: "f", name: "f", amount: 100000 }];
    s.settings.flex = [{ id: "x", name: "x", amount: 100000 }];
    s.settings.saving = [];
    s.settings.cycleDays = 1;
    let st = startCycle(s);
    st = payRemainder(st, "f");
    st = addSpend(st, "flex", "x", 40000);
    st = closeCycle(st);
    expect(st.buffer).toBe(s.buffer - 200000 + 60000);
  });

  it("fixed items accept typed amounts like flex items", () => {
    const s = defaultState();
    s.settings.fixed = [{ id: "f", name: "f", amount: 100000 }];
    s.settings.flex = [];
    s.settings.saving = [];
    let st = startCycle(s);
    st = addSpend(st, "fixed", "f", 30000);
    expect(cycleStats(st.cycle!).fixedPaid).toBe(30000);
    st = payRemainder(st, "f");
    expect(cycleStats(st.cycle!).fixedPaid).toBe(100000);
    expect(cycleStats(st.cycle!).remaining).toBe(0);
  });

  it("saving fund opening balance seeds the fund and edits shift it by the difference", () => {
    let st = defaultState();
    st = setSavingInitial(st, "qan", 2000000);
    expect(st.funds.find((f) => f.id === "qan")!.amount).toBe(2000000);
    st = { ...st, funds: st.funds.map((f) => (f.id === "qan" ? { ...f, amount: f.amount + 500 } : f)) };
    st = setSavingInitial(st, "qan", 1500000);
    expect(st.funds.find((f) => f.id === "qan")!.amount).toBe(1500500);
    expect(resetData(st.settings).funds.find((f) => f.id === "qan")!.amount).toBe(1500000);
  });

  it("changing the buffer opening balance keeps money already moved", () => {
    let st = startCycle(defaultState());
    const before = st.buffer;
    st = setInitialBuffer(st, st.settings.initialBuffer + 1000);
    expect(st.buffer).toBe(before + 1000);
  });

  it("old saved data with paid fixed items still counts as paid", () => {
    const st = startCycle(defaultState());
    const old = JSON.parse(JSON.stringify(st));
    old.cycle.fixed = old.cycle.fixed.map((f: { spends?: unknown; budget: number }, i: number) => { delete f.spends; return { ...f, paid: i === 0 }; });
    const n = normalizeState(old);
    expect(cycleStats(n.cycle!).fixedPaid).toBe(st.cycle!.fixed[0]!.budget);
  });

  it("backup round-trips", () => {
    let st = startCycle(defaultState());
    st = addSpend(st, "fixed", "web", 500, new Date("2026-01-02"));
    st = setSavingInitial(st, "qlara", 700);
    expect(fromBackup(JSON.parse(JSON.stringify(toBackup(st))))).toEqual(st);
  });
});

import { cycleEnd } from "@/lib/cashflow";
describe("cycle end date", () => {
  it("7-day cycle starting 1st ends on the 7th", () => {
    expect(cycleEnd(new Date(2026, 9, 1), 7).getDate()).toBe(7);
  });
});
