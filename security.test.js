/**
 * ============================================================
 * SOBERANÍA DIGITAL — Tests del Módulo de Seguridad
 * Archivo: tests/security.test.js
 * ============================================================
 *
 * Estos tests verifican automáticamente que la seguridad funciona.
 * Correr con: node tests/security.test.js
 *
 * Principio: si estos tests fallan, el sistema no arranca.
 * Mejor detectar un fallo de seguridad en tests que en producción.
 * ============================================================
 */

'use strict';

// Configuramos variables de entorno para tests
process.env.NODE_ENV    = 'test';
process.env.SIGNING_KEY    = 'clave-de-test-32-caracteres-minimo-aqui';
process.env.ENCRYPTION_KEY = 'clave-cifrado-test-32-caracteres-ok-';
process.env.LOG_LEVEL      = 'error'; // Silenciar logs durante tests

const security = require('../security/core');

// ── UTILIDAD DE TESTS ────────────────────────────────────────────────────────

let pasados = 0;
let fallidos = 0;

function test(nombre, fn) {
  try {
    fn();
    console.log(`  ✓ ${nombre}`);
    pasados++;
  } catch (err) {
    console.error(`  ✗ ${nombre}`);
    console.error(`    Error: ${err.message}`);
    fallidos++;
  }
}

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje || 'Aserción falló');
}

function assertEqual(a, b, mensaje) {
  if (a !== b) throw new Error(mensaje || `Esperado: ${b}, Recibido: ${a}`);
}

// ── SUITE DE TESTS ───────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════');
console.log('  SOBERANÍA DIGITAL — Tests de Seguridad');
console.log('══════════════════════════════════════════════\n');

// ── Hash ─────────────────────────────────────────────────────────────────────
console.log('[ Hash SHA-256 ]');

test('Hash de string produce 64 caracteres hexadecimales', () => {
  const resultado = security.hash('test');
  assertEqual(resultado.length, 64, 'El hash debe tener 64 caracteres');
  assert(/^[a-f0-9]+$/.test(resultado), 'El hash debe ser hexadecimal');
});

test('El mismo input produce siempre el mismo hash', () => {
  const h1 = security.hash('dato-consistente');
  const h2 = security.hash('dato-consistente');
  assertEqual(h1, h2, 'Hashes del mismo input deben ser iguales');
});

test('Un cambio mínimo produce un hash completamente diferente', () => {
  const h1 = security.hash('texto original');
  const h2 = security.hash('texto Original'); // Solo cambió la O
  assert(h1 !== h2, 'Hashes de inputs distintos deben ser distintos');
});

test('Hash de objeto funciona igual que hash de su JSON', () => {
  const obj = { nombre: 'test', valor: 42 };
  const h1  = security.hash(obj);
  const h2  = security.hash(JSON.stringify(obj));
  assertEqual(h1, h2, 'Hash de objeto debe coincidir con hash de su JSON');
});

// ── Firma ─────────────────────────────────────────────────────────────────────
console.log('\n[ Firma Digital HMAC-SHA256 ]');

test('Firmar produce un string hexadecimal', () => {
  const firma = security.firmar('dato');
  assert(typeof firma === 'string', 'La firma debe ser un string');
  assert(/^[a-f0-9]+$/.test(firma), 'La firma debe ser hexadecimal');
});

test('verificarFirma devuelve true para datos y firma válidos', () => {
  const datos = { mensaje: 'hola', valor: 123 };
  const firma = security.firmar(datos);
  assert(security.verificarFirma(datos, firma), 'La verificación debe ser exitosa');
});

test('verificarFirma detecta datos alterados', () => {
  const datosOriginales = { mensaje: 'original' };
  const firma           = security.firmar(datosOriginales);
  const datosAlterados  = { mensaje: 'ALTERADO' };
  assert(!security.verificarFirma(datosAlterados, firma), 'Debe detectar alteración');
});

test('verificarFirma detecta firma falsa', () => {
  const datos       = { mensaje: 'real' };
  const firmaFalsa  = 'a'.repeat(64);
  assert(!security.verificarFirma(datos, firmaFalsa), 'Debe rechazar firma falsa');
});

test('verificarFirma maneja firmas de longitud incorrecta', () => {
  const datos = { mensaje: 'test' };
  assert(!security.verificarFirma(datos, 'corta'), 'Debe rechazar firma de longitud incorrecta');
});

