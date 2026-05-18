# PDAM Semarang Dashboard

Website ini adalah contoh proyek untuk PDAM Semarang yang menggabungkan:
- `Prometheus` untuk monitoring metrik real time distribusi air
- `PostgreSQL + PostGIS` untuk penyimpanan area/zona dan laporan
- `Express` sebagai backend API
- `Leaflet` untuk visualisasi peta di frontend

## Struktur proyek
- `server.js` - backend Express
- `public/` - frontend HTML, CSS, JS
- `sql/schema.sql` - skema database PostGIS dan data contoh
- `.env.example` - contoh konfigurasi environment

## Cara menjalankan
1. Buat database PostgreSQL `pdam` dan aktifkan PostGIS:

```sql
CREATE DATABASE pdam;
\c pdam
CREATE EXTENSION postgis;
```

2. Jalankan SQL skema:

```bash
psql postgres://username:password@localhost:5432/pdam -f sql/schema.sql
```

3. Siapkan Prometheus dengan `PROMETHEUS_URL` di `.env`.
4. Install dependensi:

```bash
npm install
```

5. Jalankan server:

```bash
npm start
```

6. Buka `http://localhost:3000`

## Deployment dengan Docker

Untuk menjalankan seluruh sistem termasuk PostgreSQL dan Prometheus secara lokal, gunakan Docker Compose:

```bash
docker compose up --build
```

Layanan yang akan dijalankan:
- `db`: PostgreSQL untuk data PostGIS
- `prometheus`: Prometheus untuk monitoring metrik
- `metrics_exporter`: exporter metrik contoh
- `backend`: backend Express untuk website PDAM

Setelah semua layanan berjalan, buka:

- `http://localhost:3000` untuk website
- `http://localhost:9090` untuk Prometheus

Jika berjalan pertama kali, buat database PostGIS di dalam kontainer PostgreSQL:

```bash
# masuk ke kontainer PostgreSQL
docker compose exec db psql -U postgres -d pdam
# kemudian aktifkan PostGIS
CREATE EXTENSION postgis;
\q
```

## Endpoint API utama
- `GET /api/areas` - ambil data area dengan skor prioritas
- `GET /api/kelurahan` - ambil daftar semua kelurahan di Semarang
- `GET /api/points` - ambil titik PDAM GeoJSON
- `GET /api/reports` - ambil laporan terbaru
- `POST /api/reports` - kirim laporan kondisi air, kini dapat menyertakan `kelurahan`

## Catatan
- `server.js` akan mengambil metrik Prometheus: `pdam_pressure`, `pdam_flow`, `pdam_turbidity`
- Pastikan endpoint Prometheus bisa diakses pada `PROMETHEUS_URL`
- Data PostGIS area disajikan di peta menggunakan GeoJSON
