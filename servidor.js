'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4000;
const CONTRATOS_FILE = './datos/normalizado/contratos-2024.json';
const INTENDENCIAS_FILE = './datos/intendencias/resumen-intendencias-2024.json';
const BALANCE_FILE = './datos/balance/gasto-por-ministerio-2024.json';

let contratos = [];
let resumenIntendencias = [];
let balance = [];

function cargarDatos() {
  console.log('Cargando datos...');
  contratos = JSON.parse(fs.readFileSync(CONTRATOS_FILE,'utf8')).contratos || [];
  resumenIntendencias = JSON.parse(fs.readFileSync(INTENDENCIAS_FILE,'utf8')).intendencias || [];
  balance = JSON.parse(fs.readFileSync(BALANCE_FILE,'utf8')).ministerios || [];
  console.log('Cargados: ' + contratos.length + ' contratos');
}

function buscar(termino, max) {
  max = max || 100;
  if (!termino || termino.length < 2) return [];
  const t = termino.toUpperCase().trim();
  return contratos.filter(function(c) {
    return (c.organismo && c.organismo.includes(t)) ||
           (c.proveedor && c.proveedor.includes(t)) ||
           (c.objeto && c.objeto.includes(t));
  }).slice(0, max);
}

function css() {
  return '<style>' +
    '*{box-sizing:border-box}' +
    'body{font-family:Arial,sans-serif;margin:0;background:#0a0a0a;color:#e0e0e0}' +
    'header{background:#1a1a2e;padding:16px 32px;border-bottom:2px solid #00ff88;display:flex;align-items:center;gap:16px}' +
    'h1{margin:0;color:#00ff88;font-size:20px}' +
    'nav{display:flex;gap:4px;padding:8px 32px;background:#111;border-bottom:1px solid #222;flex-wrap:wrap}' +
    'nav a{color:#aaa;text-decoration:none;font-size:13px;padding:6px 14px;border-radius:4px}' +
    'nav a:hover,nav a.on{background:#1a1a2e;color:#00ff88}' +
    '.wrap{padding:24px 32px}' +
    'h2{color:#fff;margin:0 0 16px}' +
    'h3{color:#00ff88;margin:0 0 8px;font-size:15px}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-bottom:24px}' +
    '.card{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:6px;padding:16px}' +
    '.card .num{font-size:22px;font-weight:bold;color:#fff;margin:8px 0}' +
    '.card .sub{color:#888;font-size:12px}' +
    '.card a{display:inline-block;margin-top:10px;color:#00ff88;font-size:13px;text-decoration:none}' +
    'form{display:flex;gap:8px;max-width:600px;margin-bottom:16px}' +
    'input{flex:1;padding:10px 14px;font-size:15px;background:#1a1a1a;border:1px solid #333;color:#fff;border-radius:4px}' +
    'button{padding:10px 20px;background:#00ff88;color:#000;border:none;font-size:14px;font-weight:bold;border-radius:4px;cursor:pointer}' +
    '.info{background:#1a1a2e;border:1px solid #333;padding:12px 16px;border-radius:4px;margin-bottom:16px;font-size:13px}' +
    '.info span{color:#00ff88;font-weight:bold}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}' +
    'th{background:#1a1a2e;color:#00ff88;padding:8px 10px;text-align:left;border-bottom:1px solid #333;white-space:nowrap}' +
    'td{padding:7px 10px;border-bottom:1px solid #151515;vertical-align:top}' +
    'td.monto{text-align:right;white-space:nowrap;color:#7fff7f}' +
    'tr:hover td{background:#111}' +
    'tr.clickable{cursor:pointer}' +
    '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold}' +
    '.badge.licit{background:#1a3a1a;color:#00ff88}' +
    '.badge.directa{background:#3a2a1a;color:#ffaa00}' +
    '.ficha{background:#1a1a2e;border:1px solid #333;border-radius:6px;padding:20px;max-width:800px}' +
    '.ficha .fila{display:flex;gap:16px;margin-bottom:10px;font-size:13px}' +
    '.ficha .etiq{color:#888;min-width:140px}' +
    '.ficha .val{color:#fff}' +
    '.ficha .monto-grande{font-size:28px;font-weight:bold;color:#00ff88;margin:12px 0}' +
    '.back{display:inline-block;margin-bottom:16px;color:#00ff88;text-decoration:none;font-size:13px}' +
    '.vacio{color:#555;font-style:italic;padding:16px 0}' +
    'footer{padding:16px 32px;color:#333;font-size:11px;border-top:1px solid #111;margin-top:32px}' +
    '.alerta{background:#3a1a1a;border:1px solid #ff4444;border-radius:4px;padding:8px 12px;font-size:12px;color:#ff8888;margin-bottom:8px}' +
    '</style>';
}

