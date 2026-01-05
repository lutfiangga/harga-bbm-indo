const puppeteer = require('puppeteer');

/**
 * Scrapes Shell fuel prices from shell.co.id using Puppeteer.
 * URL: https://www.shell.co.id/in_id/pengendara-bermotor/bahan-bakar-shell/harga-bahan-bakar-shell.html
 * 
 * Target Table Structure (User provided):
 * Header: Jenis BBM | Lokasi | Harga per Liter
 * Row: Shell Super | Jakarta, Banten... | Rp12,700
 */
async function scrapeShell() {
    let browser;
    try {
        console.log('Shell: Launching Puppeteer...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            // 'new' headless mode is recommended
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Shell: Navigating to page...');
        const response = await page.goto('https://www.shell.co.id/in_id/pengendara-bermotor/bahan-bakar-shell/harga-bahan-bakar-shell.html', {
            waitUntil: 'domcontentloaded', // Faster than networkidle2
            timeout: 60000
        });

        if (response.status() !== 200) {
            console.error(`Shell: Failed to load page, status: ${response.status()}`);
        }

        // Wait for table headers to ensure content is loaded
        try {
            await page.waitForFunction(() => {
                const body = document.body.innerText;
                return body.includes('Jenis BBM') && body.includes('Harga per Liter');
            }, { timeout: 15000 });
        } catch (e) {
            console.log('Shell: Specific text not found immediately, proceeding to extract...');
        }

        // Extract Data
        const result = await page.evaluate(() => {
            const data = [];
            // Strategy: Find all rows in all tables
            const rows = document.querySelectorAll('tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    // Normalize text: remove &nbsp; and trim
                    const fuelType = cells[0].textContent.replace(/\u00a0/g, ' ').trim();
                    const locationStr = cells[1].textContent.replace(/\u00a0/g, ' ').trim();
                    const priceStr = cells[2].textContent.replace(/\u00a0/g, ' ').trim();

                    // Validation
                    if (!fuelType || !locationStr || !priceStr) return;
                    if (fuelType.includes('Jenis BBM')) return; // Header row

                    // Parse Price: "Rp12,700" -> 12700
                    const priceClean = priceStr.replace(/[^0-9]/g, '');
                    const price = parseInt(priceClean);

                    if (isNaN(price) || price < 1000) return;

                    // Parse Locations: "Jakarta, Banten, Jawa Barat, Jawa Timur"
                    // Split by comma or other delimiters just in case
                    const locations = locationStr.split(/,|\//).map(l => l.trim()).filter(l => l.length > 0);

                    locations.forEach(loc => {
                        data.push({
                            province: loc,
                            fuelType: fuelType,
                            price: price
                        });
                    });
                }
            });
            return data;
        });

        await browser.close();

        if (!result || result.length === 0) {
            console.log('Shell: No data extracted from HTML table.');
            // Fallback to static if scraping fails? 
            // Better to return error/empty so we know it failed, OR return fallback with note.
            // Let's return fallback for robustness as requested by user ("patokan")
            return getFallbackData();
        }

        return groupData(result);

    } catch (error) {
        if (browser) await browser.close();
        console.error('Shell scraper error:', error.message);
        return getFallbackData(error.message);
    }
}

function getFallbackData(errorMsg = '') {
    console.log('Shell: Using fallback data.');
    const prices = [
        { fuel: 'Shell Super', price: 12700 }, // Jan 2026 data per user snippet
        { fuel: 'Shell V-Power', price: 13190 },
        { fuel: 'Shell V-Power Diesel', price: 13860 },
        { fuel: 'Shell V-Power Nitro+', price: 13480 }
    ];
    const regions = ['DKI Jakarta', 'Banten', 'Jawa Barat']; // Main regions

    // Expand for Java Timur for some products if needed, but keep simple
    const data = [];
    regions.forEach(reg => {
        prices.forEach(p => {
            data.push({
                province: reg,
                fuelType: p.fuel,
                price: p.price,
                isFallback: true
            });
        });
    });

    return groupData(data);
}

function groupData(flatList) {
    const grouped = {};
    flatList.forEach(item => {
        let provinceName = item.province;
        // Normalize
        if (provinceName.toLowerCase().includes('jakarta')) provinceName = 'DKI Jakarta';
        if (provinceName.toLowerCase().includes('sumut') || provinceName.toLowerCase().includes('sumatera utara')) provinceName = 'Sumatera Utara';

        if (!grouped[provinceName]) {
            grouped[provinceName] = {
                provider: 'shell',
                province: provinceName,
                products: {}
            };
        }
        grouped[provinceName].products[item.fuelType] = item.price;
    });
    return Object.values(grouped);
}

module.exports = { scrapeShell };
