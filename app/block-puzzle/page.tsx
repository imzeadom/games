"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { recordScore } from "../lib/score-history";
import { PwaMenuActions } from "../pwa-register";
import {
  BOARD_SIZE,
  RESCUE_TARGET,
  canPlacePiece,
  emptyBoard,
  generateTray,
  hasAnyPlacement,
  legalPlacements,
  levelForLines,
  pieceBounds,
  pieceLabel,
  placeAndClear,
  restorePiece,
  scorePlacement,
  type Piece,
} from "./logic";

type GameState = {
  board: number[];
  pieces: Array<Piece | null>;
  score: number;
  best: number;
  lines: number;
  combo: number;
  maxCombo: number;
  moves: number;
  batch: number;
  rescueCharge: 0 | 1;
  rescueProgress: number;
  recorded: boolean;
};

type DragState = {
  pointerId: number;
  pieceIndex: number;
  row: number;
  column: number;
  valid: boolean;
  left: number;
  top: number;
  cellSize: number;
  gap: number;
  startX: number;
  startY: number;
  wasSelected: boolean;
};

type ToastState = {
  text: string;
  tone: "clear" | "rescue" | "perfect" | "info";
};

type PieceShapeStyle = CSSProperties & {
  "--piece-columns": number;
  "--piece-rows": number;
  "--piece-cell"?: string;
  "--piece-gap"?: string;
};

const STORAGE_KEY = "paper-arcade-block-puzzle-v1";
const COLOR_COUNT = 6;

const RANKS = [
  "初遇星光",
  "微光成列",
  "星河漫游",
  "极光连阵",
  "超新星",
  "无尽星域",
];

function initialGame(best = 0): GameState {
  const board = emptyBoard();
  return {
    board,
    pieces: generateTray(board, 0, 1),
    score: 0,
    best,
    lines: 0,
    combo: 0,
    maxCombo: 0,
    moves: 0,
    batch: 0,
    rescueCharge: 1,
    rescueProgress: 0,
    recorded: false,
  };
}

function finiteWhole(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function restoreGame(raw: string): { game: GameState; rescued: boolean } | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (
      !Array.isArray(parsed.board) ||
      parsed.board.length !== BOARD_SIZE * BOARD_SIZE ||
      !parsed.board.every(
        (cell) => Number.isInteger(cell) && cell >= 0 && cell <= COLOR_COUNT,
      ) ||
      !Array.isArray(parsed.pieces) ||
      parsed.pieces.length !== 3
    ) {
      return null;
    }

    const board = [...parsed.board];
    let pieces = parsed.pieces.map((piece) =>
      piece === null ? null : restorePiece(piece),
    );
    const lines = finiteWhole(parsed.lines);
    let batch = finiteWhole(parsed.batch);
    let rescueCharge: 0 | 1 = parsed.rescueCharge === 0 ? 0 : 1;
    let rescued = false;

    if (pieces.every((piece) => piece === null)) {
      batch += 1;
      pieces = generateTray(board, batch, levelForLines(lines));
    }

    if (!hasAnyPlacement(board, pieces) && rescueCharge === 1) {
      batch += 1;
      pieces = generateTray(board, batch, levelForLines(lines), Math.random, 2);
      rescueCharge = 0;
      rescued = true;
    }

    const score = finiteWhole(parsed.score);
    return {
      game: {
        board,
        pieces,
        score,
        best: Math.max(score, finiteWhole(parsed.best)),
        lines,
        combo: finiteWhole(parsed.combo),
        maxCombo: finiteWhole(parsed.maxCombo),
        moves: finiteWhole(parsed.moves),
        batch,
        rescueCharge,
        rescueProgress: Math.min(
          RESCUE_TARGET - 1,
          finiteWhole(parsed.rescueProgress),
        ),
        recorded: parsed.recorded === true,
      },
      rescued,
    };
  } catch {
    return null;
  }
}

function rankForLevel(level: number): string {
  return RANKS[Math.min(level - 1, RANKS.length - 1)];
}

