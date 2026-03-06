/**
 * ============================================================
 * SOBERANÍA DIGITAL — Scraper: datos.gub.uy
 * Archivo: scrapers/datos-gub-uy.js
 * ============================================================
 *
 * Recolecta datos del portal oficial de datos abiertos del
 * Estado uruguayo: https://catalogodatos.gub.uy
 *
 * Qué recolecta:
 * - Catálogo de datasets publicados por organismos del Estado
 * - Metadatos: qué organismo publicó, cuándo, en qué formato
 * - URLs de descarga de datos reales
 *
 * Principios de seguridad aplicados aquí:
 * 1. Cada respuesta del servidor se verifica (no confiamos a ciegas)
 * 2. Cada dato recolectado se firma y hashea antes de guardar
 * 3. Cada operación queda registrada en el log forense
 * 4. Los errores se registran con detalle — nunca se pierden silenciosamente
 * 5. Rate limiting: no sobrecargamos el servidor del Estado
 * ============================================================
 */

'use strict';

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

const security = require('../security/core');
const logger   = require('../security/logger');
require('dotenv').config();

// ── CONFIGURACIÓN DEL SCRAPER ────────────────────────────────────────────────

const CONFIG = {
  // URL base de la API del catálogo de datos del Estado
  // Documentación oficial: https://catalogodatos.gub.uy/api/3/action/
  baseUrl: 'https://catalogodatos.gub.uy/api/3/action',

  // Cuántos datasets traer por página (máximo recomendado: 100)
  paginaTamaño: 50,

  // Tiempo máximo de espera por respuesta (en milisegundos)
  timeout: 15000, // 15 segundos

  // Pausa entre requests para no sobrecargar el servidor del Estado
  // Principio: somos ciudadanos usando datos públicos, no atacantes
  pausaEntreRequests: 1500, // 1.5 segundos

  // Directorio donde guardamos los datos recolectados
  directorioSalida: './datos/datos-gub-uy',

  // Identificador de este scraper en los logs
  modulo: 'SCRAPER-DATOS-GUB-UY',
};

// ── CLIENTE HTTP SEGURO ──────────────────────────────────────────────────────

/**
 * Crea un cliente HTTP con configuración de seguridad.
 *
 * Headers importantes:
 * - User-Agent: nos identificamos honestamente. No somos un atacante.
 *   Si alguien del Estado revisa sus logs, puede ver que es Soberanía Digital.
 * - Accept: solo aceptamos JSON (rechazamos respuestas inesperadas)
 */
const clienteHttp = axios.create({
  timeout: CONFIG.timeout,
  headers: {
    'User-Agent':   'SoberaniaDigital/1.0 (transparencia-ciudadana; contacto@soberania.digital)',
    'Accept':       'application/json',
    'Accept-Language': 'es-UY,es;q=0.9',
  },
  // Validamos el certificado SSL del servidor (verificamos que es quien dice ser)
  httpsAgent: require('https').globalAgent,
});

// ── UTILIDADES ───────────────────────────────────────────────────────────────

/**
 * pausa(ms) — Espera un tiempo antes de continuar
 * Se usa para no bombardear el servidor del Estado con requests.
 */
const pausa = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * crearDirectorioSalida() — Crea el directorio de datos si no existe
 */
function crearDirectorioSalida() {
  if (!fs.existsSync(CONFIG.directorioSalida)) {
    fs.mkdirSync(CONFIG.directorioSalida, { recursive: true });
    logger.info(CONFIG.modulo, `Directorio creado: ${CONFIG.directorioSalida}`);
  }
}

// ── FUNCIONES DE RECOLECCIÓN ─────────────────────────────────────────────────

/**
 * obtenerListaOrganismos() — Trae todos los organismos del Estado con datos publicados
 *
 * Qué es un organismo aquí: Ministerio, Intendencia, Ente Autónomo, etc.
 * La API los llama "organizations".
 *
 * @returns {Array} Lista de organismos con sus metadatos
 */
