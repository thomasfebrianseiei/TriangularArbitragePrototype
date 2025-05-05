const { ethers } = require('ethers');
const { 
    BSC_RPC_URL, 
    BACKUP_RPC_URLS,
    RPC_TIMEOUT_MS,
    RPC_RETRY_COUNT,
    RPC_COOLDOWN_MS,
    RPC_HEALTH_CHECK_INTERVAL_MS,
    RPC_DEBUG_ENABLED
} = require('../../config/constants');

/**
 * RPC Manager untuk mengelola multiple RPC URLs dengan rotasi dan health checking
 */
class RPCManager {
    /**
     * @param {Object} logger - Logger object
     */
    constructor(logger) {
        this.logger = logger;
        this.rpcUrls = [BSC_RPC_URL, ...BACKUP_RPC_URLS];
        this.providers = this.rpcUrls.map(url => new ethers.providers.JsonRpcProvider(url));
        this.currentIndex = 0;
        this.failCounts = this.rpcUrls.map(() => 0);
        this.lastUsed = this.rpcUrls.map(() => 0);
        this.healthStatus = this.rpcUrls.map(() => true);
        this.healthCheckInterval = null;
        
        this.logger.log(`RPC Manager initialized with ${this.rpcUrls.length} providers`);
        
        // Schedule health checks
        this._initializeHealthChecks();
    }
    
    /**
     * Initialize periodic health checks
     * @private
     */
    _initializeHealthChecks() {
        // Initial health check
        this._checkHealth();
        
        // Schedule regular health checks
        this.healthCheckInterval = setInterval(() => {
            this._checkHealth();
        }, RPC_HEALTH_CHECK_INTERVAL_MS);
    }
    
