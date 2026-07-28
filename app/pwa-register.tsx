"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const MANIFESTS = {
  "/1024": {
    href: "/manifest-1024.webmanifest",
    label: "安装 1024",
  },
  "/sky-hop": {
    href: "/manifest-sky-hop.webmanifest",
    label: "安装云雀跃",
  },
  "/twilight-canopy": {
    href: "/manifest-twilight.webmanifest",
    label: "安装暮色拾星",
  },
  "/sudoku": {
    href: "/manifest-sudoku.webmanifest",
    label: "安装数独",
  },
};

export function PwaRegister() {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const manifest =
    MANIFESTS[pathname as keyof typeof MANIFESTS] ?? {
      href: "/manifest.webmanifest",
      label: "安装游戏厅",
    };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => console.warn("PWA 离线功能注册失败", error));
    }

    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <>
      <link
        rel="manifest"
        href={manifest.href}
        crossOrigin="use-credentials"
      />
      {installPrompt && (
        <button className="install-pwa-button" onClick={install}>
          <span aria-hidden="true">↓</span>
          {manifest.label}
        </button>
      )}
    </>
  );
}
