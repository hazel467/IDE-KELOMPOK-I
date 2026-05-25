const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const fs = require('fs').promises;
const path = require('path');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function normalize(value, min, max) {
  if (value == null || isNaN(value)) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function calculatePriority(area, metrics = {}, reportCount = 0) {
  const pressure = metrics.pressure ?? 0;
  const flow = metrics.flow ?? 0;
  const turbidity = metrics.turbidity ?? 0;

  const needScore = normalize(flow, 0, 10);
  const qualityScore = 1 - normalize(turbidity, 0, 10);
  const pressureScore = 1 - normalize(pressure, 0, 10);
  const reportScore = normalize(reportCount, 0, 20);

  const score =
    0.35 * needScore +
    0.25 * qualityScore +
    0.25 * pressureScore +
    0.15 * reportScore;

  return Math.round(score * 100);
}

async function queryPrometheus(query) {
  try {
    const response = await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: { query }
    });
    return response.data;
  } catch (error) {
    console.error('Prometheus query error:', error.message);
    return null;
  }
}

function mapMetrics(result) {
  const metrics = {};
  if (!result || !result.data || !Array.isArray(result.data.result)) return metrics;
  for (const item of result.data.result) {
    const area = item.metric.area || item.metric.zone || 'unknown';
    const value = parseFloat(item.value[1]);
    if (!metrics[area]) metrics[area] = value;
    else metrics[area] = value;
  }
  return metrics;
}

app.get('/api/areas', async (req, res) => {
  try {
    const areaResult = await pool.query(
      `SELECT id, name, district, subdistrict, status, priority_score, ST_AsGeoJSON(geom) AS geom FROM areas ORDER BY name`
    );

    const reportResult = await pool.query(
      `SELECT area_id, COUNT(*) AS count FROM reports WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY area_id`
    );

    const reportsByArea = {};
    for (const row of reportResult.rows) {
      reportsByArea[row.area_id] = parseInt(row.count, 10);
    }

    const pressureData = mapMetrics(await queryPrometheus('pdam_pressure'));
    const flowData = mapMetrics(await queryPrometheus('pdam_flow'));
    const turbidityData = mapMetrics(await queryPrometheus('pdam_turbidity'));

    const areas = areaResult.rows.map((area) => {
      const metrics = {
        pressure: pressureData[area.name] ?? 0,
        flow: flowData[area.name] ?? 0,
        turbidity: turbidityData[area.name] ?? 0
      };
      const reportCount = reportsByArea[area.id] || 0;
      const computedScore = calculatePriority(area, metrics, reportCount);
      return {
        ...area,
        geom: JSON.parse(area.geom),
        metrics,
        reportCount,
        computedScore
      };
    });

    res.json({ status: 'ok', data: areas });
  } catch (error) {
    console.error('API /api/areas error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil data area' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, area_id, kelurahan, home_address, report_type, description, status, created_at FROM reports ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ status: 'ok', data: result.rows });
  } catch (error) {
    console.error('API /api/reports error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil laporan' });
  }
});

app.post('/api/reports', async (req, res) => {
  const { kelurahan, home_address, report_type, description } = req.body;
  if (!report_type || !kelurahan || !home_address) {
    return res.status(400).json({ status: 'error', message: 'report_type, kelurahan, dan home_address wajib diisi' });
  }

  try {
    await pool.query(
      `INSERT INTO reports (area_id, kelurahan, home_address, report_type, description, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'baru', NOW())`,
      [null, kelurahan, home_address, report_type, description || '']
    );
    res.json({ status: 'ok', message: 'Laporan berhasil dikirim' });
  } catch (error) {
    console.error('API POST /api/reports error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal menyimpan laporan' });
  }
});

app.get('/api/kelurahan', async (req, res) => {
  try {
    const content = await fs.readFile(path.join(__dirname, 'public', 'kelurahan.json'), 'utf8');
    const data = JSON.parse(content);
    res.json({ status: 'ok', data });
  } catch (error) {
    console.error('API /api/kelurahan error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar kelurahan' });
  }
});

// Endpoint untuk mengambil titik PDAM (GeoJSON)
app.get('/api/points', async (req, res) => {
  // coba baca file public/pdam_points.geojson terlebih dahulu
  const geoPath = path.join(__dirname, 'public', 'pdam_points.geojson');
  try {
    const content = await fs.readFile(geoPath, 'utf8');
    const geojson = JSON.parse(content);
    return res.json({ status: 'ok', data: geojson });
  } catch (err) {
    // jika file tidak ada, coba ambil dari tabel PostGIS `pdam_points`
    try {
      const q = `SELECT id, name, description, ST_AsGeoJSON(geom) AS geom FROM pdam_points`;
      const result = await pool.query(q);
      const features = result.rows.map((r) => ({
        type: 'Feature',
        properties: { id: r.id, name: r.name, description: r.description },
        geometry: JSON.parse(r.geom)
      }));
      return res.json({ status: 'ok', data: { type: 'FeatureCollection', features } });
    } catch (dbErr) {
      console.error('Error loading points:', err.message, dbErr && dbErr.message);
      return res.status(500).json({ status: 'error', message: 'Gagal memuat titik PDAM' });
    }
  }
});

app.post('/api/points', async (req, res) => {
  const { name, description, latitude, longitude } = req.body;
  if (!name || latitude == null || longitude == null) {
    return res.status(400).json({ status: 'error', message: 'name, latitude, dan longitude wajib diisi' });
  }

  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ status: 'error', message: 'latitude dan longitude harus angka valid' });
  }

  try {
    const insertQuery = `
      INSERT INTO pdam_points (name, description, geom)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
      RETURNING id, name, description, ST_AsGeoJSON(geom) AS geom
    `;
    const result = await pool.query(insertQuery, [name, description || '', lon, lat]);
    const row = result.rows[0];
    const feature = {
      type: 'Feature',
      properties: { id: row.id, name: row.name, description: row.description },
      geometry: JSON.parse(row.geom)
    };
    res.status(201).json({ status: 'ok', data: feature });
  } catch (error) {
    console.error('API POST /api/points error:', error);
    res.status(500).json({ status: 'error', message: 'Gagal menyimpan titik PDAM' });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
