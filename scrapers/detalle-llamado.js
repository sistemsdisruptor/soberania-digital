'use strict';
const https = require('https');
const { parse } = require('node-html-parser');

function fetchDetalle(idLlamado) {
  return new Promise(function(resolve, reject) {
    const url = 'https://www.comprasestatales.gub.uy/consultas/detalle/mostrar-llamado/1/id/' + idLlamado;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function(r) {
      let d = '';
      r.on('data', function(c) { d += c; });
      r.on('end', function() {
        try {
          const root = parse(d);
          const content = root.querySelector('#content');
          if (!content) return resolve(null);

          const texto = content.text.replace(/\s+/g,' ').trim();
          const resultado = { url: url };

          // Título del llamado
          const h2 = content.querySelector('h2');
          resultado.titulo = h2 ? h2.text.replace(/\s+/g,' ').trim() : null;

          // Objeto
          const buyObj = content.querySelector('.buy-object p') || content.querySelector('.col-md-8 p');
          resultado.objeto_detalle = buyObj ? buyObj.text.trim() : null;

          // Extraer campos clave del texto
          function extraer(patron) {
            const m = texto.match(new RegExp(patron + ':?\\s*([^\\n]{3,80})'));
            return m ? m[1].trim() : null;
          }

          resultado.recepcion_ofertas = extraer('Recepci[oó]n de ofertas hasta');
          resultado.fecha_publicacion = extraer('Fecha Publicaci[oó]n');
          resultado.lugar_entrega = extraer('Lugar de entrega de ofertas');
          resultado.contacto = extraer('Informaci[oó]n de contacto');
          resultado.email = extraer('Apertura[^\\s]*');

          // Archivos adjuntos
          const links = [];
          content.querySelectorAll('a[href]').forEach(function(a) {
            const href = a.getAttribute('href');
            if (href && (href.includes('.pdf') || href.includes('.zip') || href.includes('.7z') || href.includes('pliego') || href.includes('adjunto'))) {
              links.push({ texto: a.text.trim(), url: href.startsWith('http') ? href : 'https://www.comprasestatales.gub.uy' + href });
            }
          });
          resultado.archivos = links;

          // Oferentes / tabla
          const filas = [];
          content.querySelectorAll('table tbody tr').forEach(function(tr) {
            const celdas = tr.querySelectorAll('td').map(function(td){ return td.text.trim(); });
            if (celdas.some(function(c){ return c.length > 1; })) filas.push(celdas);
          });
          if (filas.length > 0) resultado.oferentes = filas;

          resolve(resultado);
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

module.exports = { fetchDetalle };

// Test directo
if (require.main === module) {
  const id = process.argv[2] || 'i412806';
  console.log('Consultando ID:', id);
  fetchDetalle(id).then(function(d) {
    console.log(JSON.stringify(d, null, 2));
  }).catch(function(e){ console.log('Error:', e.message); });
}
