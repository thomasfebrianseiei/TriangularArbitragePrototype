# Flash Triangular Arbitrage Bot

Bot otomatis untuk melakukan flash triangular arbitrage antara PancakeSwap dan BiSwap di Binance Smart Chain. Bot ini memanfaatkan perbedaan harga untuk token yang sama di berbagai DEX untuk mendapatkan keuntungan melalui transaksi atomik (dalam satu transaksi).

## Fitur
- Arbitrase triangular otomatis antara PancakeSwap dan BiSwap
- Pemantauan harga real-time
- Pencarian peluang arbitrage yang menguntungkan
- Pelaksanaan arbitrage yang aman dengan flash loan
- Monitoring kesehatan jaringan dan gas price
- Logging dan pelacakan performa yang komprehensif
- Mode monitoring/simulasi tanpa eksekusi nyata

## Persyaratan
- Node.js v14 atau lebih baru
- Akun BSC dengan BNB untuk gas
- Kontrak FlashTriangularArbitrage yang sudah di-deploy

## Struktur Proyek
```
flash-triangular-arbitrage/
├── .env                       # File konfigurasi environment variables
├── package.json               # Definisi paket npm
├── index.js                   # File utama yang menjalankan bot
├── config/                    # Konfigurasi
│   ├── constants.js           # Konstanta dan alamat kontrak
│   ├── pairs.js               # Konfigurasi pasangan token
│   └── abi/                   # ABI kontrak
├── src/                       # Kode sumber
│   ├── bot.js                 # Kelas ArbitrageBot utama
│   ├── services/              # Layanan
│   ├── arbitrage/             # Logika arbitrage
│   └── utils/                 # Utilitas
└── data/                      # Data dan log
```

## Instalasi

1. Clone repositori
```bash
git clone https://github.com/yourusername/flash-triangular-arbitrage.git
cd flash-triangular-arbitrage
```

2. Install dependencies
```bash
npm install
```

3. Buat file `.env` dan isi dengan konfigurasi yang diperlukan
```
# Konfigurasi jaringan
BSC_RPC_URL=https://bsc-dataseed.binance.org/

# Konfigurasi akun
PRIVATE_KEY=your_private_key_here

# Konfigurasi kontrak
FLASH_ARBITRAGE_ADDRESS=your_flash_arbitrage_contract_address

# Konfigurasi gas
GAS_PRICE_GWEI=5
GAS_LIMIT=3000000

# Konfigurasi arbitrage
MIN_PROFIT_PERCENTAGE=1
MAX_GAS_PRICE_GWEI=10

# Mode eksekusi (true/false)
EXECUTION_ENABLED=false
```

## Penggunaan

### Mode Monitoring (Hanya Simulasi)
Pastikan `EXECUTION_ENABLED=false` di file `.env` untuk menjalankan bot dalam mode simulasi tanpa melakukan transaksi nyata.

```bash
npm start
```

### Mode Eksekusi
Untuk menjalankan bot dengan eksekusi arbitrage nyata, ubah `EXECUTION_ENABLED=true` di file `.env`.

```bash
npm start
```

## Konfigurasi Pair Token

Pair token dan konfigurasi arbitrage diatur di file `config/pairs.js`. Struktur dasar untuk setiap pair adalah:

```javascript
{
    name: 'WBNB-USDT-BUSD',  // Nama untuk pair ini
    tokens: {
        WBNB: TOKEN_ADDRESSES.WBNB,  // Alamat token A
        USDT: TOKEN_ADDRESSES.USDT,  // Alamat token B
        BUSD: TOKEN_ADDRESSES.BUSD   // Alamat token C
    },
    pancakeswapPairs: {
        'WBNB-USDT': '0x...',  // Alamat pair PancakeSwap untuk A-B
        'USDT-BUSD': '0x...',  // Alamat pair PancakeSwap untuk B-C
        'BUSD-WBNB': '0x...'   // Alamat pair PancakeSwap untuk C-A
    },
    biswapPairs: {
        'WBNB-USDT': '0x...',  // Alamat pair BiSwap untuk A-B
        'USDT-BUSD': '0x...',  // Alamat pair BiSwap untuk B-C
        'BUSD-WBNB': '0x...'   // Alamat pair BiSwap untuk C-A
    },
    priority: 1,  // Prioritas (1=tinggi, 2=sedang, 3=rendah)
    testAmounts: [1000, 5000, 10000]  // Jumlah untuk tes arbitrage
}
```

## Keamanan

- Jangan pernah berbagi atau mengekspos private key Anda
- Jalankan bot dalam mode monitoring (`EXECUTION_ENABLED=false`) terlebih dahulu sebelum mengaktifkan mode eksekusi
- Pastikan kontrak FlashTriangularArbitrage Anda telah diuji dengan baik sebelum digunakan dengan jumlah dana yang besar
- Perhatikan biaya gas dan parameter keuntungan minimum untuk menghindari kerugian

## Kontribusi

Kontribusi selalu disambut! Jika Anda ingin berkontribusi, silakan fork repositori ini, buat perubahan, dan kirimkan pull request.

## Lisensi

Proyek ini dilisensikan dengan [MIT License](LICENSE).

## Disclaimer

Penggunaan bot ini berisiko. Penulis tidak bertanggung jawab atas kerugian dana yang mungkin timbul dari penggunaan bot ini. Crypto trading dan DeFi selalu berisiko tinggi, gunakan bot ini dengan risiko Anda sendiri.