import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "历史成绩｜纸上游戏厅",
  description: "查看保存在当前设备上的游戏成绩、完成记录与最佳表现。",
};

export default function HistoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
