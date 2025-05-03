const { ethers } = require('ethers');
const { FLASH_ARBITRAGE_ABI } = require('../../config/abi');
const { MIN_PROFIT_PERCENTAGE, GAS_LIMIT } = require('../../config/constants');

/**
 * ProfitCalculator - Bertanggung jawab untuk menghitung profitabilitas peluang arbitrage
 */
class ProfitCalculator {
    constructor(flashArbitrageContract, priceService, networkService, logger) {
        this.flashArbitrageContract = flashArbitrageContract;
        this.priceService = priceService;
        this.networkService = networkService;
        this.logger = logger;
        
        // Parameter biaya flash swap
        this.feeParameters = {
            pancakeSwapFeeNumerator: ethers.BigNumber.from(25),
            pancakeSwapFeeDenominator: ethers.BigNumber.from(9975),
            biswapFeeNumerator: ethers.BigNumber.from(20),
            biswapFeeDenominator: ethers.BigNumber.from(9980)
        };
    }
    
    /**
     * Update parameter biaya dari kontrak
     */
    async updateFeeParameters() {
        try {
            const pancakeSwapFeeNumerator = await this.flashArbitrageContract.pancakeSwapFeeNumerator();
            const pancakeSwapFeeDenominator = await this.flashArbitrageContract.pancakeSwapFeeDenominator();
            const biswapFeeNumerator = await this.flashArbitrageContract.biswapFeeNumerator();
            const biswapFeeDenominator = await this.flashArbitrageContract.biswapFeeDenominator();

            this.feeParameters = {
                pancakeSwapFeeNumerator,
                pancakeSwapFeeDenominator,
                biswapFeeNumerator,
                biswapFeeDenominator
            };

            this.logger.log(`Updated fee parameters: 
        PancakeSwap: ${pancakeSwapFeeNumerator}/${pancakeSwapFeeDenominator}
        Biswap: ${biswapFeeNumerator}/${biswapFeeDenominator}`);
        } catch (error) {
            this.logger.error(`Error updating fee parameters: ${error.message}`, error);
        }
    }
    
    /**
     * Hitung profitabilitas arbitrage
     * @param {object} arbitrageData - Data arbitrage
     * @param {ethers.BigNumber} loanAmount - Jumlah pinjaman flash loan
     * @param {boolean} fromPancake - Arah arbitrage (true jika dimulai dari PancakeSwap)
     * @param {object} tokenADetails - Detail token A
     * @returns {Promise<object>} Hasil perhitungan profitabilitas
     */
    async calculateProfit(arbitrageData, loanAmount, fromPancake, tokenADetails) {
        try {
            // Convert arbitrageData to array format for contract call
            const arbitrageArrayData = [
                arbitrageData.path1,
                arbitrageData.path2,
                arbitrageData.path3,
                arbitrageData.minAmountsOut,
                arbitrageData.direction
            ];

            const profitabilityResult = await this.flashArbitrageContract.checkArbitrageProfitability(
                arbitrageArrayData,
                loanAmount,
                fromPancake
            );

            // Pastikan hasilnya adalah array dengan tiga nilai
            if (!profitabilityResult || profitabilityResult.length !== 3) {
                throw new Error(`Invalid profitability result for ${tokenADetails.symbol}`);
            }

            const [expectedProfit, expectedPlatformFee, expectedUserProfit] = profitabilityResult;

            // Hitung biaya gas menggunakan harga gas dinamis
            const gasPrice = await this.networkService.getGasPrice(1.1); // 10% buffer
            const gasLimit = ethers.BigNumber.from(GAS_LIMIT);
            const gasCostWei = gasPrice.mul(gasLimit);

            // Konversi biaya gas ke USD
            const gasCostBNB = parseFloat(ethers.utils.formatEther(gasCostWei));
            const gasCostUSD = gasCostBNB * this.priceService.bnbPrice;

            // Hitung biaya flash loan berdasarkan parameter biaya yang diperbarui
            const flashLoanFee = fromPancake
                ? loanAmount.mul(this.feeParameters.pancakeSwapFeeNumerator).div(this.feeParameters.pancakeSwapFeeDenominator).add(1)
                : loanAmount.mul(this.feeParameters.biswapFeeNumerator).div(this.feeParameters.biswapFeeDenominator).add(1);

            // Konversi profit ke USD berdasarkan jenis token
            let profitUSD = 0;
            let loanAmountUSD = 0;

            // Konversi ke USD
            profitUSD = await this.priceService.convertToUSD(
                expectedUserProfit, 
                tokenADetails.address, 
                tokenADetails.decimals
            );
            
            loanAmountUSD = await this.priceService.convertToUSD(
                loanAmount, 
                tokenADetails.address, 
                tokenADetails.decimals
            );

            // Kurangi biaya gas dari profit
            const netProfitUSD = profitUSD - gasCostUSD;

            // Hitung profit sebagai persentase dari jumlah pinjaman
            const profitPercentage = loanAmountUSD > 0 ? (netProfitUSD / loanAmountUSD) * 100 : 0;

            // Log hasil
            this.logger.log(
                `Loan: ${ethers.utils.formatUnits(loanAmount, tokenADetails.decimals)} ${tokenADetails.symbol} ($${loanAmountUSD.toFixed(2)}), ` +
                `Gross Profit: $${profitUSD.toFixed(2)}, Gas: $${gasCostUSD.toFixed(2)}, ` +
                `Net Profit: $${netProfitUSD.toFixed(2)} (${profitPercentage.toFixed(2)}%)`
            );

            return {
                expectedProfit,
                expectedPlatformFee,
                expectedUserProfit,
                profitUSD,
                netProfitUSD,
                gasCostUSD,
                loanAmountUSD,
                profitPercentage,
                isProfit: profitPercentage >= MIN_PROFIT_PERCENTAGE
            };
        } catch (error) {
            this.logger.error(`Error calculating profit: ${error.message}`, error);
            return {
                isProfit: false,
                error: error.message
            };
        }
    }
    
    /**
     * Menentukan apakah suatu peluang arbitrage cukup menguntungkan
     * @param {object} profitResult - Hasil perhitungan profit
     * @returns {boolean} Status profitabilitas
     */
    isProfitable(profitResult) {
        if (!profitResult || profitResult.error) {
            return false;
        }
        
        return profitResult.isProfit && profitResult.profitPercentage >= MIN_PROFIT_PERCENTAGE;
    }
}

module.exports = ProfitCalculator;