import type { Metadata } from "next";
import { SITE_URL } from "../site";

export const metadata: Metadata = {
  title: "合成 1024｜纸上游戏厅",
  description: "滑动并合并相同数字，挑战合成 1024。",
  alternates: { canonical: `${SITE_URL}/1024` },
  icons: {
    icon: "/icon-1024-192.png",
    apple: "/icon-1024-192.png",
  },
};

export default function MergeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
