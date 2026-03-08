'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const SALIDA = './datos/ingresos';
function log(msg) { console.log('[' + new Date().toISOString().substring(11,19) + '] ' + msg); }
if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });
log('Buscando datasets del MEF en catalogodatos.gub.uy...');
const req = https.get(
  'https://catalogodatos.gub.uy/api/3/action/package_search?fq=organization:mef&rows=20',
  { headers: { 'User-Agent': 'SoberaniaDigital/1.0' } },
  function(res) {
    let data = '';
    res.on('data', function(c){ data += c; });
    res.on('end', function() {
      try {
        const json = JSON.parse(data);
        const datasets = (json.result && json.result.results) || [];
        log('Datasets encontrados: ' + datasets.length);
        datasets.forEach(function(d) {
          console.log('\n  ' + d.title);
          (d.resources || []).forEach(function(r) {
            console.log('    ' + r.format + ' — ' + r.url);
          });
        });
        fs.writeFileSync(path.join(SALIDA, 'datasets-mef.json'), JSON.stringify({ datasets: datasets, consultado: new Date().toISOString() }, null, 2));
        log('Guardado: datasets-mef.json');
      } catch(e) { log('Error: ' + e.message); }
    });
  }
);
req.on('error', function(e) { log('Error de red: ' + e.message); });
req.setTimeout(10000, function() { log('Timeout'); req.destroy(); });
