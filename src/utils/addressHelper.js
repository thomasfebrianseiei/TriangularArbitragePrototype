const { ethers } = require('ethers');

/**
 * Utilitas untuk membantu penanganan alamat Ethereum
 */
class AddressHelper {
    /**
     * Memperbaiki format checksum alamat
     * @param {string} address - Alamat Ethereum yang akan diperbaiki format checksumnya
     * @param {object} logger - Logger untuk mencatat error
     * @returns {string} Alamat dengan format checksum yang benar
     */
    static fixAddressChecksum(address, logger = null) {
        try {
            return ethers.utils.getAddress(address);
        } catch (error) {
            if (logger) {
                logger.error(`Invalid address format: ${address}`, error);
            }
            return address; // Kembalikan alamat asli jika gagal
        }
    }
    
    /**
     * Memvalidasi alamat pair dan token dalam konfigurasi
     * @param {Array} tokenPairs - Array objek konfigurasi token pair
     * @param {object} logger - Logger untuk mencatat proses validasi
     */
    static validateAddresses(tokenPairs, logger) {
        logger.log('Validating address checksums...');
        
        // Untuk setiap konfigurasi token pair
        tokenPairs.forEach(pair => {
            // Perbaiki checksum alamat token
            for (const [symbol, address] of Object.entries(pair.tokens)) {
                pair.tokens[symbol] = this.fixAddressChecksum(address, logger);
            }
            
            // Perbaiki checksum alamat pair PancakeSwap
            for (const [key, address] of Object.entries(pair.pancakeswapPairs)) {
                pair.pancakeswapPairs[key] = this.fixAddressChecksum(address, logger);
            }
            
            // Perbaiki checksum alamat pair BiSwap
            for (const [key, address] of Object.entries(pair.biswapPairs)) {
                pair.biswapPairs[key] = this.fixAddressChecksum(address, logger);
            }
        });
        
        logger.log('Address checksum validation completed');
    }
    
    /**
     * Memeriksa apakah alamat adalah kontrak
     * @param {string} address - Alamat Ethereum
     * @param {object} provider - Provider ethers.js
     * @returns {Promise<boolean>} - True jika alamat adalah kontrak
     */
    static async isContract(address, provider) {
        try {
            const code = await provider.getCode(address);
            return code !== '0x' && code !== '0x0';
        } catch (error) {
            return false;
        }
    }
}

module.exports = AddressHelper;