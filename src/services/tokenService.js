const { ethers } = require('ethers');
const { ERC20_ABI } = require('../../config/abi');

/**
 * Service untuk mengelola informasi token
 */
class TokenService {
    constructor(provider, logger) {
        this.provider = provider;
        this.logger = logger;
        this.tokenCache = new Map(); // Cache informasi token
    }
    
    /**
     * Mendapatkan detail token (decimals, symbol, name)
     * @param {string} tokenAddress - Alamat kontrak token
     * @returns {Promise<object>} Informasi token
     */
    async getTokenDetails(tokenAddress) {
        // Cek cache terlebih dahulu
        if (this.tokenCache.has(tokenAddress)) {
            return this.tokenCache.get(tokenAddress);
        }

        try {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const decimals = await tokenContract.decimals();
            const symbol = await tokenContract.symbol();
            const name = await tokenContract.name().catch(() => symbol);

            const details = { 
                address: tokenAddress,
                decimals, 
                symbol, 
                name 
            };
            
            // Simpan ke cache
            this.tokenCache.set(tokenAddress, details);
            this.logger.log(`Cached token details for ${symbol} (${tokenAddress})`);
            
            return details;
        } catch (error) {
            this.logger.error(`Error getting token details for ${tokenAddress}: ${error.message}`, error);
            // Default ke 18 decimals jika terjadi error
            return { 
                address: tokenAddress,
                decimals: 18, 
                symbol: 'UNKNOWN', 
                name: 'Unknown Token' 
            };
        }
    }
    
    /**
     * Memeriksa saldo token pengguna
     * @param {string} tokenAddress - Alamat kontrak token
     * @param {string} userAddress - Alamat dompet pengguna
     * @returns {Promise<ethers.BigNumber>} Saldo token
     */
    async getTokenBalance(tokenAddress, userAddress) {
        try {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            const balance = await tokenContract.balanceOf(userAddress);
            
            // Dapatkan detail token untuk log
            const details = await this.getTokenDetails(tokenAddress);
            const formattedBalance = ethers.utils.formatUnits(balance, details.decimals);
            
            this.logger.log(`Balance for ${details.symbol}: ${formattedBalance}`);
            return {
                raw: balance,
                formatted: formattedBalance,
                symbol: details.symbol,
                decimals: details.decimals
            };
        } catch (error) {
            this.logger.error(`Error getting token balance for ${tokenAddress}: ${error.message}`, error);
            throw error;
        }
    }
    
    /**
     * Memeriksa allowance token untuk spender tertentu
     * @param {string} tokenAddress - Alamat kontrak token
     * @param {string} ownerAddress - Alamat pemilik token
     * @param {string} spenderAddress - Alamat spender
     * @returns {Promise<ethers.BigNumber>} Nilai allowance
     */
    async checkAllowance(tokenAddress, ownerAddress, spenderAddress) {
        try {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
            return await tokenContract.allowance(ownerAddress, spenderAddress);
        } catch (error) {
            this.logger.error(`Error checking allowance for ${tokenAddress}: ${error.message}`, error);
            throw error;
        }
    }
    
    /**
     * Memberi approval untuk spender menggunakan token
     * @param {ethers.Wallet} wallet - Wallet untuk signing transaksi
     * @param {string} tokenAddress - Alamat kontrak token
     * @param {string} spenderAddress - Alamat spender
     * @param {ethers.BigNumber} amount - Jumlah approval (umumnya MaxUint256)
     * @returns {Promise<ethers.providers.TransactionReceipt>} Receipt transaksi
     */
    async approveTokenSpender(wallet, tokenAddress, spenderAddress, amount) {
        try {
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
            const tokenDetails = await this.getTokenDetails(tokenAddress);
            
            this.logger.log(`Approving ${spenderAddress} to spend ${tokenDetails.symbol}`);
            
            const tx = await tokenContract.approve(spenderAddress, amount);
            const receipt = await tx.wait();
            
            this.logger.log(`Approval successful for ${tokenDetails.symbol}, tx: ${receipt.transactionHash}`);
            return receipt;
        } catch (error) {
            this.logger.error(`Error approving token: ${error.message}`, error);
            throw error;
        }
    }
}

module.exports = TokenService;