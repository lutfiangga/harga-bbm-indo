// ================================
// State & Utils
// ================================
const state = {
    provinces: [],
    regencies: [],
    prices: null,
    filters: {
        provinceId: '',
        regencyId: '',
        provider: ''
    },
    loading: false
};

const dom = {
    province: document.getElementById('provinceSelect'),
    regency: document.getElementById('regencySelect'),
    provider: document.getElementById('providerSelect'),
    refreshBtn: document.getElementById('refreshBtn'),
    grid: document.getElementById('priceGrid'),
    loading: document.getElementById('contentLoading'),
    error: document.getElementById('errorMessage'),
    errorText: document.getElementById('errorText'),
    noData: document.getElementById('noDataResult'),
    stats: {
        pertamina: document.getElementById('pertaminaCount'),
        shell: document.getElementById('shellCount'),
        bp: document.getElementById('bpCount'),
        vivo: document.getElementById('vivoCount'),
        mobil: document.getElementById('mobilCount'),
        update: document.getElementById('lastUpdate')
    },
    chart: {
        ctx: document.getElementById('priceChart').getContext('2d'),
        label: document.getElementById('chartRegionLabel'),
        instance: null
    }
};

const formatCurrency = (val) => {
    if (!val) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
};

const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatProvince = (name) => {
    if (!name) return '';
    return name.toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

// ================================
// Chart Logic
// ================================

const fuelGrades = [
    { id: 'ron90', label: 'RON 90', keywords: ['pertalite', 'revvo 90'] },
    { id: 'ron92', label: 'RON 92', keywords: ['pertamax', 'shell super', 'bp 92', 'revvo 92', 'gasoline 92'] },
    { id: 'ron95', label: 'RON 95', keywords: ['pertamax green', 'shell v-power', 'bp ultimate', 'revvo 95'] }, // Note: V-Power is often 95
    { id: 'ron98', label: 'RON 98', keywords: ['pertamax turbo', 'nitro+', 'bp ultimate'] }, // BP Ultimate sometimes 95 or higher
    { id: 'diesel', label: 'Diesel', keywords: ['dex', 'solar', 'diesel'] }
];

const normalizeFuel = (name) => {
    const lower = name.toLowerCase();

    // Specific overrides
    if (lower.includes('turbo') || lower.includes('nitro')) return 'ron98';
    if (lower.includes('green') || lower.includes('v-power') && !lower.includes('diesel')) return 'ron95';
    if (lower.includes('ultimate')) return 'ron95';

    // General matching
    for (const g of fuelGrades) {
        if (g.keywords.some(k => lower.includes(k))) return g.id;
    }
    return 'other';
};

const updateChart = () => {
    if (!state.prices) return;

    // Determine context (Selected Province or Default to Jakarta/Avg)
    let targetProvince = "DKI Jakarta";
    // If filter is active, use that name (we need to find name from ID)
    if (state.filters.provinceId) {
        const p = state.provinces.find(prov => prov.id === state.filters.provinceId);
        if (p) targetProvince = formatProvince(p.name);
    }

    dom.chart.label.textContent = `Harga di ${targetProvince}`;

    // Collect data points
    // Structure: { 'ron90': { 'pertamina': 10000, 'vivo': 10200 }, ... }
    const dataset = {};
    const providers = ['pertamina', 'shell', 'bp', 'vivo', 'mobil'];

    fuelGrades.forEach(g => dataset[g.id] = {});

    providers.forEach(provKey => {
        const items = state.prices.providers[provKey] || [];
        // Find item for target province
        // Improve match: contains
        let item = items.find(i => {
            const pName = i.provinceInfo?.name || i.province || '';
            return pName.toLowerCase().includes(targetProvince.toLowerCase()) ||
                targetProvince.toLowerCase().includes(pName.toLowerCase());
        });

        // Fallback for Jakarta if specific not found (e.g. slight name mismatch) but usually normalized
        if (!item && targetProvince === 'DKI Jakarta') {
            item = items.find(i => (i.province || '').toLowerCase().includes('jakarta'));
        }

        if (item && item.products) {
            Object.entries(item.products).forEach(([pName, price]) => {
                const grade = normalizeFuel(pName);
                if (dataset[grade]) {
                    // Only take first match if multiple (e.g. Diesel types) - usually keep lowest or specific?
                    // Let's keep existing logic: overwrite works or check if exists.
                    // Ideally we separate Diesel Grades (CN 51 vs 53) but for simple chart keep "Diesel" high tier
                    if (!dataset[grade][provKey] || price > dataset[grade][provKey]) {
                        dataset[grade][provKey] = price;
                    }
                }
            });
        }
    });

    // Prepare Chart.js Data
    const labels = fuelGrades.map(g => g.label);
    const providerConfig = {
        pertamina: { color: '#DA291C', label: 'Pertamina' },
        shell: { color: '#FBCE07', label: 'Shell' },
        bp: { color: '#009036', label: 'BP' },
        vivo: { color: '#0055AA', label: 'Vivo' },
        mobil: { color: '#0C4C9B', label: 'Mobil' }
    };

    const chartDatasets = providers.map(provKey => {
        const data = fuelGrades.map(g => dataset[g.id][provKey] || null);
        return {
            label: providerConfig[provKey].label,
            data: data,
            backgroundColor: providerConfig[provKey].color,
            borderRadius: 4,
            barPercentage: 0.6,
        };
    });

    if (dom.chart.instance) dom.chart.instance.destroy();

    dom.chart.instance = new Chart(dom.chart.ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: chartDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += formatCurrency(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#f3f4f6' },
                    ticks: { callback: (val) => val / 1000 + 'rb' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
};

// ================================
// API Interactions
// ================================

const fetchProvinces = async () => {
    try {
        const res = await fetch('/api/provinces');
        const data = await res.json();
        if (data.success) {
            state.provinces = data.data;
            renderProvinceOptions();
        }
    } catch (e) {
        console.error("Failed to load provinces", e);
    }
};

const fetchRegencies = async (provId) => {
    try {
        // Disable during fetch
        dom.regency.disabled = true;
        dom.regency.innerHTML = '<option>Loading...</option>';

        const res = await fetch(`/api/regencies/${provId}`);
        const data = await res.json();

        if (data.success && data.data.length > 0) {
            state.regencies = data.data;
            renderRegencyOptions();
            dom.regency.disabled = false;
        } else {
            dom.regency.innerHTML = '<option value="">Tidak ada data kabupaten</option>';
        }
    } catch (e) {
        console.error("Failed to load regencies", e);
        dom.regency.innerHTML = '<option value="">Gagal memuat</option>';
    }
};

const fetchPrices = async () => {
    setLoading(true);
    try {
        const params = new URLSearchParams();
        if (state.filters.provinceId) params.append('provinceId', state.filters.provinceId);
        if (state.filters.provider) params.append('provider', state.filters.provider);

        const res = await fetch(`/api/prices?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
            state.prices = data.data;
            renderPrices();
            updateStats();
            updateChart(); // Update chart with new data/filters
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        showError(e.message || "Gagal mengambil data harga BBM terbaru.");
    } finally {
        setLoading(false);
    }
};

const refreshData = async () => {
    const btnContent = dom.refreshBtn.innerHTML;
    dom.refreshBtn.disabled = true;
    dom.refreshBtn.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Updating...</span>
    `;

    try {
        await fetch('/api/refresh', { method: 'POST' });
        await fetchPrices(); // Fetch fresh data
    } catch (e) {
        console.error("Refresh failed", e);
    } finally {
        dom.refreshBtn.innerHTML = btnContent;
        dom.refreshBtn.disabled = false;
    }
};

// ================================
// Rendering & Logic
// ================================

const setLoading = (isLoading) => {
    if (isLoading) {
        dom.loading.classList.remove('hidden');
        dom.loading.classList.add('flex');
        dom.grid.classList.add('hidden');
        dom.error.classList.add('hidden');
        dom.noData.classList.add('hidden');
    } else {
        dom.loading.classList.add('hidden');
        dom.loading.classList.remove('flex');
        dom.grid.classList.remove('hidden');
    }
};

const showError = (msg) => {
    dom.errorText.textContent = msg;
    dom.error.classList.remove('hidden');
    dom.error.classList.add('flex');
    dom.grid.classList.add('hidden');
};

const renderProvinceOptions = () => {
    dom.province.innerHTML = '<option value="">Semua Provinsi</option>';
    state.provinces.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = formatProvince(p.name);
        dom.province.appendChild(opt);
    });
};

const renderRegencyOptions = () => {
    dom.regency.innerHTML = '<option value="">Semua Kabupaten/Kota</option>';
    state.regencies.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = formatProvince(r.name);
        dom.regency.appendChild(opt);
    });
};

const renderPrices = () => {
    const container = dom.grid;
    container.innerHTML = '';

    if (!state.prices || !state.prices.providers) return;

    const { providers } = state.prices;
    let hasItems = false;

    const providerColors = {
        pertamina: { border: 'border-red-500', bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
        shell: { border: 'border-yellow-400', bg: 'bg-yellow-400', text: 'text-yellow-800', light: 'bg-yellow-50' },
        bp: { border: 'border-green-500', bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' },
        vivo: { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
        mobil: { border: 'border-indigo-600', bg: 'bg-indigo-600', text: 'text-indigo-800', light: 'bg-indigo-50' }
    };

    Object.keys(providers).forEach(key => {
        const items = providers[key];
        if (Array.isArray(items)) {
            items.forEach(item => {
                // Backend filtering handles provinceId match
                // Client side filtering for provider if needed, though API does it too

                if (!item.products || Object.keys(item.products).length === 0) return;

                hasItems = true;
                const pColor = providerColors[key] || providerColors['pertamina'];

                const card = document.createElement('div');
                card.className = `glass-card p-0 transition-transform hover:-translate-y-1 hover:shadow-xl duration-300 overflow-hidden`;

                let productsHtml = '';
                Object.entries(item.products).forEach(([fuel, price]) => {
                    productsHtml += `
                        <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-4 transition-colors">
                            <span class="text-sm font-medium text-gray-600">${fuel}</span>
                            <span class="text-sm font-bold bg-gray-100 px-2 py-1 rounded text-gray-800">${formatCurrency(price)}</span>
                        </div>
                    `;
                });

                const provName = item.provinceInfo?.name ? formatProvince(item.provinceInfo.name) : item.province;
                const note = item.isFallback || item.note ? '<span class="text-[10px] bg-gray-200 px-1 rounded ml-2 text-gray-500" title="Data Estimasi">Est</span>' : '';

                card.innerHTML = `
                    <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center ${pColor.light}">
                        <h3 class="font-bold text-gray-800 truncate" title="${provName}">${provName}</h3>
                        <div class="flex items-center gap-2">
                             ${note}
                             <span class="px-2 py-1 text-xs font-bold uppercase rounded text-white ${pColor.bg}">
                                ${key}
                            </span>
                        </div>
                    </div>
                    <div class="px-1 py-2">
                        ${productsHtml}
                    </div>
                `;

                container.appendChild(card);
            });
        }
    });

    if (!hasItems) {
        dom.noData.classList.remove('hidden');
        dom.noData.classList.add('flex');
    } else {
        dom.noData.classList.add('hidden');
        dom.noData.classList.remove('flex');
    }
};

const updateStats = () => {
    if (!state.prices) return;
    const { providers, lastUpdated } = state.prices;

    const count = (p) => (providers[p] || []).filter(x => x.products && Object.keys(x.products).length > 0).length;

    if (dom.stats.pertamina) dom.stats.pertamina.textContent = count('pertamina') + ' Wilayah';
    if (dom.stats.shell) dom.stats.shell.textContent = count('shell') + ' Wilayah';
    if (dom.stats.bp) dom.stats.bp.textContent = count('bp') + ' Wilayah';
    if (dom.stats.vivo) dom.stats.vivo.textContent = count('vivo') + ' Wilayah';
    if (dom.stats.mobil) dom.stats.mobil.textContent = count('mobil') + ' Wilayah';

    if (dom.stats.update) dom.stats.update.textContent = formatDate(lastUpdated);
};

// ================================
// Event Listeners & Init
// ================================

dom.refreshBtn.addEventListener('click', refreshData);

dom.province.addEventListener('change', (e) => {
    const val = e.target.value;
    state.filters.provinceId = val;
    state.filters.regencyId = ''; // Reset regency

    dom.regency.disabled = true;
    dom.regency.innerHTML = '<option value="">Pilih Provinsi Dahulu</option>';

    if (val) {
        fetchRegencies(val);
    }

    fetchPrices();
});

dom.provider.addEventListener('change', (e) => {
    state.filters.provider = e.target.value;
    fetchPrices();
});

// Init
fetchProvinces();
fetchPrices();
