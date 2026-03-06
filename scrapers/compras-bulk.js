'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = './datos/compras';
const MODULO = 'COMPRAS-BULK';

// Archivos ZIP por año publicados por ARCE en catalogodatos.gub.uy
const FUENTES = [
  {
    año: 2024,
    url: 'https://catalogodatos.gub.uy/dataset/arce-datos-historicos-de-compras/resource/12508c0e-6857-406b-8aca-a63e66920e9f/download/compras2024.zip',
    archivo: 'compras2024.zip',
  },
  {
    año: 2025,
    url: 'https://catalogodatos.gub.uy/dataset/arce-datos-historicos-de-compras/resource/b8f2d1e3-9a4c-4f7b-8e2a-d3c1e9f0a2b5/download/compras2025.zip',
    archivo: 'compras2025.zip',
  },
];

function log(msg) {
  console.log('[' + new Date().toISOString().substring(11,19) + '] ' + msg);
}

function descargar(url, destino) {
  return new Promise(function(resolve, reject) {
    log('Descargando: ' + url);
    const archivo = fs.createWriteStream(destino);
    const cliente = url.startsWith('https') ? https : http;

    function hacer(urlActual, redireccion) {
      cliente.get(urlActual, {
        headers: {
          'User-Agent': 'SoberaniaDigital/1.0 (transparencia-ciudadana)',
          'Accept': '*/*',
        }
      }, function(res) {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
          log('Redireccion a: ' + res.headers.location);
          const nuevaUrl = res.headers.location;
          const nuevoCliente = nuevaUrl.startsWith('https') ? require('https') : require('http');
          nuevoCliente.get(nuevaUrl, {
            headers: { 'User-Agent': 'SoberaniaDigital/1.0' }
          }, function(res2) {
            if (res2.statusCode !== 200) {
              archivo.close();
              reject(new Error('HTTP ' + res2.statusCode + ' en ' + nuevaUrl));
              return;
            }
            const total = parseInt(res2.headers['content-length'] || '0');
            let recibido = 0;
            res2.on('data', function(chunk) {
              recibido += chunk.length;
              if (total > 0) {
                const pct = Math.floor(recibido / total * 100);
                process.stdout.write('\r  Progreso: ' + pct + '% (' + Math.floor(recibido/1024) + ' KB)');
              }
            });
            res2.pipe(archivo);
            archivo.on('finish', function() { console.log(''); archivo.close(); resolve(destino); });
            archivo.on('error', reject);
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) {
          archivo.close();
          fs.unlink(destino, function(){});
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0');
        let recibido = 0;
        res.on('data', function(chunk) {
          recibido += chunk.length;
          if (total > 0) {
            const pct = Math.floor(recibido / total * 100);
            process.stdout.write('\r  Progreso: ' + pct + '% (' + Math.floor(recibido/1024) + ' KB)');
          }
        });
        res.pipe(archivo);
        archivo.on('finish', function() { console.log(''); archivo.close(); resolve(destino); });
        archivo.on('error', reject);
      }).on('error', function(e) {
        archivo.close();
        fs.unlink(destino, function(){});
        reject(e);
      });
    }
    hacer(url);
  });
}

function procesarJSON(rutaArchivo, año) {
  log('Procesando: ' + rutaArchivo);
  try {
    const contenido = fs.readFileSync(rutaArchivo, 'utf8');
    const lineas = contenido.split('\n').filter(function(l) { return l.trim().length > 0; });
    const contratos = [];
    let errores = 0;
    lineas.forEach(function(linea, i) {
      try {
        const obj = JSON.parse(linea);
        const tender = obj.tender || {};
        const award = (obj.awards || [])[0] || {};
        const buyer = obj.buyer || {};
        contratos.push({
          id: obj.ocid || obj.id,
          año: año,
          organismo: buyer.name || 'Desconocido',
          objeto: tender.title || tender.description || 'Sin descripcion',
          modalidad: tender.procurementMethodDetails || tender.procurementMethod || null,
          monto_presupuestado: (tender.value || {}).amount || null,
          monto_adjudicado: (award.value || {}).amount || null,
          moneda: (tender.value || {}).currency || 'UYU',
          proveedor: ((award.suppliers || [])[0] || {}).name || null,
          estado_licitacion: tender.status || null,
          fecha_publicacion: obj.date || null,
        });
      } catch(e) {
        errores++;
      }
    });
    log('Parseados: ' + contratos.length + ' contratos (' + errores + ' errores de parse)');
    return contratos;
  } catch(e) {
    log('Error leyendo archivo: ' + e.message);
    return [];
  }
}

function guardarResumen(contratos, año) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const salida = path.join(DIR, 'compras-' + año + '-resumen.json');
  const resumen = {
    año: año,
    total: contratos.length,
    generado: new Date().toISOString(),
    contratos: contratos,
  };
  fs.writeFileSync(salida, JSON.stringify(resumen, null, 2), 'utf8');
  log('Guardado: ' + salida + ' (' + contratos.length + ' contratos)');

  // Estadisticas rapidas
  const conMonto = contratos.filter(function(c) { return c.monto_adjudicado > 0; });
  const totalUYU = conMonto.reduce(function(s, c) { return s + (c.monto_adjudicado || 0); }, 0);
  const organismos = {};
  contratos.forEach(function(c) {
    organismos[c.organismo] = (organismos[c.organismo] || 0) + 1;
  });
  const topOrganismos = Object.entries(organismos)
    .sort(function(a,b){ return b[1]-a[1]; })
    .slice(0, 10);

  console.log('\n  Top 10 organismos compradores:');
  topOrganismos.forEach(function(o) {
    console.log('    ' + o[1] + ' contratos - ' + o[0]);
  });
  if (totalUYU > 0) {
    console.log('\n  Monto total adjudicado: UYU ' + totalUYU.toLocaleString('es-UY'));
  }

  return salida;
}

async function ejecutar() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  console.log('\nSoberania Digital - Descarga de Compras Estatales (Bulk)');
  console.log('Fuente: catalogodatos.gub.uy / ARCE\n');

  for (const fuente of FUENTES) {
    console.log('\n== Año ' + fuente.año + ' ==');
    const rutaZip = path.join(DIR, fuente.archivo);

    try {
      await descargar(fuente.url, rutaZip);
      const stats = fs.statSync(rutaZip);
      log('Descargado: ' + Math.floor(stats.size / 1024) + ' KB');

      // Ver contenido del ZIP
      log('Contenido del ZIP:');
      const { execSync } = require('child_process');
      try {
        const lista = execSync('unzip -l ' + rutaZip + ' 2>/dev/null | head -20').toString();
        console.log(lista);
      } catch(e) {
        log('No se puede listar ZIP (unzip no instalado)');
      }

    } catch(err) {
      log('Error con año ' + fuente.año + ': ' + err.message);
      log('Probando URL alternativa...');
      // Intentar URL directa del catalogo
      const urlAlt = 'https://catalogodatos.gub.uy/dataset/575ccb87-ae74-4dcd-ba4b-cf050bd8e08a/resource/' + fuente.año + '/download';
      log('Sin datos para este año por ahora.');
    }
  }
}

ejecutar().catch(function(e) { console.error('Error fatal:', e.message); });
