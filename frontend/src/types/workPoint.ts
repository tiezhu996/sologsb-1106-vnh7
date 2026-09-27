import type { SizeTier } from './block'
import type { SkillLevel } from './carver'

export type WorkPointStatus = '在账' | '已撤销'

export interface WorkPointEntry {
  id: string
  blockId: string
  blockName: string
  carverId: string
  carverName: string
  skillLevel: SkillLevel
  sizeTier: SizeTier
  points: number
  month: string
  recordedAt: string
  status: WorkPointStatus
  revokedAt: string | null
  note: string
}
