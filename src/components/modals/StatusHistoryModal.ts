import { App, Modal, setIcon } from 'obsidian';
import { ProcessingStatus, ProcessingStats } from '../../types/processing.types';
import BaseAccordion from '@components/accordions/BaseAccordion.svelte';
import { Chart, ChartConfiguration, ChartData } from 'chart.js';
import type { SettingsService } from '../../services/SettingsService';
import type { AIService } from '@services/ai/AIService';

interface SummaryStats {
    totalProcessed: number;
    totalErrors: number;
    avgProcessingTime: number;
    successRate: number;
}

interface ChartDataSet {
    labels: string[];
    processed: number[];
    errors: number[];
}

interface AccordionOptions {
    title: string;
    description: string;
    isOpen?: boolean;
    app: App;
    settingsService: SettingsService;
    aiService: AIService;
}

export default class StatusHistoryModal extends Modal {
    private chartContainer!: HTMLElement;
    private historyAccordion!: HTMLElement;
    private chart: Chart | null = null;

    constructor(
        app: App,
        private readonly currentStatus: ProcessingStatus,
        private readonly recentStats: ProcessingStats[],
        private readonly settingsService: SettingsService,
        private readonly aiService: AIService
    ) {
        super(app);
        this.containerEl.addClass('graphweaver-modal');
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('status-history-modal');

        const modalContent = contentEl.createDiv({ cls: 'modal-content' });
        this.createHeader(modalContent);

        const scrollableContent = modalContent.createDiv({ 
            cls: 'modal-scrollable-content' 
        });

        this.createSummaryStats(scrollableContent);
        this.createChartContainer(scrollableContent);
        this.createHistoryAccordion(scrollableContent);
        this.initializeChart();
    }

    onClose(): void {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.contentEl.empty();
    }

    private createHeader(containerEl: HTMLElement): void {
        const header = containerEl.createDiv({ cls: 'modal-header' });
        header.createEl('h2', { 
            text: 'Processing History',
            cls: 'modal-header-title'
        });

        const closeButton = header.createEl('button', { cls: 'modal-close' });
        setIcon(closeButton, 'cross');
        closeButton.addEventListener('click', () => this.close());
    }

    private createSummaryStats(containerEl: HTMLElement): void {
        const summaryEl = containerEl.createDiv({ cls: 'status-summary' });
        const stats = this.calculateSummaryStats();
        
        const summaryGrid = summaryEl.createDiv({ cls: 'summary-grid' });
        
        [
            { label: 'Total Files Processed', value: stats.totalProcessed },
            { label: 'Success Rate', value: `${stats.successRate.toFixed(1)}%` },
            { label: 'Average Processing Time', value: `${stats.avgProcessingTime.toFixed(1)}s` },
            { label: 'Total Errors', value: stats.totalErrors }
        ].forEach(item => {
            const itemEl = summaryGrid.createDiv({ cls: 'summary-item' });
            itemEl.createSpan({ text: item.label, cls: 'summary-label' });
            itemEl.createSpan({ text: item.value.toString(), cls: 'summary-value' });
        });
    }

    private calculateSummaryStats(): SummaryStats {
        const stats = this.recentStats.reduce((acc, stat) => ({
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
            totalProcessed: stats.totalProcessed,
            totalErrors: stats.totalErrors,
            avgProcessingTime: stats.totalProcessed ? stats.totalTime / stats.totalProcessed : 0,
            successRate: stats.totalProcessed ? (stats.successCount / stats.totalProcessed) * 100 : 0
        };
    }

    private createChartContainer(containerEl: HTMLElement): void {
        this.chartContainer = containerEl.createDiv({ cls: 'chart-container' });
        const canvas = this.chartContainer.createEl('canvas', {
            cls: 'processing-history-chart'
        });

        if (!canvas.getContext('2d')) {
            this.chartContainer.createEl('p', { 
                text: 'Your browser does not support HTML5 canvas.' 
            });
        }
    }

    private prepareChartData(): ChartDataSet {
        const dailyStats = new Map<string, { processed: number; errors: number }>();
        
        this.recentStats.forEach(stat => {
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

    private initializeChart(): void {
        const canvas = this.chartContainer.querySelector('canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const chartData = this.prepareChartData();
        const config: ChartConfiguration = {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Processed Files',
                        data: chartData.processed,
                        borderColor: 'var(--color-green)',
                        backgroundColor: 'rgba(0, 128, 0, 0.1)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: 'Errors',
                        data: chartData.errors,
                        borderColor: 'var(--color-red)',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
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
                        position: 'top',
                        labels: {
                            color: 'var(--text-normal)',
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'var(--background-secondary)',
                        borderColor: 'var(--background-modifier-border)',
                        borderWidth: 1,
                        titleColor: 'var(--text-normal)',
                        bodyColor: 'var(--text-muted)'
                    }
                }
            }
        };

        this.chart = new Chart(ctx, config);
    }

    private createHistoryAccordion(containerEl: HTMLElement): void {
        this.historyAccordion = containerEl.createDiv({ cls: 'history-container' });
        const accordion = new HistoryAccordion(
            this.historyAccordion, 
            this.recentStats,
            this.app,
            this.settingsService,
            this.aiService
        );
        accordion.render();
    }
}

class HistoryAccordion extends BaseAccordion {
    constructor(
        containerEl: HTMLElement,
        private readonly historyData: ProcessingStats[],
        private readonly app: App,
        private readonly settingsService: SettingsService,
        private readonly aiService: AIService
    ) {
        super({
            target: containerEl,
            props: {
                title: 'Processing History',
                description: 'Detailed history of processing tasks',
                isOpen: true,
                app,
                settingsService,
                aiService
            }
        });
    }

    public render(): void {
        const contentEl = this.createAccordion(
            'Processing History',
            'Detailed history of processing tasks'
        );
        this.populateHistoryContent(contentEl);
    }

    private populateHistoryContent(historyContent: HTMLElement): void {
        if (this.historyData.length === 0) {
            historyContent.createEl('p', { 
                text: 'No history available.',
                cls: 'empty-state'
            });
            return;
        }

        const tableContainer = historyContent.createDiv({ 
            cls: 'history-table-container' 
        });

        const table = tableContainer.createEl('table', { cls: 'history-table' });
        const headerRow = table.createEl('tr');
        
        ['Date', 'Files Processed', 'Errors', 'Success Rate', 'Avg. Time']
            .forEach(header => headerRow.createEl('th', { text: header }));

        this.historyData.forEach(stat => {
            const row = table.createEl('tr');
            
            row.createEl('td', { 
                text: new Date(stat.startTime).toLocaleString() 
            });
            
            row.createEl('td', { 
                text: stat.processedFiles.toString(),
                cls: 'align-right' 
            });
            
            const errorCell = row.createEl('td', { 
                text: stat.errorFiles.toString(),
                cls: 'align-right' 
            });
            errorCell.addClass(stat.errorFiles > 0 ? 'status-error' : 'status-success');
            
            const successRate = ((stat.processedFiles - stat.errorFiles) / stat.processedFiles * 100);
            const rateCell = row.createEl('td', { 
                text: `${successRate.toFixed(1)}%`,
                cls: 'align-right'
            });
            rateCell.addClass(successRate < 90 ? 'status-warning' : 'status-success');
            
            row.createEl('td', { 
                text: `${stat.averageProcessingTime.toFixed(2)}s`,
                cls: 'align-right'
            });
        });
    }
}