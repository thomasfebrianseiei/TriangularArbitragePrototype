const { ethers } = require('ethers');
const { ROUTER_ABI } = require('../../config/abi');
const { ROUTER_ADDRESSES, TOKEN_ADDRESSES } = require('../../config/constants');

/**
 * Service untuk mengelola harga token dan perkiraan swap
 */
class PriceService {
    constructor(provider, logger) {
        this.provider = provider;
        this.logger = logger;
        this.bnbPrice = 300; // Default BNB price yang akan diupdate
        this.lastUpdated = 0;
        this.priceCache = new Map(); // Cache harga token
        
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
     * Update harga BNB berdasarkan WBNB/BUSD pair di PancakeSwap
     * @returns {Promise<number>} Harga BNB saat ini
     */
    async updateBnbPrice() {
        try {
            // Get WBNB/BUSD price from PancakeSwap
            const path = [
                TOKEN_ADDRESSES.WBNB,
                TOKEN_ADDRESSES.BUSD // BUSD address
            ];

            const amountIn = ethers.utils.parseEther('1'); // 1 BNB
            const amounts = await this.pancakeRouter.getAmountsOut(amountIn, path);

            // BUSD has 18 decimals
            const bnbPrice = parseFloat(ethers.utils.formatEther(amounts[1]));
            this.bnbPrice = bnbPrice;
            this.lastUpdated = Date.now();

            this.logger.log(`Updated BNB price: $${bnbPrice.toFixed(2)}`);
            return bnbPrice;
        } catch (error) {
            this.logger.error(`Error updating BNB price: ${error.message}`, error);
            // Keep the last known price or the default
            return this.bnbPrice;
        }
    }
    
    /**
     * Mendapatkan harga token dalam USD
     * @param {string} tokenAddress - Alamat token
     * @param {number} decimals - Decimal token
     * @returns {Promise<number>} Harga token dalam USD
     */
    async getTokenPriceUSD(tokenAddress, decimals = 18) {
        // Cek cache harga jika ada dan belum kadaluwarsa (5 menit)
        const cacheKey = `${tokenAddress}:USD`;
        const cachedPrice = this.priceCache.get(cacheKey);
        if (cachedPrice && (Date.now() - cachedPrice.timestamp) < 5 * 60 * 1000) {
            return cachedPrice.price;
        }
        
        try {
            // Jika token adalah stablecoin, kembalikan 1
            if (tokenAddress === TOKEN_ADDRESSES.BUSD || 
                tokenAddress === TOKEN_ADDRESSES.USDT || 
                tokenAddress === TOKEN_ADDRESSES.USDC || 
                tokenAddress === TOKEN_ADDRESSES.DAI) {
                return 1;
            }
            
            // Jika token adalah WBNB, kembalikan harga BNB
            if (tokenAddress === TOKEN_ADDRESSES.WBNB) {
                // Update harga BNB jika lebih dari 10 menit
                if (Date.now() - this.lastUpdated > 10 * 60 * 1000) {
                    await this.updateBnbPrice();
                }
                return this.bnbPrice;
            }
            
            // Untuk token lain, coba ambil harga via BUSD
            const busdPath = [
                tokenAddress,
                TOKEN_ADDRESSES.BUSD
            ];

            const amountIn = ethers.utils.parseUnits('1', decimals);
            const amounts = await this.pancakeRouter.getAmountsOut(amountIn, busdPath).catch(() => null);
            
            if (amounts && amounts.length >= 2) {
                const price = parseFloat(ethers.utils.formatUnits(amounts[1], 18)); // BUSD has 18 decimals
                
                // Cache hasil
                this.priceCache.set(cacheKey, {
                    price,
                    timestamp: Date.now()
                });
                
                return price;
            }
            
            // Jika jalur ke BUSD gagal, coba via WBNB
            const bnbPath = [
                tokenAddress,
                TOKEN_ADDRESSES.WBNB
            ];
            
            const bnbAmounts = await this.pancakeRouter.getAmountsOut(amountIn, bnbPath).catch(() => null);
            
            if (bnbAmounts && bnbAmounts.length >= 2) {
                // Pastikan harga BNB sudah update
                if (Date.now() - this.lastUpdated > 10 * 60 * 1000) {
                    await this.updateBnbPrice();
                }
                
                const bnbValue = parseFloat(ethers.utils.formatEther(bnbAmounts[1])); // WBNB has 18 decimals
                const price = bnbValue * this.bnbPrice;
                
                // Cache hasil
                this.priceCache.set(cacheKey, {
                    price,
                    timestamp: Date.now()
                });
                
                return price;
            }
            
            // Jika semua metode gagal
            this.logger.warn(`Could not determine price for token ${tokenAddress}`);
            return 0;
        } catch (error) {
            this.logger.error(`Error getting token price: ${error.message}`, error);
            return 0;
        }
    }
    
    /**
     * Perkiraan jumlah token yang diterima dari swap
     * @param {ethers.Contract} router - Router contract (PancakeSwap/BiSwap)
     * @param {ethers.BigNumber} amountIn - Jumlah token masukan
     * @param {string[]} path - Path swap [tokenIn, tokenOut]
     * @returns {Promise<ethers.BigNumber>} Jumlah token yang diterima
     */
    async getAmountOut(router, amountIn, path) {
        try {
            const amounts = await router.getAmountsOut(amountIn, path);
            if (!amounts || amounts.length < 2) {
                throw new Error('Invalid amounts result from router');
            }
            return amounts[amounts.length - 1];
        } catch (error) {
            this.logger.error(`Error getting amount out: ${error.message}`, error);
            throw error;
        }
    }
    
    /**
     * Konversi nilai token ke USD
     * @param {ethers.BigNumber} amount - Jumlah token
     * @param {string} tokenAddress - Alamat token
     * @param {number} decimals - Decimal token
     * @returns {Promise<number>} Nilai dalam USD
     */
    async convertToUSD(amount, tokenAddress, decimals = 18) {
        const amountFloat = parseFloat(ethers.utils.formatUnits(amount, decimals));
        const price = await this.getTokenPriceUSD(tokenAddress, decimals);
        return amountFloat * price;
    }
}

module.exports = PriceService;