function colorClass(color: number): string {
  return `block-color-${Math.max(1, Math.min(COLOR_COUNT, color))}`;
}

function PieceShape({
  piece,
  className = "",
  cellSize,
  gap,
}: {
  piece: Piece;
  className?: string;
  cellSize?: number;
  gap?: number;
}) {
  const bounds = pieceBounds(piece);
  const occupied = new Set(
    piece.cells.map(([row, column]) => `${row}:${column}`),
  );
  const style: PieceShapeStyle = {
    "--piece-columns": bounds.columns,
    "--piece-rows": bounds.rows,
  };
  if (cellSize) style["--piece-cell"] = `${cellSize}px`;
  if (gap !== undefined) style["--piece-gap"] = `${gap}px`;

  return (
    <span
      className={`block-piece-shape ${colorClass(piece.color)} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {Array.from({ length: bounds.rows * bounds.columns }, (_, index) => {
        const row = Math.floor(index / bounds.columns);
        const column = index % bounds.columns;
        return (
          <i
            className={occupied.has(`${row}:${column}`) ? "is-filled" : ""}
            key={index}
          />
        );
      })}
    </span>
  );
}

function safeVibrate(pattern: number | number[]) {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are optional and unavailable in many browsers.
  }
}

function keepFocusInDialog(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("inert"));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export default function BlockPuzzle() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [keyboardAnchor, setKeyboardAnchor] = useState<{
    row: number;
    column: number;
  } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [clearingCells, setClearingCells] = useState<Set<number>>(new Set());
  const [newCells, setNewCells] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const [clearBurst, setClearBurst] = useState(0);
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragPieceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const activePointer = useRef<number | null>(null);
  const interactionLocked = useRef(false);
  const effectTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const gameOverTimer = useRef<number | null>(null);
  const levelUpTimer = useRef<number | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const rulesCloseRef = useRef<HTMLButtonElement>(null);
  const rulesWasOpen = useRef(false);

  const showToast = useCallback((nextToast: ToastState) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(nextToast);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 1250);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let restored: { game: GameState; rescued: boolean } | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) restored = restoreGame(saved);
        if (saved && !restored) window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage can be unavailable in private or embedded browsing modes.
      }

      const next = restored?.game ?? initialGame();
      setGame(next);
      if (restored?.rescued) {
        setAnnouncement("棋盘恢复后没有可落位置，已自动使用救援牌重抽三块。");
        showToast({ text: "救援重抽！", tone: "rescue" });
      }
      if (!hasAnyPlacement(next.board, next.pieces) && !next.rescueCharge) {
        setShowGameOver(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  useEffect(() => {
    if (!game) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch {
      // Losing persistence should never interrupt a move.
    }
  }, [game]);

  useEffect(
    () => () => {
      if (effectTimer.current) window.clearTimeout(effectTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (gameOverTimer.current) window.clearTimeout(gameOverTimer.current);
      if (levelUpTimer.current) window.clearTimeout(levelUpTimer.current);
    },
    [],
  );

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (showRules) {
      rulesWasOpen.current = true;
      window.requestAnimationFrame(() => rulesCloseRef.current?.focus());
    } else if (rulesWasOpen.current) {
      rulesWasOpen.current = false;
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }, [showRules]);

  const cancelDrag = useCallback(() => {
    activePointer.current = null;
    dragRef.current = null;
    setDrag(null);
  }, []);

  useEffect(() => {
    const cancelForViewportChange = () => cancelDrag();
    const cancelWhenHidden = () => {
      if (document.hidden) cancelDrag();
    };
    window.addEventListener("resize", cancelForViewportChange);
    window.addEventListener("orientationchange", cancelForViewportChange);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("resize", cancelForViewportChange);
      window.removeEventListener("orientationchange", cancelForViewportChange);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
    };
  }, [cancelDrag]);

  const finishGame = useCallback((
    finishedGame: GameState,
    delay = 0,
    shouldRecord = true,
  ) => {
    if (shouldRecord) {
      recordScore({
        gameId: "block-puzzle",
        gameName: "方块星阵",
        score: finishedGame.score,
        moves: finishedGame.moves,
        detail: `消除 ${finishedGame.lines} 行列 · 最高 ${finishedGame.maxCombo} 连消`,
        completed: false,
      });
    }
    if (gameOverTimer.current) window.clearTimeout(gameOverTimer.current);
    gameOverTimer.current = window.setTimeout(() => {
      setShowGameOver(true);
      setAnnouncement(`本局结束，得到 ${finishedGame.score} 分。`);
      safeVibrate([45, 35, 75]);
      gameOverTimer.current = null;
    }, delay);
  }, []);

  const commitPlacement = useCallback(
    (pieceIndex: number, row: number, column: number): boolean => {
      if (!game || showGameOver || interactionLocked.current) return false;
      const piece = game.pieces[pieceIndex];
      if (!piece) return false;
      const result = placeAndClear(game.board, piece, row, column);
      if (!result) {
        safeVibrate(16);
        return false;
      }

      const lineCount =
        result.completedRows.length + result.completedColumns.length;
      const combo = lineCount > 0 ? game.combo + 1 : 0;
      const perfectClear =
        lineCount > 0 && result.board.every((cell) => cell === 0);
      const gained = scorePlacement(
        piece.cells.length,
        lineCount,
        combo,
        perfectClear,
      );
      const score = game.score + gained;
      const lines = game.lines + lineCount;
      const level = levelForLines(lines);
      const previousLevel = levelForLines(game.lines);
      let rescueCharge: 0 | 1 = game.rescueCharge;
      let rescueProgress = game.rescueProgress;

      if (lineCount > 0 && rescueCharge === 0) {
        rescueProgress += lineCount;
        if (rescueProgress >= RESCUE_TARGET) {
          rescueCharge = 1;
          rescueProgress = 0;
        }
      }

      let batch = game.batch;
      let pieces = game.pieces.map((trayPiece, index) =>
        index === pieceIndex ? null : trayPiece,
      );
      if (pieces.every((trayPiece) => trayPiece === null)) {
        batch += 1;
        pieces = generateTray(result.board, batch, level);
      }

      let usedRescue = false;
      if (!hasAnyPlacement(result.board, pieces) && rescueCharge === 1) {
        batch += 1;
        pieces = generateTray(result.board, batch, level, Math.random, 2);
        rescueCharge = 0;
        rescueProgress = 0;
        usedRescue = true;
      }

      const isGameOver = !hasAnyPlacement(result.board, pieces);
      const nextGame: GameState = {
        ...game,
        board: result.board,
        pieces,
        score,
        best: Math.max(game.best, score),
        lines,
        combo,
        maxCombo: Math.max(game.maxCombo, combo),
        moves: game.moves + 1,
        batch,
        rescueCharge,
        rescueProgress,
        recorded: game.recorded || isGameOver,
      };

      setGame(nextGame);
      setSelectedPiece(null);
      setKeyboardAnchor(null);
      setNewCells(new Set(result.placedCells));
      if (level > previousLevel) {
        if (levelUpTimer.current) window.clearTimeout(levelUpTimer.current);
        setLevelUp({ from: previousLevel, to: level });
        levelUpTimer.current = window.setTimeout(() => {
          setLevelUp(null);
          levelUpTimer.current = null;
        }, 1550);
      }

      if (lineCount > 0) {
        interactionLocked.current = true;
        setIsInteractionLocked(true);
        setClearBurst(lineCount);
        setClearingCells(new Set(result.clearedCells));
        const lineWord = lineCount === 1 ? "单线" : `${lineCount} 线同消`;
        const comboWord = combo > 1 ? ` · ${combo} 连消` : "";
        const text = perfectClear
          ? `全盘清空 +${gained}`
          : `${lineWord}${comboWord} +${gained}`;
        showToast({ text, tone: perfectClear ? "perfect" : "clear" });
        setAnnouncement(
          `${lineWord}${comboWord}，获得 ${gained} 分${perfectClear ? "，全盘清空奖励" : ""}。`,
        );
        safeVibrate(lineCount > 1 ? [24, 28, 38] : 28);
        if (effectTimer.current) window.clearTimeout(effectTimer.current);
        const clearDuration = lineCount >= 3 ? 520 : lineCount === 2 ? 430 : 360;
        effectTimer.current = window.setTimeout(() => {
          interactionLocked.current = false;
          setIsInteractionLocked(false);
          setClearingCells(new Set());
          setNewCells(new Set());
          setClearBurst(0);
          effectTimer.current = null;
        }, clearDuration);
      } else {
        setNewCells(new Set(result.placedCells));
        if (effectTimer.current) window.clearTimeout(effectTimer.current);
        effectTimer.current = window.setTimeout(() => {
          setNewCells(new Set());
          effectTimer.current = null;
        }, 220);
      }

      if (usedRescue) {
        showToast({ text: "没有位置了 · 救援重抽！", tone: "rescue" });
        setAnnouncement("剩余拼块都放不下，已自动使用救援牌并重抽三块。");
      }
      if (isGameOver) {
        finishGame(nextGame, lineCount > 0 ? 380 : 80, !game.recorded);
      }
      return true;
    },
    [finishGame, game, showGameOver, showToast],
  );

  const selectPiece = useCallback(
    (index: number) => {
      if (!game?.pieces[index] || showGameOver) return;
      if (selectedPiece === index) {
        setSelectedPiece(null);
        setKeyboardAnchor(null);
        return;
      }
      setSelectedPiece(index);
      const first = legalPlacements(game.board, game.pieces[index] as Piece)[0];
      setKeyboardAnchor(
        first ? { row: first[0], column: first[1] } : { row: 0, column: 0 },
      );
      window.requestAnimationFrame(() => boardRef.current?.focus());
    },
    [game, selectedPiece, showGameOver],
  );

  const dragPosition = useCallback(
    (
      pieceIndex: number,
      pointerId: number,
      pointerType: string,
      clientX: number,
      clientY: number,
      startX: number,
      startY: number,
      wasSelected: boolean,
    ): DragState | null => {
      const board = boardRef.current;
      const piece = game?.pieces[pieceIndex];
      if (!board || !piece || !game) return null;

      const rect = board.getBoundingClientRect();
      const computed = window.getComputedStyle(board);
      const gap = Number.parseFloat(computed.columnGap) || 0;
      const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingRight = Number.parseFloat(computed.paddingRight) || 0;
      const borderLeft = Number.parseFloat(computed.borderLeftWidth) || 0;
      const borderRight = Number.parseFloat(computed.borderRightWidth) || 0;
      const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
      const innerWidth =
        rect.width - borderLeft - borderRight - paddingLeft - paddingRight;
      const cellSize = (innerWidth - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;
      const step = cellSize + gap;
      const originX = rect.left + borderLeft + paddingLeft;
      const originY = rect.top + borderTop + paddingTop;
      const bounds = pieceBounds(piece);
      const pieceWidth = bounds.columns * cellSize + (bounds.columns - 1) * gap;
      const pieceHeight = bounds.rows * cellSize + (bounds.rows - 1) * gap;
      const isMouse = pointerType === "mouse";
      const freeLeft = clientX - pieceWidth / 2;
      const freeTop = isMouse
        ? clientY - pieceHeight / 2
        : clientY - pieceHeight - Math.max(42, cellSize * 0.95);
      const column = Math.round((freeLeft - originX) / step);
      const row = Math.round((freeTop - originY) / step);
      const valid = canPlacePiece(game.board, piece, row, column);

      return {
        pointerId,
        pieceIndex,
        row,
        column,
        valid,
        left: freeLeft,
        top: freeTop,
        cellSize,
        gap,
        startX,
        startY,
        wasSelected,
      };
    },
    [game],
  );

  const beginDrag = (
    pieceIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (
      !game?.pieces[pieceIndex] ||
      showGameOver ||
      interactionLocked.current ||
      activePointer.current !== null
    ) {
      return;
    }
    event.preventDefault();
    activePointer.current = event.pointerId;
    setSelectedPiece(pieceIndex);
    setKeyboardAnchor(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = dragPosition(
      pieceIndex,
      event.pointerId,
      event.pointerType,
      event.clientX,
      event.clientY,
      event.clientX,
      event.clientY,
      selectedPiece === pieceIndex,
    );
    dragRef.current = next;
    setDrag(next);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    const next = dragPosition(
      current.pieceIndex,
      current.pointerId,
      event.pointerType,
      event.clientX,
      event.clientY,
      current.startX,
      current.startY,
      current.wasSelected,
    );
    dragRef.current = next;
    if (
      next && current.row === next.row && current.column === next.column &&
      current.valid === next.valid
    ) {
      if (dragPieceRef.current) {
        dragPieceRef.current.style.left = `${next.left}px`;
        dragPieceRef.current.style.top = `${next.top}px`;
      }
    } else {
      setDrag(next);
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const finalPosition =
      dragPosition(
        current.pieceIndex,
        current.pointerId,
        event.pointerType,
        event.clientX,
        event.clientY,
        current.startX,
        current.startY,
        current.wasSelected,
      ) ?? current;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Capture can already be gone after an orientation change.
    }
    cancelDrag();
    const movement = Math.hypot(
      event.clientX - finalPosition.startX,
      event.clientY - finalPosition.startY,
    );
    if (movement >= 8 && finalPosition.valid) {
      commitPlacement(
        finalPosition.pieceIndex,
        finalPosition.row,
        finalPosition.column,
      );
    } else if (movement < 8 && finalPosition.wasSelected) {
      setSelectedPiece(null);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!game || showGameOver) return;
      if (showRules) {
        if (event.key === "Escape") setShowRules(false);
        return;
      }

      if (["1", "2", "3"].includes(event.key)) {
        const index = Number(event.key) - 1;
        if (game.pieces[index]) {
          event.preventDefault();
          selectPiece(index);
        }
        return;
      }

      if (event.key === "Escape") {
        setSelectedPiece(null);
        setKeyboardAnchor(null);
        cancelDrag();
        return;
      }

      if (selectedPiece === null || !game.pieces[selectedPiece]) return;
      if (event.target !== boardRef.current) return;
      const piece = game.pieces[selectedPiece] as Piece;
      const bounds = pieceBounds(piece);
      const first = legalPlacements(game.board, piece)[0] ?? [0, 0];
      const current = keyboardAnchor ?? { row: first[0], column: first[1] };
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };

      if (deltas[event.key]) {
        event.preventDefault();
        const [rowDelta, columnDelta] = deltas[event.key];
        setKeyboardAnchor({
          row: Math.max(
            0,
            Math.min(BOARD_SIZE - bounds.rows, current.row + rowDelta),
          ),
          column: Math.max(
            0,
            Math.min(
              BOARD_SIZE - bounds.columns,
              current.column + columnDelta,
            ),
          ),
        });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        commitPlacement(selectedPiece, current.row, current.column);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    cancelDrag,
    commitPlacement,
    game,
    keyboardAnchor,
    selectedPiece,
    selectPiece,
    showGameOver,
    showRules,
  ]);

  const selected =
    selectedPiece === null ? null : (game?.pieces[selectedPiece] ?? null);
  const legalAnchorKeys = useMemo(() => {
    if (!game || !selected) return new Set<string>();
    return new Set(
      legalPlacements(game.board, selected).map(
        ([row, column]) => `${row}:${column}`,
      ),
    );
  }, [game, selected]);
  const activeAnchor = useMemo(
    () =>
      drag
        ? { row: drag.row, column: drag.column, valid: drag.valid }
        : selected && keyboardAnchor
          ? {
              ...keyboardAnchor,
              valid: game
                ? canPlacePiece(
                    game.board,
                    selected,
                    keyboardAnchor.row,
                    keyboardAnchor.column,
                  )
                : false,
            }
          : null,
    [drag, game, keyboardAnchor, selected],
  );
  const previewCells = useMemo(() => {
    const cells = new Map<number, boolean>();
    if (!selected || !activeAnchor) return cells;
    for (const [rowOffset, columnOffset] of selected.cells) {
      const row = activeAnchor.row + rowOffset;
      const column = activeAnchor.column + columnOffset;
      if (row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE) {
        cells.set(row * BOARD_SIZE + column, activeAnchor.valid);
      }
    }
    return cells;
  }, [activeAnchor, selected]);
  const previewClear = useMemo(() => {
    if (!game || !selected || !activeAnchor?.valid) return null;
    return placeAndClear(game.board, selected, activeAnchor.row, activeAnchor.column);
  }, [activeAnchor, game, selected]);
  const previewRows = useMemo(
    () => new Set(previewClear?.completedRows ?? []),
    [previewClear],
  );
  const previewColumns = useMemo(
    () => new Set(previewClear?.completedColumns ?? []),
    [previewClear],
  );

  const restart = () => {
    if (effectTimer.current) window.clearTimeout(effectTimer.current);
    if (gameOverTimer.current) window.clearTimeout(gameOverTimer.current);
    if (levelUpTimer.current) window.clearTimeout(levelUpTimer.current);
    interactionLocked.current = false;
    setIsInteractionLocked(false);
    cancelDrag();
    setGame((current) => initialGame(current?.best ?? 0));
    setSelectedPiece(null);
    setKeyboardAnchor(null);
    setClearingCells(new Set());
    setNewCells(new Set());
    setClearBurst(0);
    setToast(null);
    setAnnouncement("新一局已经开始。");
    setShowRules(false);
    setShowGameOver(false);
    setLevelUp(null);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        showToast({ text: "可安装到主屏幕后全屏游玩", tone: "info" });
        setAnnouncement("当前浏览器不支持网页全屏，可安装到主屏幕后全屏游玩。");
      }
    } catch {
      showToast({ text: "浏览器暂未允许全屏", tone: "info" });
    }
  };

  if (!game) {
    return <main className="block-loading">正在点亮方阵…</main>;
  }

  const level = levelForLines(game.lines);
  const rescuePercent =
    game.rescueCharge === 1
      ? 100
      : Math.round((game.rescueProgress / RESCUE_TARGET) * 100);

  return (
    <main className="block-shell">
      <h1 className="block-sr-only">方块星阵</h1>
      <header
        className="block-hud"
        aria-label="本局状态"
        aria-hidden={showRules || showGameOver}
        inert={showRules || showGameOver ? true : undefined}
      >
        <Link className="block-round-button" href="/" aria-label="返回游戏厅">
          <span aria-hidden="true">‹</span>
        </Link>
        <div className="block-score-strip">
          <div>
            <span>分数</span>
            <strong>{game.score.toLocaleString()}</strong>
          </div>
          <i aria-hidden="true" />
          <div>
            <span>最高</span>
            <strong>{game.best.toLocaleString()}</strong>
          </div>
          <i aria-hidden="true" />
          <div>
            <span>消除</span>
            <strong>{game.lines}</strong>
          </div>
        </div>
        <button
          className="block-round-button"
          type="button"
          aria-label="打开玩法与设置"
          ref={menuButtonRef}
          onClick={() => setShowRules(true)}
        >
          <span aria-hidden="true">•••</span>
        </button>
      </header>

      <div
        className="block-status-row"
        aria-hidden={showRules || showGameOver}
        inert={showRules || showGameOver ? true : undefined}
      >
        <span className="block-rank">
          Lv.{level} · {rankForLevel(level)}
        </span>
        <span
          className={`block-combo ${game.combo > 1 ? "is-active" : ""}`}
          aria-hidden={game.combo <= 1}
        >
          {game.combo > 1 ? `${game.combo} 连消` : "稳稳落下"}
        </span>
        <span
          className={`block-rescue ${game.rescueCharge ? "is-ready" : ""}`}
          title={
            game.rescueCharge
              ? "无处可放时自动重抽三块"
              : `再消除 ${RESCUE_TARGET - game.rescueProgress} 行列恢复`
          }
        >
          <i style={{ "--rescue-fill": `${rescuePercent}%` } as CSSProperties} />
          救援
        </span>
      </div>

      <section
        className={`block-stage ${clearBurst >= 3 ? "is-clear-burst-3" : clearBurst === 2 ? "is-clear-burst-2" : ""}`}
        aria-label="方块星阵棋盘"
        aria-hidden={showRules || showGameOver}
        inert={showRules || showGameOver ? true : undefined}
      >
        {toast && (
          <div className={`block-toast is-${toast.tone}`} role="status">
            {toast.text}
          </div>
        )}
        {previewClear && (previewClear.completedRows.length > 0 || previewClear.completedColumns.length > 0) && (
          <div className="block-clear-preview" role="status">
            <span>即将消除</span>
            <strong>{previewClear.completedRows.length} 行 · {previewClear.completedColumns.length} 列</strong>
          </div>
        )}
        {clearBurst >= 2 && (
          <div className={`block-clear-burst-overlay ${clearBurst >= 3 ? "is-massive" : ""}`} aria-hidden="true">
            <span className="block-impact-ring" />
            <strong>大爆发 · {clearBurst} 线同消</strong>
            <div className="block-impact-particles">
              {Array.from({ length: clearBurst >= 3 ? 24 : 12 }, (_, index) => (
                <i key={index} style={{ "--particle-angle": `${index * (360 / (clearBurst >= 3 ? 24 : 12))}deg` } as CSSProperties} />
              ))}
            </div>
          </div>
        )}
        <div
          className={`block-board ${isInteractionLocked ? "is-locked" : ""}`}
          ref={boardRef}
          role="grid"
          aria-rowcount={BOARD_SIZE}
          aria-colcount={BOARD_SIZE}
          aria-label="8 乘 8 棋盘。先选择下方拼块，再点击一个发光起点；也可以直接拖放。"
          tabIndex={0}
        >
          {game.board.map((value, index) => {
            const row = Math.floor(index / BOARD_SIZE);
            const column = index % BOARD_SIZE;
            const preview = previewCells.get(index);
            const isAnchor = legalAnchorKeys.has(`${row}:${column}`);
            const classes = [
              "block-grid-cell",
              value ? "has-block" : "",
              value ? colorClass(value) : "",
              preview !== undefined ? "is-preview" : "",
              preview !== undefined && selected ? colorClass(selected.color) : "",
              preview === true ? "is-valid" : "",
              preview === false ? "is-invalid" : "",
              isAnchor && !activeAnchor ? "is-legal-anchor" : "",
              clearingCells.has(index) ? "is-clearing" : "",
              previewRows.has(row) ? "is-preview-row" : "",
              previewColumns.has(column) ? "is-preview-column" : "",
              newCells.has(index) && !clearingCells.has(index) ? "is-new" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                className={classes}
                type="button"
                role="gridcell"
                aria-rowindex={row + 1}
                aria-colindex={column + 1}
                tabIndex={-1}
                aria-label={`第 ${row + 1} 行，第 ${column + 1} 列${
                  value ? "，已有方块" : isAnchor ? "，可作为落点" : "，空格"
                }`}
                key={index}
                onClick={() => {
                  if (selectedPiece !== null) {
                    commitPlacement(selectedPiece, row, column);
                  }
                }}
              >
                <span />
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="block-tray"
        aria-label="待放置的三个拼块"
        aria-hidden={showRules || showGameOver}
        inert={showRules || showGameOver ? true : undefined}
      >
        <div className="block-tray-topline">
          <span>
            {selected ? "点击棋盘的发光起点" : "拖到棋盘 · 或轻点选择"}
          </span>
          <span>三块用完自动换新</span>
        </div>
        <div className="block-piece-row">
          {game.pieces.map((piece, index) =>
            piece ? (
              <button
                className={`block-piece-button ${
                  selectedPiece === index ? "is-selected" : ""
                }`}
                type="button"
                aria-pressed={selectedPiece === index}
                aria-label={`拼块 ${index + 1}：${pieceLabel(piece)}。拖到棋盘，或按回车选择。`}
                key={piece.key}
                onPointerDown={(event) => beginDrag(index, event)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
                onClick={(event) => {
                  if (event.detail === 0) selectPiece(index);
                }}
              >
                <span className="block-piece-number">{index + 1}</span>
                <PieceShape piece={piece} />
              </button>
            ) : (
              <div className="block-piece-button is-used" aria-label={`拼块 ${index + 1} 已使用`} key={index}>
                <span aria-hidden="true">✓</span>
              </div>
            ),
          )}
        </div>
      </section>

      {drag && game.pieces[drag.pieceIndex] && (
        <div
          ref={dragPieceRef}
          className={`block-drag-piece ${drag.valid ? "is-valid" : "is-invalid"}`}
          style={{ left: drag.left, top: drag.top }}
        >
          <PieceShape
            piece={game.pieces[drag.pieceIndex] as Piece}
            cellSize={drag.cellSize}
            gap={drag.gap}
          />
        </div>
      )}

      {levelUp && (
        <div className="block-level-up" role="status" aria-live="polite">
          <span className="block-level-up-kicker">星阵跃迁</span>
          <strong>LEVEL UP</strong>
          <span>Lv.{levelUp.from} → Lv.{levelUp.to} · {rankForLevel(levelUp.to)}</span>
        </div>
      )}

      <p className="block-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {showRules && (
        <div
          className="block-modal-backdrop"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setShowRules(false);
          }}
        >
          <section
            className="block-modal block-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-rules-title"
            onKeyDown={keepFocusInDialog}
          >
            <button
              className="block-modal-close"
              type="button"
              aria-label="关闭玩法说明"
              ref={rulesCloseRef}
              onClick={() => setShowRules(false)}
            >
              ×
            </button>
            <p className="block-modal-kicker">玩法与设置</p>
            <h2 id="block-rules-title">留出下一块的位置</h2>
            <ol className="block-rule-list">
              <li>
                <b>拖放三块</b>
                <span>拼块不能旋转，三块全部用完后才会换新。</span>
              </li>
              <li>
                <b>填满即消</b>
                <span>任意横行或竖列填满会同时消除；连续消除分数更高。</span>
              </li>
              <li>
                <b>救援重抽</b>
                <span>无处可放时自动救援一次；用掉后每消 12 行列可恢复。</span>
              </li>
            </ol>
            <div className="block-rule-score">
              <span>落块</span><strong>每格 5 分</strong>
              <span>清线</span><strong>80 分起</strong>
              <span>清空棋盘</span><strong>额外 500 分</strong>
            </div>
            <div className="block-modal-actions">
              <button type="button" onClick={restart}>重新开局</button>
              <button type="button" onClick={toggleFullscreen}>
                {isFullscreen ? "退出全屏" : "进入全屏"}
              </button>
              <PwaMenuActions />
            </div>
          </section>
        </div>
      )}

      {showGameOver && (
        <div className="block-modal-backdrop">
          <section
            className="block-modal block-result-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-result-title"
            onKeyDown={keepFocusInDialog}
          >
            <div className="block-result-orbit" aria-hidden="true">
              <i /><i /><i />
            </div>
            <p className="block-modal-kicker">本局完成</p>
            <h2 id="block-result-title">星阵已经挤满</h2>
            <strong className="block-final-score">{game.score.toLocaleString()}</strong>
            <span className="block-final-label">本局分数</span>
            <div className="block-result-stats">
              <span>消除 <b>{game.lines}</b></span>
              <span>落块 <b>{game.moves}</b></span>
              <span>最高连消 <b>{game.maxCombo}</b></span>
            </div>
            <button className="block-play-again" type="button" onClick={restart} autoFocus>
              再来一局
            </button>
            <Link href="/">返回游戏厅</Link>
          </section>
        </div>
      )}
    </main>
  );
}