async function obtenerListaOrganismos() {
  logger.info(CONFIG.modulo, 'Obteniendo lista de organismos del Estado...');

  try {
    const url      = `${CONFIG.baseUrl}/organization_list`;
    const respuesta = await clienteHttp.get(url, {
      params: { all_fields: true, limit: 500 }
    });

    // Verificamos que la respuesta tiene la estructura esperada
    if (!respuesta.data || !respuesta.data.success) {
      throw new Error(`API respondió con error: ${JSON.stringify(respuesta.data)}`);
    }

    const organismos = respuesta.data.result || [];

    logger.info(CONFIG.modulo, `${organismos.length} organismos encontrados`, {
      total: organismos.length,
      url,
    });

    return organismos;

  } catch (err) {
    logger.error(CONFIG.modulo, 'Error obteniendo organismos', {
      mensaje: err.message,
      url: `${CONFIG.baseUrl}/organization_list`,
    });
    throw err;
  }
}

/**
 * obtenerDatasetsPorOrganismo(organismoId, pagina) — Trae datasets de un organismo
 *
 * @param {string} organismoId - ID del organismo (ej: "ministerio-economia")
 * @param {number} pagina      - Número de página (empieza en 0)
 * @returns {{ datasets: Array, total: number }}
 */
async function obtenerDatasetsPorOrganismo(organismoId, pagina = 0) {
  const inicio = pagina * CONFIG.paginaTamaño;
  const url    = `${CONFIG.baseUrl}/package_search`;

  try {
    const respuesta = await clienteHttp.get(url, {
      params: {
        fq:    `organization:${organismoId}`,
        rows:  CONFIG.paginaTamaño,
        start: inicio,
        sort:  'metadata_modified desc', // Los más recientes primero
      }
    });

    if (!respuesta.data || !respuesta.data.success) {
      throw new Error(`API respondió con error para organismo ${organismoId}`);
    }

    const resultado = respuesta.data.result;
    return {
      datasets: resultado.results || [],
      total:    resultado.count   || 0,
    };

  } catch (err) {
    logger.warn(CONFIG.modulo, `Error obteniendo datasets de ${organismoId}`, {
      organismo: organismoId,
      pagina,
      mensaje:   err.message,
    });
    return { datasets: [], total: 0 };
  }
}

/**
 * normalizarDataset(raw) — Convierte un dataset crudo al formato interno
 *
 * Por qué normalizar: cada organismo publica sus datos en formatos
 * ligeramente distintos. Este paso los convierte todos al mismo esquema.
 * Así el resto del sistema siempre trabaja con datos predecibles.
 *
 * @param {Object} raw - Dataset en formato crudo de la API
 * @returns {Object} Dataset normalizado al esquema interno
 */
function normalizarDataset(raw) {
  return {
    // Identificación
    id:           raw.id          || null,
    nombre:       raw.title       || raw.name || 'Sin nombre',
    slug:         raw.name        || null,

    // Organismo que publicó
    organismo: {
      id:     raw.organization?.name   || null,
      nombre: raw.organization?.title  || 'Desconocido',
      tipo:   raw.organization?.type   || null,
    },

    // Descripción y categorización
    descripcion: raw.notes  || '',
    etiquetas:   (raw.tags  || []).map(t => t.name),
    grupos:      (raw.groups || []).map(g => g.title),

    // Temporalidad
    creado:          raw.metadata_created  || null,
    modificado:      raw.metadata_modified || null,
    frecuencia:      raw.frequency         || null,

    // Recursos (archivos descargables)
    recursos: (raw.resources || []).map(r => ({
      id:       r.id,
      nombre:   r.name         || r.description || 'Sin nombre',
      url:      r.url          || null,
      formato:  r.format       || 'desconocido',
      tamaño:   r.size         || null,
      creado:   r.created      || null,
    })),

    // Metadatos de recolección (Soberanía Digital los agrega)
    _meta: {
      recolectado_en:  new Date().toISOString(),
      fuente:          'catalogodatos.gub.uy',
      url_original:    `https://catalogodatos.gub.uy/dataset/${raw.name}`,
      version_scraper: '1.0.0',
    },
  };
}

/**
 * guardarDatasets(datasets, organismoId) — Guarda datasets con firma de integridad
 *
 * Cada archivo guardado incluye:
 * - Los datos normalizados
 * - Hash de cada dataset (para detectar cambios futuros)
 * - Firma del lote completo (para detectar alteraciones del archivo)
 * - Metadatos de la sesión de recolección
 *
 * @param {Array}  datasets   - Lista de datasets normalizados
 * @param {string} organismoId
 */
