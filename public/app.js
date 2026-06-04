const map = L.map('map').setView([-6.966, 110.422], 12);

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors, SRTM | rendered with OpenTopoMap',
  maxZoom: 17
});

const contourLayer = L.tileLayer('https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', {
  attribution: 'Hillshade layer © Wikimedia',
  maxZoom: 17,
  opacity: 0.55
}).addTo(map);

function setBaseLayer(layerName) {
  if (layerName === 'topo') {
    if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
    if (!map.hasLayer(topoLayer)) map.addLayer(topoLayer);
  } else {
    if (map.hasLayer(topoLayer)) map.removeLayer(topoLayer);
    if (!map.hasLayer(osmLayer)) map.addLayer(osmLayer);
  }

  document.querySelectorAll('.legend-menu-item').forEach((button) => {
    button.classList.toggle('active', button.dataset.layer === layerName);
  });
}

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

const kelurahanSelect = document.getElementById('kelurahanSelect');
const homeAddressInput = document.getElementById('homeAddress');
const otherDescriptionContainer = document.getElementById('otherDescriptionContainer');
const otherDescriptionInput = document.getElementById('otherDescription');
const areaList = document.getElementById('areaList');
const reportList = document.getElementById('reportList');
const areaCount = document.getElementById('areaCount');
const highPriorityCount = document.getElementById('highPriorityCount');
const recentReports = document.getElementById('recentReports');

const legendMenuButtons = document.querySelectorAll('.legend-menu-item');
legendMenuButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setBaseLayer(button.dataset.layer);
  });
});

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

function getAreaRegion(area) {
  const key = `${area.name || ''} ${area.district || ''}`.toLowerCase();
  if (key.includes('tengah')) return 'Semarang Tengah';
  if (key.includes('utara')) return 'Semarang Utara';
  if (key.includes('selatan')) return 'Semarang Selatan';
  if (key.includes('barat')) return 'Semarang Barat';
  if (key.includes('timur')) return 'Semarang Timur';
  return 'Semarang Lainnya';
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
  areaList.innerHTML = '';

  const bounds = [];
  const groups = {
    'Semarang Tengah': [],
    'Semarang Utara': [],
    'Semarang Selatan': [],
    'Semarang Barat': [],
    'Semarang Timur': [],
    'Semarang Lainnya': []
  };

  areas.forEach((area) => {
    const feature = {
      type: 'Feature',
      geometry: area.geom,
      properties: area
    };
    areaLayer.addData(feature);
    bounds.push(area.geom);

    const region = getAreaRegion(area);
    groups[region].push(area);
  });

  Object.entries(groups).forEach(([region, list]) => {
    if (!list.length) return;

    const groupSection = document.createElement('div');
    groupSection.className = 'area-group';
    groupSection.innerHTML = `<h3 class="area-group-title">${region}</h3>`;

    const groupCards = document.createElement('div');
    groupCards.className = 'area-group-cards';

    list.forEach((area) => {
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
      groupCards.appendChild(card);
    });

    groupSection.appendChild(groupCards);
    areaList.appendChild(groupSection);
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

function buildReportCellHtml(report) {
  const parts = [];
  parts.push(`<div class="report-type">${report.report_type} ${getReportBadge(report.report_type)}</div>`);
  if (report.home_address) {
    parts.push(`<div class="report-address"><strong>Alamat:</strong> ${report.home_address}</div>`);
  }
  if (report.description) {
    parts.push(`<div class="report-description">${report.description}</div>`);
  }
  parts.push(`<div class="report-meta"><span>Status: ${report.status}</span> · <span>${new Date(report.created_at).toLocaleString('id-ID')}</span></div>`);
  return parts.join('');
}

function shouldShowToggle(report) {
  const text = `${report.report_type} ${report.home_address || ''} ${report.description || ''}`;
  return text.length > 140;
}

async function loadReports() {
  const response = await fetch('/api/reports');
  const result = await response.json();
  if (result.status !== 'ok') return;

  reportList.innerHTML = '';
  recentReports.textContent = result.data.length;

  const table = document.createElement('table');
  table.className = 'reports-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>No</th>
        <th>Kelurahan</th>
        <th>Laporan</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  result.data.forEach((report, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${report.kelurahan || '-'}</td>
      <td>
        <div class="report-cell">
          <div class="report-summary">${buildReportCellHtml(report)}</div>
          ${shouldShowToggle(report) ? '<button type="button" class="toggle-report-button">Tampilkan semua</button>' : ''}
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });

  reportList.appendChild(table);
}

reportList.addEventListener('click', (event) => {
  if (!event.target.matches('.toggle-report-button')) return;
  const button = event.target;
  const cell = button.closest('.report-cell');
  if (!cell) return;
  const expanded = cell.classList.toggle('expanded');
  button.textContent = expanded ? 'Sembunyikan' : 'Tampilkan semua';
});

const reportForm = document.getElementById('reportForm');
const reportTypeSelect = document.getElementById('reportType');

reportTypeSelect.addEventListener('change', () => {
  if (reportTypeSelect.value === 'lainnya') {
    otherDescriptionContainer.style.display = 'block';
    otherDescriptionInput.required = true;
  } else {
    otherDescriptionContainer.style.display = 'none';
    otherDescriptionInput.required = false;
  }
});

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    kelurahan: kelurahanSelect.value || null,
    home_address: homeAddressInput.value.trim() || null,
    report_type: reportTypeSelect.value,
    description: reportTypeSelect.value === 'lainnya' ? otherDescriptionInput.value.trim() : null
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
    otherDescriptionContainer.style.display = 'none';
    loadAreas();
    loadReports();
  } else {
    alert(result.message || 'Gagal mengirim laporan');
  }
});

