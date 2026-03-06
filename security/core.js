/**
 * ============================================================
 * SOBERANÍA DIGITAL — Módulo de Seguridad Central
 * Archivo: security/core.js
 * ============================================================
 *
 * Este módulo es la base de toda la seguridad del sistema.
 * Todo el resto del código lo usa. Si este falla, nada funciona.
 *
 * Qué hace este archivo:
 * 1. Firma digital — garantiza que los datos no fueron alterados
 * 2. Cifrado/descifrado — protege datos sensibles
 * 3. Hash — huella digital única de cada pieza de información
 * 4. Generación de IDs seguros — identificadores imposibles de predecir
 *
 * Principio: usamos algoritmos probados por la industria mundial.
 * No inventamos nada propio. Los mejores algoritmos ya existen.
 * ============================================================
 */

'use strict';

const crypto = require('crypto');
require('dotenv').config();

// ── CONSTANTES ──────────────────────────────────────────────────────────────

// Algoritmo de cifrado: AES-256-GCM
// Por qué: es el estándar que usa la NSA para documentos Top Secret.
// GCM (Galois/Counter Mode) además verifica que los datos no fueron alterados.
const CIPHER_ALGORITHM = 'aes-256-gcm';

// Algoritmo de hash: SHA-256
// Por qué: el mismo que usa Bitcoin para garantizar integridad de bloques.
// Una mínima alteración en los datos produce un hash completamente diferente.
const HASH_ALGORITHM   = 'sha256';

// Tamaño del vector de inicialización para AES-GCM
// Siempre debe ser aleatorio y único por operación de cifrado
const IV_LENGTH        = 16;

// ── VALIDACIÓN DE CONFIGURACIÓN ─────────────────────────────────────────────

/**
 * Verifica que las claves necesarias existen antes de arrancar.
 * Si no están configuradas, el sistema no arranca. Mejor fallar
 * temprano que operar sin seguridad.
 */
function validateSecurityConfig() {
  const required = ['SIGNING_KEY', 'ENCRYPTION_KEY'];
  const missing  = required.filter(key => !process.env[key] ||
    process.env[key].startsWith('REEMPLAZAR'));

  if (missing.length > 0) {
    throw new Error(
      `[SEGURIDAD] Faltan claves requeridas: ${missing.join(', ')}\n` +
      `Copiá .env.example como .env y completá los valores.`
    );
  }
}

// ── FIRMA DIGITAL ───────────────────────────────────────────────────────────

/**
 * firmar(datos) — Crea una firma digital de los datos
 *
 * Qué es una firma digital en términos simples:
 * Es como un sello de cera en una carta antigua. Si alguien
 * abre la carta y la vuelve a cerrar, el sello está roto.
 * Aquí el "sello" es matemático: si alguien cambia un solo
 * carácter de los datos, la firma no coincide más.
 *
 * @param {Object|string} datos - Lo que queremos firmar
 * @returns {string} La firma en formato hexadecimal
 */
function firmar(datos) {
  const contenido = typeof datos === 'string' ? datos : JSON.stringify(datos);
  return crypto
    .createHmac(HASH_ALGORITHM, process.env.SIGNING_KEY)
    .update(contenido)
    .digest('hex');
}

/**
 * verificarFirma(datos, firma) — Verifica si una firma es válida
 *
 * Importante: usa comparación de tiempo constante (timingSafeEqual).
 * Por qué importa: una comparación normal termina más rápido cuando
 * encuentra la primera diferencia. Un atacante puede medir esos
 * microsegundos para adivinar la firma correcta. La comparación
 * de tiempo constante siempre tarda lo mismo, sin importar cuánto
 * coincidan los datos.
 *
 * @param {Object|string} datos - Los datos originales
 * @param {string} firma - La firma a verificar
 * @returns {boolean} true si la firma es válida
 */
