const http = require('http');
const config = require('../config.json');
const cache = require('./cache-service');

let runtimeModel = null;

function getActiveModel() {
    return runtimeModel || config.ollama?.model || 'qwen2.5:1.5b';
}

function setActiveModel(model) {
    runtimeModel = model;
    console.log(`[AI] Model diubah ke: ${model}`);
}

function ollamaRequest(path, method, body) {
    const ollamaConfig = config.ollama || {};
    const host = ollamaConfig.host || 'localhost';
    const port = ollamaConfig.port || 11434;

    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : '';

        const options = {
            hostname: host,
            port: port,
            path: path,
            method: method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            },
            timeout: 120000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Ollama response parse error: ${e.message}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Ollama request timeout (120s)'));
        });
        req.on('error', (err) => {
            reject(new Error(`Ollama tidak aktif: ${err.message}. Jalankan: sudo systemctl start ollama`));
        });
        if (payload) req.write(payload);
        req.end();
    });
}

async function ollamaGenerate(prompt, model) {
    const modelName = model || getActiveModel();

    const result = await ollamaRequest('/api/generate', 'POST', {
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
            temperature: 0.7,
            num_predict: 1024
        }
    });

    return result.response || '';
}

async function checkOllamaAvailable() {
    try {
        await ollamaRequest('/api/tags', 'GET');
        return true;
    } catch {
        return false;
    }
}

async function listModels() {
    try {
        const result = await ollamaRequest('/api/tags', 'GET');
        return (result.models || []).map(m => ({
            name: m.name,
            size: m.size,
            modified: m.modified_at,
            active: m.name === getActiveModel()
        }));
    } catch (err) {
        console.error('[AI] List models error:', err.message);
        return [];
    }
}

async function generate(prompt, model) {
    const available = await checkOllamaAvailable();
    if (!available) {
        throw new Error('Ollama tidak aktif. Jalankan: sudo systemctl start ollama');
    }
    return await ollamaGenerate(prompt, model);
}

function getPersona() {
    const model = getActiveModel();
    return `Kamu adalah Asisten AI bernama "Wabot AI" yang berjalan di server lokal menggunakan model ${model} melalui Ollama.

Kemampuanmu:
1. Menjawab pertanyaan APAPUN seperti ChatGPT - soal teknologi, kehidupan, coding, sains, bahasa, dll.
2. Ngobrol santai, bercanda, dan menjawab sapaan.
3. Jika ditanya soal server/DevOps, kamu juga bisa membantu analisis dan troubleshooting.
4. Jika ditanya soal dirimu, jelaskan bahwa kamu adalah Wabot AI, model ${model} yang berjalan lokal di server via Ollama, tanpa koneksi cloud.

Aturan:
- Gunakan Bahasa Indonesia santai tapi sopan.
- Jawab ringkas dan natural, maksimal 300 kata.
- Jangan kaku, jawab seperti teman yang pintar.`;
}

function getDevOpsPersona() {
    const model = getActiveModel();
    return `Kamu adalah Asisten AI "Wabot AI" (model: ${model}, lokal via Ollama) yang ahli DevOps dan Server Administration.

Aturan:
- Jawab langsung, natural, Bahasa Indonesia santai tapi profesional.
- Berikan solusi langsung pada intinya.
- Jawaban ringkas dan to the point, maksimal 300 kata.
- Berikan actionable steps yang bisa langsung dijalankan.`;
}

async function analyzeSystem(userPrompt, contextData) {
    const contextStr = JSON.stringify(contextData, null, 2);

    const prompt = `${getDevOpsPersona()}

Data Server saat ini:
${contextStr}

Pertanyaan: "${userPrompt}"

Berikan analisa singkat dan actionable steps!`;

    try {
        const cacheKey = cache.generateKey('ai:devops', userPrompt);

        return await cache.dedupedRequest(cacheKey, async () => {
            return await generate(prompt);
        }, cache.TTL.aiDevops);
    } catch (err) {
        console.error('[AI] Analyze Error:', err.message);
        return `❌ AI Error: ${err.message}`;
    }
}

async function chatWithAI(userPrompt) {
    const prompt = `${getPersona()}

Pesan dari pengguna: "${userPrompt}"

Jawab dengan natural:`;

    try {
        const cacheKey = cache.generateKey('ai:chat', userPrompt);

        return await cache.dedupedRequest(cacheKey, async () => {
            return await generate(prompt);
        }, cache.TTL.aiChat);
    } catch (err) {
        console.error('[AI] Chat Error:', err.message);
        return `❌ AI Error: ${err.message}`;
    }
}

async function parseIntent(text) {
    const prompt = `Kamu adalah parser intent. Petakan input user ke command bot server.

Command yang tersedia:
- "status": Cek status server (cpu, ram, uptime)
- "services": Status semua service
- "restart <service>": Restart service
- "start <service>": Start service
- "stop <service>": Stop service
- "logs <service>": Cek log
- "kill <pid>": Kill proses
- "df": Cek disk
- "free": Cek memory
- "top": Cek proses berat
- "analyze <target>": Analisa mendalam (cpu/ram/disk/network)
- "why <issue>": Cari penyebab masalah server
- "fix <issue>": Rekomendasi solusi masalah server
- "chat <pesan>": Untuk SEMUA hal lain: sapaan, obrolan, pertanyaan umum, pertanyaan tentang AI, dll.

PENTING: Jika input BUKAN tentang server/service/monitoring, SELALU gunakan "chat"!

Input: "${text}"

Output HANYA JSON, tanpa teks lain:
{"command":"nama","args":["arg1"]}

Contoh:
"cek server" -> {"command":"status","args":[]}
"halo" -> {"command":"chat","args":["halo"]}
"kamu pakai model apa" -> {"command":"chat","args":["kamu pakai model apa"]}
"kenapa apache mati" -> {"command":"why","args":["apache mati"]}
"apa itu docker" -> {"command":"chat","args":["apa itu docker"]}`;

    try {
        const cacheKey = cache.generateKey('ai:intent', text);
        const cachedIntent = await cache.getCache(cacheKey);
        if (cachedIntent) {
            try {
                return JSON.parse(cachedIntent);
            } catch (e) {
            }
        }

        const rawResponse = await generate(prompt);
        const cleaned = rawResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();

        const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.command) {
            await cache.setCache(cacheKey, JSON.stringify(parsed), cache.TTL.aiIntent);
            return parsed;
        }
        return null;
    } catch (err) {
        console.error('[AI] Intent Parse Error:', err.message);
        return null;
    }
}

async function getAIStatus() {
    const ollamaOk = await checkOllamaAvailable();
    const models = ollamaOk ? await listModels() : [];

    return {
        provider: 'ollama (local)',
        activeModel: getActiveModel(),
        ollama: {
            available: ollamaOk,
            host: `${config.ollama?.host || 'localhost'}:${config.ollama?.port || 11434}`,
            models: models
        }
    };
}

async function invalidateAICache() {
    const chatDeleted = await cache.deletePattern('ai:chat:*');
    const devopsDeleted = await cache.deletePattern('ai:devops:*');
    const intentDeleted = await cache.deletePattern('ai:intent:*');
    return chatDeleted + devopsDeleted + intentDeleted;
}

module.exports = {
    generate,
    analyzeSystem,
    chatWithAI,
    parseIntent,
    getAIStatus,
    getActiveModel,
    setActiveModel,
    listModels,
    checkOllamaAvailable,
    invalidateAICache
};
