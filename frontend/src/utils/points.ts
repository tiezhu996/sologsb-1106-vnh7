import type { SizeTier } from '../types/block'
import type { SkillLevel } from '../types/carver'

export const SIZE_TIERS: SizeTier[] = ['小幅', '中幅', '大幅']

export const TIER_POINTS: Record<SizeTier, number> = {
  小幅: 1,
  中幅: 2,
  大幅: 3,
}

export function pointsFor(tier: SizeTier, skillLevel: SkillLevel): number {
  const base = TIER_POINTS[tier]
  return skillLevel === '学徒' ? base / 2 : base
}

export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1)
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function localTimestamp(now: Date = new Date()): string {
  return `${currentMonthKey(now)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

export function monthLabel(month: string): string {
  const [year, mm] = month.split('-')
  return `${year} 年 ${Number(mm)} 月`
}
