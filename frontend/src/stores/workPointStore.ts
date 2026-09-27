import { derived, writable } from 'svelte/store'
import type { Block, SizeTier } from '../types/block'
import type { WorkPointEntry } from '../types/workPoint'
import { db } from '../utils/db'
import { monthKey, pointsFor } from '../utils/workPoints'

const entryList = writable<WorkPointEntry[]>([])

const currentMonthPoints = derived(entryList, ($entries) => {
  const month = monthKey()
  const totals: Record<string, number> = {}
  for (const entry of $entries) {
    if (entry.status !== '在账' || entry.month !== month) continue
    totals[entry.carverId] = (totals[entry.carverId] ?? 0) + entry.points
  }
  return totals
})

async function load(): Promise<void> {
  const records = await db.workPoints.toArray()
  records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  entryList.set(records)
}

export type RecordOutcome = 'recorded' | 'duplicate' | 'no-carver'

export interface RecordResult {
  outcome: RecordOutcome
  entry: WorkPointEntry | null
}

async function recordCarved(block: Block): Promise<RecordResult> {
  const existing = await db.workPoints.where('blockId').equals(block.id).toArray()
  if (existing.some((entry) => entry.status === '在账')) return { outcome: 'duplicate', entry: null }

  const carver = await db.carvers.where('name').equals(block.carvedBy).first()
  if (!carver) return { outcome: 'no-carver', entry: null }

  const now = new Date()
  const entry: WorkPointEntry = {
    id: `wp-${crypto.randomUUID()}`,
    blockId: block.id,
    blockName: block.blockName,
    carverId: carver.id,
    carverName: carver.name,
    skillLevel: carver.skillLevel,
    sizeTier: block.sizeTier,
    points: pointsFor(block.sizeTier, carver.skillLevel),
    month: monthKey(now),
    recordedAt: now.toISOString(),
    status: '在账',
    revokedAt: null,
    note: '标刻成记工分',
  }
  await db.workPoints.add(entry)
  await load()
  return { outcome: 'recorded', entry }
}

async function revokeForBlock(blockId: string): Promise<boolean> {
  const actives = await db.workPoints
    .where('blockId')
    .equals(blockId)
    .filter((entry) => entry.status === '在账')
    .toArray()
  if (actives.length === 0) return false

  const revokedAt = new Date().toISOString()
  await db.transaction('rw', db.workPoints, async () => {
    for (const entry of actives) {
      await db.workPoints.update(entry.id, { status: '已撤销', revokedAt })
    }
  })
  await load()
  return true
}

async function recalcForBlock(blockId: string, sizeTier: SizeTier): Promise<boolean> {
  const month = monthKey()
  const targets = await db.workPoints
    .where('blockId')
    .equals(blockId)
    .filter((entry) => entry.status === '在账' && entry.month === month)
    .toArray()
  if (targets.length === 0) return false

  await db.transaction('rw', db.workPoints, async () => {
    for (const entry of targets) {
      await db.workPoints.update(entry.id, {
        sizeTier,
        points: pointsFor(sizeTier, entry.skillLevel),
      })
    }
  })
  await load()
  return true
}

export const workPointStore = {
  subscribe: entryList.subscribe,
  currentMonthPoints,
  load,
  recordCarved,
  revokeForBlock,
  recalcForBlock,
}
