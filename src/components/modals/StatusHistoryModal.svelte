<script lang="ts">
    import { onMount } from 'svelte';
    import { Tabs, TabItem } from 'flowbite-svelte';
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
    import { Line } from 'svelte-chartjs';
    import { setIcon, type App } from 'obsidian';
    import type { ProcessingStatus, ProcessingStats } from '../../types/processing.types';

    // Register ChartJS components
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

    export let app: App;
    export let currentStatus: ProcessingStatus;
    export let recentStats: ProcessingStats[];
    export let onClose: () => void;

    let activeTab = 0;
    let fileIconEl: HTMLElement;
    let successIconEl: HTMLElement;
    let timeIconEl: HTMLElement;
    let errorIconEl: HTMLElement;

    // Reactive summary stats calculation
    $: summaryStats = calculateSummaryStats(recentStats);

    // Reactive chart data preparation
    $: chartData = prepareChartData(recentStats);

    function calculateSummaryStats(stats: ProcessingStats[]) {
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
            ...summary,
            avgProcessingTime: summary.totalProcessed ? summary.totalTime / summary.totalProcessed : 0,
            successRate: summary.totalProcessed ? (summary.successCount / summary.totalProcessed) * 100 : 0
        };
    }

    function prepareChartData(stats: ProcessingStats[]) {
        const dailyStats = stats.reduce((acc, stat) => {
            const date = new Date(stat.startTime).toLocaleDateString();
            const existing = acc.get(date) || { processed: 0, errors: 0 };
            
            acc.set(date, {
                processed: existing.processed + stat.processedFiles,
                errors: existing.errors + stat.errorFiles
            });
            return acc;
        }, new Map<string, { processed: number; errors: number }>());

        const sortedDates = Array.from(dailyStats.keys())
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        return {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Processed Files',
                    data: sortedDates.map(date => dailyStats.get(date)?.processed || 0),
                    borderColor: 'var(--color-green)',
                    backgroundColor: 'rgba(0, 128, 0, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Errors',
                    data: sortedDates.map(date => dailyStats.get(date)?.errors || 0),
                    borderColor: 'var(--color-red)',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    tension: 0.1,
                    fill: true
                }
            ]
        };
    }

    const chartOptions = {
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

    onMount(() => {
        if (fileIconEl) setIcon(fileIconEl, 'file');
        if (successIconEl) setIcon(successIconEl, 'check-circle');
        if (timeIconEl) setIcon(timeIconEl, 'clock');
        if (errorIconEl) setIcon(errorIconEl, 'x-circle');
    });
</script>

<div class="status-history-modal">
    <header class="modal-header">
      <h2>Processing History</h2>
      <button class="modal-close" on:click={onClose}>
        <div bind:this={fileIconEl}></div>
      </button>
    </header>
  
    <div class="modal-content">
      <Tabs style="pill" bind:activeTab>
        <TabItem open title="Overview">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon" bind:this={fileIconEl}></div>
              <div class="stat-info">
                <span class="stat-label">Files Processed</span>
                <span class="stat-value">{summaryStats.totalProcessed}</span>
              </div>
            </div>
  
            <div class="stat-card">
              <div class="stat-icon" bind:this={successIconEl}></div>
              <div class="stat-info">
                <span class="stat-label">Success Rate</span>
                <span class="stat-value">{summaryStats.successRate.toFixed(1)}%</span>
              </div>
            </div>
  
            <div class="stat-card">
              <div class="stat-icon" bind:this={timeIconEl}></div>
              <div class="stat-info">
                <span class="stat-label">Avg Processing Time</span>
                <span class="stat-value">{summaryStats.avgProcessingTime.toFixed(1)}s</span>
              </div>
            </div>
  
            <div class="stat-card">
              <div class="stat-icon" bind:this={errorIconEl}></div>
              <div class="stat-info">
                <span class="stat-label">Total Errors</span>
                <span class="stat-value">{summaryStats.totalErrors}</span>
              </div>
            </div>
          </div>
  
          <div class="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        </TabItem>
  
        <TabItem title="History">
          <div class="history-table-container">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="align-right">Files Processed</th>
                  <th class="align-right">Errors</th>
                  <th class="align-right">Success Rate</th>
                  <th class="align-right">Avg. Time</th>
                </tr>
              </thead>
              <tbody>
                {#each recentStats as stat}
                  <tr>
                    <td>{new Date(stat.startTime).toLocaleString()}</td>
                    <td class="align-right">{stat.processedFiles}</td>
                    <td class="align-right" class:status-error={stat.errorFiles > 0} class:status-success={stat.errorFiles === 0}>
                      {stat.errorFiles}
                    </td>
                    <td class="align-right" 
                        class:status-warning={(((stat.processedFiles - stat.errorFiles) / stat.processedFiles) * 100) < 90}
                        class:status-success={(((stat.processedFiles - stat.errorFiles) / stat.processedFiles) * 100) >= 90}>
                      {((stat.processedFiles - stat.errorFiles) / stat.processedFiles * 100).toFixed(1)}%
                    </td>
                    <td class="align-right">{stat.averageProcessingTime.toFixed(2)}s</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </TabItem>
      </Tabs>
    </div>
  </div>
  
  <style>
    .status-history-modal {
      display: flex;
      flex-direction: column;
      gap: var(--size-4);
      padding: var(--size-4);
      max-width: 800px;
      width: 100%;
    }
  
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: var(--size-4);
    }
  
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--size-4);
      margin-bottom: var(--size-4);
    }
  
    .stat-card {
      background-color: var(--background-secondary);
      border-radius: var(--radius-m);
      padding: var(--size-4);
      display: flex;
      align-items: center;
      gap: var(--size-4);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  
    .stat-icon {
      color: var(--text-muted);
      width: 24px;
      height: 24px;
    }
  
    .stat-info {
      display: flex;
      flex-direction: column;
    }
  
    .stat-label {
      color: var(--text-muted);
      font-size: var(--font-ui-small);
    }
  
    .stat-value {
      font-size: 1.2em;
      font-weight: var(--font-bold);
      color: var(--text-normal);
    }
  
    .chart-container {
      height: 300px;
      margin: var(--size-4) 0;
    }
  
    .history-table-container {
      overflow-x: auto;
    }
  
    .history-table {
      width: 100%;
      border-collapse: collapse;
    }
  
    .history-table th,
    .history-table td {
      padding: var(--size-2) var(--size-4);
      border-bottom: 1px solid var(--background-modifier-border);
    }
  
    .align-right {
      text-align: right;
    }
  
    .status-error {
      color: var(--color-red);
    }
  
    .status-warning {
      color: var(--color-yellow);
    }
  
    .status-success {
      color: var(--color-green);
    }
  </style>