/**
 * ============================================================
 * SOBERANÍA DIGITAL — Logger Forense
 * Archivo: security/logger.js
 * ============================================================
 *
 * Este módulo registra TODO lo que pasa en el sistema.
 *
 * Principio de la Doctrina de Seguridad:
 * "Ninguna acción puede ocurrir sin dejar huella permanente."
 *
 * Niveles de log:
 * - ERROR:  algo falló y necesita atención inmediata
 * - WARN:   algo sospechoso pero no crítico
 * - INFO:   operación normal del sistema
 * - DEBUG:  detalle técnico para desarrollo (desactivado en producción)
 * - FORENSE: eventos de seguridad — NUNCA se borran, van a blockchain
 *
 * Cada entrada incluye:
 * - Timestamp exacto en UTC
 * - Hash del evento (integridad)
 * - Firma digital (autenticidad)
 * - ID único del evento (trazabilidad)
 * ============================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { hash, firmar, generarId } = require('./core');
require('dotenv').config();

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────

const LOG_DIR   = process.env.LOG_DIR || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Niveles de log en orden de severidad
const NIVELES = { error: 0, warn: 1, info: 2, forense: 3, debug: 4 };

// Colores para la consola (solo en desarrollo)
const COLORES = {
  error:   '\x1b[31m', // Rojo
  warn:    '\x1b[33m', // Amarillo
  info:    '\x1b[36m', // Cyan
  forense: '\x1b[35m', // Magenta
  debug:   '\x1b[37m', // Blanco
  reset:   '\x1b[0m',
};

// ── INICIALIZACIÓN ───────────────────────────────────────────────────────────

/**
 * Crea los directorios de logs si no existen.
 * Se llama automáticamente al cargar el módulo.
 */
