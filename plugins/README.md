# Plugins Directory

Letakkan plugin di sini. Setiap plugin berupa folder dengan struktur:

```
my-plugin/
├── plugin.json          # Manifest plugin (opsional)
├── bot/
│   ├── command.js       # Definisi command
│   └── handler.js       # Implementasi handler
```

## Plugin Privat

Buat folder `private/` di bawah ini untuk plugin yang tidak ingin di-push ke GitHub.
Folder `private/` sudah di-ignore oleh `.gitignore`.

```
plugins/
├── my-public-plugin/
└── private/
    └── my-secret-plugin/
```

## Contoh plugin.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Deskripsi plugin",
  "author": "Nama Anda",
  "private": false,
  "bot": {
    "entrypoint": "bot/command.js"
  }
}
```

## Mengaktifkan/Menonaktifkan Plugin

Di `bot/config.json`:

```json
{
  "plugins": {
    "my-plugin": true,
    "disabled-plugin": false
  }
}
```
