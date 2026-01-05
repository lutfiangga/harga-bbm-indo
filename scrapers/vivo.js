/**
 * Scrapes Vivo fuel prices
 * Since Vivo doesn't have a price table on their website,
 * we use a static fallback that should be updated manually or via a smarter crawler later.
 * 
 * Current known prices (Jan 2026 est):
 * Revvo 90: Rp 11.900 (Est)
 * Revvo 92: Rp 12.700 (Match Pertamax/Shell Super)
 * Revvo 95: Rp 13.500 (Est)
 */
async function scrapeVivo() {
    // In a real scenario, we might scrape their Instagram or a news site.
    // For now, we return valid static data to ensure the app works.

    const prices = [
        {
            province: 'DKI Jakarta',
            products: {
                'Revvo 90': 12090,
                'Revvo 92': 12700,
                'Revvo 95': 13500
            }
        },
        {
            province: 'Banten',
            products: {
                'Revvo 90': 12090,
                'Revvo 92': 12700,
                'Revvo 95': 13500
            }
        },
        {
            province: 'Jawa Barat',
            products: {
                'Revvo 90': 12090,
                'Revvo 92': 12700,
                'Revvo 95': 13500
            }
        }
    ];

    return prices.map(p => ({
        provider: 'vivo',
        province: p.province,
        products: p.products,
        note: 'Harga estimasi (Static Data)'
    }));
}

module.exports = { scrapeVivo };
