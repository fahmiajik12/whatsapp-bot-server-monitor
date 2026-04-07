const patterns = [
    { regex: /^(?:cek|check|lihat)\s+(?:status|server|cpu|ram|disk|memory)/i, command: 'status', args: [] },
    { regex: /^(?:status)\s*(server)?$/i, command: 'status', args: [] },
    { regex: /^(?:cek|check|lihat)\s+(?:service|servis|layanan)/i, command: 'services', args: [] },
    { regex: /^restart\s+(\w[\w.-]*)/i, command: 'restart', args: ['$1'] },
    { regex: /^start\s+(\w[\w.-]*)/i, command: 'start', args: ['$1'] },
    { regex: /^stop\s+(\w[\w.-]*)/i, command: 'stop', args: ['$1'] },
    { regex: /^(?:nyalakan|jalankan|aktifkan)\s+(\w[\w.-]*)/i, command: 'start', args: ['$1'] },
    { regex: /^(?:matikan|hentikan|nonaktifkan)\s+(\w[\w.-]*)/i, command: 'stop', args: ['$1'] },
    { regex: /^(?:restart|mulai ulang)\s+(\w[\w.-]*)/i, command: 'restart', args: ['$1'] },
    { regex: /^(?:lihat|cek|baca|tampilkan)\s+log\s+(\w[\w.-]*)/i, command: 'logs', args: ['$1'] },
    { regex: /^log\s+(\w[\w.-]*)/i, command: 'logs', args: ['$1'] },
    { regex: /^kill\s+(?:process\s+)?(\d+)/i, command: 'kill', args: ['$1'] },
    { regex: /^(?:bunuh|matikan)\s+(?:proses|process)\s+(\d+)/i, command: 'kill', args: ['$1'] },
    { regex: /^(?:cek|lihat)\s+(?:disk|storage)/i, command: 'df', args: [] },
    { regex: /^(?:cek|lihat)\s+(?:memo?ri|ram)/i, command: 'free', args: [] },
    { regex: /^(?:cek|lihat)\s+(?:uptime)/i, command: 'uptime', args: [] },
    { regex: /^(?:cek|lihat)\s+(?:port)/i, command: 'ports', args: [] },
    { regex: /^(?:cek|lihat)\s+(?:ip|alamat)/i, command: 'ip', args: [] },
    { regex: /^(?:siapa|who)\s+(?:online|login)/i, command: 'who', args: [] },
    { regex: /^(?:top|proses\s+terberat)/i, command: 'top', args: [] },
    { regex: /^(?:aktifkan|enable)\s+alert/i, command: 'alert on', args: [] },
    { regex: /^(?:nonaktifkan|matikan|disable)\s+alert/i, command: 'alert off', args: [] },
    { regex: /^(?:menu|bantuan|help|tolong)/i, command: 'menu', args: [] },
];

function parseNaturalLanguage(input) {
    const text = input.trim();

    for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match) {
            const args = pattern.args.map(arg => {
                if (arg.startsWith('$')) {
                    const idx = parseInt(arg.substring(1));
                    return match[idx] || '';
                }
                return arg;
            }).filter(a => a !== '');

            return { command: pattern.command, args };
        }
    }

    return null;
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[m][n];
}

function findSimilarCommands(input, commands, maxDistance = 3) {
    const suggestions = [];
    const seen = new Set();

    for (const [name, entry] of commands) {
        if (name !== entry.name) continue;
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);

        const dist = levenshtein(input.toLowerCase(), entry.name.toLowerCase());
        if (dist <= maxDistance && dist > 0) {
            suggestions.push({
                name: entry.name,
                description: entry.description || '',
                usage: entry.usage || entry.name,
                distance: dist,
            });
        }

        if (entry.aliases) {
            for (const alias of entry.aliases) {
                const aliasDist = levenshtein(input.toLowerCase(), alias.toLowerCase());
                if (aliasDist <= maxDistance && aliasDist > 0 && !seen.has(entry.name + '_alias')) {
                    if (aliasDist < dist) {
                        const existing = suggestions.find(s => s.name === entry.name);
                        if (existing) {
                            existing.distance = aliasDist;
                        } else {
                            suggestions.push({
                                name: entry.name,
                                description: entry.description || '',
                                usage: entry.usage || entry.name,
                                distance: aliasDist,
                            });
                        }
                    }
                }
            }
        }
    }

    return suggestions.sort((a, b) => a.distance - b.distance).slice(0, 3);
}

function formatSuggestions(input, suggestions) {
    if (suggestions.length === 0) {
        return `❓ Command */${input}* tidak ditemukan.\n\nKetik */help* untuk daftar command\natau */menu* untuk menu interaktif.`;
    }

    let text = `❓ Command */${input}* tidak ditemukan.\n\n`;
    text += '💡 *Mungkin maksud Anda:*\n';

    for (const s of suggestions) {
        text += `- /${s.usage}`;
        if (s.description) text += ` — ${s.description}`;
        text += '\n';
    }

    text += '\nKetik */help* untuk daftar lengkap.';
    return text;
}

module.exports = {
    parseNaturalLanguage,
    levenshtein,
    findSimilarCommands,
    formatSuggestions,
};
