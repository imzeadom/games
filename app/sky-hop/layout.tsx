import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "云雀跃｜纸上游戏厅",
  description: "轻点屏幕，带着原创小云雀穿过云门。",
  manifest: "/manifest-sky-hop.webmanifest",
  icons: {
    icon: "/icon-sky-192.png",
    apple: "/icon-sky-192.png",
  },
};

export default function SkyHopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
