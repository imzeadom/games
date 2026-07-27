import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "纸上数独｜纸上游戏厅",
  description: "简单、中等、困难三档数独，支持草稿和智能高亮。",
  manifest: "/manifest-sudoku.webmanifest",
};

export default function SudokuLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
