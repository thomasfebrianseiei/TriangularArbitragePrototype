const fs = require('fs');
const path = require('path');
const { LOG_DIR } = require('../../config/constants');

class Logger {
    constructor(options = {}) {
        this.options = {
            logToConsole: options.logToConsole !== false,
            logToFile: options.logToFile !== false,
            logDir: options.logDir || LOG_DIR,
            prefix: options.prefix || '',
            ...options
        };

        // Pastikan direktori log ada
        if (this.options.logToFile && !fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }

        // Inisialisasi file log
        this.setupLogFiles();
    }

    setupLogFiles() {
        if (!this.options.logToFile) return;

        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.options.logDir, `${this.options.prefix}${today}.log`);
        const errorLogFile = path.join(this.options.logDir, `${this.options.prefix}error_${today}.log`);

        // Tutup stream sebelumnya jika ada
        if (this.logStream) this.logStream.end();
        if (this.errorLogStream) this.errorLogStream.end();

        // Buat stream log baru
        this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
        this.errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });
    }

    // Metode untuk rotasi log (biasanya dipanggil setiap hari)
    rotateLogFiles() {
        this.setupLogFiles();
        this.log('Log files rotated');
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        if (this.options.logToConsole) {
            console.log(formattedMessage);
        }
        
        if (this.options.logToFile && this.logStream) {
            this.logStream.write(formattedMessage + '\n');
        }
    }

    error(message, error) {
        const timestamp = new Date().toISOString();
        const stackTrace = error && error.stack ? `\n${error.stack}` : '';
        const formattedMessage = `[${timestamp}] ERROR: ${message}${stackTrace}`;
        
        if (this.options.logToConsole) {
            console.error(formattedMessage);
        }
        
        if (this.options.logToFile) {
            if (this.logStream) {
                this.logStream.write(formattedMessage + '\n');
            }
            
            if (this.errorLogStream) {
                this.errorLogStream.write(formattedMessage + '\n');
            }
        }
    }

    warn(message) {
        this.log(`WARNING: ${message}`);
    }

    info(message) {
        this.log(`INFO: ${message}`);
    }

    success(message) {
        this.log(`SUCCESS: ${message}`);
    }

    // Metode untuk mengakhiri stream sebelum aplikasi berhenti
    close() {
        if (this.logStream) {
            this.logStream.end();
        }
        
        if (this.errorLogStream) {
            this.errorLogStream.end();
        }
    }
}

module.exports = Logger;