loadAreas();
loadKelurahan();
loadReports();

// Load PDAM points from GeoJSON sources
const pointsLayer = L.layerGroup().addTo(map);

function isPdamPoint(feature) {
  return feature && feature.geometry && feature.geometry.type === 'Point';
}

function getPointIcon(type) {
  const isReservoir = String(type || '').toLowerCase() === 'reservoir';
  return L.divIcon({
    className: 'pdam-icon',
    html: `<div style="background:${isReservoir ? '#38bdf8' : '#0ea5e9'};color:white;padding:8px 10px;border-radius:50%;font-weight:800;font-size:18px;line-height:1;">${isReservoir ? '💦' : '💧'}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34]
  });
}

function buildPointPopup(feature) {
  const p = feature.properties || {};
  let html = `<strong>${p.name || 'Titik PDAM'}</strong><br>`;
  
  if (p.address) html += `<div><strong>📍 Alamat:</strong> ${p.address}</div>`;
  if (p.type) {
    const types = {
      kantor: 'Kantor',
      depo: 'Depo Air',
      instalasi: 'Instalasi',
      pelayanan: 'Pelayanan Pelanggan',
      bengkel: 'Bengkel Perbaikan',
      intake: 'Intake Air',
      meter: 'Meter Air',
      kontrol: 'Pusat Kontrol',
      sensor: 'Sensor Monitoring'
    };
    html += `<div><strong>🏷️ Tipe:</strong> ${types[p.type] || p.type}</div>`;
  }
  if (p.phone) html += `<div><strong>📞 Telepon:</strong> ${p.phone}</div>`;
  if (p.jam_buka) html += `<div><strong>🕐 Jam Buka:</strong> ${p.jam_buka}</div>`;
  if (p.services) html += `<div><strong>🛠️ Layanan:</strong> ${p.services.join(', ')}</div>`;
  if (p.status) html += `<div><strong>📌 Status:</strong> ${p.status}</div>`;
  if (p.capacity) html += `<div><strong>💧 Kapasitas:</strong> ${p.capacity} m³</div>`;
  if (p.sumber) html += `<div><strong>🌊 Sumber Air:</strong> ${p.sumber}</div>`;
  if (p.description) html += `<div><strong>ℹ️ Keterangan:</strong> ${p.description}</div>`;
  if (p.parameter) html += `<div><strong>📋 Parameter:</strong> ${p.parameter}</div>`;
  
  return html;
}

async function loadPdamPoints() {
  const sources = ['/api/pdam-reservoir', '/api/points'];
  const allFeatures = [];

  for (const src of sources) {
    try {
      const resp = await fetch(src);
      if (!resp.ok) {
        console.warn('Failed to fetch PDAM points from', src, resp.status, resp.statusText);
        continue;
      }
      const geo = await resp.json();
      const features = (geo.data && Array.isArray(geo.data.features) ? geo.data.features : Array.isArray(geo.features) ? geo.features : []);
      allFeatures.push(...features);
    } catch (sourceErr) {
      console.warn('Error loading PDAM source', src, sourceErr);
    }
  }

  pointsLayer.clearLayers();
  const pdamFeatures = allFeatures.filter(isPdamPoint);
  if (!pdamFeatures.length) return;

  L.geoJSON({ type: 'FeatureCollection', features: pdamFeatures }, {
    pointToLayer(feature, latlng) {
      const icon = getPointIcon(feature.properties.type);
      return L.marker(latlng, { icon });
    },
    onEachFeature(feature, layer) {
      const popup = buildPointPopup(feature);
      layer.bindPopup(popup);
    }
  }).addTo(pointsLayer);
}

loadPdamPoints();
