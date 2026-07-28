import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { PwaRegister } from "./pwa-register";
import { SITE_NAME, SITE_URL } from "./site";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = `${protocol}://${host}`;
  const title = "纸上游戏厅｜四款轻松小游戏";
  const description =
    "数独、合成 1024 与原创休闲小游戏，支持离线游玩并可安装到手机主屏幕。";

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
      url: siteUrl,
      title,
      description,
      siteName: SITE_NAME,
      locale: "zh_CN",
      images: [{ url: `${siteUrl}/og.png`, width: 1731, height: 909 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/og.png`],
    },
  };
}

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
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
