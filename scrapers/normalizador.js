'use strict';
const fs = require('fs');
const path = require('path');

const ENTRADA = './datos/compras';
const SALIDA = './datos/normalizado';

function log(msg) {
  console.log('[' + new Date().toISOString().substring(11,19) + '] ' + msg);
}

function crearDirectorio(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extraerMonto(release) {
  var awards = release.awards || [];
  for (var i = 0; i < awards.length; i++) {
    var a = awards[i];
    if (a.value && a.value.amount) return { monto: a.value.amount, moneda: a.value.currency || 'UYU' };
    if (a.items && a.items.length > 0) {
      var total = 0;
      var moneda = 'UYU';
      a.items.forEach(function(item) {
        if (item.unit && item.unit.value && item.unit.value.amount) {
          var cantidad = item.quantity || 1;
          total += item.unit.value.amount * cantidad;
          moneda = item.unit.value.currency || moneda;
        }
      });
      if (total > 0) return { monto: total, moneda: moneda };
    }
  }
  if (release.tender && release.tender.value && release.tender.value.amount) {
    return { monto: release.tender.value.amount, moneda: release.tender.value.currency || 'UYU' };
  }
  return { monto: null, moneda: 'UYU' };
}

function extraerObjeto(release) {
  if (release.tender && release.tender.title) return release.tender.title;
  if (release.tender && release.tender.description) return release.tender.description;
  var awards = release.awards || [];
  for (var i = 0; i < awards.length; i++) {
    var items = awards[i].items || [];
    if (items.length > 0 && items[0].classification && items[0].classification.description) {
      return items[0].classification.description;
    }
    if (awards[i].title) return awards[i].title;
  }
  return null;
}

function extraerProveedor(release) {
  var awards = release.awards || [];
  for (var i = 0; i < awards.length; i++) {
    var suppliers = awards[i].suppliers || [];
    if (suppliers.length > 0 && suppliers[0].name) return suppliers[0].name;
  }
  return null;
}

function normalizar(release, mes, año) {
  var buyer = release.buyer || {};
  var montoData = extraerMonto(release);
  var objeto = extraerObjeto(release);
  var proveedor = extraerProveedor(release);
  return {
    id:        release.ocid || release.id || null,
    mes:       mes,
    año:       año,
    organismo: buyer.name ? buyer.name.trim().toUpperCase() : null,
    objeto:    objeto ? objeto.trim().toUpperCase() : null,
    proveedor: proveedor ? proveedor.trim().toUpperCase() : null,
    monto:     montoData.monto,
    moneda:    montoData.moneda,
    fecha:     release.date || null,
  };
}

function estadisticas(contratos) {
  var organismos = {};
  var proveedores = {};
  var montoTotal = 0;
  var conMonto = 0;
  contratos.forEach(function(c) {
    if (c.organismo) organismos[c.organismo] = (organismos[c.organismo]||0) + 1;
    if (c.proveedor) proveedores[c.proveedor] = (proveedores[c.proveedor]||0) + 1;
    if (c.monto && c.monto > 0) { montoTotal += c.monto; conMonto++; }
  });
  return {
    total_contratos: contratos.length,
    con_monto: conMonto,
    monto_total_uyu: montoTotal,
    monto_promedio_uyu: conMonto > 0 ? Math.round(montoTotal / conMonto) : 0,
    organismos_unicos: Object.keys(organismos).length,
    proveedores_unicos: Object.keys(proveedores).length,
    top_organismos: Object.entries(organismos).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){ return {nombre:e[0], contratos:e[1]}; }),
    top_proveedores: Object.entries(proveedores).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){ return {nombre:e[0], contratos:e[1]}; }),
    por_mes: Array.from({length:12}, function(_,i) {
      var mes = i + 1;
      var del_mes = contratos.filter(function(c){ return c.mes === mes; });
      var monto_mes = del_mes.reduce(function(s,c){ return s + (c.monto||0); }, 0);
      return { mes: mes, contratos: del_mes.length, monto_uyu: monto_mes };
    }),
  };
}

function ejecutar() {
  crearDirectorio(SALIDA);
  log('Iniciando normalizador v2...');
  var normalizados = [];
  for (var m = 1; m <= 12; m++) {
    var mes = String(m).padStart(2, '0');
    var archivo = path.join(ENTRADA, 'a-' + mes + '-2024.json');
    if (!fs.existsSync(archivo)) continue;
    log('Procesando mes ' + mes + '...');
    var data = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    var releases = data.releases || [];
    releases.forEach(function(r) { normalizados.push(normalizar(r, m, 2024)); });
    log('Mes ' + mes + ': ' + releases.length + ' contratos');
  }
  log('Total: ' + normalizados.length + ' contratos');
  var stats = estadisticas(normalizados);
  fs.writeFileSync(path.join(SALIDA, 'contratos-2024.json'), JSON.stringify({ año: 2024, total: normalizados.length, generado: new Date().toISOString(), contratos: normalizados }, null, 2), 'utf8');
  fs.writeFileSync(path.join(SALIDA, 'estadisticas-2024.json'), JSON.stringify(stats, null, 2), 'utf8');
  console.log('\n════════════════════════════════════════');
  console.log('  COMPRAS DEL ESTADO URUGUAYO 2024');
  console.log('════════════════════════════════════════');
  console.log('Total contratos:      ' + stats.total_contratos.toLocaleString('es-UY'));
  console.log('Con monto registrado: ' + stats.con_monto.toLocaleString('es-UY'));
  console.log('Monto total UYU:      ' + Math.round(stats.monto_total_uyu).toLocaleString('es-UY'));
  console.log('Monto promedio UYU:   ' + stats.monto_promedio_uyu.toLocaleString('es-UY'));
  console.log('Organismos unicos:    ' + stats.organismos_unicos);
  console.log('Proveedores unicos:   ' + stats.proveedores_unicos);
  console.log('\nTop 10 proveedores:');
  stats.top_proveedores.slice(0,10).forEach(function(p) { console.log('  ' + String(p.contratos).padStart(6) + '  ' + p.nombre); });
  console.log('════════════════════════════════════════\n');
}

ejecutar();
