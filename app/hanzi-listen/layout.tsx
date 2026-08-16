import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "听音找汉字｜纸上游戏厅",
  description: "听一听读音，在纸上花园里找到对应的汉字。",
};

export default function HanziListenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
