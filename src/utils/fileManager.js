const fs = require('fs');
const path = require('path');
const { HISTORY_FILE, STATS_FILE, HISTORY_DIR } = require('../../config/constants');

/**
 * Kelas untuk mengelola file data dan statistik arbitrage
 */
class FileManager {
    constructor(logger) {
        this.logger = logger;
        
        // Pastikan direktori ada
        if (!fs.existsSync(HISTORY_DIR)) {
            fs.mkdirSync(HISTORY_DIR, { recursive: true });
        }
        
        // Inisialisasi data
        this.executionHistory = [];
        this.performanceStats = {
            totalProfit: 0,
            totalFees: 0,
            successfulTrades: 0,
            failedTrades: 0,
            startDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            profitByPair: {}
        };
        
        // Load data dari file
        this.loadExecutionHistory();
        this.loadPerformanceStats();
    }
    
    loadExecutionHistory() {
        try {
            if (fs.existsSync(HISTORY_FILE)) {
                const data = fs.readFileSync(HISTORY_FILE, 'utf8');
                this.executionHistory = JSON.parse(data);
                this.logger.log(`Loaded ${this.executionHistory.length} historical execution records`);
            } else {
                this.executionHistory = [];
                this.logger.log('No execution history found, starting fresh');
            }
        } catch (error) {
            this.logger.error(`Error loading execution history: ${error.message}`, error);
            this.executionHistory = [];
        }
    }
    
    saveExecutionHistory() {
        try {
            fs.writeFileSync(
                HISTORY_FILE,
                JSON.stringify(this.executionHistory, null, 2)
            );
        } catch (error) {
            this.logger.error(`Error saving execution history: ${error.message}`, error);
        }
    }
    
    addExecutionRecord(record) {
        this.executionHistory.push(record);
        this.saveExecutionHistory();
    }
    
    loadPerformanceStats() {
        try {
            if (fs.existsSync(STATS_FILE)) {
                const data = fs.readFileSync(STATS_FILE, 'utf8');
                this.performanceStats = JSON.parse(data);
            } else {
                // Gunakan default stats yang sudah di-inisialisasi
                this.logger.log('No performance stats found, starting fresh');
            }
        } catch (error) {
            this.logger.error(`Error loading performance stats: ${error.message}`, error);
            // Reset stats jika terjadi error
        }
    }
    
    savePerformanceStats() {
        try {
            this.performanceStats.lastUpdated = new Date().toISOString();
            fs.writeFileSync(
                STATS_FILE,
                JSON.stringify(this.performanceStats, null, 2)
            );
        } catch (error) {
            this.logger.error(`Error saving performance stats: ${error.message}`, error);
        }
    }
    
    updatePerformanceStats(pairName, profitUSD, gasCostUSD, success) {
        if (success) {
            this.performanceStats.totalProfit += profitUSD;
            this.performanceStats.totalFees += gasCostUSD;
            this.performanceStats.successfulTrades += 1;
            
            // Update pair-specific stats
            if (!this.performanceStats.profitByPair[pairName]) {
                this.performanceStats.profitByPair[pairName] = {
                    totalProfit: 0,
                    trades: 0
                };
            }
            
            this.performanceStats.profitByPair[pairName].totalProfit += profitUSD;
            this.performanceStats.profitByPair[pairName].trades += 1;
        } else {
            this.performanceStats.failedTrades += 1;
            this.performanceStats.totalFees += gasCostUSD;
        }
        
        this.savePerformanceStats();
    }
    
    getPerformanceSummary() {
        const summary = `
========== PERFORMANCE SUMMARY ==========
Running since: ${new Date(this.performanceStats.startDate).toLocaleString()}
Current time:  ${new Date().toLocaleString()}

Total profit:  $${this.performanceStats.totalProfit.toFixed(2)}
Total gas fee: $${this.performanceStats.totalFees.toFixed(2)}
Net profit:    $${(this.performanceStats.totalProfit - this.performanceStats.totalFees).toFixed(2)}

Successful trades: ${this.performanceStats.successfulTrades}
Failed trades:     ${this.performanceStats.failedTrades}
Success rate:      ${this.performanceStats.successfulTrades + this.performanceStats.failedTrades > 0 ? 
            (this.performanceStats.successfulTrades / (this.performanceStats.successfulTrades + this.performanceStats.failedTrades) * 100).toFixed(2) + '%' : 
            'N/A'}

PROFIT BY PAIR:
${Object.entries(this.performanceStats.profitByPair).map(([pair, stats]) => 
    `${pair}: $${stats.totalProfit.toFixed(2)} (${stats.trades} trades)`
).join('\n')}
========================================
`;
        return summary;
    }
}

module.exports = FileManager;