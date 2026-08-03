import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";
import { SITE_NAME, SITE_URL } from "./site";

export const metadata: Metadata = (() => {
  const title = "纸上游戏厅｜六款轻松小游戏与实用工具";
  const description =
    "数独、迷宫、Crossword 单词寻踪与原创休闲小游戏，支持历史成绩、离线游玩和安装到手机主屏幕。";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: SITE_NAME,
    alternates: { canonical: SITE_URL },
    keywords: [
      "在线小游戏",
      "PWA 游戏",
      "数独",
      "1024 游戏",
      "休闲游戏",
      "平台跳跃游戏",
      "迷宫游戏",
      "Crossword",
      "英语单词游戏",
      "骰子工具",
      "离线游戏",
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "games",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "纸上游戏厅",
    },
    openGraph: {
      type: "website",
      url: SITE_URL,
      title,
      description,
      siteName: SITE_NAME,
      locale: "zh_CN",
      images: [{ url: `${SITE_URL}/og.png`, width: 1731, height: 909 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/og.png`],
    },
  };
})();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f4f0e6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <PwaRegister>{children}</PwaRegister>
      </body>
    </html>
  );
}
