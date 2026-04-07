const { handleAnalyze, handleWhy, handleFix, handleChat, handleAIModel, handleCacheStats } = require('./handler');

module.exports = {
    name: 'ai',
    commands: [
        {
            name: 'analyze',
            aliases: ['analisa', 'cek', 'tinjau'],
            description: 'AI akan menganalisa server/target (contoh: /analyze cpu)',
            usage: 'analyze <target>',
            module: 'ai',
            permission: 'admin',
            handler: handleAnalyze,
        },
        {
            name: 'why',
            aliases: ['kenapa', 'mengapa'],
            description: 'Tanya AI penyebab masalah (contoh: /why apache down)',
            usage: 'why <issue>',
            module: 'ai',
            permission: 'admin',
            handler: handleWhy,
        },
        {
            name: 'fix',
            aliases: ['cara', 'perbaiki'],
            description: 'Tanya AI langkah perbaikan (contoh: /fix ram penuh)',
            usage: 'fix <issue>',
            module: 'ai',
            permission: 'admin',
            handler: handleFix,
        },
        {
            name: 'chat',
            aliases: ['tanya', 'ngobrol', 'ai'],
            description: 'Ngobrol dengan AI (contoh: /chat halo)',
            usage: 'chat <pesan>',
            module: 'ai',
            permission: 'user',
            handler: handleChat,
        },
        {
            name: 'aimodel',
            aliases: ['model', 'aimodels'],
            description: 'Kelola model AI Ollama (list/use/pull/rm)',
            usage: 'aimodel [list|use|pull|rm] [nama]',
            module: 'ai',
            permission: 'superadmin',
            handler: handleAIModel,
        },
        {
            name: 'cache',
            aliases: ['redis'],
            description: 'Lihat statistik cache Redis atau hapus cache (/cache clear)',
            usage: 'cache [clear]',
            module: 'ai',
            permission: 'admin',
            handler: handleCacheStats,
        }
    ]
};
