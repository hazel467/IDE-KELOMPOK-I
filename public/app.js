const map = L.map('map').setView([-6.966, 110.422], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const areaLayer = L.geoJSON(null, {
  style(feature) {
    const score = feature.properties.computedScore || 0;
    const color = score >= 70 ? '#dc2626' : score >= 50 ? '#f59e0b' : '#047857';
    return {
      color,
      weight: 3,
      opacity: 0.9,
      fillOpacity: 0.15
    };
  },
  onEachFeature(feature, layer) {
    if (!feature.properties) return;
    layer.bindPopup(`
      <strong>${feature.properties.name}</strong><br>
      Kecamatan: ${feature.properties.district}<br>
      Kelurahan: ${feature.properties.subdistrict}<br>
      Skor prioritas: ${feature.properties.computedScore}<br>
      Laporan 30 hari: ${feature.properties.reportCount}<br>
      Tekanan: ${feature.properties.metrics.pressure}<br>
      Debit: ${feature.properties.metrics.flow}<br>
      Kekeruhan: ${feature.properties.metrics.turbidity}
    `);
  }
}).addTo(map);

const areaSelect = document.getElementById('areaSelect');
const kelurahanSelect = document.getElementById('kelurahanSelect');
const areaList = document.getElementById('areaList');
const reportList = document.getElementById('reportList');
const areaCount = document.getElementById('areaCount');
const highPriorityCount = document.getElementById('highPriorityCount');
const recentReports = document.getElementById('recentReports');

function getPriorityBadge(score) {
  if (score >= 70) return '<span class="badge high">Tinggi</span>';
  if (score >= 50) return '<span class="badge medium">Sedang</span>';
  return '<span class="badge low">Rendah</span>';
}

function getReportBadge(type) {
  if (type === 'mati air') return '<span class="badge high">Mati Air</span>';
  if (type === 'air keruh') return '<span class="badge medium">Air Keruh</span>';
  if (type === 'tekanan rendah') return '<span class="badge medium">Tekanan Rendah</span>';
  if (type === 'kebocoran') return '<span class="badge high">Kebocoran</span>';
  return '<span class="badge low">Laporan</span>';
}

async function loadAreas() {
  const response = await fetch('/api/areas');
  const result = await response.json();
  if (result.status !== 'ok') {
    return;
  }

  const areas = result.data;
  areaCount.textContent = areas.length;
  const highPriority = areas.filter((a) => a.computedScore >= 70).length;
  highPriorityCount.textContent = highPriority;

  areaLayer.clearLayers();
  areaSelect.innerHTML = '';
  areaList.innerHTML = '';

  const bounds = [];
  areas.forEach((area) => {
    const feature = {
      type: 'Feature',
      geometry: area.geom,
      properties: area
    };
    areaLayer.addData(feature);
    bounds.push(area.geom);

    const option = document.createElement('option');
    option.value = area.id;
    option.textContent = area.name;
    areaSelect.appendChild(option);

    const card = document.createElement('div');
    card.className = 'area-card';
    card.innerHTML = `
      <h3>${area.name} ${getPriorityBadge(area.computedScore)}</h3>
      <p><strong>Kecamatan:</strong> ${area.district}</p>
      <p><strong>Kelurahan:</strong> ${area.subdistrict}</p>
      <p><strong>Skor prioritas:</strong> ${area.computedScore}</p>
      <p><strong>Jumlah laporan:</strong> ${area.reportCount}</p>
      <p><strong>Tekanan:</strong> ${area.metrics.pressure}</p>
      <p><strong>Debit:</strong> ${area.metrics.flow}</p>
      <p><strong>Kekeruhan:</strong> ${area.metrics.turbidity}</p>
    `;
    areaList.appendChild(card);
  });

  if (bounds.length > 0) {
    const geojson = { type: 'FeatureCollection', features: bounds.map((geom, index) => ({ type: 'Feature', geometry: geom })) };
    try {
      const layer = L.geoJSON(geojson);
      map.fitBounds(layer.getBounds(), { padding: [36, 36] });
    } catch (error) {
      console.warn('Map bounds error', error);
    }
  }
}

async function loadKelurahan() {
  const response = await fetch('/api/kelurahan');
  const result = await response.json();
  if (result.status !== 'ok') return;
  kelurahanSelect.innerHTML = '<option value="">Pilih kelurahan</option>';
  result.data.data.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.kecamatan;
    group.kelurahan.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      optgroup.appendChild(option);
    });
    kelurahanSelect.appendChild(optgroup);
  });
}

async function loadReports() {
  const response = await fetch('/api/reports');
  const result = await response.json();
  if (result.status !== 'ok') return;

  reportList.innerHTML = '';
  recentReports.textContent = result.data.length;

  result.data.forEach((report) => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.innerHTML = `
      <h3>${report.report_type} ${getReportBadge(report.report_type)}</h3>
      <p><strong>Kelurahan:</strong> ${report.kelurahan || '-'}</p>
      <p><strong>Area ID:</strong> ${report.area_id || '-'}</p>
      <p>${report.description || 'Tidak ada deskripsi.'}</p>
      <p><strong>Status:</strong> ${report.status}</p>
      <p><strong>Dilaporkan:</strong> ${new Date(report.created_at).toLocaleString('id-ID')}</p>
    `;
    reportList.appendChild(card);
  });
}

const reportForm = document.getElementById('reportForm');
reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    area_id: areaSelect.value ? parseInt(areaSelect.value, 10) : null,
    kelurahan: kelurahanSelect.value || null,
    report_type: document.getElementById('reportType').value,
    description: document.getElementById('reportDescription').value.trim()
  };

  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (result.status === 'ok') {
    alert(result.message);
    reportForm.reset();
    loadAreas();
    loadReports();
  } else {
    alert(result.message || 'Gagal mengirim laporan');
  }
});

loadAreas();
loadKelurahan();
loadReports();

// Load PDAM Tirto Moedal points (from public/pdam_points.geojson)
const pointsLayer = L.layerGroup().addTo(map);
async function loadPdamPoints() {
  try {
    const resp = await fetch('/pdam_points.geojson');
    if (!resp.ok) return;
    const geo = await resp.json();
    pointsLayer.clearLayers();
    const pdamIcon = L.divIcon({
      className: 'pdam-icon',
      html: '<div style="background:#0f4c81;color:white;padding:6px 8px;border-radius:8px;font-weight:700;">💧</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    L.geoJSON(geo, {
      pointToLayer(feature, latlng) {
        return L.marker(latlng, { icon: pdamIcon });
      },
      onEachFeature(feature, layer) {
        const p = feature.properties || {};
        layer.bindPopup(`<strong>${p.name || 'PDAM'}</strong><br>${p.address || ''}`);
      }
    }).addTo(pointsLayer);
  } catch (err) {
    console.warn('Failed to load PDAM points', err);
  }
}

loadPdamPoints();
