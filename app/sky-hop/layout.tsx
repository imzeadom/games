import type { Metadata } from "next";
import { SITE_URL } from "../site";

export const metadata: Metadata = {
  title: "云雀跃｜纸上游戏厅",
  description: "轻点屏幕，带着原创小云雀穿过云门。",
  alternates: { canonical: `${SITE_URL}/sky-hop` },
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
