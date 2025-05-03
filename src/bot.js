const { ethers } = require('ethers');
const cron = require('node-cron');
const { FLASH_ARBITRAGE_ABI } = require('../config/abi');
const { TOKEN_PAIRS } = require('../config/pairs');
const { EXECUTION_ENABLED } = require('../config/constants');
const AddressHelper = require('./utils/addressHelper');

/**
 * ArbitrageBot - Kelas utama yang mengkoordinasikan seluruh operasi bot
 */
class ArbitrageBot {
    constructor({
        providerService,
        tokenService,
        priceService,
        networkService,
        fileManager,
        logger,
        profitCalculator,
        arbitrageChecker,
        arbitrageExecutor
    }) {
        this.providerService = providerService;
        this.tokenService = tokenService;
        this.priceService = priceService;
        this.networkService = networkService;
        this.fileManager = fileManager;
        this.logger = logger;
        this.profitCalculator = profitCalculator;
        this.arbitrageChecker = arbitrageChecker;
        this.arbitrageExecutor = arbitrageExecutor;
        
        this.isRunning = false;
        
        // Objek untuk menyimpan pemeriksaan terjadwal
        this.scheduledChecks = {
            priceUpdate: null,
            feeUpdate: null,
            networkHealth: null,
            highPriorityCheck: null,
            lowPriorityCheck: null,
            logRotation: null
        };
    }
    
    /**
     * Memulai bot dengan validasi dan penjadwalan
     */
    async start() {
        this.logger.log('Starting arbitrage bot...');
        
        try {
            // Validasi kontrak dan koneksi jaringan
            await this.validate();
            
            // Validasi alamat
            AddressHelper.validateAddresses(TOKEN_PAIRS, this.logger);
            
            // Update harga BNB dan parameter fee kontrak
            await this.priceService.updateBnbPrice();
            await this.profitCalculator.updateFeeParameters();
            await this.networkService.checkNetworkHealth();
            
            // Penjadwalan update harga BNB (setiap 10 menit)
            this.scheduledChecks.priceUpdate = cron.schedule('*/10 * * * *', async () => {
                await this.priceService.updateBnbPrice();
            });
            
            // Penjadwalan update parameter fee (setiap jam)
            this.scheduledChecks.feeUpdate = cron.schedule('0 * * * *', async () => {
                await this.profitCalculator.updateFeeParameters();
            });
            
            // Penjadwalan pemeriksaan kesehatan jaringan (setiap 5 menit)
            this.scheduledChecks.networkHealth = cron.schedule('*/5 * * * *', async () => {
                await this.networkService.checkNetworkHealth();
            });
            
            // Penjadwalan rotasi log (setiap hari pada tengah malam)
            this.scheduledChecks.logRotation = cron.schedule('0 0 * * *', () => {
                this.logger.rotateLogFiles();
            });
            
            // Penjadwalan pemeriksaan arbitrage untuk pair prioritas tinggi (setiap 5 menit)
            this.scheduledChecks.highPriorityCheck = cron.schedule('*/5 * * * *', async () => {
                if (this.isRunning) {
                    this.logger.log('Previous check still running, skipping...');
                    return;
                }
                
                this.isRunning = true;
                
                try {
                    // Periksa kondisi jaringan sebelum melanjutkan
                    const isNetworkReady = await this.networkService.isNetworkReadyForArbitrage();
                    if (!isNetworkReady) {
                        this.logger.log('Network conditions unfavorable. Skipping arbitrage check.');
                        return;
                    }
                    
                    // Periksa apakah kontrak dipause
                    const isPaused = await this.arbitrageExecutor.isContractPaused();
                    if (isPaused) {
                        this.logger.log('Contract is paused. Skipping arbitrage check.');
                        return;
                    }
                    
                    // Periksa hanya pair prioritas tinggi pada interval 5 menit
                    const highPriorityPairs = TOKEN_PAIRS.filter(pair => pair.priority === 1);
                    await this.checkAndExecuteArbitrage(highPriorityPairs);
                } catch (error) {
                    this.logger.error(`Error in scheduled high-priority check: ${error.message}`, error);
                } finally {
                    this.isRunning = false;
                }
            });
            
            // Penjadwalan pemeriksaan arbitrage untuk pair prioritas rendah (setiap 15 menit)
            this.scheduledChecks.lowPriorityCheck = cron.schedule('*/15 * * * *', async () => {
                if (this.isRunning) {
                    this.logger.log('Previous check still running, skipping...');
                    return;
                }
                
                this.isRunning = true;
                
                try {
                    // Periksa kondisi jaringan sebelum melanjutkan
                    const isNetworkReady = await this.networkService.isNetworkReadyForArbitrage();
                    if (!isNetworkReady) {
                        this.logger.log('Network conditions unfavorable. Skipping arbitrage check.');
                        return;
                    }
                    
                    // Periksa apakah kontrak dipause
                    const isPaused = await this.arbitrageExecutor.isContractPaused();
                    if (isPaused) {
                        this.logger.log('Contract is paused. Skipping arbitrage check.');
                        return;
                    }
                    
                    // Periksa prioritas rendah lebih jarang
                    const lowerPriorityPairs = TOKEN_PAIRS.filter(pair => pair.priority > 1);
                    await this.checkAndExecuteArbitrage(lowerPriorityPairs);
                } catch (error) {
                    this.logger.error(`Error in scheduled low-priority check: ${error.message}`, error);
                } finally {
                    this.isRunning = false;
                }
            });
            
            // Jalankan segera saat startup dengan semua pair
            await this.runInitialCheck();
            
            this.logger.log('Bot started successfully and running...');
        } catch (error) {
            this.logger.error(`Error starting bot: ${error.message}`, error);
            throw error;
        }
    }
    
