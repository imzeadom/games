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
  install: () => Promise<void>;
};

const InstallContext = createContext<InstallContextValue | null>(null);

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
    <InstallContext.Provider
      value={{
        installPrompt,
        installLabel: manifest.label,
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

  return (
    <>
      <PwaRefreshButton />
      {installContext?.installPrompt && (
        <button
          className="menu-pwa-button menu-install-button"
          type="button"
          onClick={installContext.install}
          aria-label={installContext.installLabel}
        >
          <span aria-hidden="true">↓</span>
          <span className="menu-action-label">
            {installContext.installLabel}
          </span>
        </button>
      )}
    </>
  );
}
