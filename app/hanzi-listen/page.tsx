"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PwaMenuActions } from "../pwa-register";
import { recordScore } from "../lib/score-history";
import { BEGINNER_BANK, CHALLENGE_BANK, HANZI_BANK, type HanziEntry, type HanziDifficulty } from "./data";
import { buildHanziOptions, shuffleWithRandom } from "./logic";

const CUSTOM_KEY = "paper-arcade-hanzi-custom-v1";
const MODES: Record<HanziDifficulty, { label: string; options: number; bank: HanziEntry[]; hint: string }> = {
  beginner: { label: "启蒙", options: 2, bank: BEGINNER_BANK, hint: `2 个选项 · ${BEGINNER_BANK.length} 个生活汉字` },
  medium: { label: "进阶", options: 4, bank: HANZI_BANK, hint: "4 个选项 · 500 字常用字库" },
  challenge: { label: "挑战", options: 6, bank: CHALLENGE_BANK, hint: "6 个选项 · 优先相近字" },
};

function shuffle<T>(items: T[]): T[] { return shuffleWithRandom(items); }
function loadCustom(): HanziEntry[] {
  try { const value = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]"); if (!Array.isArray(value)) return []; const seen = new Set(HANZI_BANK.map((entry) => entry.hanzi)); const clean = value.map(sanitizeCustom).filter((entry): entry is HanziEntry => Boolean(entry)).filter((entry) => !seen.has(entry.hanzi) && (seen.add(entry.hanzi), true)); localStorage.setItem(CUSTOM_KEY, JSON.stringify(clean)); return clean; } catch { return []; }
}
function isSingleHanzi(value: unknown): value is string {
  return typeof value === "string" && /^[\u3400-\u4dbf\u4e00-\u9fff]$/.test(value);
}
function sanitizeCustom(value: unknown): HanziEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<HanziEntry>;
  if (!isSingleHanzi(item.hanzi)) return null;
  const confusableWith = Array.isArray(item.confusableWith) ? item.confusableWith.filter(isSingleHanzi).filter((entry) => entry !== item.hanzi) : [];
  const difficulty = item.difficulty === "medium" || item.difficulty === "challenge" || item.difficulty === "beginner" ? item.difficulty : "beginner";
  return { hanzi: item.hanzi, audio: `tts:${item.hanzi}`, image: typeof item.image === "string" && item.image.trim() ? item.image.trim().slice(0, 8) : "✨", category: typeof item.category === "string" && item.category.trim() ? item.category.trim().slice(0, 24) : "自定义", difficulty, confusableWith: [...new Set(confusableWith)] };
}
function getSpeechVoice() {
  if (typeof speechSynthesis === "undefined") return undefined;
  return speechSynthesis.getVoices().find((voice) => /^zh(-|_)?(CN|TW|HK)?/i.test(voice.lang)) ?? speechSynthesis.getVoices().find((voice) => voice.lang.startsWith("zh"));
}