function nav(activa) {
  return '<nav>' +
    '<a href="/" class="'+(activa==='inicio'?'on':'')+'">Inicio</a>' +
    '<a href="/nacional" class="'+(activa==='nacional'?'on':'')+'">Nacional</a>' +
    '<a href="/departamental" class="'+(activa==='dep'?'on':'')+'">Departamental</a>' +
    '<a href="/balance" class="'+(activa==='balance'?'on':'')+'">Balance</a>' +
    '<a href="/buscar" class="'+(activa==='buscar'?'on':'')+'">Buscar</a>' +
    '</nav>';
}

function layout(titulo, activa, contenido) {
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+titulo+' — Soberanía Digital</title>'+css()+'</head><body>' +
    '<header><h1>🇺🇾 Soberanía Digital</h1><span style="color:#666;font-size:12px">Transparencia del Estado Uruguayo 2024</span></header>' +
    nav(activa) +
    '<div class="wrap">' + contenido + '</div>' +
    '<footer>Datos: ARCE, OPP, catalogodatos.gub.uy — 2024 — Soberanía Digital</footer>' +
    '</body></html>';
}

function fichaContrato(id) {
  const c = contratos.find(function(x){ return x.id === id; });
  if (!c) return null;
  const alerta = c.monto && c.monto > 10000000 ?
    '<div class="alerta">⚠️ Contrato de alto valor — UYU '+Math.round(c.monto).toLocaleString('es-UY')+'</div>' : '';
  const html =
    '<a class="back" href="javascript:history.back()">← Volver</a>' +
    alerta +
    '<div class="ficha">' +
    '<h2 style="color:#fff;margin:0 0 4px">' + (c.objeto||'Sin descripción') + '</h2>' +
    '<div class="monto-grande">' + (c.monto ? 'UYU '+Math.round(c.monto).toLocaleString('es-UY') : 'Monto no registrado') + '</div>' +
    '<div class="fila"><span class="etiq">Organismo</span><span class="val">'+(c.organismo||'?')+'</span></div>' +
    '<div class="fila"><span class="etiq">Proveedor</span><span class="val">'+(c.proveedor||'No adjudicado')+'</span></div>' +
    '<div class="fila"><span class="etiq">Fecha</span><span class="val">'+(c.fecha||'?').substring(0,10)+'</span></div>' +
    '<div class="fila"><span class="etiq">Moneda</span><span class="val">'+(c.moneda||'UYU')+'</span></div>' +
    '<div class="fila"><span class="etiq">Mes</span><span class="val">'+(c.mes||'?')+'/2024</span></div>' +
    '<div class="fila"><span class="etiq">ID</span><span class="val" style="font-size:11px;color:#555">'+(c.id||'?')+'</span></div>' +
    '</div>' +
    '<h3 style="margin-top:24px;color:#fff">Otros contratos del mismo proveedor</h3>' +
    (c.proveedor ? tablaContratos(contratos.filter(function(x){ return x.proveedor===c.proveedor && x.id!==c.id; }).slice(0,10), false) : '<p class="vacio">Sin datos</p>');
  return layout('Contrato', 'buscar', html);
}

