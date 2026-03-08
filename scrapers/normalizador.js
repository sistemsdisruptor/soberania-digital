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

function normalizar(contrato) {
  return {
    id:        contrato.id || null,
    mes:       contrato.mes || null,
    año:       contrato.año || 2024,
    organismo: limpiar(contrato.organismo),
    objeto:    limpiar(contrato.objeto),
    proveedor: limpiar(contrato.proveedor),
    monto:     contrato.monto ? parseFloat(contrato.monto) : null,
    moneda:    contrato.moneda || 'UYU',
    fecha:     contrato.fecha || null,
  };
}

function limpiar(texto) {
  if (!texto) return null;
  return texto.toString().trim().toUpperCase().replace(/\s+/g, ' ');
}

function estadisticas(contratos) {
  const organismos = {};
  const proveedores = {};
  let montoTotal = 0;
  let conMonto = 0;

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
    top_organismos: Object.entries(organismos).sort((a,b)=>b[1]-a[1]).slice(0,20).map(function(e){ return {nombre:e[0], contratos:e[1]}; }),
    top_proveedores: Object.entries(proveedores).sort((a,b)=>b[1]-a[1]).slice(0,20).map(function(e){ return {nombre:e[0], contratos:e[1]}; }),
    por_mes: Array.from({length:12}, function(_,i) {
      const mes = i + 1;
      const del_mes = contratos.filter(function(c){ return c.mes === mes; });
      const monto_mes = del_mes.reduce(function(s,c){ return s + (c.monto||0); }, 0);
      return { mes: mes, contratos: del_mes.length, monto_uyu: monto_mes };
    }),
  };
}

function ejecutar() {
  crearDirectorio(SALIDA);
  log('Iniciando normalizador...');

  const archivoEntrada = path.join(ENTRADA, 'resumen-2024.json');
  if (!fs.existsSync(archivoEntrada)) {
    log('ERROR: No existe ' + archivoEntrada);
    log('Correr primero: node scrapers/compras-bulk.js');
    process.exit(1);
  }

  log('Leyendo resumen-2024.json...');
  const raw = JSON.parse(fs.readFileSync(archivoEntrada, 'utf8'));
  const contratos = raw.contratos || [];
  log('Contratos leidos: ' + contratos.length);

  log('Normalizando...');
  const normalizados = contratos.map(function(c) { return normalizar(c); });

  log('Calculando estadisticas...');
  const stats = estadisticas(normalizados);

  // Guardar contratos normalizados
  const salidaContratos = path.join(SALIDA, 'contratos-2024.json');
  fs.writeFileSync(salidaContratos, JSON.stringify({
    año: 2024,
    total: normalizados.length,
    generado: new Date().toISOString(),
    contratos: normalizados,
  }, null, 2), 'utf8');
  log('Guardado: contratos-2024.json');

  // Guardar estadisticas separadas
  const salidaStats = path.join(SALIDA, 'estadisticas-2024.json');
  fs.writeFileSync(salidaStats, JSON.stringify(stats, null, 2), 'utf8');
  log('Guardado: estadisticas-2024.json');

  // Mostrar resumen en pantalla
  console.log('\n════════════════════════════════════════');
  console.log('  COMPRAS DEL ESTADO URUGUAYO 2024');
  console.log('════════════════════════════════════════');
  console.log('Total contratos:      ' + stats.total_contratos.toLocaleString('es-UY'));
  console.log('Con monto registrado: ' + stats.con_monto.toLocaleString('es-UY'));
  console.log('Monto total UYU:      ' + Math.round(stats.monto_total_uyu).toLocaleString('es-UY'));
  console.log('Monto promedio UYU:   ' + stats.monto_promedio_uyu.toLocaleString('es-UY'));
  console.log('Organismos unicos:    ' + stats.organismos_unicos);
  console.log('Proveedores unicos:   ' + stats.proveedores_unicos);
  console.log('\nTop 10 organismos compradores:');
  stats.top_organismos.slice(0,10).forEach(function(o) {
    console.log('  ' + String(o.contratos).padStart(6) + '  ' + o.nombre);
  });
  console.log('\nTop 10 proveedores:');
  stats.top_proveedores.slice(0,10).forEach(function(p) {
    console.log('  ' + String(p.contratos).padStart(6) + '  ' + p.nombre);
  });
  console.log('\nPor mes:');
  stats.por_mes.forEach(function(m) {
    const barra = '█'.repeat(Math.floor(m.contratos / 1000));
    console.log('  Mes ' + String(m.mes).padStart(2,'0') + ': ' + String(m.contratos).padStart(6) + ' contratos  ' + barra);
  });
  console.log('════════════════════════════════════════\n');
}

ejecutar();
