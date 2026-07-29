import Link from "next/link";
import { SITE_NAME, SITE_URL } from "./site";

const games = [
  {
    href: "/sudoku",
    number: "01",
    title: "纸上数独",
    description: "在行、列与九宫格中，找到每个数字唯一的位置。",
    action: "开始推理",
    className: "sudoku-card",
    preview: (
      <div className="mini-sudoku" aria-hidden="true">
        {[5, 3, 0, 0, 7, 0, 6, 0, 0, 1, 9, 5, 0, 9, 8, 0].map(
          (value, index) => (
            <span key={index}>{value || ""}</span>
          ),
        )}
      </div>
    ),
  },
  {
    href: "/1024",
    number: "02",
    title: "合成 1024",
    description: "滑动方块、合并相同数字，一步步抵达 1024。",
    action: "开始合成",
    className: "merge-card",
    preview: (
      <div className="mini-merge" aria-hidden="true">
        <span>16</span>
        <span>32</span>
        <span>64</span>
        <span>128</span>
        <span>256</span>
        <span>512</span>
        <strong>1024</strong>
      </div>
    ),
  },
  {
    href: "/sky-hop",
    number: "03",
    title: "云雀跃",
    description: "轻点屏幕穿过云门，让小云雀飞得更远。",
    action: "振翅起飞",
    className: "sky-card",
    preview: (
      <div className="mini-sky" aria-hidden="true">
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        {/* Static PNG avoids a runtime image optimizer request on Sites. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sky-lark.png" alt="" width={110} height={110} />
      </div>
    ),
  },
  {
    href: "/twilight-canopy",
    number: "04",
    title: "暮色拾星",
    description: "踏亮林冠间的灯笼，滑翔追回每一次差一点的落点。",
    action: "去林冠拾星",
    className: "twilight-card",
    preview: (
      <div className="mini-twilight" aria-hidden="true">
        <span className="mini-moon">✦</span>
        <span className="mini-leaf leaf-a" />
        <span className="mini-leaf leaf-b" />
        <span className="mini-lantern" />
        <span className="mini-squirrel">
          <i />
          <b />
        </span>
        <span className="mini-butterfly">◆</span>
      </div>
    ),
  },
  {
    href: "/maze",
    number: "05",
    title: "纸上迷宫",
    description: "在随机生成的岔路中辨认方向，找到右下角的出口。",
    action: "走进迷宫",
    className: "maze-card",
    preview: (
      <div className="mini-maze" aria-hidden="true">
        {Array.from({ length: 36 }, (_, index) => (
          <span
            key={index}
            className={
              [0, 1, 7, 8, 14, 15, 21, 27, 28, 29, 35].includes(index)
                ? "is-route"
                : ""
            }
          />
        ))}
        <i />
        <b>◎</b>
      </div>
    ),
  },
  {
    href: "/crossword",
    number: "06",
    title: "Crossword · 单词寻踪",
    description: "找出交错隐藏的英文单词，顺手记住中文意思和例句。",
    action: "开始找词",
    className: "crossword-card",
    preview: (
      <div className="mini-crossword" aria-hidden="true">
        {"BRIDGEPLANETWORDGAME".split("").map((letter, index) => (
          <span
            key={index}
            className={index >= 4 && index <= 9 ? "is-word" : ""}
          >
            {letter}
          </span>
        ))}
      </div>
    ),
  },
];

export default function GamesHome() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        inLanguage: "zh-CN",
      },
      {
        "@type": "ItemList",
        name: "纸上游戏厅游戏列表",
        numberOfItems: games.length,
        itemListElement: games.map((game, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${SITE_URL}${game.href}`,
          name: game.title,
          description: game.description,
        })),
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        url: SITE_URL,
        description:
          "数独、迷宫、英文单词寻踪与原创休闲小游戏组成的中文 PWA 游戏合集。",
        offers: {
          "@type": "Offer",
          price: 0,
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    <main className="hub-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <header className="site-header hub-header">
        <Link className="brand" href="/" aria-label="纸上游戏厅首页">
          <span className="brand-mark" aria-hidden="true">
            游
          </span>
          <span>
            <strong>纸上游戏厅</strong>
            <small>PAPER ARCADE</small>
          </span>
        </Link>
        <div className="hub-actions">
          <Link href="/history">历史成绩</Link>
          <span className="hub-count">六款小游戏 · 随时开局</span>
        </div>
      </header>

      <section className="hub-hero">
        <div>
          <p className="eyebrow">一小局，也有好心情</p>
          <h1>
            留一点时间，
            <br />
            给简单的快乐。
          </h1>
        </div>
        <p>
          六款轻量小游戏，不用注册进度也会留在当前设备。支持离线游玩，
          也可以分别安装到手机主屏幕。
        </p>
      </section>

      <section className="game-library" aria-label="游戏列表">
        {games.map((game) => (
          <Link
            className={`game-card ${game.className}`}
            href={game.href}
            key={game.href}
          >
            <div className="card-topline">
              <span>{game.number}</span>
              <span>离线可玩</span>
            </div>
            <div className="card-preview">{game.preview}</div>
            <div className="card-copy">
              <h2>{game.title}</h2>
              <p>{game.description}</p>
              <span className="card-action">
                {game.action}
                <b aria-hidden="true">↗</b>
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="hub-tools" aria-labelledby="tools-title">
        <div className="tools-heading">
          <div>
            <p className="eyebrow">GAME TOOLS</p>
            <h2 id="tools-title">顺手可用的小工具</h2>
          </div>
          <p>不设输赢，也不计入成绩。需要的时候，随手打开。</p>
        </div>
        <Link className="tool-card" href="/tools/dice">
          <div className="tool-card-icon" aria-hidden="true">
            <i className="paper-die paper-die-back" />
            <i className="paper-die paper-die-front" />
          </div>
          <div>
            <span>01 · 骰子工具</span>
            <h3>掷骰子</h3>
            <p>支持 1–6 枚 D6、D8、D10、D12 与 D20。</p>
          </div>
          <b aria-hidden="true">↗</b>
        </Link>
      </section>

      <footer className="hub-footer">
        <span>纸上游戏厅 · 持续更新</span>
        <span>
          <Link href="/history">历史成绩</Link> · 无广告 ·
          进度仅存于你的设备 · <Link href="/privacy">隐私说明</Link>
        </span>
      </footer>
    </main>
  );
}