function verificarFirma(datos, firma) {
  const firmaEsperada = firmar(datos);
  const bufA = Buffer.from(firmaEsperada, 'hex');
  const bufB = Buffer.from(firma,         'hex');

  // Si los buffers tienen distinto tamaño, la firma es inválida
  if (bufA.length !== bufB.length) return false;

  // Comparación en tiempo constante — resistente a ataques de timing
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── HASH ────────────────────────────────────────────────────────────────────

/**
 * hash(datos) — Genera la huella digital de cualquier dato
 *
 * Un hash es como la huella dactilar de los datos: única e irrepetible.
 * Si los datos cambian aunque sea un espacio, el hash cambia completamente.
 * Sirve para verificar integridad: "¿estos datos son exactamente los mismos
 * que vi antes?"
 *
 * @param {Object|string} datos
 * @returns {string} Hash SHA-256 en hexadecimal (64 caracteres)
 */
function hash(datos) {
  const contenido = typeof datos === 'string' ? datos : JSON.stringify(datos);
  return crypto
    .createHash(HASH_ALGORITHM)
    .update(contenido)
    .digest('hex');
}

// ── CIFRADO ─────────────────────────────────────────────────────────────────

/**
 * cifrar(texto) — Cifra texto plano para almacenamiento seguro
 *
 * Cómo funciona en términos simples:
 * - Generamos un número aleatorio único (IV) para esta operación
 * - Ciframos el texto con AES-256 usando ese número y nuestra clave
 * - El resultado incluye: el IV + el texto cifrado + una etiqueta de
 *   autenticación (que detecta si alguien intentó modificar el cifrado)
 *
 * Por qué el IV aleatorio: si cifráramos el mismo texto dos veces
 * con la misma clave fija, el resultado sería idéntico. Eso le permite
 * a un atacante detectar patrones. El IV aleatorio garantiza que el
 * mismo texto cifrado dos veces produce resultados completamente distintos.
 *
 * @param {string} texto - El texto a cifrar
 * @returns {string} Texto cifrado en formato "iv:contenido:tag" en base64
 */
function cifrar(texto) {
  // Generamos un IV único y aleatorio para esta operación
  const iv = crypto.randomBytes(IV_LENGTH);

  // Preparamos la clave: debe tener exactamente 32 bytes para AES-256
  const clave = crypto
    .createHash('sha256')
    .update(process.env.ENCRYPTION_KEY)
    .digest();

  // Creamos el cifrador
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, clave, iv);

  // Ciframos el texto
  let cifrado = cipher.update(texto, 'utf8', 'base64');
  cifrado    += cipher.final('base64');

  // La "etiqueta de autenticación" detecta modificaciones posteriores
  const tag = cipher.getAuthTag();

  // Empaquetamos todo junto para poder descifrarlo después
  return `${iv.toString('base64')}:${cifrado}:${tag.toString('base64')}`;
}

/**
 * descifrar(textoCifrado) — Descifra datos previamente cifrados
 *
 * Proceso inverso al cifrado. Si alguien modificó el texto cifrado
 * (aunque sea un bit), la verificación de la etiqueta de autenticación
 * falla y lanzamos un error. No hay datos corruptos silenciosos.
 *
 * @param {string} textoCifrado - En formato "iv:contenido:tag"
 * @returns {string} El texto original descifrado
 */
function descifrar(textoCifrado) {
  const partes = textoCifrado.split(':');
  if (partes.length !== 3) {
    throw new Error('[SEGURIDAD] Formato de datos cifrados inválido');
  }

  const [ivBase64, contenido, tagBase64] = partes;
  const iv    = Buffer.from(ivBase64,  'base64');
  const tag   = Buffer.from(tagBase64, 'base64');
  const clave = crypto
    .createHash('sha256')
    .update(process.env.ENCRYPTION_KEY)
    .digest();

  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, clave, iv);
  decipher.setAuthTag(tag);

  let descifrado  = decipher.update(contenido, 'base64', 'utf8');
  descifrado     += decipher.final('utf8');

  return descifrado;
}

// ── IDs SEGUROS ─────────────────────────────────────────────────────────────

/**
 * generarId() — Genera un identificador único criptográficamente seguro
 *
 * Por qué no usar Math.random(): Math.random() es predecible.
 * Un atacante puede adivinar los IDs generados si conoce el momento
 * en que fueron creados. crypto.randomBytes() usa fuentes de entropía
 * del sistema operativo — imposible de predecir.
 *
 * @param {number} bytes - Tamaño en bytes (por defecto 16 = 128 bits)
 * @returns {string} ID en formato hexadecimal
 */
function generarId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

// ── EMPAQUETADO SEGURO ──────────────────────────────────────────────────────

/**
 * empaquetar(datos) — Prepara cualquier dato para transmisión o almacenamiento seguro
 *
 * Combina todo: agrega timestamp, firma, hash e ID único.
 * Cualquier pieza de información que sale o entra al sistema
 * debe pasar por aquí.
 *
 * El resultado es un sobre digital que garantiza:
 * - Integridad: los datos no fueron modificados (firma + hash)
 * - Temporalidad: cuándo exactamente fue creado (timestamp)
 * - Trazabilidad: identificador único para seguimiento (id)
 *
 * @param {Object} datos - Los datos a empaquetar
 * @returns {Object} El paquete firmado y listo
 */
function empaquetar(datos) {
  const paquete = {
    id:        generarId(),
    timestamp: new Date().toISOString(),
    datos,
  };
  paquete.hash  = hash(paquete);
  paquete.firma = firmar(paquete);
  return paquete;
}

/**
 * verificarPaquete(paquete) — Verifica que un paquete no fue alterado
 *
 * @param {Object} paquete - El paquete a verificar
 * @returns {{ valido: boolean, razon: string }}
 */
function verificarPaquete(paquete) {
  if (!paquete || !paquete.firma || !paquete.hash) {
    return { valido: false, razon: 'Paquete incompleto: faltan firma o hash' };
  }

  const { firma, ...sinFirma } = paquete;
  if (!verificarFirma(sinFirma, firma)) {
    return { valido: false, razon: 'Firma inválida: los datos pueden haber sido alterados' };
  }

  return { valido: true, razon: 'OK' };
}

// ── EXPORTACIÓN ─────────────────────────────────────────────────────────────

module.exports = {
  validateSecurityConfig,
  firmar,
  verificarFirma,
  hash,
  cifrar,
  descifrar,
  generarId,
  empaquetar,
  verificarPaquete,
};
