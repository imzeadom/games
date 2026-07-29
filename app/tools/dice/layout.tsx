import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "骰子工具｜纸上游戏厅",
  description: "支持多枚 D6、D8、D10、D12 和 D20 的离线掷骰工具。",
};

export default function DiceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
