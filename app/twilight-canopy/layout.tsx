import type { Metadata } from "next";
import { SITE_URL } from "../site";

export const metadata: Metadata = {
  title: "暮色拾星｜纸上游戏厅",
  description:
    "操控飞鼠在暮色林冠间自动弹跳，滑翔补救失误，踏亮灯笼并收集星光。",
  alternates: { canonical: `${SITE_URL}/twilight-canopy` },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function TwilightCanopyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
