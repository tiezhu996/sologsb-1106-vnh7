<script lang="ts">
  import { onMount } from 'svelte'
  import EmptyBox from '../components/common/EmptyBox.svelte'
  import { carverStore } from '../stores/carverStore'
  import { workPointStore } from '../stores/workPointStore'
  import { downloadJson } from '../utils/export'
  import { formatPoints, monthKey, monthLabel, SIZE_TIERS } from '../utils/workPoints'
  import type { SizeTier } from '../types/block'
  import type { SkillLevel } from '../types/carver'

  interface CarverSummary {
    carverId: string
    carverName: string
    skillLevel: SkillLevel
    tierCounts: Record<SizeTier, number>
    entryCount: number
    points: number
  }

  let selectedMonth = $state(monthKey())

  onMount(() => {
    void Promise.all([carverStore.load(), workPointStore.load()])
  })

  const months = $derived.by(() => {
    const known = new Set<string>([monthKey()])
    for (const entry of $workPointStore) known.add(entry.month)
    return [...known].sort((a, b) => b.localeCompare(a))
  })

  const monthEntries = $derived($workPointStore.filter((entry) => entry.month === selectedMonth))
  const activeEntries = $derived(monthEntries.filter((entry) => entry.status === '在账'))
  const revokedCount = $derived(monthEntries.length - activeEntries.length)
  const totalPoints = $derived(activeEntries.reduce((sum, entry) => sum + entry.points, 0))

  const summaries = $derived.by(() => {
    const byCarver = new Map<string, CarverSummary>()
    for (const entry of activeEntries) {
      const current =
        byCarver.get(entry.carverId) ??
        ({
          carverId: entry.carverId,
          carverName: entry.carverName,
          skillLevel: entry.skillLevel,
          tierCounts: { 小幅: 0, 中幅: 0, 大幅: 0 },
          entryCount: 0,
          points: 0,
        } satisfies CarverSummary)
      current.tierCounts[entry.sizeTier] += 1
      current.entryCount += 1
      current.points += entry.points
      byCarver.set(entry.carverId, current)
    }
    return [...byCarver.values()].sort((a, b) => b.points - a.points || a.carverName.localeCompare(b.carverName, 'zh-CN'))
  })

  function formatTime(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ')
  }

  function exportSettlement(): void {
    downloadJson(`工分结算-${selectedMonth}.json`, {
      exportedAt: new Date().toISOString(),
      month: selectedMonth,
      totals: {
        points: totalPoints,
        activeEntries: activeEntries.length,
        revokedEntries: revokedCount,
        carvers: summaries.length,
      },
      summary: summaries,
      entries: monthEntries,
    })
  }
</script>

<svelte:head>
  <title>工分结算 · 木版年画刻版工序档案</title>
</svelte:head>

<div class="page-heading">
  <div>
    <p class="eyebrow">月底对账</p>
    <h1>工分结算</h1>
    <p>按人汇总当月刻版工分：小幅 1 分、中幅 2 分、大幅 3 分，学徒按半档计。退回在刻的那一笔自动撤销，不再计入。</p>
  </div>
  <button class="button primary" data-testid="export-settlement" type="button" onclick={exportSettlement}>导出结算单</button>
</div>

<section class="filter-bar" aria-label="结算月份">
  <label>
    <span>结算月份</span>
    <select data-testid="filter-month" bind:value={selectedMonth}>
      {#each months as month}
        <option value={month}>{monthLabel(month)}</option>
      {/each}
    </select>
  </label>
  <p>在账 {activeEntries.length} 笔 · 已撤销 {revokedCount} 笔</p>
</section>

<section class="summary-strip four" aria-label="结算概况">
  <div><span>当月工分合计</span><strong data-testid="total-points">{formatPoints(totalPoints)}</strong></div>
  <div><span>记工人数</span><strong>{summaries.length}</strong></div>
  <div><span>在账笔数</span><strong>{activeEntries.length}</strong></div>
  <div><span>撤销笔数</span><strong>{revokedCount}</strong></div>
</section>

{#if monthEntries.length === 0}
  <EmptyBox title="这个月还没有工分流水" message="版片标刻成后，工分会按幅面档位自动记入当月。" />
{:else}
  <section class="panel">
    <div class="panel-heading">
      <div>
        <span class="section-kicker">按人汇总</span>
        <h2>{monthLabel(selectedMonth)}工分汇总</h2>
      </div>
    </div>
    <div class="table-scroll">
      <table class="data-table settlement-table">
        <thead>
          <tr>
            <th>刻工</th>
            <th>等级</th>
            {#each SIZE_TIERS as tier}<th>{tier}</th>{/each}
            <th>在账笔数</th>
            <th>工分合计</th>
          </tr>
        </thead>
        <tbody>
          {#each summaries as summary (summary.carverId)}
            <tr data-testid="row-settlement">
              <td><strong>{summary.carverName}</strong></td>
              <td><span class="tag">{summary.skillLevel}</span></td>
              {#each SIZE_TIERS as tier}
                <td>{summary.tierCounts[tier]} 笔</td>
              {/each}
              <td>{summary.entryCount} 笔</td>
              <td><strong>{formatPoints(summary.points)} 分</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-heading">
      <div>
        <span class="section-kicker">流水明细</span>
        <h2>当月记账与撤销记录</h2>
      </div>
    </div>
    <div class="table-scroll">
      <table class="data-table settlement-table">
        <thead>
          <tr>
            <th>记账时间</th>
            <th>刻工</th>
            <th>版片</th>
            <th>档位</th>
            <th>工分</th>
            <th>状态</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {#each monthEntries as entry (entry.id)}
            <tr class:revoked={entry.status === '已撤销'} data-testid="row-entry">
              <td>{formatTime(entry.recordedAt)}</td>
              <td><strong>{entry.carverName}</strong></td>
              <td>{entry.blockName}</td>
              <td>{entry.sizeTier}</td>
              <td>{formatPoints(entry.points)} 分</td>
              <td><span class="tag">{entry.status}</span></td>
              <td>{entry.note}{entry.revokedAt ? ` · ${formatTime(entry.revokedAt)} 撤销` : ''}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}