function guardarDatasets(datasets, organismoId) {
  // Hashear cada dataset individualmente para detectar cambios futuros
  const datasetsConHash = datasets.map(ds => ({
    ...ds,
    _integridad: {
      hash: security.hash(ds),
    }
  }));

  // Empaquetar el lote completo con firma
  const paquete = security.empaquetar({
    organismo:    organismoId,
    total:        datasets.length,
    datasets:     datasetsConHash,
  });

  // Nombre del archivo: organismo + fecha para fácil búsqueda
  const fecha    = new Date().toISOString().split('T')[0];
  const nombreArchivo = `${organismoId}-${fecha}.json`;
  const rutaArchivo   = path.join(CONFIG.directorioSalida, nombreArchivo);

  fs.writeFileSync(rutaArchivo, JSON.stringify(paquete, null, 2), 'utf8');

  logger.info(CONFIG.modulo, `Datos guardados: ${nombreArchivo}`, {
    organismo: organismoId,
    total:     datasets.length,
    archivo:   rutaArchivo,
    hash_lote: paquete.hash,
  });

  return rutaArchivo;
}

// ── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * ejecutar() — Punto de entrada del scraper
 *
 * Flujo completo:
 * 1. Inicializar directorios
 * 2. Obtener lista de organismos
 * 3. Para cada organismo: obtener todos sus datasets paginando
 * 4. Normalizar y guardar con firma de integridad
 * 5. Registrar resumen en log forense
 */
async function ejecutar() {
  logger.forense(CONFIG.modulo, 'Sesión de recolección iniciada', {
    timestamp: new Date().toISOString(),
    config: {
      paginaTamaño:         CONFIG.paginaTamaño,
      pausaEntreRequests:   CONFIG.pausaEntreRequests,
    }
  });

  crearDirectorioSalida();

  const resumen = {
    inicio:          new Date().toISOString(),
    organismos:      0,
    datasets_total:  0,
    errores:         0,
    archivos:        [],
  };

  try {
    // Paso 1: Lista de organismos
    const organismos = await obtenerListaOrganismos();
    resumen.organismos = organismos.length;

    // Paso 2: Datasets de cada organismo
    for (const organismo of organismos) {
      const id = organismo.name;
      logger.debug(CONFIG.modulo, `Procesando: ${organismo.title || id}`);

      let pagina  = 0;
      let hayMas  = true;
      let todosDsOrganismo = [];

      // Paginamos hasta traer todos los datasets del organismo
      while (hayMas) {
        const { datasets, total } = await obtenerDatasetsPorOrganismo(id, pagina);

        if (datasets.length === 0) {
          hayMas = false;
          break;
        }

        const normalizados = datasets.map(normalizarDataset);
        todosDsOrganismo = todosDsOrganismo.concat(normalizados);

        // ¿Hay más páginas?
        const cargados = (pagina + 1) * CONFIG.paginaTamaño;
        hayMas = cargados < total;
        pagina++;

        // Pausa cortés entre páginas
        if (hayMas) await pausa(CONFIG.pausaEntreRequests);
      }

      if (todosDsOrganismo.length > 0) {
        const archivo = guardarDatasets(todosDsOrganismo, id);
        resumen.datasets_total += todosDsOrganismo.length;
        resumen.archivos.push(archivo);
      }

      // Pausa entre organismos — somos respetuosos con el servidor del Estado
      await pausa(CONFIG.pausaEntreRequests);
    }

  } catch (err) {
    resumen.errores++;
    logger.error(CONFIG.modulo, 'Error crítico durante recolección', {
      mensaje: err.message,
      stack:   process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Registro forense del resultado de la sesión
  resumen.fin      = new Date().toISOString();
  resumen.exitoso  = resumen.errores === 0;

  logger.forense(CONFIG.modulo, 'Sesión de recolección finalizada', resumen);

  return resumen;
}

// ── EXPORTACIÓN ─────────────────────────────────────────────────────────────
module.exports = { ejecutar, normalizarDataset };

// Ejecución directa si se llama este archivo directamente
// (ej: node scrapers/datos-gub-uy.js)
if (require.main === module) {
  // Verificar config de seguridad antes de cualquier otra cosa
  try {
    security.validateSecurityConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  ejecutar()
    .then(resumen => {
      console.log('\n── Resumen de recolección ──────────────────');
      console.log(`Organismos procesados: ${resumen.organismos}`);
      console.log(`Datasets recolectados: ${resumen.datasets_total}`);
      console.log(`Errores:               ${resumen.errores}`);
      console.log(`Exitoso:               ${resumen.exitoso ? 'SÍ' : 'NO'}`);
    })
    .catch(err => {
      console.error('Error fatal:', err.message);
      process.exit(1);
    });
}