    /**
     * Run health check on all providers
     * @private
     */
    async _checkHealth() {
        this.logger.log("Checking health of RPC providers...");
        
        for (let i = 0; i < this.providers.length; i++) {
            try {
                // Check with timeout
                const provider = this.providers[i];
                const blockNumberPromise = provider.getBlockNumber();
                
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Health check timeout')), 5000);
                });
                
                // Race promises
                const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
                
                this.healthStatus[i] = true;
                this.logger.log(`Provider ${i} (${this._formatUrl(this.rpcUrls[i])}) is healthy, block: ${blockNumber}`);
            } catch (error) {
                this.healthStatus[i] = false;
                this.logger.error(`Provider ${i} (${this._formatUrl(this.rpcUrls[i])}) is unhealthy: ${error.message}`);
            }
        }
    }
    
    /**
     * Format URL for logging (masking API keys for security)
     * @private
     * @param {string} url - RPC URL
     * @returns {string} Formatted URL for logging
     */
    _formatUrl(url) {
        try {
            const urlObj = new URL(url);
            // Mask API key in path if present
            if (urlObj.pathname.length > 20) {
                return `${urlObj.origin}/*****`;
            }
            return urlObj.origin;
        } catch (e) {
            // If URL is invalid, return truncated version
            return url.substring(0, 20) + '...';
        }
    }
    
    /**
     * Get best available ethers provider
     * @returns {Promise<ethers.providers.JsonRpcProvider>} Ethers provider
     */
    async getProvider() {
        const now = Date.now();
        
        // Try current provider if health is good
        if (this.healthStatus[this.currentIndex] && 
            this.failCounts[this.currentIndex] < 3 && 
            now - this.lastUsed[this.currentIndex] > 500) {
            this.lastUsed[this.currentIndex] = now;
            return this.providers[this.currentIndex];
        }
        
        // Find another healthy provider
        for (let i = 0; i < this.providers.length; i++) {
            const idx = (this.currentIndex + i + 1) % this.providers.length;
            
            if (this.healthStatus[idx] && 
                this.failCounts[idx] < 3 && 
                now - this.lastUsed[idx] > 500) {
                this.currentIndex = idx;
                this.lastUsed[idx] = now;
                
                this.logger.log(`Switching to provider ${idx} (${this._formatUrl(this.rpcUrls[idx])})`);
                
                return this.providers[idx];
            }
        }
        
        // If all are problematic, reset and use primary
        this.logger.warn("All providers are unhealthy, resetting to primary");
        this.failCounts = this.failCounts.map(() => 0);
        this.currentIndex = 0; 
        this.lastUsed[0] = now;
        return this.providers[0];
    }
    
    /**
     * Report a provider failure
     */
    reportFailure() {
        this.failCounts[this.currentIndex]++;
        this.logger.log(`Provider ${this.currentIndex} failure reported (${this.failCounts[this.currentIndex]}/3)`);
        
        if (this.failCounts[this.currentIndex] >= 3) {
            this.logger.warn(`Marking provider ${this.currentIndex} as unhealthy`);
            this.healthStatus[this.currentIndex] = false;
            
            // Reset after cooldown period
            setTimeout(() => {
                this.healthStatus[this.currentIndex] = true;
                this.failCounts[this.currentIndex] = 0;
                this.logger.log(`Resetting provider ${this.currentIndex} after cooldown`);
            }, RPC_COOLDOWN_MS);
            
            // Move to next provider
            this.currentIndex = (this.currentIndex + 1) % this.providers.length;
        }
    }
    
    /**
     * Report a provider success
     */
    reportSuccess() {
        // Reset fail count for current provider
        this.failCounts[this.currentIndex] = 0;
    }
    
    /**
     * Get current gas price with retry
     * @returns {Promise<ethers.BigNumber>} Gas price in wei
     */
    async getGasPrice() {
        let attempts = 0;
        
        while (attempts < RPC_RETRY_COUNT) {
            try {
                const provider = await this.getProvider();
                
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Gas price request timeout')), RPC_TIMEOUT_MS);
                });
                
                // Race promises
                const gasPrice = await Promise.race([
                    provider.getGasPrice(),
                    timeoutPromise
                ]);
                
                this.reportSuccess();
                
                this.logger.log(`Current gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
                return gasPrice;
            } catch (error) {
                attempts++;
                this.reportFailure();
                
                this.logger.error(`Failed to get gas price (attempt ${attempts}/${RPC_RETRY_COUNT}): ${error.message}`);
                
                if (attempts < RPC_RETRY_COUNT) {
                    // Wait before retrying with exponential backoff
                    const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // All attempts failed, fallback to reasonable default
                    this.logger.error(`All attempts to get gas price failed, using default gas price`);
                    return ethers.utils.parseUnits('5', 'gwei');
                }
            }
        }
    }
    
    /**
     * Get optimal gas price for transactions
     * @param {number} expectedProfitUSD - Expected profit in USD
     * @returns {Promise<ethers.BigNumber>} Optimal gas price in wei
     */
    async getOptimalGasPrice(expectedProfitUSD = 0) {
        try {
            // Get base gas price
            const baseGasPrice = await this.getGasPrice();
            const baseGasPriceGwei = parseFloat(ethers.utils.formatUnits(baseGasPrice, 'gwei'));
            
            // Default multiplier
            let multiplier = 1.05; // 5% higher than market price
            
            // Adjust based on profit
            if (expectedProfitUSD > 50) {
                multiplier = 1.3;
            } else if (expectedProfitUSD > 20) {
                multiplier = 1.2;
            } else if (expectedProfitUSD > 10) {
                multiplier = 1.1;
            }
            
            // Calculate optimal gas price (not exceeding max)
            const MAX_GAS_PRICE_GWEI = 10; // Get from constants if available
            let optimalGasPriceGwei = Math.min(
                baseGasPriceGwei * multiplier, 
                MAX_GAS_PRICE_GWEI
            );
            
            this.logger.log(`Base gas price: ${baseGasPriceGwei.toFixed(2)} gwei`);
            this.logger.log(`Optimal gas price: ${optimalGasPriceGwei.toFixed(2)} gwei (multiplier: ${multiplier.toFixed(2)})`);
            
            return ethers.utils.parseUnits(optimalGasPriceGwei.toString(), 'gwei');
        } catch (error) {
            this.logger.error(`Error calculating optimal gas price: ${error.message}`);
            return ethers.utils.parseUnits('5', 'gwei'); // Default fallback
        }
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.logger.log('RPC Manager cleaned up');
    }
}

module.exports = RPCManager;