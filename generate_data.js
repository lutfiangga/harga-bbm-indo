const fs = require('fs');
const path = require('path');
const { scrapePertamina, scrapeShell, scrapeBP, scrapeVivo, scrapeMobil } = require('./scrapers');

// Simplified province matching for static generation
const PROVINCES = [
    { id: '11', name: 'ACEH' },
    { id: '12', name: 'SUMATERA UTARA' },
    { id: '13', name: 'SUMATERA BARAT' },
    { id: '14', name: 'RIAU' },
    { id: '15', name: 'JAMBI' },
    { id: '16', name: 'SUMATERA SELATAN' },
    { id: '17', name: 'BENGKULU' },
    { id: '18', name: 'LAMPUNG' },
    { id: '19', name: 'KEPULAUAN BANGKA BELITUNG' },
    { id: '21', name: 'KEPULAUAN RIAU' },
    { id: '31', name: 'DKI JAKARTA' },
    { id: '32', name: 'JAWA BARAT' },
    { id: '33', name: 'JAWA TENGAH' },
    { id: '34', name: 'DI YOGYAKARTA' },
    { id: '35', name: 'JAWA TIMUR' },
    { id: '36', name: 'BANTEN' },
    { id: '51', name: 'BALI' },
    { id: '52', name: 'NUSA TENGGARA BARAT' },
    { id: '53', name: 'NUSA TENGGARA TIMUR' },
    { id: '61', name: 'KALIMANTAN BARAT' },
    { id: '62', name: 'KALIMANTAN TENGAH' },
    { id: '63', name: 'KALIMANTAN SELATAN' },
    { id: '64', name: 'KALIMANTAN TIMUR' },
    { id: '65', name: 'KALIMANTAN UTARA' },
    { id: '71', name: 'SULAWESI UTARA' },
    { id: '72', name: 'SULAWESI TENGAH' },
    { id: '73', name: 'SULAWESI SELATAN' },
    { id: '74', name: 'SULAWESI TENGGARA' },
    { id: '75', name: 'GORONTALO' },
    { id: '76', name: 'SULAWESI BARAT' },
    { id: '81', name: 'MALUKU' },
    { id: '82', name: 'MALUKU UTARA' },
    { id: '91', name: 'PAPUA BARAT' },
    { id: '94', name: 'PAPUA' }
];

function normalizeProvinceName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/\b(dki|di|daerah|istimewa|khusus|kepulauan|kep|provinsi|prov)\b/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

async function matchProvince(rawProvince) {
    const normalized = normalizeProvinceName(rawProvince);
    for (const prov of PROVINCES) {
        if (normalizeProvinceName(prov.name) === normalized) return prov;
        if (normalized.includes(normalizeProvinceName(prov.name)) || normalizeProvinceName(prov.name).includes(normalized)) return prov;
    }
    return { id: null, name: rawProvince };
}

async function scrapeAndSave() {
    console.log('Starting static scrape...');
    const results = {
        success: true,
        data: {
            lastUpdated: new Date().toISOString(),
            providers: {}
        }
    };

    const runScraper = async (scraper, name) => {
        try {
            console.log(`Scraping ${name}...`);
            const data = await scraper();
            if (Array.isArray(data)) {
                return await Promise.all(data.map(async item => ({
                    ...item,
                    provinceInfo: await matchProvince(item.province)
                })));
            }
            return [];
        } catch (e) {
            console.error(`Error ${name}:`, e.message);
            return [];
        }
    };

    const [pertamina, shell, bp, vivo, mobil] = await Promise.all([
        runScraper(scrapePertamina, 'pertamina'),
        runScraper(scrapeShell, 'shell'),
        runScraper(scrapeBP, 'bp'),
        runScraper(scrapeVivo, 'vivo'),
        runScraper(scrapeMobil, 'mobil')
    ]);

    results.data.providers = { pertamina, shell, bp, vivo, mobil };

    // Create API folder structure
    const publicDir = path.join(__dirname, 'public');
    const apiDir = path.join(publicDir, 'api');

    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
    if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);

    // Save as api/prices.json (accessible as /api/prices.json)
    // To support /api/prices (no extension) on GitHub Pages, we can output a file named 'prices' without extension
    // But then Content-Type is issue. Best practice for static APIs is .json.
    // I will stick to prices.json and update app.js to fetch that.

    const outputPath = path.join(apiDir, 'prices.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Saved data to ${outputPath}`);
}

scrapeAndSave();