function inicializarDirectorios() {
  const dirs = [
    LOG_DIR,
    path.join(LOG_DIR, 'forense'),  // Logs de seguridad — no rotar, no borrar
    path.join(LOG_DIR, 'sistema'),  // Logs operativos
    path.join(LOG_DIR, 'ataques'),  // Intentos de intrusión detectados
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ── ESCRITURA DE LOGS ────────────────────────────────────────────────────────

/**
 * escribirArchivo(ruta, entrada) — Escribe una entrada al archivo de log
 * Usa 'a' (append) — nunca sobreescribe, siempre agrega al final.
 */
function escribirArchivo(ruta, entrada) {
  try {
    fs.appendFileSync(ruta, JSON.stringify(entrada) + '\n', 'utf8');
  } catch (err) {
    // Si falla escribir el log, lo reportamos a consola pero no detenemos el sistema
    console.error(`[LOGGER] Error escribiendo log en ${ruta}:`, err.message);
  }
}

/**
 * construirEntrada(nivel, modulo, mensaje, datos) — Construye una entrada de log
 *
 * Cada entrada es un objeto JSON con:
 * - id: identificador único del evento
 * - timestamp: cuándo ocurrió, con precisión de milisegundos
 * - nivel: qué tipo de evento es
 * - modulo: qué parte del sistema lo generó
 * - mensaje: descripción en texto
 * - datos: información adicional relevante
 * - hash: huella digital de la entrada completa
 * - firma: sello criptográfico de autenticidad
 */
function construirEntrada(nivel, modulo, mensaje, datos = {}) {
  const base = {
    id:        generarId(8), // ID más corto para logs = más legible
    timestamp: new Date().toISOString(),
    nivel:     nivel.toUpperCase(),
    modulo,
    mensaje,
    datos,
    entorno:   process.env.NODE_ENV || 'development',
  };

  // Agregamos integridad criptográfica
  base.hash  = hash(base);
  base.firma = firmar(base);

  return base;
}

/**
 * registrar(nivel, modulo, mensaje, datos) — Función central de logging
 */
function registrar(nivel, modulo, mensaje, datos = {}) {
  // Verificamos si este nivel debe registrarse según configuración
  const nivelConfig  = NIVELES[LOG_LEVEL]   ?? 2;
  const nivelEvento  = NIVELES[nivel]        ?? 2;

  // Los logs forenses SIEMPRE se registran, sin importar el nivel configurado
  const esForense = nivel === 'forense';
  if (!esForense && nivelEvento > nivelConfig) return;

  const entrada = construirEntrada(nivel, modulo, mensaje, datos);

  // ── Consola (solo en desarrollo) ──────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const color  = COLORES[nivel] || COLORES.reset;
    const tiempo = entrada.timestamp.split('T')[1].slice(0, 12); // HH:MM:SS.mmm
    console.log(
      `${color}[${tiempo}] [${nivel.toUpperCase().padEnd(7)}] [${modulo}] ${mensaje}${COLORES.reset}`
    );
    if (Object.keys(datos).length > 0 && nivel === 'debug') {
      console.log('  └─', JSON.stringify(datos, null, 2));
    }
  }

  // ── Archivos ──────────────────────────────────────────────────────────────
  const fecha = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Todos los logs van al archivo general del día
  escribirArchivo(
    path.join(LOG_DIR, 'sistema', `${fecha}.jsonl`),
    entrada
  );

  // Los eventos forenses van a su propio directorio permanente
  if (esForense) {
    escribirArchivo(
      path.join(LOG_DIR, 'forense', `${fecha}-forense.jsonl`),
      entrada
    );
  }

  // Los errores tienen su propio archivo para fácil monitoreo
  if (nivel === 'error') {
    escribirArchivo(
      path.join(LOG_DIR, 'sistema', `errores.jsonl`),
      entrada
    );
  }

  return entrada;
}

// ── API PÚBLICA DEL LOGGER ───────────────────────────────────────────────────

/**
 * logger.error(modulo, mensaje, datos)
 * Para errores que requieren atención inmediata.
 */
function error(modulo, mensaje, datos = {}) {
  return registrar('error', modulo, mensaje, datos);
}

/**
 * logger.warn(modulo, mensaje, datos)
 * Para situaciones anómalas pero no críticas.
 */
function warn(modulo, mensaje, datos = {}) {
  return registrar('warn', modulo, mensaje, datos);
}

/**
 * logger.info(modulo, mensaje, datos)
 * Para operaciones normales importantes.
 */
function info(modulo, mensaje, datos = {}) {
  return registrar('info', modulo, mensaje, datos);
}

/**
 * logger.debug(modulo, mensaje, datos)
 * Para detalle técnico — solo visible en development.
 */
function debug(modulo, mensaje, datos = {}) {
  return registrar('debug', modulo, mensaje, datos);
}

/**
 * logger.forense(modulo, mensaje, datos)
 * Para eventos de seguridad — PERMANENTES, van a blockchain en Fase 2.
 *
 * Usar para:
 * - Intentos de acceso fallidos
 * - Firmas inválidas detectadas
 * - Patrones de ataque identificados
 * - Accesos administrativos
 * - Cualquier anomalía de seguridad
 */
function forense(modulo, mensaje, datos = {}) {
  return registrar('forense', modulo, mensaje, datos);
}

/**
 * logger.ataque(datos) — Registra un intento de ataque con estructura estándar
 *
 * @param {Object} datos.origen    - IP o identificador del origen
 * @param {Object} datos.metodo    - Tipo de ataque detectado
 * @param {Object} datos.destino   - Endpoint o módulo atacado
 * @param {Object} datos.bloqueado - Si fue bloqueado exitosamente
 */
function ataque(datos) {
  const fecha = new Date().toISOString().split('T')[0];

  const entrada = construirEntrada('forense', 'DETECTOR-ATAQUES', 'Intento de ataque detectado', {
    ...datos,
    procesado_en: new Date().toISOString(),
  });

  // Va al log general forense
  escribirArchivo(
    path.join(LOG_DIR, 'forense', `${fecha}-forense.jsonl`),
    entrada
  );

  // También a su propio registro de ataques
  escribirArchivo(
    path.join(LOG_DIR, 'ataques', `${fecha}-ataques.jsonl`),
    entrada
  );

  // Consola siempre para ataques, sin importar entorno
  console.warn(
    `${COLORES.error}[ATAQUE DETECTADO] Origen: ${datos.origen || 'desconocido'} | ` +
    `Método: ${datos.metodo || 'desconocido'} | ` +
    `Bloqueado: ${datos.bloqueado ? 'SÍ' : 'NO'}${COLORES.reset}`
  );

  return entrada;
}

// ── INICIALIZAR AL CARGAR ────────────────────────────────────────────────────
inicializarDirectorios();

// ── EXPORTACIÓN ─────────────────────────────────────────────────────────────
module.exports = { error, warn, info, debug, forense, ataque };
