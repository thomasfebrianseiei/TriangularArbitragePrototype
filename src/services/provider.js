const { ethers } = require('ethers');
const RPCManager = require('../utils/rpcManager');

/**
 * Service untuk mengelola provider Ethereum
 */
class ProviderService {
    /**
     * @param {Object} logger - Logger object
     */
    constructor(logger) {
        this.logger = logger;
        this.rpcManager = null;
        this.provider = null;
    }
    
    /**
     * Initialize provider service
     * @returns {Promise<ethers.providers.Provider>} Ethers provider
     */
    async initialize() {
        try {
            this.logger.log('Initializing provider service...');
            
            // Initialize RPC Manager
            this.rpcManager = new RPCManager(this.logger);
            
            // Get initial provider
            this.provider = await this.rpcManager.getProvider();
            
            // Test connection
            const network = await this.provider.getNetwork();
            const blockNumber = await this.provider.getBlockNumber();
            
            this.logger.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
            this.logger.log(`Current block number: ${blockNumber}`);
            
            return this.provider;
        } catch (error) {
            this.logger.error(`Provider service initialization failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get current provider or refresh if needed
     * @returns {Promise<ethers.providers.Provider>} Current ethers provider
     */
    async getProvider() {
        if (!this.rpcManager) {
            throw new Error('Provider service not initialized');
        }
        
        try {
            // Get potentially new provider if current one is unhealthy
            this.provider = await this.rpcManager.getProvider();
            return this.provider;
        } catch (error) {
            this.logger.error(`Error getting provider: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get optimal gas price for transactions
     * @param {number} expectedProfitUSD - Expected profit in USD
     * @returns {Promise<ethers.BigNumber>} Optimal gas price
     */
    async getOptimalGasPrice(expectedProfitUSD = 0) {
        if (!this.rpcManager) {
            throw new Error('Provider service not initialized');
        }
        
        return await this.rpcManager.getOptimalGasPrice(expectedProfitUSD);
    }
    
    /**
     * Report a successful transaction/call
     */
    reportSuccess() {
        if (this.rpcManager) {
            this.rpcManager.reportSuccess();
        }
    }
    
    /**
     * Report a failed transaction/call
     */
    reportFailure() {
        if (this.rpcManager) {
            this.rpcManager.reportFailure();
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        if (this.rpcManager) {
            this.rpcManager.cleanup();
        }
        this.logger.log('Provider service cleaned up');
    }
}

module.exports = ProviderService;