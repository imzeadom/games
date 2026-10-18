import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "纸上迷宫｜纸上游戏厅",
  description: "陪小猫穿过纸上迷宫，收集毛线并找到小鱼；还可打印成迷宫练习页。",
};

export default function MazeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
