import { derived, writable } from 'svelte/store'
import type { Block, SizeTier } from '../types/block'
import type { SkillLevel } from '../types/carver'
import type { WorkPointEntry } from '../types/workPoint'
import { currentMonthKey, localTimestamp, pointsFor } from '../utils/points'
import { db } from '../utils/db'

export interface CarverMonthSummary {
  key: string
  carverId: string
  carverName: string
  skillLevel: SkillLevel | ''
  validCount: number
  cancelledCount: number
  tierCounts: Record<SizeTier, number>
  points: number
}

const entryList = writable<WorkPointEntry[]>([])

const availableMonths = derived(entryList, ($entries) => {
  const months = new Set<string>([currentMonthKey()])
  for (const entry of $entries) months.add(entry.month)
  return [...months].sort((a, b) => b.localeCompare(a))
})

const currentMonthByCarver = derived(entryList, ($entries) => {
  const month = currentMonthKey()
  const summary: Record<string, { points: number; validCount: number }> = {}
  for (const entry of $entries) {
    if (entry.month !== month || entry.status !== '有效') continue
    const key = entry.carverId || entry.carverName
    const slot = summary[key] ?? { points: 0, validCount: 0 }
    slot.points += entry.points
    slot.validCount += 1
    summary[key] = slot
  }
  return summary
})

function summarizeMonth(entries: WorkPointEntry[], month: string): CarverMonthSummary[] {
  const byCarver = new Map<string, CarverMonthSummary>()
  for (const entry of entries) {
    if (entry.month !== month) continue
    const key = entry.carverId || entry.carverName
    const summary =
      byCarver.get(key) ??
      ({
        key,
        carverId: entry.carverId,
        carverName: entry.carverName,
        skillLevel: entry.skillLevel,
        validCount: 0,
        cancelledCount: 0,
        tierCounts: { 小幅: 0, 中幅: 0, 大幅: 0 },
        points: 0,
      } satisfies CarverMonthSummary)
    if (entry.status === '有效') {
      summary.validCount += 1
      summary.tierCounts[entry.sizeTier] += 1
      summary.points += entry.points
    } else {
      summary.cancelledCount += 1
    }
    byCarver.set(key, summary)
  }
  return [...byCarver.values()].sort((a, b) => b.points - a.points || a.carverName.localeCompare(b.carverName, 'zh-CN'))
}

async function load(): Promise<void> {
  const records = await db.workPoints.toArray()
  records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  entryList.set(records)
}

export interface RecordResult {
  created: boolean
  entry: WorkPointEntry | null
}

async function recordCarved(block: Block): Promise<RecordResult> {
  if (!block.carvedBy) return { created: false, entry: null }

  let result: RecordResult = { created: false, entry: null }
  await db.transaction('rw', db.workPoints, db.carvers, async () => {
    const active = await db.workPoints
      .where('blockId')
      .equals(block.id)
      .filter((entry) => entry.status === '有效')
      .first()
    if (active) {
      result = { created: false, entry: active }
      return
    }

    const carver = await db.carvers.where('name').equals(block.carvedBy).first()
    const skillLevel: SkillLevel = carver?.skillLevel ?? '熟练'
    const recordedAt = localTimestamp()
    const entry: WorkPointEntry = {
      id: `wp-${crypto.randomUUID()}`,
      blockId: block.id,
      blockName: block.blockName,
      draftId: block.draftId,
      carverId: carver?.id ?? '',
      carverName: block.carvedBy,
      skillLevel,
      sizeTier: block.sizeTier,
      points: pointsFor(block.sizeTier, skillLevel),
      month: recordedAt.slice(0, 7),
      recordedAt,
      status: '有效',
      cancelledAt: null,
      cancelReason: '',
    }
    await db.workPoints.add(entry)
    result = { created: true, entry }
  })
  await load()
  return result
}

async function cancelActiveForBlock(blockId: string, reason = '退回在刻'): Promise<number> {
  let cancelled = 0
  await db.transaction('rw', db.workPoints, async () => {
    const actives = await db.workPoints
      .where('blockId')
      .equals(blockId)
      .filter((entry) => entry.status === '有效')
      .toArray()
    for (const entry of actives) {
      await db.workPoints.update(entry.id, {
        status: '已撤销',
        cancelledAt: localTimestamp(),
        cancelReason: reason,
      })
      cancelled += 1
    }
  })
  if (cancelled > 0) await load()
  return cancelled
}

async function retierBlock(block: Block, sizeTier: SizeTier): Promise<boolean> {
  let recalculated = false
  await db.transaction('rw', db.blocks, db.workPoints, async () => {
    await db.blocks.update(block.id, { sizeTier })
    const month = currentMonthKey()
    const current = await db.workPoints
      .where('blockId')
      .equals(block.id)
      .filter((entry) => entry.status === '有效' && entry.month === month)
      .first()
    if (current) {
      await db.workPoints.update(current.id, {
        sizeTier,
        points: pointsFor(sizeTier, current.skillLevel),
      })
      recalculated = true
    }
  })
  await load()
  return recalculated
}

export const workPointStore = {
  subscribe: entryList.subscribe,
  availableMonths,
  currentMonthByCarver,
  summarizeMonth,
  load,
  recordCarved,
  cancelActiveForBlock,
  retierBlock,
}
