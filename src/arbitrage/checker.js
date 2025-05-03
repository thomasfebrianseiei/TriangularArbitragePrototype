const { ethers } = require('ethers');
const { ROUTER_ABI } = require('../../config/abi');
const { ROUTER_ADDRESSES } = require('../../config/constants');

/**
 * ArbitrageChecker - Bertanggung jawab untuk mencari peluang arbitrage
 */
class ArbitrageChecker {
    constructor(provider, tokenService, priceService, profitCalculator, logger) {
        this.provider = provider;
        this.tokenService = tokenService;
        this.priceService = priceService;
        this.profitCalculator = profitCalculator;
        this.logger = logger;
        
        // Setup router contracts
        this.pancakeRouter = new ethers.Contract(
            ROUTER_ADDRESSES.PANCAKESWAP,
            ROUTER_ABI,
            provider
        );
        
        this.biswapRouter = new ethers.Contract(
            ROUTER_ADDRESSES.BISWAP,
            ROUTER_ABI,
            provider
        );
    }
    
    /**
     * Memeriksa semua token pair untuk peluang arbitrage
     * @param {Array} tokenPairs - Array konfigurasi token pair
     * @returns {Promise<Array>} Array hasil peluang arbitrage
     */
    async checkArbitrageOpportunities(tokenPairs) {
        this.logger.log(`Checking for arbitrage opportunities in ${tokenPairs.length} pairs...`);
        
        const opportunities = [];
        
        // Check each token pair
        for (const pair of tokenPairs) {
            this.logger.log(`Checking ${pair.name} opportunities...`);

            // Try both directions (PancakeSwap -> BiSwap -> PancakeSwap and BiSwap -> PancakeSwap -> BiSwap)
            const pancakeToBiswap = await this.checkTriangularArbitrage(pair, true);
            const biswapToPancake = await this.checkTriangularArbitrage(pair, false);
            
            // Tambahkan peluang yang ditemukan
            opportunities.push(...pancakeToBiswap, ...biswapToPancake);
        }
        
        // Urutkan peluang berdasarkan profitabilitas (dari yang tertinggi)
        opportunities.sort((a, b) => b.profitResult.profitPercentage - a.profitResult.profitPercentage);
        
        return opportunities;
    }
    