// ── Cifrado ───────────────────────────────────────────────────────────────────
console.log('\n[ Cifrado AES-256-GCM ]');

test('Cifrar y descifrar devuelve el texto original', () => {
  const original  = 'Texto confidencial de ciudadano uruguayo';
  const cifrado   = security.cifrar(original);
  const descifrado = security.descifrar(cifrado);
  assertEqual(descifrado, original, 'El texto descifrado debe ser igual al original');
});

test('El mismo texto cifrado dos veces produce resultados diferentes', () => {
  const texto  = 'mismo texto';
  const cifr1  = security.cifrar(texto);
  const cifr2  = security.cifrar(texto);
  assert(cifr1 !== cifr2, 'Cifrados del mismo texto deben ser distintos (IV aleatorio)');
});

test('El texto cifrado tiene formato válido (iv:contenido:tag)', () => {
  const cifrado = security.cifrar('test');
  const partes  = cifrado.split(':');
  assertEqual(partes.length, 3, 'El cifrado debe tener 3 partes separadas por ":"');
});

test('descifrar lanza error con datos corruptos', () => {
  let errorDetectado = false;
  try {
    security.descifrar('datos:corruptos:invalidos');
  } catch {
    errorDetectado = true;
  }
  assert(errorDetectado, 'Debe detectar datos cifrados corruptos');
});

test('Cifrado funciona con strings largos y caracteres especiales', () => {
  const textoLargo = 'Ñoño texto español con tildes: á é í ó ú ü ¿¡ — "comillas" ' + 'x'.repeat(1000);
  const cifrado    = security.cifrar(textoLargo);
  const resultado  = security.descifrar(cifrado);
  assertEqual(resultado, textoLargo, 'Debe manejar texto largo con caracteres especiales');
});

// ── Generación de IDs ─────────────────────────────────────────────────────────
console.log('\n[ Generación de IDs Seguros ]');

test('generarId produce strings únicos', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(security.generarId());
  assertEqual(ids.size, 1000, 'Deben generarse 1000 IDs únicos sin colisiones');
});

test('generarId respeta el tamaño especificado', () => {
  const id8  = security.generarId(8);   // 8 bytes = 16 hex chars
  const id16 = security.generarId(16);  // 16 bytes = 32 hex chars
  assertEqual(id8.length,  16, 'ID de 8 bytes debe tener 16 caracteres hex');
  assertEqual(id16.length, 32, 'ID de 16 bytes debe tener 32 caracteres hex');
});

// ── Empaquetado ───────────────────────────────────────────────────────────────
console.log('\n[ Empaquetado y Verificación ]');

test('empaquetar agrega id, timestamp, hash y firma', () => {
  const paquete = security.empaquetar({ dato: 'test' });
  assert(paquete.id,        'Debe tener id');
  assert(paquete.timestamp, 'Debe tener timestamp');
  assert(paquete.hash,      'Debe tener hash');
  assert(paquete.firma,     'Debe tener firma');
  assert(paquete.datos,     'Debe tener los datos originales');
});

test('verificarPaquete valida un paquete legítimo', () => {
  const paquete    = security.empaquetar({ mensaje: 'ciudadano' });
  const resultado  = security.verificarPaquete(paquete);
  assert(resultado.valido, `El paquete debería ser válido: ${resultado.razon}`);
});

test('verificarPaquete detecta paquete alterado', () => {
  const paquete          = security.empaquetar({ mensaje: 'original' });
  paquete.datos.mensaje  = 'ALTERADO'; // Simulamos una alteración
  const resultado        = security.verificarPaquete(paquete);
  assert(!resultado.valido, 'Debe detectar el paquete alterado');
});

test('verificarPaquete maneja paquetes incompletos', () => {
  const resultado = security.verificarPaquete({ solo: 'datos', sin: 'firma' });
  assert(!resultado.valido, 'Debe rechazar paquetes sin firma');
});

// ── RESUMEN ──────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log(`  Resultados: ${pasados} pasados, ${fallidos} fallidos`);
console.log('══════════════════════════════════════════════\n');

if (fallidos > 0) {
  console.error(`⚠  ${fallidos} test(s) fallaron. Revisar antes de continuar.\n`);
  process.exit(1);
} else {
  console.log('✓  Todos los tests de seguridad pasaron.\n');
  process.exit(0);
}
