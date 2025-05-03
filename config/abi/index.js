// ABI untuk FlashTriangularArbitrage contract
const FLASH_ARBITRAGE_ABI = [
    "function executeFlashLoan(address pairAddress, uint256 borrowAmount, tuple(address[],address[],address[],uint256[],bool) data, bool fromPancake) external",
    "function checkArbitrageProfitability(tuple(address[],address[],address[],uint256[],bool) data, uint256 loanAmount, bool fromPancake) external view returns (uint256 expectedProfit, uint256 expectedPlatformFee, uint256 expectedUserProfit)",
    "function authorizedPancakeswapPairs(address) external view returns (bool)",
    "function authorizedBiswapPairs(address) external view returns (bool)",
    "function updateAuthorizedPair(address pair, bool isAuthorized, bool isPancakeswap) external",
    "function paused() external view returns (bool)",
    "function pancakeSwapFeeNumerator() external view returns (uint256)",
    "function pancakeSwapFeeDenominator() external view returns (uint256)",
    "function biswapFeeNumerator() external view returns (uint256)",
    "function biswapFeeDenominator() external view returns (uint256)",
    "function pauseContract() external",
    "function unpauseContract() external",
    "function owner() external view returns (address)",
    "function factory() external view returns (address)"
];

// ABI untuk token ERC20
const ERC20_ABI = [
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

// ABI untuk router DEX
const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function factory() external view returns (address)"
];

// ABI khusus untuk WBNB (Wrapped BNB)
const WBNB_ABI = [
    "function withdraw(uint wad) external"
];

// ABI untuk pair LP token
const PAIR_ABI = [
    "function getReserves() external view returns (uint112, uint112, uint32)"
];

module.exports = {
    FLASH_ARBITRAGE_ABI,
    ERC20_ABI,
    ROUTER_ABI,
    WBNB_ABI,
    PAIR_ABI
};