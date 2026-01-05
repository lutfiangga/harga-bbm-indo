const puppeteer = require('puppeteer');

/**
 * Scrapes BP fuel prices from bp.com
 * @returns {Promise<Array>} Array of price objects
 */
async function scrapeBP() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto('https://www.bp.com/id_id/indonesia/home/produk-dan-layanan/spbu/harga.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for content
        await page.waitForSelector('table, [class*="table"], [class*="price"]', { timeout: 30000 }).catch(() => { });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const prices = await page.evaluate(() => {
            const results = [];

            // Region mapping: BP regions to provinces
            const regionMap = {
                'JABODETABEK': ['DKI Jakarta', 'Banten', 'Jawa Barat'],
                'JAWA TIMUR': ['Jawa Timur'],
                'JATIM': ['Jawa Timur'],
                'JAKARTA': ['DKI Jakarta'],
                'BANTEN': ['Banten'],
                'JAWA BARAT': ['Jawa Barat'],
                'JABAR': ['Jawa Barat']
            };

            // Known BP fuel types
            const bpProducts = ['BP 92', 'BP Ultimate', 'BP Ultimate Diesel'];

            // Find tables
            const tables = document.querySelectorAll('table');

            tables.forEach(table => {
                // Get headers to identify region columns
                const headers = [];
                const headerCells = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
                headerCells.forEach(th => {
                    headers.push(th.textContent?.trim()?.toUpperCase() || '');
                });

                const rows = table.querySelectorAll('tbody tr, tr');

                rows.forEach((row, rowIdx) => {
                    if (rowIdx === 0 && headerCells.length > 0) return; // Skip header row

                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const fuelType = cells[0]?.textContent?.trim() || '';

                        // Skip if this looks like a header
                        if (fuelType.toLowerCase().includes('jenis') ||
                            fuelType.toLowerCase().includes('produk') ||
                            fuelType.toLowerCase().includes('harga')) {
                            return;
                        }

                        // Get price for each region column
                        for (let i = 1; i < cells.length; i++) {
                            const priceText = cells[i]?.textContent?.trim() || '';
                            const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;

                            if (price && price > 1000) {
                                const regionName = headers[i] || `Region ${i}`;
                                const provinces = regionMap[regionName] || [regionName];

                                provinces.forEach(province => {
                                    results.push({
                                        fuelType: fuelType,
                                        province: province,
                                        price: price
                                    });
                                });
                            }
                        }
                    }
                });
            });

            // Also check for non-table layouts
            const priceContainers = document.querySelectorAll('[class*="price"], [class*="fuel"], [class*="product"]');
            priceContainers.forEach(container => {
                const text = container.textContent || '';

                bpProducts.forEach(product => {
                    if (text.toLowerCase().includes(product.toLowerCase().replace('bp ', ''))) {
                        const priceMatch = text.match(/Rp[\s.]*(\d+[.,]?\d*)/i);
                        if (priceMatch) {
                            const price = parseInt(priceMatch[1].replace(/[.,]/g, '')) || null;
                            if (price && price > 1000) {
                                // Try to find region context
                                const regionMatch = text.match(/(JABODETABEK|JAWA TIMUR|JATIM|JAKARTA)/i);
                                const region = regionMatch ? regionMatch[1].toUpperCase() : 'JABODETABEK';
                                const provinces = regionMap[region] || ['DKI Jakarta'];

                                provinces.forEach(province => {
                                    results.push({
                                        fuelType: product,
                                        province: province,
                                        price: price
                                    });
                                });
                            }
                        }
                    }
                });
            });

            return results;
        });

        await browser.close();

        // Group by province
        const grouped = {};
        prices.forEach(item => {
            if (!grouped[item.province]) {
                grouped[item.province] = {
                    provider: 'bp',
                    province: item.province,
                    products: {}
                };
            }
            grouped[item.province].products[item.fuelType] = item.price;
        });

        const result = Object.values(grouped);

        if (result.length === 0) {
            return [{
                provider: 'bp',
                province: 'Data tidak tersedia',
                products: {},
                note: 'Silakan cek website BP langsung'
            }];
        }

        return result;

    } catch (error) {
        if (browser) await browser.close();
        console.error('BP scraper error:', error.message);

        return [{
            provider: 'bp',
            province: 'Data tidak tersedia',
            products: {},
            error: error.message
        }];
    }
}

module.exports = { scrapeBP };
