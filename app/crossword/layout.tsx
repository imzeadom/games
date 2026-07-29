import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crossword 单词寻踪｜纸上游戏厅",
  description: "在交叉字母中寻找英文单词，查看中文释义和简单英文例句。",
};

export default function CrosswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
