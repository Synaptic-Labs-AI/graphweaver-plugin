<!--src/components/modals/StatusHistoryModal.svelte-->
<script context="module" lang="ts">
  import { Modal, Setting, setIcon, type App } from 'obsidian';
  import type { ProcessingStatus, ProcessingStats } from '@type/processing.types';
  import type { SvelteComponent } from 'svelte';
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
  } from 'chart.js';

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );

  export class StatusHistoryModal extends Modal {
    component!: SvelteComponent;
    
    constructor(
      app: App,
      private currentStatus: ProcessingStatus,
      private recentStats: ProcessingStats[]
    ) {
      super(app);
    }

    onOpen(): void {
      this.titleEl.setText('Processing History');
      
      // Use the Svelte component constructor directly from this file
      this.component = new (this.constructor as any).$$render({
        target: this.contentEl,
        props: {
          app: this.app,
          currentStatus: this.currentStatus,
          recentStats: this.recentStats,
          onClose: () => this.close()
        }
      });
    }

    onClose(): void {
      this.component?.$destroy();
      this.contentEl.empty();
    }
  }
</script>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let app: App;
  export let currentStatus: ProcessingStatus;
  export let recentStats: ProcessingStats[];
  export let onClose: () => void;

  let containerEl: HTMLElement;
  let activeTab = 'overview';
  let chart: ChartJS | null = null;
  let canvasEl: HTMLCanvasElement;

  interface SummaryStats {
    totalProcessed: number;
    totalErrors: number;
    avgProcessingTime: number;
    successRate: number;
  }

  $: summaryStats = calculateSummaryStats(recentStats);

  onMount(() => {
    renderContent();
  });

  onDestroy(() => {
    chart?.destroy();
  });

  function calculateSummaryStats(stats: ProcessingStats[]): SummaryStats {
    const summary = stats.reduce((acc, stat) => ({
      totalProcessed: acc.totalProcessed + stat.processedFiles,
      totalErrors: acc.totalErrors + stat.errorFiles,
      totalTime: acc.totalTime + (stat.averageProcessingTime * stat.processedFiles),
      successCount: acc.successCount + (stat.processedFiles - stat.errorFiles)
    }), {
      totalProcessed: 0,
      totalErrors: 0,
      totalTime: 0,
      successCount: 0
    });

    return {
      totalProcessed: summary.totalProcessed,
      totalErrors: summary.totalErrors,
      avgProcessingTime: summary.totalProcessed ? summary.totalTime / summary.totalProcessed : 0,
      successRate: summary.totalProcessed ? (summary.successCount / summary.totalProcessed) * 100 : 0
    };
  }

  function renderContent(): void {
    if (!containerEl) return;
    containerEl.empty();

    // Tab Selection
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Overview')
        .setCta()
        .onClick(() => {
          activeTab = 'overview';
          renderContent();
        }))
      .addButton(button => button
        .setButtonText('History')
        .setCta()
        .onClick(() => {
          activeTab = 'history';
          renderContent();
        }));

    if (activeTab === 'overview') {
      renderOverview();
    } else {
      renderHistory();
    }
  }

  function renderOverview(): void {
    // Stats Cards
    const statsEl = containerEl.createDiv('stats-grid');
    
    const stats = [
      { icon: 'file', label: 'Files Processed', value: summaryStats.totalProcessed },
      { icon: 'check-circle', label: 'Success Rate', value: `${summaryStats.successRate.toFixed(1)}%` },
      { icon: 'clock', label: 'Avg Processing Time', value: `${summaryStats.avgProcessingTime.toFixed(1)}s` },
      { icon: 'x-circle', label: 'Total Errors', value: summaryStats.totalErrors }
    ];

    stats.forEach(stat => {
      const card = new Setting(statsEl)
        .setClass('stat-card')
        .setHeading()
        .setName(stat.label)
        .setDesc(stat.value.toString());

      const iconEl = card.controlEl.createDiv('stat-icon');
      setIcon(iconEl, stat.icon);
    });

    // Chart
    const chartEl = containerEl.createDiv('chart-container');
    canvasEl = chartEl.createEl('canvas');
    initializeChart();
  }

  function renderHistory(): void {
    const tableEl = containerEl.createDiv('history-table-container');
    const table = tableEl.createEl('table', { cls: 'history-table' });
    
    // Header
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    ['Date', 'Files Processed', 'Errors', 'Success Rate', 'Avg. Time']
      .forEach(text => headerRow.createEl('th', { text }));

    // Body
    const tbody = table.createEl('tbody');
    recentStats.forEach(stat => {
      const row = tbody.createEl('tr');
      
      row.createEl('td', { text: new Date(stat.startTime).toLocaleString() });
      row.createEl('td', { text: stat.processedFiles.toString(), cls: 'align-right' });
      
      const errorCell = row.createEl('td', { 
        text: stat.errorFiles.toString(),
        cls: `align-right ${stat.errorFiles > 0 ? 'status-error' : 'status-success'}`
      });

      const successRate = ((stat.processedFiles - stat.errorFiles) / stat.processedFiles * 100);
      row.createEl('td', { 
        text: `${successRate.toFixed(1)}%`,
        cls: `align-right ${successRate < 90 ? 'status-warning' : 'status-success'}`
      });

      row.createEl('td', { 
        text: `${stat.averageProcessingTime.toFixed(2)}s`,
        cls: 'align-right'
      });
    });
  }

  function initializeChart(): void {
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const dailyStats = prepareDailyStats();
    
    chart?.destroy();
    chart = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: dailyStats.labels,
        datasets: [
          {
            label: 'Processed Files',
            data: dailyStats.processed,
            borderColor: 'var(--color-green)',
            backgroundColor: 'rgba(0, 128, 0, 0.1)',
            tension: 0.1,
            fill: true
          },
          {
            label: 'Errors',
            data: dailyStats.errors,
            borderColor: 'var(--color-red)',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            tension: 0.1,
            fill: true
          }
        ]
      },
      options: getChartOptions()
    });
  }

  function prepareDailyStats() {
    const dailyStats = new Map<string, { processed: number; errors: number }>();
    
    recentStats.forEach(stat => {
      const date = new Date(stat.startTime).toLocaleDateString();
      const existing = dailyStats.get(date) || { processed: 0, errors: 0 };
      
      dailyStats.set(date, {
        processed: existing.processed + stat.processedFiles,
        errors: existing.errors + stat.errorFiles
      });
    });

    const sortedDates = Array.from(dailyStats.keys())
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    return {
      labels: sortedDates,
      processed: sortedDates.map(date => dailyStats.get(date)?.processed || 0),
      errors: sortedDates.map(date => dailyStats.get(date)?.errors || 0)
    };
  }

  function getChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index' as const
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'var(--background-modifier-border)'
          },
          ticks: {
            color: 'var(--text-muted)'
          }
        },
        x: {
          grid: {
            color: 'var(--background-modifier-border)'
          },
          ticks: {
            color: 'var(--text-muted)'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: 'var(--text-normal)',
            usePointStyle: true
          }
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'var(--background-secondary)',
          borderColor: 'var(--background-modifier-border)',
          borderWidth: 1,
          titleColor: 'var(--text-normal)',
          bodyColor: 'var(--text-muted)'
        }
      }
    };
  }
