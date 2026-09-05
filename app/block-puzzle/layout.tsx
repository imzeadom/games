import type { Metadata, Viewport } from "next";
import { SITE_URL } from "../site";

export const metadata: Metadata = {
  title: "方块星阵｜纸上游戏厅",
  description: "拖放三组拼块，填满横行或竖列并触发连消的休闲方块游戏。",
  alternates: { canonical: `${SITE_URL}/block-puzzle` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#111a38",
};

export default function BlockPuzzleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
