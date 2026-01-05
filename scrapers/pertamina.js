const puppeteer = require('puppeteer');

/**
 * Scrapes Pertamina fuel prices from mypertamina.id
 * @returns {Promise<Array>} Array of price objects
 */
async function scrapePertamina() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto('https://mypertamina.id/about/product-price', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page to fully render
    await page.waitForSelector('table, [class*="grid"], [class*="table"]', { timeout: 30000 }).catch(() => { });

    // Give extra time for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract prices from the page
    const prices = await page.evaluate(() => {
      const results = [];
      const fuelTypes = ['Pertalite', 'Pertamax', 'Pertamax Green', 'Pertamax Turbo', 'Pertamina Dex', 'Dexlite', 'Solar'];

      // Try to find table rows
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const firstCell = cells[0]?.textContent?.trim() || '';

            // Check if first cell looks like a province name
            if (firstCell && !fuelTypes.some(f => firstCell.toLowerCase().includes(f.toLowerCase()))) {
              const priceData = {
                province: firstCell,
                products: {}
              };

              // Extract prices from remaining cells
              for (let i = 1; i < cells.length && i <= fuelTypes.length; i++) {
                const priceText = cells[i]?.textContent?.trim() || '';
                const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;
                if (price && price > 1000) {
                  priceData.products[fuelTypes[i - 1]] = price;
                }
              }

              if (Object.keys(priceData.products).length > 0) {
                results.push(priceData);
              }
            }
          }
        });
      });

      // Alternative: Try grid-based layout
      if (results.length === 0) {
        const gridItems = document.querySelectorAll('[class*="grid"] > div, [class*="row"]');
        let currentProvince = null;

        gridItems.forEach(item => {
          const text = item.textContent?.trim() || '';
          const priceMatch = text.match(/Rp[\s.]*(\d+[.,]\d+|\d+)/gi);

          if (priceMatch) {
            // This might be a price row
            const provinceEl = item.querySelector('[class*="province"], [class*="wilayah"], h3, h4, strong');
            if (provinceEl) {
              currentProvince = provinceEl.textContent?.trim();
            }

            if (currentProvince) {
              const priceData = { province: currentProvince, products: {} };

              priceMatch.forEach((p, idx) => {
                const price = parseInt(p.replace(/[^0-9]/g, '')) || null;
                if (price && price > 1000 && idx < fuelTypes.length) {
                  priceData.products[fuelTypes[idx]] = price;
                }
              });

              if (Object.keys(priceData.products).length > 0) {
                results.push(priceData);
              }
            }
          }
        });
      }

      return results;
    });

    await browser.close();

    // Return normalized data
    return prices.map(item => ({
      provider: 'pertamina',
      province: item.province,
      products: item.products
    }));

  } catch (error) {
    if (browser) await browser.close();
    console.error('Pertamina scraper error:', error.message);

    // Return fallback data structure
    return [{
      provider: 'pertamina',
      province: 'Data tidak tersedia',
      products: {},
      error: error.message
    }];
  }
}

module.exports = { scrapePertamina };