    /**
     * Validasi kontrak dan koneksi jaringan
     */
    async validate() {
        // Validasi koneksi provider
        const provider = await this.providerService.getProvider();
        const blockNumber = await provider.getBlockNumber();
        this.logger.log(`Connected to BSC at block ${blockNumber}`);
        
        // Periksa saldo wallet
        const walletAddress = await this.arbitrageExecutor.wallet.getAddress();
        const balance = await provider.getBalance(walletAddress);
        const balanceEth = ethers.utils.formatEther(balance);
        this.logger.log(`Wallet balance: ${balanceEth} BNB`);
        
        if (parseFloat(balanceEth) < 0.05) {
            this.logger.warn(`WARNING: Low BNB balance (${balanceEth}). Consider adding more BNB for gas fees.`);
        }
        
        // Validasi kontrak flash arbitrage
        const flashArbitrageAddress = this.arbitrageExecutor.flashArbitrageContract.address;
        if (!flashArbitrageAddress) {
            throw new Error('Flash arbitrage contract address not configured.');
        }
        
        // Periksa apakah kontrak ada
        const contractCode = await provider.getCode(flashArbitrageAddress);
        if (contractCode === '0x' || contractCode === '0x0') {
            throw new Error(`No contract found at address ${flashArbitrageAddress}`);
        }
        
        // Validasi pemilik kontrak
        const owner = await this.arbitrageExecutor.flashArbitrageContract.owner();
        this.logger.log(`Contract validation successful. Owner: ${owner}`);
        
        // Periksa apakah wallet bot adalah pemilik
        if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
            this.logger.log(`INFO: Bot wallet is not the contract owner. Some operations like authorizing pairs will require manual intervention.`);
        }
    }
    
    /**
     * Pemeriksaan awal pada semua pair
     */
    async runInitialCheck() {
        this.isRunning = true;
        
        try {
            // Periksa apakah kontrak dipause
            const isPaused = await this.arbitrageExecutor.isContractPaused();
            if (isPaused) {
                this.logger.log('Contract is paused. Skipping initial arbitrage check.');
                return;
            }
            
            this.logger.log('Running initial arbitrage check on all pairs...');
            await this.checkAndExecuteArbitrage(TOKEN_PAIRS);
        } catch (error) {
            this.logger.error(`Error in initial check: ${error.message}`, error);
        } finally {
            this.isRunning = false;
        }
    }
    
    /**
     * Periksa dan eksekusi arbitrage pada set pair tertentu
     * @param {Array} pairsToCheck - Array konfigurasi token pair
     */
    async checkAndExecuteArbitrage(pairsToCheck) {
        try {
            // Temukan peluang arbitrage
            const opportunities = await this.arbitrageChecker.checkArbitrageOpportunities(pairsToCheck);
            
            if (opportunities.length === 0) {
                this.logger.log('No profitable arbitrage opportunities found.');
                return;
            }
            
            // Urutkan berdasarkan profitabilitas
            opportunities.sort((a, b) => b.profitResult.profitPercentage - a.profitResult.profitPercentage);
            
            // Log peluang yang ditemukan
            this.logger.log(`Found ${opportunities.length} profitable arbitrage opportunities.`);
            
            for (let i = 0; i < Math.min(3, opportunities.length); i++) {
                const opp = opportunities[i];
                this.logger.log(`Opportunity ${i+1}: ${opp.tokenADetails.symbol}-${opp.tokenBDetails.symbol}-${opp.tokenCDetails.symbol} - Profit: $${opp.profitResult.netProfitUSD.toFixed(2)} (${opp.profitResult.profitPercentage.toFixed(2)}%)`);
            }
            
            if (!EXECUTION_ENABLED) {
                this.logger.log('⚠️ Execution is disabled. Set EXECUTION_ENABLED=true to enable arbitrage execution.');
                return;
            }
            
            // Eksekusi arbitrage paling menguntungkan
            const bestOpportunity = opportunities[0];
            this.logger.log(`Executing best opportunity: ${bestOpportunity.tokenADetails.symbol}-${bestOpportunity.tokenBDetails.symbol}-${bestOpportunity.tokenCDetails.symbol}`);
            
            const success = await this.arbitrageExecutor.executeArbitrage(bestOpportunity);
            
            if (success) {
                this.logger.log('Arbitrage execution completed successfully.');
            } else {
                this.logger.warn('Arbitrage execution failed.');
            }
        } catch (error) {
            this.logger.error(`Error in checkAndExecuteArbitrage: ${error.message}`, error);
        }
    }
    
    /**
     * Menghentikan bot dan membersihkan resource
     */
    stop() {
        this.logger.log('Stopping arbitrage bot...');
        
        // Bersihkan semua jadwal cron
        Object.values(this.scheduledChecks).forEach(schedule => {
            if (schedule) schedule.stop();
        });
        
        // Tampilkan ringkasan performa
        const summary = this.fileManager.getPerformanceSummary();
        console.log(summary);
        this.logger.log(summary);
        
        // Tutup log stream
        this.logger.close();
        
        this.logger.log('Bot stopped.');
    }
    
    /**
     * Menampilkan ringkasan performa bot
     */
    displayPerformanceSummary() {
        const summary = this.fileManager.getPerformanceSummary();
        console.log(summary);
        return summary;
    }
}

module.exports = ArbitrageBot;