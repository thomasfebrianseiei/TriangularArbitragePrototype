const { ethers } = require('ethers');
const { GAS_LIMIT } = require('../../config/constants');
const { ERC20_ABI, WBNB_ABI } = require('../../config/abi');

/**
 * ArbitrageExecutor - Bertanggung jawab untuk mengeksekusi transaksi arbitrage
 */
class ArbitrageExecutor {
    constructor(flashArbitrageContract, networkService, fileManager, wallet, logger) {
        this.flashArbitrageContract = flashArbitrageContract;
        this.networkService = networkService;
        this.fileManager = fileManager;
        this.wallet = wallet;
        this.logger = logger;
        
        // Setup WBNB contract
        this.wbnbContract = new ethers.Contract(
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB address
            WBNB_ABI,
            wallet
        );
    }
    
    /**
     * Memeriksa apakah kontrak dalam keadaan pause
     * @returns {Promise<boolean>} Status pause
     */
    async isContractPaused() {
        try {
            return await this.flashArbitrageContract.paused();
        } catch (error) {
            this.logger.error(`Error checking contract pause state: ${error.message}`, error);
            return true; // Anggap paused jika terjadi error
        }
    }
    
    /**
     * Memeriksa apakah pair sudah diotorisasi
     * @param {string} pairAddress - Alamat pair
     * @param {boolean} isPancakeswap - Apakah pair berasal dari PancakeSwap
     * @returns {Promise<boolean>} Status otorisasi
     */
    async isPairAuthorized(pairAddress, isPancakeswap) {
        try {
            const isAuthorized = isPancakeswap
                ? await this.flashArbitrageContract.authorizedPancakeswapPairs(pairAddress)
                : await this.flashArbitrageContract.authorizedBiswapPairs(pairAddress);
            
            return isAuthorized;
        } catch (error) {
            this.logger.error(`Error checking pair authorization: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Mengotorisasi pair untuk digunakan dalam flash loan
     * @param {string} pairAddress - Alamat pair
     * @param {boolean} isPancakeswap - Apakah pair berasal dari PancakeSwap
     * @returns {Promise<boolean>} Berhasil atau tidak
     */
    async authorizePair(pairAddress, isPancakeswap) {
        try {
            // Periksa apakah wallet adalah owner kontrak
            const contractOwner = await this.flashArbitrageContract.owner();
            
            if (contractOwner.toLowerCase() !== this.wallet.address.toLowerCase()) {
                this.logger.warn(`Bot wallet is not the contract owner. Cannot authorize pair ${pairAddress}.`);
                return false;
            }
            
            // Otorisasi pair
            this.logger.log(`Authorizing pair ${pairAddress} (isPancakeswap: ${isPancakeswap})`);
            
            const tx = await this.flashArbitrageContract.updateAuthorizedPair(
                pairAddress,
                true,
                isPancakeswap
            );
            
            await tx.wait();
            this.logger.log(`✅ Successfully authorized ${pairAddress}`);
            
            return true;
        } catch (error) {
            this.logger.error(`Failed to authorize pair ${pairAddress}: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Mengeksekusi arbitrage
     * @param {object} opportunity - Objek peluang arbitrage
     * @returns {Promise<boolean>} Status keberhasilan eksekusi
     */
    async executeArbitrage(opportunity) {
        try {
            const {
                flashLoanPair,
                loanAmount,
                arbitrageData,
                direction,
                tokenADetails,
                profitResult
            } = opportunity;
            
            this.logger.log(`Executing arbitrage: ${direction ? 'PancakeSwap' : 'BiSwap'} -> ${direction ? 'BiSwap' : 'PancakeSwap'} -> ${direction ? 'PancakeSwap' : 'BiSwap'}`);
            
            // Validasi parameter sebelum memanggil
            if (!flashLoanPair || !ethers.utils.isAddress(flashLoanPair)) {
                this.logger.log(`Invalid pair address: ${flashLoanPair}. Aborting execution.`);
                return false;
            }
            
            if (!loanAmount || loanAmount.isZero()) {
                this.logger.log(`Invalid borrow amount. Aborting execution.`);
                return false;
            }
            
            // Verifikasi data arbitrage
            if (!arbitrageData || !arbitrageData.path1 || !arbitrageData.path2 || !arbitrageData.path3 || !arbitrageData.minAmountsOut) {
                this.logger.log(`Invalid arbitrage data. Aborting execution.`);
                return false;
            }
            
            // Double check path
            const path1Valid = arbitrageData.path1.length >= 2 && arbitrageData.path1.every((addr) => ethers.utils.isAddress(addr));
            const path2Valid = arbitrageData.path2.length >= 2 && arbitrageData.path2.every((addr) => ethers.utils.isAddress(addr));
            const path3Valid = arbitrageData.path3.length >= 2 && arbitrageData.path3.every((addr) => ethers.utils.isAddress(addr));
            
            if (!path1Valid || !path2Valid || !path3Valid) {
                this.logger.log(`Invalid paths in arbitrage data. Aborting execution.`);
                return false;
            }
            
            // Periksa apakah pair sudah diotorisasi
            const isAuthorized = await this.isPairAuthorized(flashLoanPair, direction);
            
            if (!isAuthorized) {
                this.logger.warn(`Pair ${flashLoanPair} is not authorized. Attempting to authorize...`);
                
                // Coba otorisasi pair
                const authSuccess = await this.authorizePair(flashLoanPair, direction);
                
                if (!authSuccess) {
                    this.logger.warn(`Could not authorize pair. Aborting execution.`);
                    return false;
                }
            }
            
            // Periksa apakah kontrak dipause
            const isPaused = await this.isContractPaused();
            
            if (isPaused) {
                this.logger.warn('Contract is paused. Cannot execute arbitrage.');
                return false;
            }
            
            // Dapatkan gas price
            const gasPrice = await this.networkService.getGasPrice(1.1); // 10% buffer
            
            // Konversi data arbitrage ke format array untuk panggilan kontrak
            const arbitrageArrayData = [
                arbitrageData.path1,
                arbitrageData.path2,
                arbitrageData.path3,
                arbitrageData.minAmountsOut,
                arbitrageData.direction
            ];
            
            // Eksekusi transaksi
            this.logger.log(`Sending transaction with gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei, gas limit: ${GAS_LIMIT}`);
            
            const tx = await this.flashArbitrageContract.executeFlashLoan(
                flashLoanPair,
                loanAmount,
                arbitrageArrayData,
                direction,
                {
                    gasLimit: GAS_LIMIT,
                    gasPrice: gasPrice
                }
            );
            
            this.logger.log(`Transaction sent: ${tx.hash}`);
            
            // Tunggu transaksi selesai
            this.logger.log(`Waiting for transaction to be mined...`);
            const receipt = await tx.wait();
            
            // Hitung biaya gas
            const gasCost = receipt.gasUsed.mul(gasPrice);
            const gasCostEth = ethers.utils.formatEther(gasCost);
            const gasCostUSD = profitResult.gasCostUSD;
            
            // Rekam eksekusi
            const executionRecord = {
                timestamp: new Date().toISOString(),
                txHash: receipt.transactionHash,
                tokenSymbol: tokenADetails.symbol,
                borrowAmount: ethers.utils.formatUnits(loanAmount, tokenADetails.decimals),
                profitUSD: profitResult.profitUSD,
                profitPercentage: profitResult.profitPercentage,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: gasPrice.toString(),
                gasCostUSD: gasCostUSD,
                status: receipt.status === 1 ? 'Success' : 'Failed'
            };
            
            this.fileManager.addExecutionRecord(executionRecord);
            
            // Update statistik performa
            this.fileManager.updatePerformanceStats(
                tokenADetails.symbol,
                profitResult.profitUSD,
                gasCostUSD,
                receipt.status === 1
            );
            
            if (receipt.status === 1) {
                this.logger.log(`🎉 Arbitrage execution successful! Profit: $${profitResult.profitUSD.toFixed(2)}`);
                
                // Jika profit dalam WBNB, konversi ke BNB native
                if (tokenADetails.symbol === 'WBNB') {
                    await this.convertWBNBtoBNB();
                }
            } else {
                this.logger.log(`❌ Arbitrage execution failed!`);
            }
            
            // Log gas yang digunakan
            this.logger.log(`Gas used: ${receipt.gasUsed.toString()}, Gas cost: ${gasCostEth} BNB ($${gasCostUSD.toFixed(2)})`);
            
            return receipt.status === 1;
        } catch (error) {
            this.logger.error(`Error executing arbitrage: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Konversi WBNB ke BNB native
     * @returns {Promise<boolean>} Status keberhasilan konversi
     */
    async convertWBNBtoBNB() {
        try {
            this.logger.log('Converting WBNB profits to native BNB...');
            
            // Dapatkan saldo WBNB
            const wbnbContract = new ethers.Contract(
                '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB address
                ERC20_ABI,
                this.wallet.provider
            );
            
            const wbnbBalance = await wbnbContract.balanceOf(this.wallet.address);
            
            if (!wbnbBalance || wbnbBalance.isZero()) {
                this.logger.log('No WBNB balance to convert');
                return false;
            }
            
            this.logger.log(`Found ${ethers.utils.formatEther(wbnbBalance)} WBNB to convert to BNB`);
            
            // Gunakan fungsi withdraw dari kontrak WBNB
            const tx = await this.wbnbContract.withdraw(wbnbBalance);
            
            this.logger.log(`WBNB to BNB conversion transaction sent: ${tx.hash}`);
            
            // Tunggu transaksi selesai
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                this.logger.log(`Successfully converted ${ethers.utils.formatEther(wbnbBalance)} WBNB to BNB`);
                return true;
            } else {
                this.logger.log('WBNB to BNB conversion failed');
                return false;
            }
        } catch (error) {
            this.logger.error(`Error converting WBNB to BNB: ${error.message}`, error);
            return false;
        }
    }
}

module.exports = ArbitrageExecutor;