const fs = require('fs');

const MAPA = {
  'Ministerio de Salud Pública': ['SALUD','HOSPITAL','CENTRO HOSPITALARIO','CENTRO AUXILIAR','CENTRO DEPARTAMENTAL','RED DE ATENCIÓN PRIMARIA','REHABILITACIÓN MÉDICO'],
  'Ministerio de Defensa Nacional': ['ARMADA','EJÉRCITO','FUERZA AÉREA','COMANDO','DEFENSA'],
  'Ministerio de Educación y Cultura': ['EDUCACIÓN','CONSEJO DE EDUCACIÓN','ANEP','UDELAR','UNIVERSIDAD'],
  'Ministerio de Transporte y Obras Públicas': ['TRANSPORTE','OBRAS PÚBLICAS','ARQUITECTURA','VIALIDAD','PUERTOS'],
  'Ministerio de Economía y Finanzas': ['ECONOMÍA','FINANZAS','DGI','ADUANAS','DNA'],
  'Ministerio del Interior': ['INTERIOR','POLICÍA','DIRECCIÓN NACIONAL DE MIGRACIÓN'],
  'Ministerio de Ganadería, Agricultura y Pesca': ['GANADERÍA','AGRICULTURA','PESCA','SERVICIOS GANADEROS','DGSG'],
  'Administración Nacional de Usinas y Trasmisiones Eléctricas': ['USINAS','UTE'],
  'Administración Nacional de Combustible, Alcohol y Portland': ['COMBUSTIBLE','ANCAP'],
  'Administración Nacional de Correos': ['CORREOS'],
  'Banco de la República Oriental del Uruguay': ['REPÚBLICA DEL URUGUAY'],
  'Banco de Seguros del Estado': ['SEGUROS DEL ESTADO'],
  'Banco de Previsión Social': ['PREVISIÓN SOCIAL','BPS'],
  'Administración de las Obras Sanitarias del Estado': ['SANITARIAS','OSE'],
};

const contratos = JSON.parse(fs.readFileSync('./datos/normalizado/contratos-2024.json','utf8')).contratos || [];

function agrupar(nombreOrg) {
  if (!nombreOrg) return 'OTROS';
  for (const ministerio in MAPA) {
    const palabras = MAPA[ministerio];
    for (const p of palabras) {
      if (nombreOrg.includes(p)) return ministerio;
    }
  }
  return nombreOrg;
}

const porMinisterio = {};
contratos.forEach(function(c) {
  const grupo = agrupar(c.organismo);
  if (!porMinisterio[grupo]) porMinisterio[grupo] = { monto: 0, cantidad: 0 };
  porMinisterio[grupo].monto    += c.monto || 0;
  porMinisterio[grupo].cantidad += 1;
});

console.log('\nGASTO EN CONTRATOS POR MINISTERIO 2024\n');
Object.entries(porMinisterio)
  .sort(function(a,b){ return b[1].monto - a[1].monto; })
  .slice(0,20)
  .forEach(function(e) {
    console.log(e[0]);
    console.log('  Contratos: ' + e[1].cantidad.toLocaleString('es-UY'));
    console.log('  Monto:     UYU ' + Math.round(e[1].monto).toLocaleString('es-UY'));
    console.log('');
  });

fs.mkdirSync('./datos/balance', { recursive: true });
fs.writeFileSync('./datos/balance/gasto-por-ministerio-2024.json', JSON.stringify({ año: 2024, generado: new Date().toISOString(), ministerios: Object.entries(porMinisterio).map(function(e){ return { nombre: e[0], monto: Math.round(e[1].monto), contratos: e[1].cantidad }; }).sort(function(a,b){return b.monto-a.monto;}) }, null, 2));
console.log('Guardado: datos/balance/gasto-por-ministerio-2024.json');
