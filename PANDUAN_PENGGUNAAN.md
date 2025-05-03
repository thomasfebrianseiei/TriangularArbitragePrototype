# Panduan Penggunaan Bot Flash Triangular Arbitrage

Dokumen ini memberikan panduan langkah demi langkah tentang cara menggunakan Bot Flash Triangular Arbitrage.

## 1. Persiapan Awal

### 1.1 Persyaratan
- Node.js versi 14 atau lebih baru
- Akun BSC dengan saldo BNB untuk gas
- Alamat kontrak FlashTriangularArbitrage yang sudah di-deploy
- Private key wallet (pastikan wallet khusus untuk bot ini saja)

### 1.2 Menyiapkan Lingkungan

1. Clone atau download source code bot
2. Buat file `.env` dan isi dengan parameter yang diperlukan:

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

3. Install dependencies:
```bash
npm install
```

## 2. Konfigurasi Bot

### 2.1 Parameter dalam file .env

- `BSC_RPC_URL`: URL node RPC BSC. Gunakan node yang stabil dan cepat.
- `PRIVATE_KEY`: Private key wallet Anda. Pastikan wallet ini memiliki cukup BNB untuk gas.
- `FLASH_ARBITRAGE_ADDRESS`: Alamat kontrak FlashTriangularArbitrage yang sudah di-deploy.
- `GAS_PRICE_GWEI`: Harga gas default dalam Gwei.
- `GAS_LIMIT`: Limit gas untuk transaksi arbitrage.
- `MIN_PROFIT_PERCENTAGE`: Persentase keuntungan minimum agar arbitrage dieksekusi.
- `MAX_GAS_PRICE_GWEI`: Harga gas maksimum dimana bot akan tetap berjalan.
- `EXECUTION_ENABLED`: Set `true` untuk mode eksekusi nyata, `false` untuk mode monitoring saja.

### 2.2 Konfigurasi Pair

Pair token dikonfigurasi di `config/pairs.js`. Bot mendukung banyak kombinasi token untuk arbitrase. Anda dapat:

1. Menggunakan pair yang sudah disediakan
2. Memodifikasi pair yang ada
3. Menambahkan pair baru

Setiap pair memiliki struktur sebagai berikut:

```javascript
{
    name: 'NAMA-PAIR',
    tokens: {
        TOKEN1: 'ALAMAT_TOKEN1',
        TOKEN2: 'ALAMAT_TOKEN2',
        TOKEN3: 'ALAMAT_TOKEN3'
    },
    pancakeswapPairs: {
        'TOKEN1-TOKEN2': 'ALAMAT_PAIR_PANCAKESWAP_T1_T2',
        'TOKEN2-TOKEN3': 'ALAMAT_PAIR_PANCAKESWAP_T2_T3',
        'TOKEN3-TOKEN1': 'ALAMAT_PAIR_PANCAKESWAP_T3_T1'
    },
    biswapPairs: {
        'TOKEN1-TOKEN2': 'ALAMAT_PAIR_BISWAP_T1_T2',
        'TOKEN2-TOKEN3': 'ALAMAT_PAIR_BISWAP_T2_T3',
        'TOKEN3-TOKEN1': 'ALAMAT_PAIR_BISWAP_T3_T1'
    },
    priority: PRIORITAS_1_2_atau_3,  // 1=tinggi, 2=sedang, 3=rendah
    testAmounts: [JUMLAH1, JUMLAH2, JUMLAH3]  // Jumlah yang diuji
}
```

## 3. Menjalankan Bot

### 3.1 Mode Monitoring (Simulasi)

Untuk menjalankan bot dalam mode monitoring tanpa melakukan transaksi nyata:

1. Pastikan `EXECUTION_ENABLED=false` dalam file `.env`
2. Jalankan bot:
```bash
node index.js
```

Dalam mode ini, bot akan:
- Mencari peluang arbitrage di semua pair yang dikonfigurasi
- Menghitung keuntungan potensial
- Mencatat semua peluang yang ditemukan di log
- TIDAK melakukan transaksi nyata

Mode ini berguna untuk:
- Memvalidasi konfigurasi bot
- Memahami pola arbitrage yang mungkin
- Menyesuaikan parameter seperti `MIN_PROFIT_PERCENTAGE`

### 3.2 Mode Eksekusi (Transaksi Nyata)

Untuk menjalankan bot dengan eksekusi transaksi nyata:

1. Ubah `EXECUTION_ENABLED=true` dalam file `.env`
2. Pastikan wallet memiliki cukup BNB untuk biaya gas
3. Jalankan bot:
```bash
node index.js
```

Dalam mode ini, bot akan:
- Mencari peluang arbitrage
- Mengeksekusi transaksi untuk peluang yang menguntungkan
- Mencatat hasil eksekusi dan performa

**Tips:**
- Mulai dengan nilai `MIN_PROFIT_PERCENTAGE` yang tinggi (misalnya 2% atau 3%)
- Mulai dengan jumlah dana kecil hingga Anda yakin bot berfungsi dengan baik
- Pantau performa dan sesuaikan parameter sesuai kebutuhan

## 4. Memahami Output dan Log

### 4.1 File Log

Bot menyimpan log di folder `data/logs`:
- `arbitrage_YYYY-MM-DD.log`: Log umum dengan semua aktivitas bot
- `error_YYYY-MM-DD.log`: Log khusus untuk error

