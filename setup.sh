#!/bin/bash

echo "========================================"
echo "  WABOT - Server Monitor Bot Setup"
echo "========================================"
echo ""

check_command() {
    if command -v "$1" &> /dev/null; then
        echo "[OK] $1 terdeteksi: $($1 --version 2>/dev/null | head -1)"
        return 0
    else
        echo "[!!] $1 tidak ditemukan"
        return 1
    fi
}

echo "[1/6] Cek prerequisites..."
echo ""
check_command node
NODE_OK=$?
check_command npm
NPM_OK=$?
check_command go
GO_OK=$?
echo ""

if [ $NODE_OK -ne 0 ]; then
    echo "[!!] Node.js 18+ diperlukan. Install: https://nodejs.org/"
    exit 1
fi

if [ $GO_OK -ne 0 ]; then
    echo "[!!] Go 1.21+ diperlukan. Install: https://go.dev/dl/"
    exit 1
fi

echo "[2/6] Setup konfigurasi..."
echo ""

if [ ! -f "bot/config.json" ]; then
    cp bot/config.example.json bot/config.json
    echo "[OK] bot/config.json dibuat dari template"
    echo ""
    echo "  >> PENTING: Edit bot/config.json dan isi:"
    echo "     - apiKey: ganti dengan key yang aman"
    echo "     - adminNumbers: isi nomor WhatsApp admin (format 628xxx)"
    echo ""
else
    echo "[OK] bot/config.json sudah ada"
fi

if [ ! -f "backend/config.json" ]; then
    cp backend/config.example.json backend/config.json
    echo "[OK] backend/config.json dibuat dari template"
    echo ""
    echo "  >> PENTING: Edit backend/config.json dan isi:"
    echo "     - apiKey: harus sama dengan bot/config.json"
    echo "     - allowedServices: kosongkan [] untuk auto-detect"
    echo ""
else
    echo "[OK] backend/config.json sudah ada"
fi

echo "[3/6] Install Node.js dependencies..."
echo ""
cd bot && npm install && cd ..
echo ""

echo "[4/6] Build Go backend..."
echo ""
cd backend && go mod tidy && go build -o wabot-backend ./cmd && cd ..
echo ""

if [ -f "backend/wabot-backend" ]; then
    echo "[OK] Build berhasil: backend/wabot-backend"
else
    echo "[!!] Build gagal"
    exit 1
fi

echo "[5/6] Buat folder yang diperlukan..."
mkdir -p bot/logs
mkdir -p bot/auth_info
echo "[OK] Folder logs dan auth_info dibuat"
echo ""

echo "[6/6] Verifikasi..."
echo ""
node --check bot/index.js 2>/dev/null && echo "[OK] Node.js syntax OK" || echo "[!!] Node.js syntax error"
echo ""

echo "========================================"
echo "  Setup selesai!"
echo "========================================"
echo ""
echo "Langkah selanjutnya:"
echo ""
echo "  1. Edit konfigurasi:"
echo "     - bot/config.json    (API key + nomor admin)"
echo "     - backend/config.json (API key harus sama)"
echo ""
echo "  2. Start Go backend:"
echo "     cd backend && sudo ./wabot-backend"
echo ""
echo "  3. Start bot (terminal lain):"
echo "     cd bot && npm start"
echo ""
echo "  4. Scan QR code yang muncul dengan WhatsApp"
echo ""
echo "  Atau gunakan PM2 + systemd (lihat README.md)"
echo ""
