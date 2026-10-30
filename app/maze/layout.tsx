import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "纸上迷宫｜纸上游戏厅",
  description: "陪小猫寻找小鱼，或带小兔找胡萝卜、收集水滴并给菜园浇水；支持打印迷宫练习页。",
};

export default function MazeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
