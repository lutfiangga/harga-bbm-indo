const { scrapePertamina } = require('./pertamina');
const { scrapeShell } = require('./shell');
const { scrapeBP } = require('./bp');
const { scrapeVivo } = require('./vivo');
const { scrapeMobil } = require('./mobil');

module.exports = {
    scrapePertamina,
    scrapeShell,
    scrapeBP,
    scrapeVivo,
    scrapeMobil
};
