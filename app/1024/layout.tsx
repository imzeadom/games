import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "合成 1024｜纸上游戏厅",
  description: "滑动并合并相同数字，挑战合成 1024。",
  manifest: "/manifest-1024.webmanifest",
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
