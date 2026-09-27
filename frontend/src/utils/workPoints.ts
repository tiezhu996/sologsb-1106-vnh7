import type { SizeTier } from '../types/block'
import type { SkillLevel } from '../types/carver'

export const SIZE_TIERS: SizeTier[] = ['小幅', '中幅', '大幅']

export const TIER_POINTS: Record<SizeTier, number> = {
  小幅: 1,
  中幅: 2,
  大幅: 3,
}

export function pointsFor(sizeTier: SizeTier, skillLevel: SkillLevel): number {
  const base = TIER_POINTS[sizeTier]
  return skillLevel === '学徒' ? base / 2 : base
}

export function monthKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${year} 年 ${Number(month)} 月`
}

export function formatPoints(points: number): string {
  return Number.isInteger(points) ? `${points}` : points.toFixed(1)
}
