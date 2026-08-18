"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PwaMenuActions } from "../../pwa-register";

type Counter = {
  id: string;
  name: string;
  initialValue: number;
  currentValue: number;
  color: string;
};

const PRESET_COLORS = ["#b4553d", "#3f8069", "#4779a8", "#9b6a35", "#7652a8", "#d06b82"];

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "网络请求失败，请重试。");
  return data;
}

export default function CounterPage() {
  const [items, setItems] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"edit" | "recharge" | null>(null);
  const [editing, setEditing] = useState<Counter | null>(null);
  const [form, setForm] = useState({ name: "", initialValue: "0", color: PRESET_COLORS[0] });
  const [rechargeAmount, setRechargeAmount] = useState("10");
  const queues = useRef(new Map<string, Promise<void>>());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson("/api/counters");
      setItems(data.counters);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!dialog) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  const mutate = (item: Counter, action: "delta" | "recharge" | "reset", amount?: number) => {
    const prior = queues.current.get(item.id) ?? Promise.resolve();
    if (action !== "reset") {
      const change = amount ?? 1;
      setItems((list) => list.map((entry) => entry.id === item.id
        ? { ...entry, currentValue: Math.max(-1e9, Math.min(1e9, entry.currentValue + change)) }
        : entry));
    }
    const task = prior.then(async () => {
      try {
        const data = await requestJson(`/api/counters/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action, amount }),
        });
        if (queues.current.get(item.id) === task) {
          setItems((list) => list.map((entry) => entry.id === item.id ? data.counter : entry));
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "更新失败。");
        await load();
      }
    });
    queues.current.set(item.id, task);
    void task.finally(() => {
      if (queues.current.get(item.id) === task) queues.current.delete(item.id);
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: `计数器 ${items.length + 1}`, initialValue: "0", color: PRESET_COLORS[items.length % PRESET_COLORS.length] });
    setDialog("edit");
  };

  const openEdit = (item: Counter) => {
    setEditing(item);
    setForm({ name: item.name, initialValue: String(item.initialValue), color: item.color });
    setDialog("edit");
  };

  const saveCounter = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { name: form.name, initialValue: Number(form.initialValue), color: form.color };
      if (editing) {
        const data = await requestJson(`/api/counters/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setItems((list) => list.map((item) => item.id === editing.id ? data.counter : item));
      } else {
        const data = await requestJson("/api/counters", { method: "POST", body: JSON.stringify(payload) });
        setItems((list) => [...list, data.counter]);
      }
      setDialog(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败。");
    }
  };

  const submitRecharge = (event: React.FormEvent) => {
    event.preventDefault();
    if (editing) mutate(editing, "recharge", Number(rechargeAmount));
    setDialog(null);
  };

  const remove = async (item: Counter) => {
    if (!window.confirm(`确定删除“${item.name}”？`)) return;
    try {
      await requestJson(`/api/counters/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((entry) => entry.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败。");
    }
  };

  return (
    <main className="counter-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">← 游戏厅</Link>
        <div className="nav-actions"><span>实用工具 · 云端保存</span><PwaMenuActions /></div>
      </header>
      <section className="counter-heading">
        <div><p className="eyebrow">LONG-TERM COUNTER</p><h1>把每一次，<br />都认真记下。</h1></div>
        <p>可以设置起始值、随时充值，创建多组有颜色的计数器。数据与当前浏览器关联，换设备后不会混在一起。</p>
      </section>
      <div className="counter-toolbar"><button className="counter-primary" onClick={openCreate}>＋ 添加计数器</button><button className="counter-retry" onClick={() => void load()} disabled={loading}>↻ 刷新</button></div>
      {error && <p className="counter-error" role="alert">{error}</p>}
      {loading ? <p className="counter-state">正在读取你的计数器…</p> : items.length === 0 ? <div className="counter-empty"><strong>还没有计数器</strong><span>添加一个，让今天的第一笔记录有个位置。</span></div> : (
        <section className="counter-grid" aria-label="我的计数器">
          {items.map((item) => <article className="counter-card" key={item.id} style={{ "--counter-color": item.color } as React.CSSProperties}>
            <div className="counter-card-top"><span className="counter-dot" /><h2>{item.name}</h2><button onClick={() => openEdit(item)}>编辑</button><button onClick={() => void remove(item)}>删除</button></div>
            <div className="counter-number" aria-live="polite">{item.currentValue.toLocaleString("zh-CN")}</div>
            <div className="counter-actions"><button aria-label={`${item.name} 减一`} onClick={() => mutate(item, "delta", -1)}>−1</button><button className="counter-plus" aria-label={`${item.name} 加一`} onClick={() => mutate(item, "delta", 1)}>＋1</button></div>
            <div className="counter-secondary"><button onClick={() => { setEditing(item); setRechargeAmount("10"); setDialog("recharge"); }}>充值</button><button onClick={() => mutate(item, "reset")}>重置为初始值（{item.initialValue.toLocaleString("zh-CN")}）</button></div>
          </article>)}
        </section>
      )}
      {dialog === "edit" && <div className="counter-modal-backdrop"><form className="counter-dialog" onSubmit={saveCounter} role="dialog" aria-modal="true" aria-labelledby="counter-dialog-title"><button type="button" className="counter-close" aria-label="关闭" onClick={() => setDialog(null)}>×</button><h2 id="counter-dialog-title">{editing ? "编辑计数器" : "新计数器"}</h2><label>名称<input required maxLength={30} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>初始值<input required type="number" min={-1e9} max={1e9} value={form.initialValue} onChange={(event) => setForm({ ...form, initialValue: event.target.value })} /></label><fieldset><legend>颜色（可选预设或自定义）</legend><div className="counter-colors">{PRESET_COLORS.map((color) => <button type="button" key={color} aria-label={`选择颜色 ${color}`} className={form.color === color ? "is-selected" : ""} style={{ background: color }} onClick={() => setForm({ ...form, color })} />)}<input aria-label="自定义颜色" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div></fieldset><button className="counter-primary" type="submit">保存</button></form></div>}
      {dialog === "recharge" && <div className="counter-modal-backdrop"><form className="counter-dialog" onSubmit={submitRecharge} role="dialog" aria-modal="true" aria-labelledby="recharge-title"><button type="button" className="counter-close" aria-label="关闭" onClick={() => setDialog(null)}>×</button><h2 id="recharge-title">充值计数</h2><label>充值数量（正整数）<input autoFocus required type="number" min="1" max={1e9} step="1" value={rechargeAmount} onChange={(event) => setRechargeAmount(event.target.value)} /></label><button className="counter-primary" type="submit">确认充值</button></form></div>}
    </main>
  );
}
