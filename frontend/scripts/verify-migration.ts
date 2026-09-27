import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

Object.assign(globalThis, { indexedDB, IDBKeyRange })

const { default: Dexie } = await import('dexie')

// 先以旧版 v2 结构建库，模拟老用户已有的数据
const legacy = new Dexie('gbwoodprint-db')
legacy.version(1).stores({
  drafts: 'id, genre, status, title',
  blocks: 'id, draftId, colorNo, carvedBy, state',
  carvers: 'id, specialty, skillLevel, name',
  batches: 'id, draftId, batchNo, printedAt',
  nodes: 'id, batchId, blockId, stage, seq, operator',
})
legacy.version(2).stores({
  drafts: 'id, genre, status, title, schemaRev',
  blocks: 'id, draftId, colorNo, carvedBy, state, schemaRev',
  carvers: 'id, specialty, skillLevel, name, schemaRev',
  batches: 'id, draftId, batchNo, printedAt, schemaRev',
  nodes: 'id, batchId, blockId, stage, seq, operator, schemaRev',
})
await legacy.open()
await legacy.table('blocks').add({
  id: 'block-legacy-01',
  draftId: 'draft-legacy',
  blockName: '墨线版',
  colorNo: 1,
  woodType: '梨木',
  thicknessMm: 18,
  carvedBy: '老刻工',
  state: '已刻成',
  defectNote: '',
  schemaRev: 2,
})
legacy.close()

// 再用新代码打开同一个库，触发 v3 升级
const { db } = await import('../src/utils/db')
await db.open()

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
}

check('库版本升到 3', db.verno, 3)
const migrated = await db.blocks.get('block-legacy-01')
check('老版片回填默认档位', migrated?.sizeTier, '中幅')
check('老版片数据保留', migrated?.carvedBy, '老刻工')
check('schemaRev 升到 3', (migrated as unknown as Record<string, unknown>)?.schemaRev, 3)
check('工分表已建好', await db.workPoints.count(), 0)

console.log(failures === 0 ? '\n迁移验证通过' : `\n${failures} 项未通过`)
process.exit(failures === 0 ? 0 : 1)
