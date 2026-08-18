import { and, eq, sql } from "drizzle-orm";
import { counters } from "../../../../db/schema";
import { MAX_VALUE, json, ownerFrom, withOwner } from "../route";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
type Context = { params: Promise<{ id: string }> };
async function getDb() {
  return (await import("../../../../db/index")).getDb();
}

function inputNumber(value: unknown, allowNegative = false) {
  const number = Number(value);
  if (
    !Number.isInteger(number) ||
    (!allowNegative && number <= 0) ||
    number < -MAX_VALUE ||
    number > MAX_VALUE
  ) {
    throw new Error("请输入范围内的整数。");
  }
  return number;
}

async function rowFor(id: string, owner: string) {
  const db = await getDb();
  return db
    .select()
    .from(counters)
    .where(and(eq(counters.id, id), eq(counters.ownerId, owner)))
    .limit(1);
}

export async function PATCH(request: Request, context: Context) {
  const owner = ownerFrom(request);
  const { id } = await context.params;
  try {
    const db = await getDb();
    const body = (await request.json()) as Record<string, unknown>;
    const current = (await rowFor(id, owner))[0];
    if (!current) return withOwner(json({ error: "找不到这个计数器。" }, { status: 404 }), owner, request);
    let row;
    if (body.action !== undefined && !["delta", "recharge", "reset"].includes(String(body.action))) {
      throw new Error("不支持的操作。");
    }
    if (body.action === "delta" || body.action === "recharge") {
      const amount = inputNumber(body.amount ?? (body.action === "recharge" ? undefined : 1), body.action === "delta");
      row = (
        await db
          .update(counters)
          .set({
            currentValue: sql`MAX(-${MAX_VALUE}, MIN(${MAX_VALUE}, ${counters.currentValue} + ${amount}))`,
            updatedAt: Date.now(),
          })
          .where(and(eq(counters.id, id), eq(counters.ownerId, owner)))
          .returning()
      )[0];
    } else if (body.action === "reset") {
      row = (
        await db
          .update(counters)
          .set({ currentValue: counters.initialValue, updatedAt: Date.now() })
          .where(and(eq(counters.id, id), eq(counters.ownerId, owner)))
          .returning()
      )[0];
    } else {
      const updates: Partial<typeof counters.$inferInsert> = { updatedAt: Date.now() };
      if (body.name !== undefined) { const name = String(body.name).trim(); if (!name || name.length > 30) throw new Error("名称需为 1–30 个字符。"); updates.name = name; }
      if (body.color !== undefined) { const color = String(body.color); if (!HEX_COLOR.test(color)) throw new Error("请输入六位十六进制颜色，例如 #b4553d。"); updates.color = color; }
      if (body.initialValue !== undefined) { updates.initialValue = inputNumber(body.initialValue, true); }
      if (body.name === undefined && body.color === undefined && body.initialValue === undefined) throw new Error("请提供要修改的字段。");
      row = (
        await db
          .update(counters)
          .set(updates)
          .where(and(eq(counters.id, id), eq(counters.ownerId, owner)))
          .returning()
      )[0];
    }
    return withOwner(json({ counter: row }), owner, request);
  } catch (error) {
    return withOwner(json({ error: error instanceof Error ? error.message : "更新失败。" }, { status: 400 }), owner, request);
  }
}

export async function DELETE(request: Request, context: Context) {
  const owner = ownerFrom(request);
  const { id } = await context.params;
  const db = await getDb();
  const deleted = await db
    .delete(counters)
    .where(and(eq(counters.id, id), eq(counters.ownerId, owner)))
    .returning({ id: counters.id });
  return withOwner(json({ ok: deleted.length > 0 }), owner, request);
}