function tablaContratos(lista, conLink) {
  if (lista.length === 0) return '<p class="vacio">Sin resultados.</p>';
  conLink = conLink !== false;
  return '<table><thead><tr><th>Fecha</th><th>Organismo</th><th>Objeto</th><th>Proveedor</th><th>Monto</th></tr></thead><tbody>' +
    lista.map(function(c) {
      const fila = '<td>'+(c.fecha||'').substring(0,10)+'</td>' +
        '<td>'+(c.organismo||'?')+'</td>' +
        '<td>'+(c.objeto||'?')+'</td>' +
        '<td>'+(c.proveedor||'?')+'</td>' +
        '<td class="monto">'+(c.monto?'UYU '+Math.round(c.monto).toLocaleString('es-UY'):'-')+'</td>';
      return conLink && c.id ?
        '<tr class="clickable" onclick="location=\'/contrato/'+encodeURIComponent(c.id)+'\'">'+fila+'</tr>' :
        '<tr>'+fila+'</tr>';
    }).join('') +
    '</tbody></table>';
}

function paginaInicio() {
  const total = contratos.length;
  const monto = contratos.reduce(function(s,c){return s+(c.monto||0);},0);
  return layout('Inicio','inicio',
    '<h2>Transparencia del Estado Uruguayo</h2>' +
    '<div class="grid">' +
    '<div class="card"><h3>Contratos 2024</h3><div class="num">'+total.toLocaleString('es-UY')+'</div><div class="sub">Registros con detalle completo</div><a href="/buscar">Buscar contratos →</a></div>' +
    '<div class="card"><h3>Gasto en contratos</h3><div class="num">UYU '+Math.round(monto/1000000).toLocaleString('es-UY')+' M</div><div class="sub">Total adjudicado 2024</div><a href="/balance">Ver balance →</a></div>' +
    '<div class="card"><h3>Departamentos</h3><div class="num">'+resumenIntendencias.length+'</div><div class="sub">Intendencias con datos</div><a href="/departamental">Ver intendencias →</a></div>' +
    '</div>'
  );
}

function paginaBuscar(q) {
  const resultados = q ? buscar(q) : [];
  const monto = resultados.reduce(function(s,c){return s+(c.monto||0);},0);
  return layout('Buscar','buscar',
    '<h2>Buscar contratos</h2>' +
    '<form method="get" action="/buscar"><input name="q" value="'+(q||'')+'" placeholder="Organismo, proveedor u objeto..." autofocus><button>Buscar</button></form>' +
    (q ? '<div class="info">'+resultados.length+' resultados para <span>"'+q+'"</span>'+(monto>0?' — Total: <span>UYU '+Math.round(monto).toLocaleString('es-UY')+'</span>':'')+' — Hacé clic en una fila para ver el detalle</div>' : '') +
    tablaContratos(resultados, true)
  );
}

function paginaNacional(q) {
  const resultados = q ? buscar(q) : [];
  const monto = resultados.reduce(function(s,c){return s+(c.monto||0);},0);
  return layout('Nacional','nacional',
    '<h2>Gobierno Nacional</h2>' +
    '<form method="get" action="/nacional"><input name="q" value="'+(q||'')+'" placeholder="Buscar organismo, proveedor..." autofocus><button>Buscar</button></form>' +
    (q ? '<div class="info">'+resultados.length+' resultados — Total: <span>UYU '+Math.round(monto).toLocaleString('es-UY')+'</span> — Hacé clic para ver detalle</div>' : '') +
    tablaContratos(resultados, true)
  );
}

function paginaBalance() {
  const filas = balance.map(function(b) {
    return '<tr><td>'+b.nombre+'</td><td class="monto">'+b.contratos.toLocaleString('es-UY')+'</td><td class="monto">UYU '+Math.round(b.monto).toLocaleString('es-UY')+'</td><td><a href="/buscar?q='+encodeURIComponent(b.nombre.split(' ').slice(-2).join(' '))+'">Ver contratos</a></td></tr>';
  }).join('');
  return layout('Balance','balance',
    '<h2>Balance de Gasto por Organismo 2024</h2>' +
    '<div class="info">Gasto registrado en contratos públicos adjudicados. Hacé clic en "Ver contratos" para ver el detalle de cada organismo.</div>' +
    '<table><thead><tr><th>Organismo</th><th>Contratos</th><th>Monto total</th><th></th></tr></thead><tbody>'+filas+'</tbody></table>'
  );
}

