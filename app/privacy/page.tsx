import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyActions } from "./privacy-actions";
import { SITE_URL } from "../site";
import { PwaMenuActions } from "../pwa-register";

export const metadata: Metadata = {
  title: "隐私说明｜纸上游戏厅",
  description: "了解纸上游戏厅如何在设备本地保存游戏进度和离线资源。",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyPage() {
  return (
    <main className="privacy-shell">
      <header className="game-nav">
        <Link href="/" className="back-link">
          ← 游戏厅
        </Link>
        <div className="nav-actions">
          <span>隐私与本地数据</span>
          <PwaMenuActions />
        </div>
      </header>

      <article className="privacy-content">
        <p className="eyebrow">PRIVACY</p>
        <h1>简单游戏，也保持数据简单。</h1>
        <p className="privacy-lead">
          纸上游戏厅不接入广告、行为分析、营销追踪或第三方社交组件。
          游戏进度只保存在你当前使用的浏览器中，不会由游戏代码上传。
        </p>

        <div className="privacy-grid">
          <section>
            <span>01</span>
            <h2>保存在设备上的内容</h2>
            <p>
              数独局面、1024 分数、汉字成绩和自定义汉字字库使用浏览器 localStorage
              保存。PWA 服务工作线程会缓存页面、图标和原创游戏素材，以便离线游玩。
            </p>
          </section>
          <section>
            <span>02</span>
            <h2>Cookie 与登录</h2>
            <p>
              游戏本身不设置分析或广告 Cookie。托管平台可能使用维持登录和安全所必需的
              Cookie；这些属于提供你所请求服务所需的技术数据。
            </p>
          </section>
          <section>
            <span>03</span>
            <h2>你的控制权</h2>
            <p>
              你可以使用下方按钮清除游戏保存和离线缓存，也可以通过浏览器的网站数据设置进行管理。
              清除后不能恢复。
            </p>
          </section>
        </div>

        <PrivacyActions />
        <p className="privacy-note">
          本说明适用于本站游戏代码。托管平台账户与身份验证由平台独立提供并受其条款约束。
          最后更新：2026 年 7 月 27 日。
        </p>
      </article>
    </main>
  );
}
