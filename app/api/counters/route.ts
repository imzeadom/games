import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { counters } from "../../../db/schema";

async function getDb() {
  return (await import("../../../db/index")).getDb();
}

const COOKIE = "paper_arcade_counter_owner";
const MAX_COUNTERS = 30;
const MAX_VALUE = 1_000_000_000;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function json(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function ownerFrom(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const value = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9-]{36}$/i.test(value) ? value : crypto.randomUUID();
}

function withOwner(response: NextResponse, owner: string, request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const current = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (current !== owner) {
    response.cookies.set(COOKIE, owner, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 5,
    });
  }
  return response;
}

function parseBody(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("请求内容无效。");
  const input = body as Record<string, unknown>;
  const name = input.name === undefined ? undefined : String(input.name).trim();
  if (name !== undefined && (!name || name.length > 30)) throw new Error("名称需为 1–30 个字符。");
  const value = input.initialValue === undefined ? undefined : Number(input.initialValue);
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < -MAX_VALUE || value > MAX_VALUE)
  ) {
    throw new Error("初始值需为 -1,000,000,000 至 1,000,000,000 的整数。");
  }
  const color = input.color === undefined ? undefined : String(input.color);
  if (color !== undefined && !HEX_COLOR.test(color)) throw new Error("请输入六位十六进制颜色，例如 #b4553d。");
  return { name, value, color };
}

export async function GET(request: Request) {
  const owner = ownerFrom(request);
  const db = await getDb();
  const rows = await db
    .select()
    .from(counters)
    .where(eq(counters.ownerId, owner))
    .orderBy(asc(counters.createdAt));
  return withOwner(json({ counters: rows }), owner, request);
}

export async function POST(request: Request) {
  const owner = ownerFrom(request);
  try {
    const db = await getDb();
    const input = parseBody(await request.json());
    if (!input.name) throw new Error("请输入计数器名称。");
    const existing = await db.select({ id: counters.id }).from(counters).where(eq(counters.ownerId, owner));
    if (existing.length >= MAX_COUNTERS) throw new Error("最多可以创建 30 个计数器。");
    const now = Date.now();
    const row = {
      id: crypto.randomUUID(),
      ownerId: owner,
      name: input.name,
      initialValue: input.value ?? 0,
      currentValue: input.value ?? 0,
      color: input.color ?? "#b4553d",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(counters).values(row);
    return withOwner(json({ counter: row }, { status: 201 }), owner, request);
  } catch (error) {
    return withOwner(json({ error: error instanceof Error ? error.message : "创建失败。" }, { status: 400 }), owner, request);
  }
}

export { COOKIE, MAX_VALUE, ownerFrom, json, withOwner };
