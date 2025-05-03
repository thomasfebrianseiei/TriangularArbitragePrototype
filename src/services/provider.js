const { ethers } = require('ethers');
const { BSC_RPC_URL, BACKUP_RPC_URLS } = require('../../config/constants');

/**
 * Service untuk mengelola koneksi ke node blockchain
 */
class ProviderService {
    constructor(logger) {
        this.logger = logger;
        this.provider = null;
        this.failedAttempts = 0;
    }
    
    /**
     * Inisialisasi provider dengan mekanisme retry
     * @returns {ethers.providers.JsonRpcProvider} Provider yang berhasil terhubung
     */
    async initialize() {
        try {
            this.provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
            await this.provider.getNetwork(); // Test koneksi
            this.logger.log(`Connected to primary RPC: ${BSC_RPC_URL}`);
            return this.provider;
        } catch (error) {
            this.logger.error(`Failed to connect to primary RPC: ${error.message}`, error);
            this.logger.log('Trying backup RPC nodes...');
            
            // Coba backup RPC URLs
            for (const backupUrl of BACKUP_RPC_URLS) {
                try {
                    this.provider = new ethers.providers.JsonRpcProvider(backupUrl);
                    await this.provider.getNetwork(); // Test koneksi
                    this.logger.log(`Connected to backup RPC: ${backupUrl}`);
                    return this.provider;
                } catch (e) {
                    this.logger.error(`Failed to connect to backup RPC ${backupUrl}: ${e.message}`, e);
                }
            }
            
            this.logger.error('Failed to connect to any RPC node.');
            throw new Error('Could not connect to any RPC node');
        }
    }
    
    /**
     * Mendapatkan provider yang sudah diinisialisasi, atau menginisialisasi jika belum
     * @returns {Promise<ethers.providers.JsonRpcProvider>}
     */
    async getProvider() {
        if (!this.provider) {
            return this.initialize();
        }
        return this.provider;
    }
    
    /**
     * Mencoba ulang koneksi ke RPC jika terjadi kegagalan
     * @returns {Promise<boolean>} Berhasil atau tidak
     */
    async reconnect() {
        this.failedAttempts++;
        this.logger.log(`Attempting to reconnect (attempt ${this.failedAttempts})...`);
        
        try {
            // Coba RPC utama terlebih dahulu
            if (this.failedAttempts <= 3) {
                this.provider = new ethers.providers.JsonRpcProvider(BSC_RPC_URL);
                await this.provider.getNetwork();
                this.logger.log(`Reconnected to primary RPC: ${BSC_RPC_URL}`);
                this.failedAttempts = 0;
                return true;
            }
            
            // Jika masih gagal, coba backup RPC
            const backupIndex = (this.failedAttempts - 4) % BACKUP_RPC_URLS.length;
            const backupUrl = BACKUP_RPC_URLS[backupIndex];
            
            this.provider = new ethers.providers.JsonRpcProvider(backupUrl);
            await this.provider.getNetwork();
            this.logger.log(`Reconnected to backup RPC: ${backupUrl}`);
            this.failedAttempts = 0;
            return true;
        } catch (error) {
            this.logger.error(`Failed to reconnect: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Memeriksa kesehatan koneksi provider
     * @returns {Promise<boolean>} Status kesehatan
     */
    async checkHealth() {
        try {
            if (!this.provider) {
                return false;
            }
            
            // Coba dapatkan nomor blok terbaru
            const blockNumber = await this.provider.getBlockNumber();
            this.logger.log(`Provider health check: current block ${blockNumber}`);
            return true;
        } catch (error) {
            this.logger.error(`Provider health check failed: ${error.message}`, error);
            return false;
        }
    }
}

module.exports = ProviderService;