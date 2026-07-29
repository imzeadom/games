import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "纸上迷宫｜纸上游戏厅",
  description: "随机生成的离线迷宫游戏，包含简单、中等、困难三种难度。",
};

export default function MazeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
