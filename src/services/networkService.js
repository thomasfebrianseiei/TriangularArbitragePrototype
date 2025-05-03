const { ethers } = require('ethers');
const { MAX_GAS_PRICE_GWEI, GAS_PRICE_GWEI } = require('../../config/constants');

/**
 * Service untuk memonitor kondisi jaringan dan gas price
 */
class NetworkService {
    constructor(provider, logger) {
        this.provider = provider;
        this.logger = logger;
        this.networkHealth = {
            lastCheckTime: 0,
            isHealthy: true,
            failedAttempts: 0,
            gasPrice: ethers.utils.parseUnits(GAS_PRICE_GWEI, 'gwei')
        };
    }

    /**
     * Memeriksa kesehatan jaringan dan harga gas
     * @returns {Promise<boolean>} Status kesehatan jaringan
     */
    async checkNetworkHealth() {
        try {
            // Periksa harga gas saat ini
            const gasPrice = await this.provider.getGasPrice();
            const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));
            
            // Update status kesehatan jaringan
            this.networkHealth.lastCheckTime = Date.now();
            this.networkHealth.gasPrice = gasPrice;
            
            // Periksa apakah harga gas terlalu tinggi
            if (gasPriceGwei > MAX_GAS_PRICE_GWEI) {
                this.logger.warn(`Gas price too high: ${gasPriceGwei.toFixed(2)} Gwei (max: ${MAX_GAS_PRICE_GWEI} Gwei)`);
                this.networkHealth.isHealthy = false;
            } else {
                this.networkHealth.isHealthy = true;
                this.networkHealth.failedAttempts = 0;
                this.logger.log(`Network health check passed. Gas price: ${gasPriceGwei.toFixed(2)} Gwei`);
            }
            
            return this.networkHealth.isHealthy;
        } catch (error) {
            this.logger.error(`Error checking network health: ${error.message}`, error);
            this.networkHealth.failedAttempts += 1;
            
            // Jika ada beberapa kegagalan berturut-turut, tandai jaringan sebagai tidak sehat
            if (this.networkHealth.failedAttempts >= 3) {
                this.networkHealth.isHealthy = false;
                this.logger.warn('Network marked as unhealthy due to multiple failed checks');
            }
            
            return false;
        }
    }

    /**
     * Mendapatkan estimasi gas untuk transaksi
     * @param {ethers.providers.TransactionRequest} txRequest - Request transaksi
     * @returns {Promise<ethers.BigNumber>} Estimasi gas
     */
    async estimateGas(txRequest) {
        try {
            return await this.provider.estimateGas(txRequest);
        } catch (error) {
            this.logger.error(`Error estimating gas: ${error.message}`, error);
            throw error;
        }
    }

    /**
     * Mendapatkan harga gas terbaru
     * @param {number} multiplier - Multiplier untuk menambahkan buffer (opsional, default: 1.1)
     * @returns {Promise<ethers.BigNumber>} Harga gas
     */
    async getGasPrice(multiplier = 1.1) {
        try {
            // Jika sudah memeriksa baru-baru ini (< 2 menit), gunakan nilai yang disimpan
            if (Date.now() - this.networkHealth.lastCheckTime < 2 * 60 * 1000) {
                const price = this.networkHealth.gasPrice;
                
                // Tambahkan buffer sesuai multiplier
                if (multiplier > 1) {
                    return price.mul(Math.floor(multiplier * 100)).div(100);
                }
                
                return price;
            }
            
            // Dapatkan harga gas baru
            const gasPrice = await this.provider.getGasPrice();
            this.networkHealth.gasPrice = gasPrice;
            
            // Tambahkan buffer sesuai multiplier
            if (multiplier > 1) {
                return gasPrice.mul(Math.floor(multiplier * 100)).div(100);
            }
            
            return gasPrice;
        } catch (error) {
            this.logger.error(`Error getting gas price: ${error.message}`, error);
            // Jika gagal, gunakan nilai default atau yang disimpan sebelumnya
            return this.networkHealth.gasPrice;
        }
    }

    /**
     * Mengecek apakah jaringan sehat dan siap untuk arbitrage
     * @returns {Promise<boolean>} Status jaringan
     */
    async isNetworkReadyForArbitrage() {
        // Jika belum pernah memeriksa atau sudah > 5 menit sejak pemeriksaan terakhir
        if (Date.now() - this.networkHealth.lastCheckTime > 5 * 60 * 1000) {
            await this.checkNetworkHealth();
        }
        
        return this.networkHealth.isHealthy;
    }
}

module.exports = NetworkService;