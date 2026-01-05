# Harga BBM Indonesia ⛽

Web app sederhana untuk memantau harga BBM terkini di Indonesia dari berbagai provider (Pertamina, Shell, BP, Vivo, Mobil Indostation).

**🌐 Live Demo:** [https://lutfiangga.github.io/harga-bbm-indo/](https://lutfiangga.github.io/harga-bbm-indo/)

## 🔌 API Public

Anda dapat menggunakan data JSON statis yang kami generate setiap hari:

**Endpoint:** `https://lutfiangga.github.io/harga-bbm-indo/api/prices.json`

**Format Response:**

```json
{
  "success": true,
  "data": {
    "lastUpdated": "2026-01-05T...",
    "providers": {
      "pertamina": [...],
      "shell": [...]
    }
  }
}
```

## 🚀 Fitur

- **Multi-Provider:** Pantau harga dari 5 provider sekaligus.
- **Filter Wilayah:** Cari harga berdasarkan Provinsi.
- **Grafik Perbandingan:** Visualisasi harga bahan bakar antar provider.
- **Auto-Update:** Data diperbarui setiap hari menggunakan GitHub Actions.

## 🛠 Teknologi

- **Frontend:** HTML, Tailwind CSS, Chart.js (Tanpa Framework JS berat).
- **Scraper:** Puppeteer (Node.js).
- **Hosting:** GitHub Pages (Static).
- **CI/CD:** GitHub Actions.

---

License: MIT