### 4.2 Data Performa dan Riwayat

Bot menyimpan data performa dan riwayat eksekusi di folder `data/history`:
- `arbitrage_history.json`: Riwayat semua eksekusi arbitrage
- `performance_stats.json`: Statistik performa bot

### 4.3 Memahami Output Terminal

Bot akan menampilkan pesan di terminal, termasuk:
- Inisialisasi komponen
- Koneksi ke jaringan
- Pemeriksaan pair token
- Peluang arbitrage yang ditemukan
- Eksekusi transaksi (jika dalam mode eksekusi)
- Error dan warning

Contoh output:
```
[2023-05-01T12:00:00.000Z] Starting arbitrage bot...
[2023-05-01T12:00:01.123Z] Connected to BSC at block 12345678
[2023-05-01T12:00:02.456Z] Wallet balance: 0.5 BNB
[2023-05-01T12:00:05.789Z] Checking WBNB-USDT-BUSD opportunities...
[2023-05-01T12:00:10.123Z] Found profitable arbitrage opportunity! Profit: $2.50 (1.2%)
```

## 5. Kustomisasi dan Optimasi

### 5.1 Penyesuaian Frekuensi Pemeriksaan

Frekuensi pemeriksaan diatur di `src/bot.js` menggunakan cron schedules:
- High priority pairs: `*/5 * * * *` (setiap 5 menit)
- Low priority pairs: `*/15 * * * *` (setiap 15 menit)

### 5.2 Penyesuaian Threshold Profit

- Sesuaikan `MIN_PROFIT_PERCENTAGE` di `.env` berdasarkan keadaan market
- Nilai lebih tinggi = lebih sedikit eksekusi tetapi keuntungan per transaksi lebih besar
- Nilai lebih rendah = lebih banyak eksekusi tetapi keuntungan per transaksi lebih kecil

### 5.3 Menambahkan Pair Baru

Untuk menambahkan pair baru:
1. Tambahkan alamat token di `config/constants.js` jika belum ada
2. Tambahkan konfigurasi pair di `config/pairs.js` mengikuti format yang ada
3. Restart bot untuk menerapkan perubahan

### 5.4 Optimasi Gas

Bot menggunakan mekanisme gas price dinamis, tetapi Anda dapat:
1. Menyesuaikan `GAS_PRICE_GWEI` untuk nilai default
2. Menyesuaikan `MAX_GAS_PRICE_GWEI` untuk batas maksimum
3. Optimasi `GAS_LIMIT` berdasarkan pengalaman eksekusi

## 6. Troubleshooting

### 6.1 Masalah Koneksi

Jika bot mengalami masalah koneksi ke BSC:
- Coba gunakan RPC URL alternatif di `.env`
- Pastikan URL RPC tidak membatasi permintaan Anda

### 6.2 Transaksi Gagal

Jika transaksi arbitrage gagal:
- Periksa `error_YYYY-MM-DD.log` untuk detail error
- Periksa jika kontrak FlashTriangularArbitrage berfungsi dengan benar
- Pastikan pair yang digunakan diotorisasi di kontrak

### 6.3 Tidak Menemukan Peluang

Jika bot tidak menemukan peluang:
- Pastikan pair dikonfigurasi dengan benar
- Coba turunkan `MIN_PROFIT_PERCENTAGE`
- Verifikasi alamat pair dan token

### 6.4 Masalah Performa

Jika bot menggunakan terlalu banyak CPU/memori:
- Kurangi jumlah pair yang dipantau
- Kurangi frekuensi pemeriksaan dengan mengubah jadwal cron

## 7. Pemeliharaan Bot

### 7.1 Update Regular

- Periksa versi token dan pair secara berkala
- Update alamat kontrak jika terjadi perubahan di DEX

### 7.2 Backup Data

- Backup file `data/history` secara berkala untuk menyimpan riwayat dan statistik

### 7.3 Monitoring Jangka Panjang

- Pantau performa bot secara berkala
- Sesuaikan parameter berdasarkan tren market

## 8. Tips Keamanan

- Jangan pernah membagikan private key Anda
- Gunakan wallet terpisah khusus untuk bot ini
- Mulai dengan jumlah kecil hingga Anda yakin bot berfungsi dengan baik
- Selalu jalankan dalam mode monitor terlebih dahulu sebelum mode eksekusi

## 9. FAQ

**Q: Apakah bot ini bekerja untuk chain selain BSC?**
A: Bot ini dirancang khusus untuk BSC. Untuk chain lain perlu modifikasi pada kode.

**Q: Berapa keuntungan yang bisa diharapkan?**
A: Sangat bervariasi tergantung kondisi market, volatilitas, dan pair token yang digunakan.

**Q: Apakah bot ini aman dari front-running?**
A: Bot menggunakan flash loan untuk melakukan arbitrage dalam satu transaksi atomik, yang mengurangi risiko front-running.

**Q: Berapa biaya gas yang biasanya dibutuhkan?**
A: Biaya gas untuk flash loan arbitrage bisa cukup tinggi karena kompleksitas kontrak, biasanya sekitar 500,000-1,000,000 gas.

**Q: Dapatkah saya menjalankan bot di cloud?**
A: Ya, bot dapat dijalankan di server cloud menggunakan PM2 atau layanan serupa.