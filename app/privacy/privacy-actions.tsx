"use client";

import { useState } from "react";

const GAME_STORAGE_KEYS = [
  "paper-sudoku-current-game",
  "paper-arcade-1024",
  "paper-arcade-sky-hop-best",
];

export function PrivacyActions() {
  const [message, setMessage] = useState("");

  const clearLocalData = async () => {
    GAME_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));

    if ("caches" in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }

    setMessage("这台设备上的游戏进度和离线缓存已清除。");
  };

  return (
    <div className="privacy-actions">
      <button className="primary-button compact-button" onClick={clearLocalData}>
        清除本地游戏数据
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
