'use strict';
const fs = require('fs');
const path = require('path');

const DATOS = './datos/normalizado/contratos-2024.json';
const SALIDA = './datos/intendencias';

function log(msg) {
  console.log('[' + new Date().toISOString().substring(11,19) + '] ' + msg);
}

function crearDirectorio(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function estadisticasOrganismo(contratos) {
  const proveedores = {};
  const objetos = {};
  let montoTotal = 0;
  let conMonto = 0;

  contratos.forEach(function(c) {
    if (c.proveedor) proveedores[c.proveedor] = (proveedores[c.proveedor]||0) + 1;
    if (c.objeto) objetos[c.objeto] = (objetos[c.objeto]||0) + 1;
    if (c.monto && c.monto > 0) { montoTotal += c.monto; conMonto++; }
  });

  return {
    total_contratos: contratos.length,
    con_monto: conMonto,
    monto_total_uyu: montoTotal,
    monto_promedio_uyu: conMonto > 0 ? Math.round(montoTotal / conMonto) : 0,
    proveedores_unicos: Object.keys(proveedores).length,
    top_proveedores: Object.entries(proveedores).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){ return {nombre:e[0], contratos:e[1]}; }),
    top_objetos: Object.entries(objetos).sort(function(a,b){return b[1]-a[1];}).slice(0,20).map(function(e){ return {descripcion:e[0], veces:e[1]}; }),
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
  log('Cargando contratos...');

  const raw = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
  const todos = raw.contratos || [];
  log('Total contratos: ' + todos.length);

  // Agrupar por intendencia
  const porIntendencia = {};
  todos.forEach(function(c) {
    if (c.organismo && c.organismo.includes('INTENDENCIA')) {
      const nombre = c.organismo;
      if (!porIntendencia[nombre]) porIntendencia[nombre] = [];
      porIntendencia[nombre].push(c);
    }
  });

  const intendencias = Object.keys(porIntendencia).sort();
  log('Intendencias encontradas: ' + intendencias.length);

  const resumenGeneral = [];

  intendencias.forEach(function(nombre) {
    const contratos = porIntendencia[nombre];
    const stats = estadisticasOrganismo(contratos);

    // Guardar archivo individual por intendencia
    const nombreArchivo = nombre.replace(/\s+/g, '-').toLowerCase() + '.json';
    fs.writeFileSync(
      path.join(SALIDA, nombreArchivo),
      JSON.stringify({ nombre: nombre, año: 2024, stats: stats, contratos: contratos }, null, 2),
      'utf8'
    );

    resumenGeneral.push({
      nombre: nombre,
      total_contratos: stats.total_contratos,
      monto_total_uyu: stats.monto_total_uyu,
      proveedores_unicos: stats.proveedores_unicos,
      top_proveedor: stats.top_proveedores[0] || null,
    });

    log(nombre + ': ' + stats.total_contratos + ' contratos, UYU ' + Math.round(stats.monto_total_uyu).toLocaleString('es-UY'));
  });

  // Guardar resumen general
  fs.writeFileSync(
    path.join(SALIDA, 'resumen-intendencias-2024.json'),
    JSON.stringify({ año: 2024, total_intendencias: intendencias.length, generado: new Date().toISOString(), intendencias: resumenGeneral }, null, 2),
    'utf8'
  );

  // Mostrar tabla comparativa
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  GOBIERNOS DEPARTAMENTALES — COMPRAS 2024');
  console.log('════════════════════════════════════════════════════════════');
  resumenGeneral.sort(function(a,b){ return b.monto_total_uyu - a.monto_total_uyu; }).forEach(function(i) {
    console.log('\n  ' + i.nombre);
    console.log('    Contratos:  ' + i.total_contratos.toLocaleString('es-UY'));
    console.log('    Monto:      UYU ' + Math.round(i.monto_total_uyu).toLocaleString('es-UY'));
    console.log('    Proveedores: ' + i.proveedores_unicos);
    if (i.top_proveedor) console.log('    Top proveedor: ' + i.top_proveedor.nombre + ' (' + i.top_proveedor.contratos + ' contratos)');
  });
  console.log('\n════════════════════════════════════════════════════════════\n');
}

ejecutar();