    /**
     * Memeriksa triangular arbitrage untuk sebuah konfigurasi pair
     * @param {object} pairConfig - Konfigurasi token pair
     * @param {boolean} direction - Arah arbitrage (true: PancakeSwap->BiSwap->PancakeSwap, false: BiSwap->PancakeSwap->BiSwap)
     * @returns {Promise<Array>} Peluang arbitrage yang ditemukan
     */
    async checkTriangularArbitrage(pairConfig, direction) {
        const opportunities = [];
        const tokens = pairConfig.tokens;
        const tokenKeys = Object.keys(tokens);

        // Coba berbagai kombinasi token
        for (let i = 0; i < tokenKeys.length; i++) {
            const startToken = tokenKeys[i];
            const midToken = tokenKeys[(i + 1) % tokenKeys.length];
            const endToken = tokenKeys[(i + 2) % tokenKeys.length];

            const opportunity = await this.checkArbitrageLoop(
                pairConfig,
                tokens[startToken],
                tokens[midToken],
                tokens[endToken],
                direction
            );
            
            if (opportunity) {
                opportunities.push(opportunity);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Memeriksa selisih harga antara PancakeSwap dan BiSwap
     * @param {string} tokenA - Alamat token A
     * @param {string} tokenB - Alamat token B
     * @param {string} tokenC - Alamat token C
     * @returns {Promise<number>} Selisih harga dalam persentase
     */
    async checkPriceGap(tokenA, tokenB, tokenC, tokenADetails) {
        try {
            // Tentukan jumlah untuk perbandingan
            const testAmount = ethers.utils.parseUnits('1', tokenADetails.decimals); // 1 token
            
            // Periksa harga di PancakeSwap
            const pancakePrice = await this.checkTriangularPrice(
                this.pancakeRouter, 
                testAmount, 
                [tokenA, tokenB, tokenC, tokenA]
            );
            
            // Periksa harga di BiSwap
            const biswapPrice = await this.checkTriangularPrice(
                this.biswapRouter, 
                testAmount, 
                [tokenA, tokenB, tokenC, tokenA]
            );
            
            // Hitung selisih persentase
            if (pancakePrice && biswapPrice && !pancakePrice.isZero()) {
                const priceDiff = pancakePrice.sub(biswapPrice).abs(); // Gunakan nilai absolut
                const percentageDiff = priceDiff.mul(ethers.BigNumber.from(100)).div(pancakePrice);
                return parseFloat(ethers.utils.formatUnits(percentageDiff, 0));
            }
            
            return 0;
        } catch (error) {
            this.logger.error(`Error checking price gap: ${error.message}`, error);
            return 0;
        }
    }

    /**
     * Simulasi harga setelah rangkaian swap triangular
     * @param {ethers.Contract} router - Router contract
     * @param {ethers.BigNumber} amountIn - Jumlah token masuk
     * @param {string[]} path - Array token path
     * @returns {Promise<ethers.BigNumber>} Hasil akhir setelah swap
     */
    async checkTriangularPrice(router, amountIn, path) {
        try {
            let amountOut = amountIn;
            
            // Simulasikan 3 swap berturut-turut
            for (let i = 0; i < path.length - 1; i++) {
                const swapPath = [path[i], path[i+1]];
                const amounts = await router.getAmountsOut(amountOut, swapPath);
                if (!amounts || amounts.length < 2) return null;
                amountOut = amounts[1];
            }
            
            return amountOut;
        } catch (error) {
            this.logger.error(`Error checking triangular price: ${error.message}`, error);
            return null;
        }
    }
    
    /**
     * Memeriksa arbitrage loop untuk set token tertentu
     * @param {object} pairConfig - Konfigurasi token pair
     * @param {string} tokenA - Alamat token A
     * @param {string} tokenB - Alamat token B
     * @param {string} tokenC - Alamat token C
     * @param {boolean} direction - Arah arbitrage
     * @returns {Promise<object|null>} Peluang arbitrage jika menguntungkan, null jika tidak
     */
    async checkArbitrageLoop(pairConfig, tokenA, tokenB, tokenC, direction) {
        try {
            // Dapatkan detail token
            const tokenADetails = await this.tokenService.getTokenDetails(tokenA);
            const tokenBDetails = await this.tokenService.getTokenDetails(tokenB);
            const tokenCDetails = await this.tokenService.getTokenDetails(tokenC);

            this.logger.log(`Checking arbitrage: ${tokenADetails.symbol} -> ${tokenBDetails.symbol} -> ${tokenCDetails.symbol} -> ${tokenADetails.symbol} (${direction ? 'PancakeSwap->BiSwap->PancakeSwap' : 'BiSwap->PancakeSwap->BiSwap'})`);

            // Periksa selisih harga antara PancakeSwap dan BiSwap
            const priceGap = await this.checkPriceGap(tokenA, tokenB, tokenC, tokenADetails);
            let originalDirection = direction;
            
            // Jika selisih harga >= 5%, balik arah arbitrage
            if (priceGap >= 5.0) {
                this.logger.log(`Price gap ${priceGap.toFixed(2)}% >= 5%, reversing arbitrage direction from ${direction ? 'PancakeSwap->BiSwap->PancakeSwap' : 'BiSwap->PancakeSwap->BiSwap'} to ${!direction ? 'PancakeSwap->BiSwap->PancakeSwap' : 'BiSwap->PancakeSwap->BiSwap'}`);
                direction = !direction;
            }

            // Buat path untuk swap
            const path1 = [tokenA, tokenB];
            const path2 = [tokenB, tokenC];
            const path3 = [tokenC, tokenA];

            // Verifikasi path
            if (!path1 || path1.length < 2 || !path2 || path2.length < 2 || !path3 || path3.length < 2) {
                this.logger.log(`Invalid paths for ${tokenADetails.symbol} -> ${tokenBDetails.symbol} -> ${tokenCDetails.symbol}`);
                return null;
            }

            // Temukan alamat pair yang cocok
            const pancakePairs = pairConfig.pancakeswapPairs;
            const biswapPairs = pairConfig.biswapPairs;

            // Tentukan alamat pair pertama berdasarkan arah
            let flashLoanPair;
            if (direction) {
                // PancakeSwap -> BiSwap -> PancakeSwap
                for (const key in pancakePairs) {
                    const [token1, token2] = key.split('-');
                    if ((pairConfig.tokens[token1] === tokenA && pairConfig.tokens[token2] === tokenB) ||
                        (pairConfig.tokens[token1] === tokenB && pairConfig.tokens[token2] === tokenA)) {
                        flashLoanPair = pancakePairs[key];
                        break;
                    }
                }
            } else {
                // BiSwap -> PancakeSwap -> BiSwap
                for (const key in biswapPairs) {
                    const [token1, token2] = key.split('-');
                    if ((pairConfig.tokens[token1] === tokenA && pairConfig.tokens[token2] === tokenB) ||
                        (pairConfig.tokens[token1] === tokenB && pairConfig.tokens[token2] === tokenA)) {
                        flashLoanPair = biswapPairs[key];
                        break;
                    }
                }
            }

            if (!flashLoanPair) {
                this.logger.log(`No suitable pair found for flash loan of ${tokenADetails.symbol}`);
                return null;
            }

            // Dapatkan jumlah test berdasarkan jenis token
            const testAmounts = pairConfig.testAmounts || 
                (tokenADetails.symbol.includes('USD') ? 
                    [1000, 10000, 50000, 100000] : // Default stablecoin
                    [0.5, 1, 2, 5]); // Default non-stablecoin
            
            // Konversi jumlah test ke decimals yang tepat
            const loanAmounts = testAmounts.map(amount => 
                ethers.utils.parseUnits(amount.toString(), tokenADetails.decimals)
            );

            // Variabel untuk menyimpan hasil terbaik
            let bestResult = null;
            let bestLoanAmount = ethers.BigNumber.from(0);
            let bestMinAmountsOut = [ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.BigNumber.from(0)];
            let bestProfitResult = null;

            // Periksa setiap jumlah loan
            for (const loanAmount of loanAmounts) {
                // Coba hitung output dari swap
                const result = await this.calculateSwapOutputs(
                    direction, 
                    loanAmount, 
                    path1, path2, path3,
                    tokenADetails, tokenBDetails, tokenCDetails
                );
                
                // Lanjutkan jika perhitungan gagal
                if (!result || !result.success) continue;
                
                // Tentukan minimum amount out dengan toleransi slippage 1%
                const minAmountOut1 = result.amountOut1.mul(99).div(100);
                const minAmountOut2 = result.amountOut2.mul(99).div(100);
                const minAmountOut3 = result.amountOut3.mul(99).div(100);
                
                // Verifikasi minAmountsOut
                if (minAmountOut1.isZero() || minAmountOut2.isZero() || minAmountOut3.isZero()) {
                    this.logger.log(`Skipping due to zero min amounts for ${tokenADetails.symbol}`);
                    continue;
                }
                
                // Struktur data arbitrage
                const arbitrageData = {
                    path1,
                    path2,
                    path3,
                    minAmountsOut: [minAmountOut1, minAmountOut2, minAmountOut3],
                    direction
                };
                
                // Hitung profitabilitas
                const profitResult = await this.profitCalculator.calculateProfit(
                    arbitrageData,
                    loanAmount,
                    direction,
                    tokenADetails
                );
                
                // Update hasil terbaik jika lebih menguntungkan
                if (this.profitCalculator.isProfitable(profitResult) && 
                    (!bestProfitResult || profitResult.profitPercentage > bestProfitResult.profitPercentage)) {
                    bestResult = result;
                    bestLoanAmount = loanAmount;
                    bestMinAmountsOut = [minAmountOut1, minAmountOut2, minAmountOut3];
                    bestProfitResult = profitResult;
                }
            }
            
            // Jika ditemukan peluang yang menguntungkan
            if (bestProfitResult && this.profitCalculator.isProfitable(bestProfitResult)) {
                this.logger.log(`🚀 Found profitable arbitrage opportunity! Profit: $${bestProfitResult.netProfitUSD.toFixed(2)} (${bestProfitResult.profitPercentage.toFixed(2)}%)`);
                
                // Tambahkan informasi apakah arah arbitrage dibalik
                const directionReversed = originalDirection !== direction;
                
                return {
                    pairConfig,
                    flashLoanPair,
                    tokenA,
                    tokenB,
                    tokenC,
                    tokenADetails,
                    tokenBDetails,
                    tokenCDetails,
                    loanAmount: bestLoanAmount,
                    arbitrageData: {
                        path1,
                        path2,
                        path3,
                        minAmountsOut: bestMinAmountsOut,
                        direction
                    },
                    profitResult: bestProfitResult,
                    direction,
                    directionReversed,
                    priceGap
                };
            }
            
            return null;
        } catch (error) {
            this.logger.error(`Error in checkArbitrageLoop: ${error.message}`, error);
            return null;
        }
    }
    
    /**
     * Menghitung output dari rangkaian swap
     * @param {boolean} direction - Arah arbitrage
     * @param {ethers.BigNumber} loanAmount - Jumlah pinjaman
     * @param {string[]} path1 - Path swap pertama
     * @param {string[]} path2 - Path swap kedua
     * @param {string[]} path3 - Path swap ketiga
     * @param {object} tokenADetails - Detail token A
     * @param {object} tokenBDetails - Detail token B
     * @param {object} tokenCDetails - Detail token C
     * @returns {Promise<object|null>} Hasil perhitungan, null jika gagal
     */
    async calculateSwapOutputs(direction, loanAmount, path1, path2, path3, tokenADetails, tokenBDetails, tokenCDetails) {
        let amountOut1, amountOut2, amountOut3;
        let success = true;
        
        this.logger.log(`Testing loan amount: ${ethers.utils.formatUnits(loanAmount, tokenADetails.decimals)} ${tokenADetails.symbol}`);
        
        try {
            // Hitung swap pertama
            if (direction) {
                // PancakeSwap -> BiSwap -> PancakeSwap
                const amounts1 = await this.pancakeRouter.getAmountsOut(loanAmount, path1);
                if (!amounts1 || amounts1.length < 2) {
                    this.logger.log(`Invalid amounts1 result for path ${path1.join(' -> ')}`);
                    return { success: false };
                }
                amountOut1 = amounts1[1];
            } else {
                // BiSwap -> PancakeSwap -> BiSwap
                const amounts1 = await this.biswapRouter.getAmountsOut(loanAmount, path1);
                if (!amounts1 || amounts1.length < 2) {
                    this.logger.log(`Invalid amounts1 result for path ${path1.join(' -> ')}`);
                    return { success: false };
                }
                amountOut1 = amounts1[1];
            }
            
            this.logger.log(`First swap output: ${ethers.utils.formatUnits(amountOut1, tokenBDetails.decimals)} ${tokenBDetails.symbol}`);
        } catch (error) {
            this.logger.log(`Error calculating first swap: ${error.message}`);
            return { success: false };
        }
        
        try {
            // Hitung swap kedua
            if (direction) {
                const amounts2 = await this.biswapRouter.getAmountsOut(amountOut1, path2);
                if (!amounts2 || amounts2.length < 2) {
                    this.logger.log(`Invalid amounts2 result for path ${path2.join(' -> ')}`);
                    return { success: false };
                }
                amountOut2 = amounts2[1];
            } else {
                const amounts2 = await this.pancakeRouter.getAmountsOut(amountOut1, path2);
                if (!amounts2 || amounts2.length < 2) {
                    this.logger.log(`Invalid amounts2 result for path ${path2.join(' -> ')}`);
                    return { success: false };
                }
                amountOut2 = amounts2[1];
            }
            
            this.logger.log(`Second swap output: ${ethers.utils.formatUnits(amountOut2, tokenCDetails.decimals)} ${tokenCDetails.symbol}`);
        } catch (error) {
            this.logger.log(`Error calculating second swap: ${error.message}`);
            return { success: false };
        }
        
        try {
            // Hitung swap ketiga
            if (direction) {
                const amounts3 = await this.pancakeRouter.getAmountsOut(amountOut2, path3);
                if (!amounts3 || amounts3.length < 2) {
                    this.logger.log(`Invalid amounts3 result for path ${path3.join(' -> ')}`);
                    return { success: false };
                }
                amountOut3 = amounts3[1];
            } else {
                const amounts3 = await this.biswapRouter.getAmountsOut(amountOut2, path3);
                if (!amounts3 || amounts3.length < 2) {
                    this.logger.log(`Invalid amounts3 result for path ${path3.join(' -> ')}`);
                    return { success: false };
                }
                amountOut3 = amounts3[1];
            }
            
            this.logger.log(`Third swap output: ${ethers.utils.formatUnits(amountOut3, tokenADetails.decimals)} ${tokenADetails.symbol}`);
        } catch (error) {
            this.logger.log(`Error calculating third swap: ${error.message}`);
            return { success: false };
        }
        
        // Pastikan semua nilai terdefinisi
        if (!amountOut1 || !amountOut2 || !amountOut3) {
            this.logger.log(`Skipping due to undefined output amounts for ${tokenADetails.symbol}`);
            return { success: false };
        }
        
        return {
            success: true,
            amountOut1,
            amountOut2,
            amountOut3,
            loanAmount
        };
    }
}

module.exports = ArbitrageChecker;