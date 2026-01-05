const express = require('express');
const NodeCache = require('node-cache');
const axios = require('axios');
const path = require('path');
const {
    scrapePertamina,
    scrapeShell,
    scrapeBP,
    scrapeVivo,
    scrapeMobil
} = require('./scrapers'); // Import from index aggregator

const app = express();
const PORT = process.env.PORT || 3000;

// Cache for 1 hour (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Emsifa API base URL
const EMSIFA_API = 'https://emsifa.github.io/api-wilayah-indonesia/api';

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON
app.use(express.json());

// =====================
// WILAYAH API (Emsifa)
// =====================

// Get list of provinces from Emsifa API
app.get('/api/provinces', async (req, res) => {
    try {
        const cached = cache.get('provinces');
        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const response = await axios.get(`${EMSIFA_API}/provinces.json`);
        const provinces = response.data.map(p => ({
            id: p.id,
            name: p.name
        }));

        cache.set('provinces', provinces, 86400); // Cache for 24 hours
        res.json({ success: true, data: provinces });
    } catch (error) {
        console.error('Error fetching provinces:', error.message);
        res.status(500).json({ success: false, error: 'Gagal mengambil data provinsi' });
    }
});

// Get regencies by province ID
app.get('/api/regencies/:provinceId', async (req, res) => {
    try {
        const { provinceId } = req.params;
        const cacheKey = `regencies_${provinceId}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const response = await axios.get(`${EMSIFA_API}/regencies/${provinceId}.json`);
        const regencies = response.data.map(r => ({
            id: r.id,
            name: r.name
        }));

        cache.set(cacheKey, regencies, 86400);
        res.json({ success: true, data: regencies });
    } catch (error) {
        console.error('Error fetching regencies:', error.message);
        res.status(500).json({ success: false, error: 'Gagal mengambil data kabupaten/kota' });
    }
});

// Get districts by regency ID
app.get('/api/districts/:regencyId', async (req, res) => {
    try {
        const { regencyId } = req.params;
        const cacheKey = `districts_${regencyId}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            return res.json({ success: true, data: cached });
        }

        const response = await axios.get(`${EMSIFA_API}/districts/${regencyId}.json`);
        cache.set(cacheKey, response.data, 86400);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error fetching districts:', error.message);
        res.status(500).json({ success: false, error: 'Gagal mengambil data kecamatan' });
    }
});

// =====================
// FUEL PRICES API
// =====================

