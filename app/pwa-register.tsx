"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

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

type RefreshState = "idle" | "checking" | "updating";

const REFRESH_LABELS: Record<RefreshState, string> = {
  idle: "强制刷新",
  checking: "检查更新…",
  updating: "载入新版…",
};

const SERVICE_WORKER_ENABLED = process.env.NODE_ENV === "production";

type InstallContextValue = {
  installPrompt: InstallPromptEvent | null;
  installLabel: string;
  isInstalled: boolean;
  install: () => Promise<boolean>;
};

const InstallContext = createContext<InstallContextValue | null>(null);

function installationHelpFor(userAgent: string) {
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "点按浏览器的“分享”按钮，再选择“添加到主屏幕”。";
  }

  if (/android/i.test(userAgent)) {
    return "打开浏览器右上角菜单，选择“安装应用”或“添加到主屏幕”。";
  }

  if (/safari/i.test(userAgent) && !/chrome|chromium|edg/i.test(userAgent)) {
    return "打开 Safari 的“文件”菜单，选择“添加到程序坞”。";
  }

  return "查看地址栏右侧的安装图标；如果没有，请打开浏览器菜单，选择“安装应用”。";
}

function waitForActivation(worker: ServiceWorker) {
  if (worker.state === "activated" || worker.state === "redundant") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, 8_000);

    function finish() {
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    }

    function onStateChange() {
      if (worker.state === "activated" || worker.state === "redundant") {
        finish();
      }
    }

    worker.addEventListener("statechange", onStateChange);
  });
}

export function PwaRegister({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const manifest =
    MANIFESTS[pathname as keyof typeof MANIFESTS] ?? {
      href: "/manifest.webmanifest",
      label: "安装游戏厅",
    };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (SERVICE_WORKER_ENABLED) {
        navigator.serviceWorker
          .register("/sw.js", { updateViaCache: "none" })
          .catch((error) => console.warn("PWA 离线功能注册失败", error));
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations.map((registration) => registration.unregister()),
            ),
          )
          .catch((error) =>
            console.warn("清理开发环境 Service Worker 失败", error),
          );
      }
    }

    const onInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setIsInstalled(false);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const useCachedDocumentNavigation = (event: MouseEvent) => {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // Client-side RSC navigation needs a network response. A full document
      // navigation lets the service worker serve the precached page on iOS.
      event.preventDefault();
      window.location.assign(url.href);
    };
    const updateInstalledState = () => {
      const iosNavigator = navigator as Navigator & { standalone?: boolean };
      setIsInstalled(
        standaloneQuery.matches ||
          iosNavigator.standalone === true ||
          document.referrer.startsWith("android-app://"),
      );
    };

    window.addEventListener("beforeinstallprompt", onInstallAvailable);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("click", useCachedDocumentNavigation, true);
    standaloneQuery.addEventListener("change", updateInstalledState);
    updateInstalledState();

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallAvailable);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("click", useCachedDocumentNavigation, true);
      standaloneQuery.removeEventListener("change", updateInstalledState);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    return true;
  };

  return (
    <InstallContext.Provider
      value={{
        installPrompt,
        installLabel: manifest.label,
        isInstalled,
        install,
      }}
    >
      {children}
      <link
        rel="manifest"
        href={manifest.href}
        crossOrigin="use-credentials"
      />
    </InstallContext.Provider>
  );
}

function PwaRefreshButton() {
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");

  const forceRefresh = async () => {
    if (refreshState !== "idle") return;

    setRefreshState("checking");

    try {
      if (SERVICE_WORKER_ENABLED && "serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        let updateWorker =
          registration.installing ?? registration.waiting ?? null;

        const rememberUpdate = () => {
          updateWorker = registration.installing ?? registration.waiting;
        };

        registration.addEventListener("updatefound", rememberUpdate);
        try {
          await registration.update();
        } finally {
          registration.removeEventListener("updatefound", rememberUpdate);
        }

        updateWorker =
          registration.installing ?? registration.waiting ?? updateWorker;

        if (updateWorker && updateWorker !== registration.active) {
          setRefreshState("updating");
          updateWorker.postMessage({ type: "SKIP_WAITING" });
          await waitForActivation(updateWorker);
        }
      }
    } catch (error) {
      console.warn("检查 PWA 更新失败，将直接刷新页面", error);
    }

    window.location.reload();
  };

  return (
    <button
      className="menu-pwa-button menu-refresh-button"
      type="button"
      onClick={forceRefresh}
      disabled={refreshState !== "idle"}
      aria-label="检查服务端更新并强制刷新"
      aria-busy={refreshState !== "idle"}
    >
      <span aria-hidden="true">↻</span>
      <span className="menu-action-label">
        {REFRESH_LABELS[refreshState]}
      </span>
    </button>
  );
}

export function PwaMenuActions() {
  const installContext = useContext(InstallContext);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    if (!showInstallHelp) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowInstallHelp(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showInstallHelp]);

  const requestInstall = async () => {
    if (!installContext) return;
    const showedNativePrompt = await installContext.install();
    if (!showedNativePrompt) setShowInstallHelp(true);
  };

  return (
    <>
      <PwaRefreshButton />
      {installContext && !installContext.isInstalled && (
        <button
          className="menu-pwa-button menu-install-button"
          type="button"
          onClick={requestInstall}
          aria-label={installContext.installLabel}
        >
          <span aria-hidden="true">↓</span>
          <span className="menu-action-label">
            {installContext.installLabel}
          </span>
        </button>
      )}
      {showInstallHelp && installContext && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowInstallHelp(false)}
        >
          <section
            className="install-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="关闭安装说明"
              onClick={() => setShowInstallHelp(false)}
            >
              ×
            </button>
            <div className="install-help-icon" aria-hidden="true">
              ↓
            </div>
            <p className="eyebrow">安装到设备</p>
            <h2 id="install-help-title">{installContext.installLabel}</h2>
            <p>
              {installationHelpFor(navigator.userAgent)}
              安装后可以从主屏幕或应用列表直接打开，并继续使用离线游戏。
            </p>
            <button
              className="primary-button"
              type="button"
              autoFocus
              onClick={() => setShowInstallHelp(false)}
            >
              知道了
            </button>
          </section>
        </div>
      )}
    </>
  );
}
