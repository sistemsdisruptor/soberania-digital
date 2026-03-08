'use strict';
const fs = require('fs');
const path = require('path');

const DATOS = './datos/normalizado/contratos-2024.json';

function cargar() {
  if (!fs.existsSync(DATOS)) {
    console.log('ERROR: No existe ' + DATOS);
    console.log('Correr primero: node scrapers/normalizador.js');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
  return raw.contratos || [];
}

function buscar(contratos, termino) {
  const t = termino.toUpperCase().trim();
  return contratos.filter(function(c) {
    return (c.organismo && c.organismo.includes(t)) ||
           (c.proveedor && c.proveedor.includes(t)) ||
           (c.objeto && c.objeto.includes(t));
  });
}

function mostrar(resultados, termino) {
  console.log('\n════════════════════════════════════════');
  console.log('  Búsqueda: "' + termino + '"');
  console.log('  Resultados: ' + resultados.length + ' contratos');
  console.log('════════════════════════════════════════');

  if (resultados.length === 0) {
    console.log('  Sin resultados.\n');
    return;
  }

  const montoTotal = resultados.reduce(function(s,c){ return s + (c.monto||0); }, 0);
  console.log('  Monto total: UYU ' + Math.round(montoTotal).toLocaleString('es-UY'));

  console.log('\n  Primeros 20 contratos:');
  resultados.slice(0,20).forEach(function(c, i) {
    console.log('\n  [' + (i+1) + '] ' + (c.fecha||'sin fecha'));
    console.log('      Organismo: ' + (c.organismo||'?'));
    console.log('      Objeto:    ' + (c.objeto||'?'));
    console.log('      Proveedor: ' + (c.proveedor||'?'));
    console.log('      Monto:     ' + (c.monto ? 'UYU ' + c.monto.toLocaleString('es-UY') : 'no registrado'));
  });
  console.log('');
}

// Buscar por argumento de línea de comandos
const termino = process.argv.slice(2).join(' ');
if (!termino) {
  console.log('Uso: node scrapers/buscador.js TERMINO');
  console.log('Ejemplos:');
  console.log('  node scrapers/buscador.js MURRY');
  console.log('  node scrapers/buscador.js HOSPITAL MACIEL');
  console.log('  node scrapers/buscador.js ROCHE');
  console.log('  node scrapers/buscador.js INTENDENCIA MONTEVIDEO');
  process.exit(0);
}

const contratos = cargar();
const resultados = buscar(contratos, termino);
mostrar(resultados, termino);
