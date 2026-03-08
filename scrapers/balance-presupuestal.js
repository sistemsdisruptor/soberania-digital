const fs = require('fs');
const contenido = fs.readFileSync('./datos/ingresos/credito-presupuestal-resumen.csv','latin1');
const lineas = contenido.split('\n');
const organismos = {};
let procesadas = 0;
lineas.slice(1).forEach(function(linea) {
  if (linea.indexOf('"2024"') !== 0) return;
  const cols = linea.match(/"([^"]*)"/g);
  if (!cols || cols.length < 12) return;
  const org = cols[1].replace(/"/g,'');
  const apertura  = parseFloat((cols[10]||'""').replace(/"/g,'').replace(/\./g,'').replace(',','.')) || 0;
  const ejecutado = parseFloat((cols[12]||'""').replace(/"/g,'').replace(/\./g,'').replace(',','.')) || 0;
  if (!organismos[org]) organismos[org] = { apertura: 0, ejecutado: 0 };
  organismos[org].apertura  += apertura;
  organismos[org].ejecutado += ejecutado;
  procesadas++;
});
console.log('Filas procesadas: ' + procesadas);
console.log('\nBALANCE PRESUPUESTAL 2024\n');
Object.entries(organismos)
  .sort(function(a,b){ return b[1].ejecutado - a[1].ejecutado; })
  .slice(0,15)
  .forEach(function(e) {
    const diff = e[1].ejecutado - e[1].apertura;
    const pct = e[1].apertura > 0 ? Math.round(e[1].ejecutado / e[1].apertura * 100) : 0;
    console.log(e[0]);
    console.log('  Asignado:   UYU ' + Math.round(e[1].apertura).toLocaleString('es-UY'));
    console.log('  Ejecutado:  UYU ' + Math.round(e[1].ejecutado).toLocaleString('es-UY') + ' (' + pct + '%)');
    console.log('  Diferencia: ' + (diff >= 0 ? '+' : '') + Math.round(diff).toLocaleString('es-UY'));
    console.log('');
  });