</script>

<div class="status-history-container" bind:this={containerEl}></div>

<style>
  .status-history-container {
    display: flex;
    flex-direction: column;
    gap: var(--size-4);
    padding: var(--size-4);
    height: 100%;
  }

  :global(.stats-grid) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--size-4);
    margin-bottom: var(--size-4);
  }

  :global(.stat-card) {
    background-color: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: var(--size-4);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  :global(.stat-card .setting-item-info) {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  :global(.stat-card .setting-item-name) {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  :global(.stat-card .setting-item-description) {
    font-size: 1.2em;
    font-weight: var(--font-bold);
    color: var(--text-normal);
  }

  :global(.stat-icon) {
    color: var(--text-muted);
    width: 24px;
    height: 24px;
    margin-bottom: var(--size-2);
  }

  :global(.chart-container) {
    height: 300px;
    margin: var(--size-4) 0;
  }

  :global(.history-table-container) {
    overflow-x: auto;
    margin-top: var(--size-4);
  }

  :global(.history-table) {
    width: 100%;
    border-collapse: collapse;
  }

  :global(.history-table th),
  :global(.history-table td) {
    padding: var(--size-2) var(--size-4);
    border-bottom: 1px solid var(--background-modifier-border);
    text-align: left;
  }

  :global(.align-right) {
    text-align: right;
  }

  :global(.status-error) {
    color: var(--color-red);
  }

  :global(.status-warning) {
    color: var(--color-yellow);
  }

  :global(.status-success) {
    color: var(--color-green);
  }
</style>