function paginaDep() {
  const cards = resumenIntendencias.sort(function(a,b){return b.monto_total_uyu-a.monto_total_uyu;}).map(function(i) {
    return '<div class="card"><h3>'+i.nombre+'</h3>' +
      '<div class="num">UYU '+Math.round(i.monto_total_uyu/1000000).toLocaleString('es-UY')+' M</div>' +
      '<div class="sub">'+i.total_contratos.toLocaleString('es-UY')+' contratos · '+i.proveedores_unicos+' proveedores</div>' +
      (i.top_proveedor?'<div class="sub" style="margin-top:4px">Top: '+i.top_proveedor.nombre+'</div>':'') +
      '<a href="/departamental/'+encodeURIComponent(i.nombre)+'">Ver detalle →</a></div>';
  }).join('');
  return layout('Departamental','dep','<h2>Gobiernos Departamentales</h2><div class="grid">'+cards+'</div>');
}

function paginaIntendencia(nombre) {
  const archivo = './datos/intendencias/'+nombre.replace(/\s+/g,'-').toLowerCase()+'.json';
  if (!fs.existsSync(archivo)) return null;
  const data = JSON.parse(fs.readFileSync(archivo,'utf8'));
  const stats = data.stats;
  const contratosIntend = data.contratos || [];
  const filasProv = (stats.top_proveedores||[]).slice(0,15).map(function(p){
    return '<tr class="clickable" onclick="location=\'/buscar?q='+encodeURIComponent(p.nombre)+'\'"><td>'+p.nombre+'</td><td class="monto">'+p.contratos+'</td></tr>';
  }).join('');
  return layout(nombre,'dep',
    '<a class="back" href="/departamental">← Departamentos</a>' +
    '<h2>'+nombre+'</h2>' +
    '<div class="grid">' +
    '<div class="card"><h3>Contratos 2024</h3><div class="num">'+stats.total_contratos.toLocaleString('es-UY')+'</div></div>' +
    '<div class="card"><h3>Monto Total</h3><div class="num">UYU '+Math.round(stats.monto_total_uyu).toLocaleString('es-UY')+'</div></div>' +
    '<div class="card"><h3>Proveedores únicos</h3><div class="num">'+stats.proveedores_unicos+'</div></div>' +
    '</div>' +
    '<h3 style="color:#fff;margin:24px 0 12px">Top proveedores — clic para ver sus contratos</h3>' +
    '<table><thead><tr><th>Proveedor</th><th>Contratos</th></tr></thead><tbody>'+filasProv+'</tbody></table>' +
    '<h3 style="color:#fff;margin:24px 0 12px">Últimos contratos</h3>' +
    tablaContratos(contratosIntend.slice(0,20), true)
  );
}

const server = http.createServer(function(req, res) {
  const url = new URL(req.url,'http://localhost');
  const p = url.pathname;
  res.setHeader('Content-Type','text/html; charset=utf-8');

  if (p === '/') { res.writeHead(200); res.end(paginaInicio()); }
  else if (p === '/buscar') { res.writeHead(200); res.end(paginaBuscar(url.searchParams.get('q')||'')); }
  else if (p === '/nacional') { res.writeHead(200); res.end(paginaNacional(url.searchParams.get('q')||'')); }
  else if (p === '/balance') { res.writeHead(200); res.end(paginaBalance()); }
  else if (p === '/departamental') { res.writeHead(200); res.end(paginaDep()); }
  else if (p.startsWith('/departamental/')) {
    const nombre = decodeURIComponent(p.replace('/departamental/','')).toUpperCase();
    const pag = paginaIntendencia(nombre);
    if (pag) { res.writeHead(200); res.end(pag); } else { res.writeHead(404); res.end('No encontrado'); }
  }
  else if (p.startsWith('/contrato/')) {
    const id = decodeURIComponent(p.replace('/contrato/',''));
    const pag = fichaContrato(id);
    if (pag) { res.writeHead(200); res.end(pag); } else { res.writeHead(404); res.end('Contrato no encontrado'); }
  }
  else { res.writeHead(302,{Location:'/'}); res.end(); }
});

cargarDatos();
server.listen(PORT, function(){ console.log('\nSoberania Digital: http://localhost:'+PORT+'\n'); });
