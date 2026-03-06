'use strict';
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const security = require('../security/core');
const logger = require('../security/logger');
require('dotenv').config();

const CONFIG = {
  baseUrl: 'https://www.comprasestatales.gub.uy/ws/1.0',
  timeout: 25000,
  pausa: 2500,
  directorioSalida: './datos/compras',
  modulo: 'SCRAPER-COMPRAS',
};

const clienteHttp = axios.create({
  timeout: CONFIG.timeout,
  headers: {
    'User-Agent': 'SoberaniaDigital/1.0 (transparencia-ciudadana)',
    'Accept': 'application/json, application/xml, */*',
  },
});

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

function crearDirectorio() {
  if (!fs.existsSync(CONFIG.directorioSalida)) {
    fs.mkdirSync(CONFIG.directorioSalida, { recursive: true });
  }
}

function formatearFecha(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function calcularPeriodo(semanaAtras) {
  const hoy = new Date();
  const fin = new Date(hoy);
  fin.setDate(hoy.getDate() - semanaAtras * 7);
  const inicio = new Date(fin);
  inicio.setDate(fin.getDate() - 7);
  return { inicio: formatearFecha(inicio), fin: formatearFecha(fin) };
}

async function obtenerPublicaciones(periodo, tipo) {
  const nombre = tipo === 'L' ? 'Licitaciones' : 'Adjudicaciones';
  try {
    console.log('  Consultando ' + nombre + ' del ' + periodo.inicio + ' al ' + periodo.fin + '...');
    const r = await clienteHttp.get(CONFIG.baseUrl + '/publicaciones', {
      params: { fecha_inicio: periodo.inicio, fecha_fin: periodo.fin, tipo: tipo },
    });
    const d = r.data;
    if (Array.isArray(d)) return d;
    if (d && d.publicaciones) return Array.isArray(d.publicaciones) ? d.publicaciones : [d.publicaciones];
    if (d && d.data) return d.data;
    if (d && typeof d === 'object') return [d];
    return [];
  } catch (err) {
    console.log('  Sin datos para ' + nombre + ': ' + err.message);
    return [];
  }
}

function normalizar(raw, tipo) {
  const get = function() {
    for (var i = 0; i < arguments.length; i++) {
      if (raw[arguments[i]] != null) return raw[arguments[i]];
    }
    return null;
  };
  return {
    id: get('id','nro_compra','numeroCompra'),
    tipo: tipo === 'L' ? 'licitacion' : 'adjudicacion',
    organismo: get('organismo','nombre_organismo','inciso') || 'Desconocido',
    objeto: get('objeto','descripcion','objeto_compra') || 'Sin descripcion',
    monto: { total: get('monto','monto_total','importe_total'), moneda: get('moneda') || 'UYU' },
    proveedor: get('proveedor','nombre_proveedor','razon_social') || null,
    fecha: get('fecha_publicacion','fecha','fecha_llamado') || null,
    estado: get('estado','resolucion') || null,
    _original: raw,
    _meta: { recolectado: new Date().toISOString(), fuente: 'comprasestatales.gub.uy' },
  };
}

function guardar(registros, periodo) {
  if (registros.length === 0) return null;
  const paquete = security.empaquetar({ periodo: periodo, total: registros.length, registros: registros });
  const fecha = new Date().toISOString().split('T')[0];
  const nombre = 'compras-' + periodo.inicio.replace(/\//g,'-') + '_' + fecha + '.json';
  const ruta = path.join(CONFIG.directorioSalida, nombre);
  fs.writeFileSync(ruta, JSON.stringify(paquete, null, 2), 'utf8');
  console.log('  Guardado: ' + nombre + ' (' + registros.length + ' registros)');
  return ruta;
}

async function ejecutar(semanas) {
  semanas = semanas || 4;
  crearDirectorio();
  const resumen = { licitaciones: 0, adjudicaciones: 0, total: 0, archivos: [] };

  for (let s = 0; s < semanas; s++) {
    const periodo = calcularPeriodo(s);
    console.log('\nSemana ' + (s+1) + '/' + semanas + ': ' + periodo.inicio + ' a ' + periodo.fin);
    const lics = await obtenerPublicaciones(periodo, 'L');
    const adjs = await obtenerPublicaciones(periodo, 'A');
    const todos = lics.map(function(r){ return normalizar(r,'L'); }).concat(adjs.map(function(r){ return normalizar(r,'A'); }));
    const archivo = guardar(todos, periodo);
    if (archivo) resumen.archivos.push(archivo);
    resumen.licitaciones += lics.length;
    resumen.adjudicaciones += adjs.length;
    resumen.total += todos.length;
    if (s < semanas - 1) await pausa(CONFIG.pausa);
  }
  return resumen;
}

module.exports = { ejecutar: ejecutar };

if (require.main === module) {
  try { security.validateSecurityConfig(); } catch(e) { console.error(e.message); process.exit(1); }
  const semanas = parseInt(process.argv[2]) || 4;
  console.log('\nSoberania Digital - Compras del Estado');
  console.log('Ultimas ' + semanas + ' semanas\n');
  ejecutar(semanas).then(function(r) {
    console.log('\n-- Resumen --');
    console.log('Licitaciones:   ' + r.licitaciones);
    console.log('Adjudicaciones: ' + r.adjudicaciones);
    console.log('Total:          ' + r.total);
    console.log('Archivos:       ' + r.archivos.length);
    if (r.total === 0) console.log('\nSin datos - la API puede requerir autenticacion.');
  }).catch(function(e) { console.error('Error:', e.message); process.exit(1); });
}
