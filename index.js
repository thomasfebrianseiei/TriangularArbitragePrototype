require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { FLASH_ARBITRAGE_ABI } = require('./config/abi');
const { DATA_DIR, LOG_DIR, HISTORY_DIR } = require('./config/constants');

// Import services and utilities
const Logger = require('./src/utils/logger');
const FileManager = require('./src/utils/fileManager');
const ProviderService = require('./src/services/provider');
const TokenService = require('./src/services/tokenService');
const PriceService = require('./src/services/priceService');
const NetworkService = require('./src/services/networkService');

// Import arbitrage logic modules
const ProfitCalculator = require('./src/arbitrage/profitCalculator');
const ArbitrageChecker = require('./src/arbitrage/checker');
const ArbitrageExecutor = require('./src/arbitrage/executor');

// Import main bot class
const ArbitrageBot = require('./src/bot');

// Ensure required directories exist
[DATA_DIR, LOG_DIR, HISTORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Bot instance
let bot = null;

/**
 * Inisialisasi dan jalankan bot
 */
async function startBot() {
    try {
        // Inisialisasi logger
        const logger = new Logger({
            prefix: 'arbitrage_'
        });
        
        logger.log('Initializing bot components...');
        
        // Inisialisasi provider service
        const providerService = new ProviderService(logger);
        const provider = await providerService.initialize();
        
        // Validasi environment variables
        const PRIVATE_KEY = process.env.PRIVATE_KEY;
        const FLASH_ARBITRAGE_ADDRESS = process.env.FLASH_ARBITRAGE_ADDRESS;
        
        if (!PRIVATE_KEY) {
            logger.error('PRIVATE_KEY tidak ditemukan di .env file');
            process.exit(1);
        }
        
        if (!FLASH_ARBITRAGE_ADDRESS) {
            logger.error('FLASH_ARBITRAGE_ADDRESS tidak ditemukan di .env file');
            process.exit(1);
        }
        
        // Inisialisasi wallet
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        logger.log(`Wallet address: ${wallet.address}`);
        
        // Inisialisasi flash arbitrage contract
        const flashArbitrageContract = new ethers.Contract(
            FLASH_ARBITRAGE_ADDRESS,
            FLASH_ARBITRAGE_ABI,
            wallet
        );
        
        // Inisialisasi services
        const fileManager = new FileManager(logger);
        const tokenService = new TokenService(provider, logger);
        const priceService = new PriceService(provider, logger);
        const networkService = new NetworkService(provider, logger);
        
        // Inisialisasi arbitrage modules
        const profitCalculator = new ProfitCalculator(flashArbitrageContract, priceService, networkService, logger);
        const arbitrageChecker = new ArbitrageChecker(provider, tokenService, priceService, profitCalculator, logger);
        const arbitrageExecutor = new ArbitrageExecutor(flashArbitrageContract, networkService, fileManager, wallet, logger);
        
        // Buat instance bot
        bot = new ArbitrageBot({
            providerService,
            tokenService,
            priceService,
            networkService,
            fileManager,
            logger,
            profitCalculator,
            arbitrageChecker,
            arbitrageExecutor
        });
        
        // Mulai bot
        await bot.start();
        
        logger.log('Bot started successfully');
    } catch (error) {
        console.error('Fatal error starting bot:', error);
        process.exit(1);
    }
}

// Handle process termination signals
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down gracefully...');
    if (bot) bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM. Shutting down gracefully...');
    if (bot) bot.stop();
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (bot) bot.stop();
    process.exit(1);
});

// Start the bot
startBot().catch((error) => {
    console.error('Fatal error starting bot:', error);
    process.exit(1);
});