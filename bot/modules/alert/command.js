const { handleAlertOn, handleAlertOff, handleAlertStatus, handleDiagnose } = require('./handler');

module.exports = {
    name: 'alert',
    commands: [
        {
            name: 'alert on',
            aliases: [],
            description: 'Aktifkan alert monitoring',
            usage: 'alert on',
            module: 'alert',
            permission: 'admin',
            handler: handleAlertOn,
        },
        {
            name: 'alert off',
            aliases: [],
            description: 'Nonaktifkan alert monitoring',
            usage: 'alert off',
            module: 'alert',
            permission: 'admin',
            handler: handleAlertOff,
        },
        {
            name: 'alert status',
            aliases: ['alert'],
            description: 'Lihat status alert',
            usage: 'alert status',
            module: 'alert',
            permission: 'admin',
            handler: handleAlertStatus,
        },
        {
            name: 'diagnose',
            aliases: ['diag'],
            description: 'Diagnosa mengapa service mati menggunakan AI',
            usage: 'diagnose <service>',
            module: 'alert',
            permission: 'admin',
            handler: handleDiagnose,
        },
    ],
};
