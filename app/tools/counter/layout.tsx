import type { Metadata } from "next";
import "./counter.css";

export const metadata: Metadata = {
  title: "长期计数器｜纸上游戏厅",
  description: "可长期保存的多组计数器，支持初始值、充值、命名与颜色设置。",
};

export default function CounterLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
