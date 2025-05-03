const { TOKEN_ADDRESSES, PANCAKESWAP_PAIRS } = require('./constants');

// BiSwap Pair Information
const BISWAP_PAIRS = [
    {
        pid: 0,
        name: { symbolA: "USDT", symbolB: "BUSD" },
        address: "0xDA8ceb724A06819c0A5cDb4304ea0cB27F8304cF",
        percent: "70",
        enabled: true
    },
    {
        pid: 1,
        name: { symbolA: "USDT", symbolB: "WBNB" },
        address: "0x8840C6252e2e86e545deFb6da98B2a0E26d8C1BA",
        percent: "70",
        enabled: true
    },
    {
        pid: 2,
        name: { symbolA: "WBNB", symbolB: "BUSD" },
        address: "0xaCAac9311b0096E04Dfe96b6D87dec867d3883Dc",
        percent: "70",
        enabled: true
    },
    {
        pid: 3,
        name: { symbolA: "USDT", symbolB: "USDC" },
        address: "0x1483767E665B3591677Fd49F724bf7430C18Bf83",
        percent: "80",
        enabled: true
    },
    {
        pid: 4,
        name: { symbolA: "ETH", symbolB: "USDT" },
        address: "0x63b30de1A998e9E64FD58A21F68D323B9BcD8F85",
        percent: "80",
        enabled: true
    },
    {
        pid: 5,
        name: { symbolA: "USDT", symbolB: "BTCB" },
        address: "0xa987f0b7098585c735cD943ee07544a84e923d1D",
        percent: "80",
        enabled: true
    },
    {
        pid: 6,
        name: { symbolA: "ETH", symbolB: "BTCB" },
        address: "0x6216E04cd40DB2c6FBEd64f1B5830A98D3A91740",
        percent: "80",
        enabled: true
    },
    {
        pid: 7,
        name: { symbolA: "BTCB", symbolB: "WBNB" },
        address: "0xC7e9d76ba11099AF3F330ff829c5F442d571e057",
        percent: "80",
        enabled: true
    },
    {
        pid: 8,
        name: { symbolA: "USDT", symbolB: "BSW" },
        address: "0x2b30c317ceDFb554Ec525F85E79538D59970BEb0",
        percent: "49",
        enabled: true
    },
    {
        pid: 9,
        name: { symbolA: "BSW", symbolB: "WBNB" },
        address: "0x46492B26639Df0cda9b2769429845cb991591E0A",
        percent: "49",
        enabled: true
    },
    {
        pid: 10,
        name: { symbolA: "Cake", symbolB: "WBNB" },
        address: "0x3d94d03eb9ea2D4726886aB8Ac9fc0F18355Fd13",
        percent: "80",
        enabled: true
    },
    {
        pid: 21,
        name: { symbolA: "ETH", symbolB: "WBNB" },
        address: "0x5bf6941f029424674bb93A43b79fc46bF4A67c21",
        percent: "80",
        enabled: true
    }
    // Tambahkan pair BiSwap lainnya sesuai kebutuhan
];

// Helper function to find BiSwap pair by symbols
const findBiswapPairAddress = (symbolA, symbolB) => {
    const pair = BISWAP_PAIRS.find(p => 
        (p.name.symbolA === symbolA && p.name.symbolB === symbolB) || 
        (p.name.symbolA === symbolB && p.name.symbolB === symbolA)
    );
    return pair ? pair.address : null;
};

