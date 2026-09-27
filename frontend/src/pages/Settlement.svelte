<script lang="ts">
  import { onMount } from 'svelte'
  import EmptyBox from '../components/common/EmptyBox.svelte'
  import { carverStore } from '../stores/carverStore'
  import { workPointStore } from '../stores/workPointStore'
  import { SIZE_TIERS, TIER_POINTS, currentMonthKey, formatPoints, monthLabel } from '../utils/points'
  import { downloadJson, downloadText } from '../utils/export'

  const availableMonths = workPointStore.availableMonths

  let selectedMonth = $state(currentMonthKey())

  const monthEntries = $derived($workPointStore.filter((entry) => entry.month === selectedMonth))
  const summaries = $derived(workPointStore.summarizeMonth($workPointStore, selectedMonth))
  const validCount = $derived(monthEntries.filter((entry) => entry.status === '有效').length)
  const cancelledCount = $derived(monthEntries.length - validCount)
  const totalPoints = $derived(summaries.reduce((sum, summary) => sum + summary.points, 0))

  onMount(() => {
    void Promise.all([workPointStore.load(), carverStore.load()])
  })

  function exportJson(): void {
    downloadJson(`工分结算-${selectedMonth}.json`, {
      exportedAt: new Date().toISOString(),
      month: selectedMonth,
      rule: {
        tierPoints: TIER_POINTS,
        apprentice: '学徒按半档计',
        note: '退回在刻的版片已撤销当笔，不计入汇总；幅面改动后当月当笔按新档位重算。',
      },
      summaries,
      entries: monthEntries,
    })
  }

  function exportCsv(): void {
    const header = '月份,刻工,等级,有效笔数,小幅,中幅,大幅,撤销笔数,工分合计'
    const rows = summaries.map((summary) =>
      [
        selectedMonth,
        summary.carverName,
        summary.skillLevel,
        summary.validCount,
        summary.tierCounts['小幅'],
        summary.tierCounts['中幅'],
        summary.tierCounts['大幅'],
        summary.cancelledCount,
        formatPoints(summary.points),
      ].join(','),
    )
    downloadText(`工分结算-${selectedMonth}.csv`, '\uFEFF' + [header, ...rows].join('\n'), 'text/csv;charset=utf-8')
  }
</script>

<svelte:head>
  <title>工分结算 · 木版年画刻版工序档案</title>
</svelte:head>

<div class="page-heading">
  <div>
    <p class="eyebrow">按件记工</p>
    <h1>工分结算</h1>
    <p>
      小幅 {TIER_POINTS['小幅']} 分 · 中幅 {TIER_POINTS['中幅']} 分 · 大幅 {TIER_POINTS['大幅']} 分，学徒接活按半档计。
      退回在刻的版片当笔撤账，不计入汇总。
    </p>
  </div>
  <div class="heading-actions">
    <button class="button ghost" data-testid="export-csv" type="button" onclick={exportCsv}>导出 CSV</button>
    <button class="button primary" data-testid="export-json" type="button" onclick={exportJson}>导出结算单</button>
  </div>
</div>

<section class="filter-bar" aria-label="结算月份">
  <label>
    <span>结算月份</span>
    <select data-testid="filter-month" bind:value={selectedMonth}>
      {#each $availableMonths as month}
        <option value={month}>{monthLabel(month)}</option>
      {/each}
    </select>
  </label>
  <p>{monthLabel(selectedMonth)} · 共 {monthEntries.length} 笔记录</p>
</section>

<section class="summary-strip" aria-label="结算概况">
  <div><span>有效笔数</span><strong data-testid="count-valid">{validCount}</strong></div>
  <div><span>撤销笔数</span><strong>{cancelledCount}</strong></div>
  <div><span>工分合计</span><strong data-testid="total-points">{formatPoints(totalPoints)}</strong></div>
  <div><span>记工刻工</span><strong>{summaries.length}</strong></div>
</section>

{#if monthEntries.length === 0}
  <EmptyBox
    title="这个月还没有工分记录"
    message="刻工在版片编排台把版标成刻成后，这里会按人汇总当月工分。"
  />
{:else}
  <section class="panel">
    <div class="panel-heading">
      <div>
        <span class="section-kicker">按人汇总</span>
        <h2>{monthLabel(selectedMonth)}结算单</h2>
      </div>
      <span class="sync-note">撤销的 {cancelledCount} 笔不计入工分</span>
    </div>
    <div class="table-scroll">
      <table class="data-table settlement-table">
        <thead>
          <tr>
            <th>刻工</th>
            <th>等级</th>
            {#each SIZE_TIERS as tier}<th>{tier}</th>{/each}
            <th>有效笔数</th>
            <th>撤销</th>
            <th>工分合计</th>
          </tr>
        </thead>
        <tbody>
          {#each summaries as summary (summary.key)}
            <tr data-testid="row-settlement">
              <td><strong>{summary.carverName}</strong></td>
              <td><span class="tag">{summary.skillLevel || '未入档'}</span></td>
              {#each SIZE_TIERS as tier}
                <td>{summary.tierCounts[tier]} 笔</td>
              {/each}
              <td>{summary.validCount} 笔</td>
              <td>{summary.cancelledCount > 0 ? `${summary.cancelledCount} 笔` : '—'}</td>
              <td><strong class="points-strong">{formatPoints(summary.points)} 分</strong></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <div class="panel-heading">
      <div>
        <span class="section-kicker">逐笔明细</span>
        <h2>当月记账往来</h2>
      </div>
      <strong>{monthEntries.length} 笔</strong>
    </div>
    <div class="table-scroll">
      <table class="data-table settlement-table">
        <thead>
          <tr>
            <th>记账时间</th>
            <th>版片</th>
            <th>刻工</th>
            <th>幅面档位</th>
            <th>工分</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {#each monthEntries as entry (entry.id)}
            <tr class:voided={entry.status === '已撤销'} data-testid="row-entry">
              <td>{entry.recordedAt.replace('T', ' ')}</td>
              <td><strong>{entry.blockName}</strong></td>
              <td>{entry.carverName}<small>{entry.skillLevel}</small></td>
              <td>{entry.sizeTier}</td>
              <td>{formatPoints(entry.points)} 分</td>
              <td>
                <span class="tag">{entry.status}</span>
                {#if entry.status === '已撤销'}
                  <small>{entry.cancelReason}{entry.cancelledAt ? ` · ${entry.cancelledAt.replace('T', ' ')}` : ''}</small>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}
