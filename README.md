# WhatsApp Bot Server Monitor

[![GitHub](https://img.shields.io/badge/GitHub-whatsapp--bot--server--monitor-blue)](https://github.com/fahmiajik12/whatsapp-bot-server-monitor)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8)](https://go.dev)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

WhatsApp Bot untuk monitoring dan kontrol server Linux menggunakan Baileys (Node.js) + Go Backend. Mendukung auto-detect GPU, services, dan plugin architecture.

## Arsitektur

```
+----------------+     REST API      +----------------+     System     +----------------+
|   WhatsApp     | ----------------> |  Go Backend    | ------------>  |    Linux        |
|   (Baileys)    | <---------------- |  (REST API)    | <------------  |    Server       |
+----------------+                   +----------------+                +----------------+
       |                                                                      |
       v                                                                      |
  +---------+                  Alert Monitoring                               |
  |  Grup   | <--- Scheduler (60s) --- Cek CPU/Disk/Apache -------------------+
  |  Alert  |
  +---------+
```

## Fitur

- **Monitoring** - CPU, RAM, Swap, GPU/VRAM (auto-detect), Disk, Uptime
- **Service** - Start, Stop, Restart service (auto-detect dari sistem)
- **Apache** - Status, Restart, Reload, ConfigTest, VHost
- **Tools** - PM2, Docker, df, free, top, ports, ip, uptime, who
- **Process** - Kill proses by PID
- **Logs** - Service journal, Apache error log
- **Auth** - Whitelist nomor, role-based (superadmin/admin/user)
- **Alert** - Auto-alert ke grup WhatsApp (CPU/Disk/Apache)
- **GPU** - Auto-detect AMD, NVIDIA, Intel (integrated & dedicated)
- **Plugin** - Modular architecture, mudah tambah modul baru

## Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/fahmiajik12/whatsapp-bot-server-monitor.git
cd whatsapp-bot-server-monitor
chmod +x setup.sh
./setup.sh
```

### 2. Konfigurasi

Salin template config:
```bash
cp bot/config.example.json bot/config.json
cp backend/config.example.json backend/config.json
```

Edit `bot/config.json`:
```json
{
  "backendUrl": "http://localhost:8080",
  "apiKey": "your-secret-api-key",
  "adminNumbers": {
    "628xxxxxxxxxx": "superadmin",
    "628xxxxxxxxxx": "admin"
  }
}
```

Edit `backend/config.json`:
```json
{
  "port": ":8080",
  "apiKey": "your-secret-api-key",
  "allowedServices": [],
  "logTailLines": 50
}
```

> **Catatan:**
> - `apiKey` harus **sama** di kedua file
> - `allowedServices` kosong `[]` = auto-detect dari sistem
> - `adminNumbers` format: `628xxxxxxxxxx` (kode negara tanpa + atau 0)

### 3. Build

```bash
cd backend
go build -o wabot-backend ./cmd
```

### 4. Jalankan

**Manual (development):**

```bash
# Terminal 1 - Backend
cd backend && sudo ./wabot-backend

# Terminal 2 - Bot
cd bot && node index.js
```

**PM2 (production):**

```bash
pm2 start ecosystem.config.js
pm2 save
```

### 5. Scan QR Code

Scan QR code yang muncul di terminal dengan WhatsApp:
1. Buka WhatsApp di HP
2. Menu > Linked Devices > Link a Device
3. Scan QR code

## Deployment (Production)

### Rekomendasi: PM2

```bash
# Start semua (backend + bot)
pm2 start ecosystem.config.js

# Simpan agar auto-start saat reboot
pm2 save

# Manajemen
pm2 status
pm2 logs wabot-bot
pm2 logs wabot-backend
pm2 restart wabot-bot
pm2 restart wabot-backend
```

### Alternatif: systemd (Backend) + PM2 (Bot)

```bash
# Edit path di wabot-backend.service sesuai lokasi install
sudo cp wabot-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wabot-backend
sudo systemctl start wabot-backend

# Bot tetap via PM2
cd bot
pm2 start ecosystem.config.js
pm2 save
```

## Daftar Command

### Monitoring

| Command | Permission | Deskripsi |
|---------|------------|-----------|
| /status | user | CPU, RAM, Swap, GPU/VRAM, Disk, Uptime |
| /services | user | Status semua service |

### Service Management

| Command | Permission | Deskripsi |
|---------|------------|-----------|
| /service \<nama\> | admin | Status satu service |
| /start \<nama\> | admin | Start service |
| /stop \<nama\> | admin | Stop service |
| /restart \<nama\> | admin | Restart service |

### Apache

| Command | Permission | Deskripsi |
|---------|------------|-----------|
| /web status | admin | Status Apache |
| /web restart | admin | Restart Apache |
| /web reload | admin | Reload config |
| /web configtest | admin | Test konfigurasi |
| /web vhost | admin | Daftar virtual host |

### Tools

| Command | Permission | Deskripsi |
|---------|------------|-----------|
| /pm2 | admin | PM2 process list |
| /docker | admin | Docker containers aktif |
| /docker images | admin | Docker images |
| /docker stats | admin | Docker resource usage |
| /df | user | Disk usage |
| /free | user | Memory usage |
| /uptime | user | Server uptime & load |
| /who | admin | User yang login |
| /top | admin | Top proses (by CPU) |
| /ports | admin | Port yang terbuka |
| /ip | admin | IP address server |
| /tools | user | Daftar semua tools |

### Lainnya

| Command | Permission | Deskripsi |
|---------|------------|-----------|
| /kill \<pid\> | admin | Kill proses |
| /logs \<service\> [n] | admin | Log service (n baris) |
| /weblogs [n] | admin | Apache error log |
| /adduser \<nomor\> [role] | superadmin | Tambah user |
| /removeuser \<nomor\> | superadmin | Hapus user |
| /listusers | superadmin | Daftar user |
| /alert on | admin | Aktifkan alert |
| /alert off | admin | Nonaktifkan alert |
| /alert status | admin | Status alert |
| /help | user | Daftar command |

## Auto-Detection

### Services
Jika `allowedServices` kosong di config, backend akan:
1. Scan semua service yang sedang berjalan via `systemctl`
2. Filter system/internal services (dbus, systemd-*, polkit, dll)
3. Menghasilkan whitelist otomatis

### GPU
Backend otomatis mendeteksi GPU via:
1. `lspci` untuk nama GPU (AMD, NVIDIA, Intel)
2. `/sys/class/drm/card*/device/` untuk VRAM dan usage
3. Jika tidak ada GPU, section GPU tidak ditampilkan

## Alert System

Bot otomatis membuat grup WhatsApp saat pertama kali konek dan mengirim alert jika:

| Kondisi | Default Threshold |
|---------|-------------------|
| CPU Usage | > 80% |
| Disk Usage | > 90% |
| Apache | Down |

Konfigurasi threshold di `bot/config.json`:
```json
{
  "alert": {
    "enabled": true,
    "intervalSeconds": 60,
    "cooldownSeconds": 300,
    "thresholds": { "cpu": 80, "disk": 90 }
  }
}
```

## Struktur Proyek

```
whatsapp-bot-server-monitor/
+-- ecosystem.config.js         # PM2 config (backend + bot)
+-- setup.sh                    # Setup script
+-- wabot-backend.service       # systemd service (opsional)
+-- README.md
+-- backend/                    # Go REST API
|   +-- cmd/main.go
|   +-- config/config.go
|   +-- config.example.json
|   +-- internal/
|       +-- server/server.go
|       +-- middleware/         # Auth, Logger
|       +-- executor/           # Safe command execution
|       +-- model/              # Response models
|       +-- modules/
|           +-- monitoring/     # CPU, RAM, Swap, GPU, Disk
|           +-- service/        # Service management
|           +-- apache/         # Apache control
|           +-- process/        # Process management
|           +-- logs/           # Log viewer
|           +-- tools/          # PM2, Docker, dll
+-- bot/                        # Node.js WhatsApp Bot
    +-- index.js
    +-- config.example.json
    +-- ecosystem.config.js
    +-- core/
    |   +-- client.js           # WhatsApp connection
    |   +-- router.js           # Message routing
    |   +-- dispatcher.js       # Command dispatch
    |   +-- module-loader.js    # Plugin loader
    +-- modules/
        +-- monitoring/         # /status, /services
        +-- service/            # /start, /stop, /restart
        +-- apache/             # /web status, /web restart
        +-- tools/              # /pm2, /docker, /df, /free
        +-- process/            # /kill
        +-- logs/               # /logs, /weblogs
        +-- auth/               # /adduser, /removeuser
        +-- alert/              # /alert, scheduler
```

## Cara Membuat Modul Baru

1. Buat folder `bot/modules/<nama-modul>/`

2. Buat `command.js`:
```javascript
const { handleMyCommand } = require('./handler');

module.exports = {
    name: 'nama-modul',
    commands: [{
        name: 'mycommand',
        aliases: ['mc'],
        description: 'Deskripsi',
        usage: 'mycommand <arg>',
        module: 'nama-modul',
        permission: 'user',
        handler: handleMyCommand,
    }],
};
```

3. Buat `handler.js`:
```javascript
async function handleMyCommand(ctx) {
    const { sock, jid, args } = ctx;
    await sock.sendMessage(jid, { text: 'Response' });
}
module.exports = { handleMyCommand };
```

4. Enable di `bot/config.json`:
```json
{ "modules": { "nama-modul": true } }
```

Restart bot, modul otomatis ter-load.

## Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| WABOT_PORT | :8080 | Port backend |
| WABOT_API_KEY | (auto-generate) | API key |
| CONFIG_PATH | config.json | Path config file |

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | /health | Health check (tanpa auth) |
| GET | /api/monitoring/status | CPU, RAM, Swap, GPU, Disk, Uptime |
| GET | /api/monitoring/services | Status semua service |
| GET | /api/service/{name} | Status service |
| POST | /api/service/{name}/start | Start service |
| POST | /api/service/{name}/stop | Stop service |
| POST | /api/service/{name}/restart | Restart service |
| GET | /api/apache/status | Status Apache |
| POST | /api/apache/restart | Restart Apache |
| POST | /api/apache/reload | Reload config |
| GET | /api/apache/configtest | Test config |
| GET | /api/apache/vhost | Daftar vhost |
| POST | /api/process/kill/{pid} | Kill proses |
| GET | /api/logs/{service}?lines=N | Log service |
| GET | /api/logs/apache?lines=N | Apache error log |
| GET | /api/tools/list | Daftar tools |
| GET | /api/tools/exec/{name} | Jalankan tool |

## Keamanan

- Whitelist nomor telepon
- Role-based access control (superadmin > admin > user)
- Service whitelist (auto-detect atau manual)
- Tidak ada shell execution (exec.Command langsung)
- Timeout pada semua command (10 detik)
- API key authentication (header X-API-Key)
- Input validation di semua endpoint
- Session WhatsApp tersimpan lokal (auth_info/)

## Requirements

- Node.js 18+
- Go 1.21+
- Linux (Ubuntu/Debian recommended)
- systemd
- PM2 (recommended untuk production)

## License

Lihat file [LICENSE](LICENSE) untuk detail.