// Token pair configurations for arbitrage
const TOKEN_PAIRS = [
    // Pair 1: WBNB-USDT-BUSD (Stablecoin + BNB)
    {
        name: 'WBNB-USDT-BUSD',
        tokens: {
            WBNB: TOKEN_ADDRESSES.WBNB,
            USDT: TOKEN_ADDRESSES.USDT,
            BUSD: TOKEN_ADDRESSES.BUSD
        },
        pancakeswapPairs: {
            'WBNB-USDT': PANCAKESWAP_PAIRS['WBNB-USDT'],
            'USDT-BUSD': PANCAKESWAP_PAIRS['USDT-BUSD'],
            'BUSD-WBNB': PANCAKESWAP_PAIRS['BUSD-WBNB']
        },
        biswapPairs: {
            'WBNB-USDT': findBiswapPairAddress('USDT', 'WBNB'), // PID 1
            'USDT-BUSD': findBiswapPairAddress('USDT', 'BUSD'), // PID 0
            'BUSD-WBNB': findBiswapPairAddress('BUSD', 'WBNB')  // PID 2
        },
        priority: 1,
        testAmounts: [1000, 5000, 10000]  // USDT/BUSD amounts
    },
    
    // Pair 2: WBNB-BTCB-USDT (BTC pair)
    {
        name: 'WBNB-BTCB-USDT',
        tokens: {
            WBNB: TOKEN_ADDRESSES.WBNB,
            BTCB: TOKEN_ADDRESSES.BTCB,
            USDT: TOKEN_ADDRESSES.USDT
        },
        pancakeswapPairs: {
            'WBNB-BTCB': PANCAKESWAP_PAIRS['WBNB-BTCB'],
            'BTCB-USDT': PANCAKESWAP_PAIRS['BTCB-USDT'],
            'USDT-WBNB': PANCAKESWAP_PAIRS['WBNB-USDT']
        },
        biswapPairs: {
            'WBNB-BTCB': findBiswapPairAddress('BTCB', 'WBNB'), // PID 7
            'BTCB-USDT': findBiswapPairAddress('USDT', 'BTCB'), // PID 5 
            'USDT-WBNB': findBiswapPairAddress('USDT', 'WBNB')  // PID 1
        },
        priority: 2,
        testAmounts: [0.01, 0.05, 0.1]  // BTCB amounts
    },
    
    // Pair 3: WBNB-ETH-USDT (ETH pair)
    {
        name: 'WBNB-ETH-USDT',
        tokens: {
            WBNB: TOKEN_ADDRESSES.WBNB,
            ETH: TOKEN_ADDRESSES.ETH,
            USDT: TOKEN_ADDRESSES.USDT
        },
        pancakeswapPairs: {
            'WBNB-ETH': PANCAKESWAP_PAIRS['WBNB-ETH'],
            'ETH-USDT': PANCAKESWAP_PAIRS['ETH-USDT'],
            'USDT-WBNB': PANCAKESWAP_PAIRS['WBNB-USDT']
        },
        biswapPairs: {
            'WBNB-ETH': findBiswapPairAddress('ETH', 'WBNB'), // PID 21
            'ETH-USDT': findBiswapPairAddress('ETH', 'USDT'), // PID 4
            'USDT-WBNB': findBiswapPairAddress('USDT', 'WBNB')  // PID 1
        },
        priority: 2,
        testAmounts: [0.1, 0.25, 0.5]  // ETH amounts
    },
    
    // Pair 4: WBNB-CAKE-USDT (CAKE pair)
    {
        name: 'WBNB-CAKE-USDT',
        tokens: {
            WBNB: TOKEN_ADDRESSES.WBNB,
            CAKE: TOKEN_ADDRESSES.CAKE,
            USDT: TOKEN_ADDRESSES.USDT
        },
        pancakeswapPairs: {
            'WBNB-CAKE': PANCAKESWAP_PAIRS['WBNB-CAKE'],
            'CAKE-USDT': PANCAKESWAP_PAIRS['CAKE-USDT'],
            'USDT-WBNB': PANCAKESWAP_PAIRS['WBNB-USDT']
        },
        biswapPairs: {
            'WBNB-CAKE': findBiswapPairAddress('Cake', 'WBNB'), // PID 10
            // For CAKE-USDT we'll use PancakeSwap if BiSwap doesn't have the pair
            'CAKE-USDT': PANCAKESWAP_PAIRS['CAKE-USDT'],
            'USDT-WBNB': findBiswapPairAddress('USDT', 'WBNB')  // PID 1
        },
        priority: 3,
        testAmounts: [5, 10, 25]  // CAKE amounts
    },
    
    // Pair 5: WBNB-BSW-USDT (BiSwap token)
    {
        name: 'WBNB-BSW-USDT',
        tokens: {
            WBNB: TOKEN_ADDRESSES.WBNB,
            BSW: TOKEN_ADDRESSES.BSW,
            USDT: TOKEN_ADDRESSES.USDT
        },
        pancakeswapPairs: {
            'WBNB-BSW': PANCAKESWAP_PAIRS['WBNB-BSW'],
            'BSW-USDT': PANCAKESWAP_PAIRS['BSW-USDT'],
            'USDT-WBNB': PANCAKESWAP_PAIRS['WBNB-USDT']
        },
        biswapPairs: {
            'WBNB-BSW': findBiswapPairAddress('BSW', 'WBNB'), // PID 9
            'BSW-USDT': findBiswapPairAddress('USDT', 'BSW'), // PID 8
            'USDT-WBNB': findBiswapPairAddress('USDT', 'WBNB')  // PID 1
        },
        priority: 1,  // Prioritas tinggi untuk token native BiSwap
        testAmounts: [100, 500, 1000]  // BSW amounts
    }
];

module.exports = {
    BISWAP_PAIRS,
    TOKEN_PAIRS,
    findBiswapPairAddress
};