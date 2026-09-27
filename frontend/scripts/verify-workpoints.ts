import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

Object.assign(globalThis, { indexedDB, IDBKeyRange })

const { db, initializeDatabase } = await import('../src/utils/db')
const { workPointStore } = await import('../src/stores/workPointStore')
const { currentMonthKey } = await import('../src/utils/points')

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
}

await initializeDatabase()

const blocks = await db.blocks.toArray()
check('种子版片全部带幅面档位', blocks.every((b) => Boolean(b.sizeTier)), true)

const seedEntries = await db.workPoints.toArray()
check('种子工分笔数', seedEntries.length, 7)
check('种子含一笔退回撤账', seedEntries.filter((e) => e.status === '已撤销').length, 1)

// 1. 标刻成记账：block-mk-01 齐师傅(师傅) 大幅 → 3 分
const mk01 = (await db.blocks.get('block-mk-01'))!
const r1 = await workPointStore.recordCarved(mk01)
check('标刻成记一笔', r1.created, true)
check('大幅师傅得 3 分', r1.entry?.points, 3)
check('记入当月', r1.entry?.month, currentMonthKey())

// 2. 同一块版连着标两次只算一笔
const r2 = await workPointStore.recordCarved(mk01)
check('连着标第二次不重复记', r2.created, false)
const mk01Entries = await db.workPoints.where('blockId').equals('block-mk-01').toArray()
check('该版仍只有一笔有效', mk01Entries.filter((e) => e.status === '有效').length, 1)

// 3. 幅面中途改了，当月那笔按新档位重算
const recalculated = await workPointStore.retierBlock((await db.blocks.get('block-mk-01'))!, '小幅')
check('改档触发当月重算', recalculated, true)
const afterRetier = await db.workPoints.get(r1.entry!.id)
check('重算后 1 分', afterRetier?.points, 1)
check('账目档位同步为小幅', afterRetier?.sizeTier, '小幅')

// 4. 退回在刻撤掉那一笔
const cancelled = await workPointStore.cancelActiveForBlock('block-mk-01')
check('退回撤一笔', cancelled, 1)
const afterCancel = await db.workPoints.get(r1.entry!.id)
check('撤账后状态', afterCancel?.status, '已撤销')

// 5. 之后再刻成按新的一笔重记（沿用新档位小幅）
const r3 = await workPointStore.recordCarved((await db.blocks.get('block-mk-01'))!)
check('再刻成开新账', r3.created, true)
check('新账按新档位 1 分', r3.entry?.points, 1)
const mk01All = await db.workPoints.where('blockId').equals('block-mk-01').toArray()
check('该版一撤一有效共两笔', mk01All.length, 2)

// 6. 学徒接的按半档算：block-ms-03 陈小满(学徒) 大幅 → 1.5 分
const ms03 = (await db.blocks.get('block-ms-03'))!
const r4 = await workPointStore.recordCarved(ms03)
check('学徒大幅半档 1.5 分', r4.entry?.points, 1.5)

// 7. 未指派刻工不记账
const noCarver = await workPointStore.recordCarved({ ...ms03, id: 'block-x', carvedBy: '' })
check('未指派不记账', noCarver.created, false)

// 8. 退回已撤销账的版（block-ms-02 种子撤账）→ 没有在账可撤
const cancelledTwice = await workPointStore.cancelActiveForBlock('block-ms-02')
check('已撤账的版无可撤', cancelledTwice, 0)

// 9. 历史月份的账不受当月改档影响：block-ll-02 账在 2025-12
const ll02 = (await db.blocks.get('block-ll-02'))!
const recalcOld = await workPointStore.retierBlock(ll02, '大幅')
check('往月账不随改档重算', recalcOld, false)
const ll02Entry = await db.workPoints.get('wp-ll-02')
check('往月账仍是 2 分', ll02Entry?.points, 2)

// 10. 当月按人汇总
const all = await db.workPoints.toArray()
const summaries = workPointStore.summarizeMonth(all, currentMonthKey())
const qi = summaries.find((s) => s.carverName === '齐师傅')
const chen = summaries.find((s) => s.carverName === '陈小满')
check('齐师傅当月 1 分（小幅）', qi?.points, 1)
check('陈小满当月 1.5 分', chen?.points, 1.5)
check('汇总不含已撤销的分数', summaries.reduce((sum, s) => sum + s.points, 0), 2.5)

const dec = workPointStore.summarizeMonth(all, '2025-12')
check('2025-12 汇总 4 人', dec.length, 4)
check('2025-12 合计 7 分', dec.reduce((sum, s) => sum + s.points, 0), 7)

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项未通过`)
process.exit(failures === 0 ? 0 : 1)