// Normalize province name for matching
function normalizeProvinceName(name) {
    return name
        .toUpperCase()
        .replace(/PROV\.?\s*/gi, '')
        .replace(/PROVINSI\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Match scraped province to emsifa province
async function matchProvince(rawProvince) {
    try {
        let provinces = cache.get('provinces');
        if (!provinces) {
            const response = await axios.get(`${EMSIFA_API}/provinces.json`);
            provinces = response.data;
            cache.set('provinces', provinces, 86400);
        }

        const normalized = normalizeProvinceName(rawProvince);

        for (const prov of provinces) {
            const provNormalized = normalizeProvinceName(prov.name);

            if (provNormalized === normalized) {
                return { id: prov.id, name: prov.name };
            }

            // Fuzzy match
            if (normalized.includes(provNormalized) || provNormalized.includes(normalized)) {
                return { id: prov.id, name: prov.name };
            }

            // Handle special cases
            if (normalized.includes('JAKARTA') && provNormalized.includes('JAKARTA')) {
                return { id: prov.id, name: prov.name };
            }
            if (normalized.includes('YOGYAKARTA') && provNormalized.includes('YOGYAKARTA')) {
                return { id: prov.id, name: prov.name };
            }
        }

        return { id: null, name: rawProvince };
    } catch (error) {
        return { id: null, name: rawProvince };
    }
}

// Fetch all prices from all providers
async function fetchAllPrices() {
    const cached = cache.get('allPrices');
    if (cached) {
        return cached;
    }

    const results = {
        lastUpdated: new Date().toISOString(),
        providers: {}
    };

    console.log('Fetching prices from all providers (Pertamina, Shell, BP, Vivo, Mobil)...');

    // Fetch from all providers in parallel
    const [pertaminaData, shellData, bpData, vivoData, mobilData] = await Promise.allSettled([
        scrapePertamina(),
        scrapeShell(),
        scrapeBP(),
        scrapeVivo(),
        scrapeMobil()
    ]);

    // Helper to process provider data
    const processProvider = async (providerData, providerName) => {
        if (providerData.status === 'fulfilled' && Array.isArray(providerData.value)) {
            const processed = await Promise.all(
                providerData.value.map(async item => ({
                    ...item,
                    provinceInfo: await matchProvince(item.province)
                }))
            );
            results.providers[providerName] = processed;
        } else {
            results.providers[providerName] = {
                error: providerData.reason?.message || 'Gagal mengambil data',
                data: []
            };
        }
    };

    await processProvider(pertaminaData, 'pertamina');
    await processProvider(shellData, 'shell');
    await processProvider(bpData, 'bp');
    await processProvider(vivoData, 'vivo');
    await processProvider(mobilData, 'mobil');

    cache.set('allPrices', results);
    console.log('Prices fetched and cached successfully');
    return results;
}

// Get all fuel prices
app.get('/api/prices', async (req, res) => {
    try {
        const { province, provinceId, provider } = req.query;

        let data = await fetchAllPrices();

        // Filter by provider
        if (provider) {
            const providerLower = provider.toLowerCase();
            if (data.providers[providerLower]) {
                data = {
                    lastUpdated: data.lastUpdated,
                    providers: {
                        [providerLower]: data.providers[providerLower]
                    }
                };
            } else {
                return res.status(404).json({
                    success: false,
                    error: `Provider '${provider}' tidak ditemukan. Tersedia: pertamina, shell, bp`
                });
            }
        }

        // Filter by province name or ID
        if (province || provinceId) {
            const filteredProviders = {};

            for (const [provName, provData] of Object.entries(data.providers)) {
                if (Array.isArray(provData)) {
                    const filtered = provData.filter(item => {
                        if (provinceId) {
                            return item.provinceInfo?.id === provinceId;
                        }
                        if (province) {
                            const searchTerm = province.toUpperCase();
                            return (item.province?.toUpperCase().includes(searchTerm) ||
                                item.provinceInfo?.name?.toUpperCase().includes(searchTerm));
                        }
                        return true;
                    });

                    filteredProviders[provName] = filtered;
                } else {
                    filteredProviders[provName] = provData;
                }
            }

            data = {
                lastUpdated: data.lastUpdated,
                providers: filteredProviders
            };
        }

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get prices by provider
app.get('/api/prices/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        const data = await fetchAllPrices();

        const providerLower = provider.toLowerCase();
        if (data.providers[providerLower]) {
            res.json({
                success: true,
                lastUpdated: data.lastUpdated,
                data: data.providers[providerLower]
            });
        } else {
            res.status(404).json({
                success: false,
                error: `Provider '${provider}' tidak ditemukan`
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Force refresh cache
app.post('/api/refresh', async (req, res) => {
    try {
        cache.del('allPrices');
        const data = await fetchAllPrices();

        res.json({
            success: true,
            message: 'Cache berhasil diperbarui',
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        cacheStats: cache.getStats(),
        timestamp: new Date().toISOString()
    });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 BBM Indonesia Price API running on http://localhost:${PORT}`);
    console.log(`
📋 Available endpoints:
   
   🌐 WEB VIEW
   GET  /                           - HTML view
   
   🗺️  WILAYAH API (Emsifa)
   GET  /api/provinces              - Daftar provinsi
   GET  /api/regencies/:provinceId  - Daftar kabupaten/kota
   GET  /api/districts/:regencyId   - Daftar kecamatan
   
   ⛽ HARGA BBM API
   GET  /api/prices                 - Semua harga BBM
   GET  /api/prices?province=jakarta    - Filter by nama provinsi
   GET  /api/prices?provinceId=31       - Filter by ID provinsi
   GET  /api/prices?provider=pertamina  - Filter by provider
   GET  /api/prices/:provider           - Harga per provider
   
   🔧 UTILITIES
   POST /api/refresh                - Refresh cache
   GET  /api/health                 - Health check
`);
});