export default function HanziListen() {
  const [mode, setMode] = useState<HanziDifficulty>("beginner");
  const [custom, setCustom] = useState<HanziEntry[]>(() => (typeof window === "undefined" ? [] : loadCustom()));
  const [target, setTarget] = useState<HanziEntry | null>(null);
  const [options, setOptions] = useState<HanziEntry[]>([]);
  const [started, setStarted] = useState(false);
  const [feedback, setFeedback] = useState("点一下开始，先听听这个字。");
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [parentOpen, setParentOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ hanzi: "", image: "✨", category: "自定义", confusableWith: "", difficulty: "beginner" as HanziDifficulty });
  const [parentNotice, setParentNotice] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const roundTimer = useRef<number | null>(null);
  const milestonesRef = useRef(new Set<number>());
  const parentDialogRef = useRef<HTMLElement>(null);
  const allBank = useMemo(() => [...HANZI_BANK, ...custom], [custom]);

  useEffect(() => () => { if (roundTimer.current) window.clearTimeout(roundTimer.current); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }, []);
  useEffect(() => {
    if (!parentOpen) return;
    parentDialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setParentOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [parentOpen]);

  const speak = useCallback((entry: HanziEntry | null): "played" | "muted" | "unsupported" => {
    if (!entry || !soundOn) { if (!soundOn) setFeedback("声音已关闭，请先打开声音。"); return "muted"; }
    if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") { setFeedback("当前浏览器不支持语音，请检查系统语音设置。"); return "unsupported"; }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(entry.hanzi);
    utterance.lang = "zh-CN";
    const voice = getSpeechVoice();
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
    return "played";
  }, [soundOn]);

  const nextRound = useCallback((nextMode = mode, playImmediately = false) => {
    const settings = MODES[nextMode];
    const bank = nextMode === "beginner" ? [...settings.bank, ...custom.filter((entry) => entry.difficulty === "beginner")] : nextMode === "medium" ? [...settings.bank, ...custom.filter((entry) => entry.difficulty !== "challenge")] : [...settings.bank, ...custom];
    const previous = target?.hanzi;
    const candidates = bank.filter((entry) => entry.hanzi !== previous);
    const challengeCandidates = nextMode === "challenge" ? candidates.filter((entry) => entry.confusableWith.some((hanzi) => bank.some((item) => item.hanzi === hanzi))) : candidates;
    const next = shuffle(challengeCandidates.length ? challengeCandidates : candidates)[0] ?? settings.bank[0];
    setTarget(next);
    setOptions(buildHanziOptions(next, nextMode, bank));
    setSelected(null);
    setFeedback("听清楚了吗？找一找对应的汉字。");
    if (playImmediately || started) speak(next);
  }, [custom, mode, speak, started, target]);

  const start = useCallback(() => { setStarted(true); nextRound(mode, true); }, [mode, nextRound]);
  const choose = useCallback((entry: HanziEntry) => {
    if (!target || selected === target.hanzi) return;
    if (roundTimer.current) window.clearTimeout(roundTimer.current);
    setSelected(entry.hanzi);
    if (entry.hanzi === target.hanzi) {
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect); setStreak((value) => value + 1); setFeedback(`${target.image} 找到了！这是“${target.category}”里的字。`); speak(target);
      if (nextCorrect > 0 && nextCorrect % 10 === 0) {
        if (!milestonesRef.current.has(nextCorrect)) { milestonesRef.current.add(nextCorrect); recordScore({ gameId: "hanzi-listen", gameName: "听音找汉字", difficulty: mode === "beginner" ? "简单" : mode === "medium" ? "中等" : "困难", score: nextCorrect, mistakes, detail: `本局找到 ${nextCorrect} 个汉字`, completed: true }); }
      }
      roundTimer.current = window.setTimeout(() => nextRound(), 850);
    } else { setMistakes((value) => value + 1); setStreak(0); setFeedback(`再听一次：不是“${entry.hanzi}”，小耳朵再试试。`); speak(target); roundTimer.current = window.setTimeout(() => setSelected(null), 550); }
  }, [correct, mistakes, mode, nextRound, selected, speak, target]);

  function saveCustom(event: React.FormEvent) {
    event.preventDefault(); setParentNotice(null); const value = customForm.hanzi.trim();
    if (!isSingleHanzi(value)) return setParentNotice({ kind: "error", message: "请输入一个汉字（仅限中文汉字）。" });
    if (allBank.some((entry) => entry.hanzi === value)) return setParentNotice({ kind: "error", message: "这个汉字已经在字库里了。" });
    const entry: HanziEntry = { hanzi: value, audio: `tts:${value}`, image: customForm.image.trim().slice(0, 8) || "✨", category: customForm.category.trim().slice(0, 24) || "自定义", difficulty: customForm.difficulty, confusableWith: [...new Set(customForm.confusableWith.split(",").map((item) => item.trim()).filter((item) => isSingleHanzi(item) && item !== value))] };
    const next = [...custom, entry]; setCustom(next); localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); setCustomForm({ hanzi: "", image: "✨", category: "自定义", confusableWith: "", difficulty: "beginner" }); setParentNotice({ kind: "success", message: `已加入“${value}”到自定义字库。` });
  }
  function removeCustom(hanzi: string) { const next = custom.filter((entry) => entry.hanzi !== hanzi); setCustom(next); localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); setParentNotice({ kind: "success", message: `已删除“${hanzi}”。` }); }
  function exportCustom() { const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "我的汉字字库.json"; anchor.click(); URL.revokeObjectURL(url); }
  function importCustom(event: React.ChangeEvent<HTMLInputElement>) { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (!Array.isArray(parsed)) throw new Error(); const seen = new Set(allBank.map((item) => item.hanzi)); const additions = parsed.map(sanitizeCustom).filter((entry): entry is HanziEntry => Boolean(entry)).filter((entry) => { if (seen.has(entry.hanzi)) return false; seen.add(entry.hanzi); return true; }); const skipped = parsed.length - additions.length; const next = [...custom, ...additions]; setCustom(next); localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); setParentNotice({ kind: "success", message: `已导入 ${additions.length} 个汉字，跳过 ${skipped} 个无效或重复项目。` }); } catch { setParentNotice({ kind: "error", message: "JSON 格式不正确。" }); } finally { input.value = ""; } }; reader.readAsText(file); }

  const toggleSound = useCallback(() => {
    if (soundOn) {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      setSoundOn(false);
      setFeedback("声音已关闭。");
      return;
    }
    setSoundOn(true);
    setFeedback("声音已打开，再听一次。");
    window.setTimeout(() => {
      if (target && typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined") {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(target.hanzi);
        utterance.lang = "zh-CN";
        speechSynthesis.speak(utterance);
      }
    }, 0);
  }, [soundOn, target]);

  return <main className="hanzi-shell">
    <header className="hanzi-nav"><Link href="/" className="back-link">← 游戏厅</Link><div className="hanzi-nav-title"><span aria-hidden="true">♧</span><strong>听音找汉字</strong><small>小耳朵识字</small></div><div className="nav-actions"><Link href="/history">历史成绩</Link><PwaMenuActions /></div></header>
    <section className="hanzi-stage">
      <div className="hanzi-intro"><p className="eyebrow">LISTENING GARDEN</p><h1>听一听，<br /><em>找出它。</em></h1><p>让耳朵带路，在暖暖的识字花园里找到正确的汉字。</p><div className="hanzi-mode-picker" role="group" aria-label="选择难度">{(Object.keys(MODES) as HanziDifficulty[]).map((key) => <button key={key} type="button" className={mode === key ? "is-current" : ""} onClick={() => { if (roundTimer.current) window.clearTimeout(roundTimer.current); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); setFeedback("点一下开始，先听听这个字。"); setMode(key); setStarted(false); setTarget(null); setOptions([]); setCorrect(0); setMistakes(0); setStreak(0); setSelected(null); milestonesRef.current.clear(); }}>{MODES[key].label}<small>{MODES[key].hint}</small></button>)}</div></div>
      <section className={`hanzi-board ${selected && selected === target?.hanzi ? "is-correct" : ""} ${selected && selected !== target?.hanzi ? "is-wrong" : ""}`} aria-label="听音找汉字游戏"><div className="hanzi-board-top"><span>第 {correct + 1} 轮</span><span>找到 {correct} · 错误 {mistakes} · 连对 {streak}</span></div><div className="hanzi-listen"><div className="hanzi-sun" aria-hidden="true">☼</div><p>{started ? "听到的是哪个字？" : "准备好了吗？"}</p><button type="button" className="listen-button" onClick={() => { if (!started) start(); else speak(target); }} aria-label={started ? "再听一次" : "开始游戏并播放读音"}><span aria-hidden="true">{started ? "◖" : "▶"}</span>{started ? "再听一次" : "开始游戏"}</button>{started && <button type="button" className={`sound-toggle ${soundOn ? "" : "is-muted"}`} onClick={toggleSound}>{soundOn ? "声音开" : "声音关"}</button>}</div><div className="hanzi-options" role="group" aria-label="汉字选项">{options.map((entry) => <button key={entry.hanzi} type="button" className={`hanzi-option ${selected === entry.hanzi ? entry.hanzi === target?.hanzi ? "is-right" : "is-wrong" : ""}`} onClick={() => choose(entry)} disabled={!started || Boolean(selected && selected === target?.hanzi)}>{entry.hanzi}</button>)}</div><p className="hanzi-feedback" aria-live="polite">{feedback}</p></section>
    </section>
    <div className="hanzi-footer"><span>本局只保存在当前设备</span><button type="button" className="parent-link" onClick={() => setParentOpen(true)}>家长字库 ⚙</button></div>
    {parentOpen && <div className="hanzi-modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setParentOpen(false); }}><section ref={parentDialogRef} tabIndex={-1} className="hanzi-parent" role="dialog" aria-modal="true" aria-labelledby="parent-title"><button type="button" className="modal-close" onClick={() => setParentOpen(false)} aria-label="关闭家长字库">×</button><p className="eyebrow">FOR PARENTS</p><h2 id="parent-title">我的汉字小抽屉</h2><p>自定义字库只保存在这台设备上。</p><form onSubmit={saveCustom} className="parent-form"><label>汉字<input value={customForm.hanzi} maxLength={2} onChange={(event) => setCustomForm({ ...customForm, hanzi: event.target.value })} placeholder="例：春" /></label><label>图案<input value={customForm.image} onChange={(event) => setCustomForm({ ...customForm, image: event.target.value })} /></label><label>分类<input value={customForm.category} onChange={(event) => setCustomForm({ ...customForm, category: event.target.value })} /></label><label>难度<select value={customForm.difficulty} onChange={(event) => setCustomForm({ ...customForm, difficulty: event.target.value as HanziDifficulty })}><option value="beginner">启蒙</option><option value="medium">进阶</option><option value="challenge">挑战</option></select></label><label>相近字（逗号分隔）<input value={customForm.confusableWith} onChange={(event) => setCustomForm({ ...customForm, confusableWith: event.target.value })} placeholder="例：木,本" /></label><button className="primary-button" type="submit">加入字库</button></form>{parentNotice && <p className={`parent-notice parent-${parentNotice.kind}`} role={parentNotice.kind === "error" ? "alert" : "status"}>{parentNotice.message}</p>}<div className="parent-tools"><button type="button" onClick={exportCustom}>导出 JSON</button><label className="import-button">导入 JSON<input type="file" accept="application/json" onChange={importCustom} /></label><button type="button" onClick={() => { setCustom([]); localStorage.removeItem(CUSTOM_KEY); setParentNotice({ kind: "success", message: "已重置自定义字库。" }); }}>重置自定义字库</button></div><ul className="custom-list">{custom.map((entry) => <li key={entry.hanzi}><span>{entry.image} {entry.hanzi} · {entry.difficulty === "beginner" ? "启蒙" : entry.difficulty === "medium" ? "进阶" : "挑战"}</span><button type="button" onClick={() => removeCustom(entry.hanzi)}>删除</button></li>)}</ul></section></div>}
  </main>;
}
