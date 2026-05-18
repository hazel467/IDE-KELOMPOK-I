const express = require('express');
const app = express();
const port = process.env.METRICS_PORT || 9100;

const metrics = [
  { area: 'Semarang Barat', pressure: 6.4, flow: 7.0, turbidity: 1.2 },
  { area: 'Semarang Selatan', pressure: 5.0, flow: 5.8, turbidity: 2.4 },
  { area: 'Semarang Timur', pressure: 7.5, flow: 6.3, turbidity: 0.8 }
];

function renderMetrics() {
  return metrics
    .map((item) => [
      `pdam_pressure{area=\"${item.area}\"} ${item.pressure}`,
      `pdam_flow{area=\"${item.area}\"} ${item.flow}`,
      `pdam_turbidity{area=\"${item.area}\"} ${item.turbidity}`
    ].join('\n'))
    .join('\n');
}

app.get('/', (req, res) => {
  res.send('Metrics exporter: gunakan /metrics untuk mengakses metrik.');
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(renderMetrics());
});

app.listen(port, () => {
  console.log(`Metrics exporter berjalan di http://0.0.0.0:${port}/metrics`);
});
