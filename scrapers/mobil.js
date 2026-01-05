/**
 * Scrapes Mobil Indostation (Exxon) fuel prices
 * Uses static fallback as official site doesn't list prices clearly.
 * 
 * Products: Gasoline 92
 */
async function scrapeMobil() {
    // Static data based on market rates (matching Shell Super / Pertamax for 92)
    const prices = [
        {
            province: 'DKI Jakarta',
            products: {
                'Gasoline 92': 12700
            }
        },
        {
            province: 'Banten',
            products: {
                'Gasoline 92': 12700
            }
        },
        {
            province: 'Jawa Barat',
            products: {
                'Gasoline 92': 12700
            }
        },
        {
            province: 'Jawa Timur',
            products: {
                'Gasoline 92': 12700
            }
        }
    ];

    return prices.map(p => ({
        provider: 'mobil',
        province: p.province,
        products: p.products,
        note: 'Harga estimasi (Static Data)'
    }));
}

module.exports = { scrapeMobil };
