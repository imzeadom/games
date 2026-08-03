import type { Metadata, Viewport } from "next";
import { SITE_URL } from "../site";

export const metadata: Metadata = {
  title: "Iron Recoil｜原创横版跑枪游戏",
  description:
    "进入柴油朋克工业港，营救工人并摧毁失控移动钻探机的原创网页版 2D 横版跑枪游戏。",
  alternates: { canonical: `${SITE_URL}/iron-recoil` },
  manifest: "/manifest-iron-recoil.webmanifest",
  icons: {
    icon: "/icon-iron-recoil.svg",
    apple: "/icon-iron-recoil.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#101922",
};

export default function IronRecoilLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
