# SOBERANÍA DIGITAL
### Plataforma Ciudadana de Transparencia del Estado Uruguayo
*"Una persona. Una cédula. Un peso. Un voto."*

---

## ¿Qué es esto?

Soberanía Digital es una plataforma que recolecta, organiza y publica datos del Estado uruguayo de forma legible para cualquier ciudadano. Todo el código es público. La gobernanza es ciudadana. La seguridad está incorporada desde la primera línea.

## Estructura del Proyecto

```
soberania-digital/
├── security/
│   ├── core.js       ← Núcleo criptográfico (firma, cifrado, hash)
│   └── logger.js     ← Sistema de registro forense
├── scrapers/
│   └── datos-gub-uy.js  ← Recolector de datos del Estado
├── tests/
│   └── security.test.js ← Tests automáticos de seguridad
├── datos/            ← Datos recolectados (generado automáticamente)
├── logs/             ← Logs del sistema (generado automáticamente)
├── .env.example      ← Plantilla de configuración
├── .gitignore        ← Archivos que NO van a GitHub
└── README.md         ← Este archivo
```

## Primeros Pasos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar entorno
```bash
cp .env.example .env
```
Abrir `.env` y completar las claves (instrucciones dentro del archivo).

### 3. Generar claves de seguridad
```bash
node -e "console.log('SIGNING_KEY=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```
Copiar los resultados al archivo `.env`.

### 4. Correr los tests de seguridad
```bash
node tests/security.test.js
```
Todos deben pasar antes de continuar.

### 5. Ejecutar el primer scraper
```bash
node scrapers/datos-gub-uy.js
```

## Principios de Seguridad

1. **Transparencia total**: el código es completamente público
2. **No confiar, verificar**: todo se verifica criptográficamente
3. **Los ataques se registran**: cada intento de intrusión queda en blockchain
4. **Ningún humano tiene poder total**: las claves maestras están distribuidas
5. **Todo lleva etiqueta**: si algo lo tocó la IA, se sabe; si algo fue un acceso admin, se sabe

## Para Desarrolladores

Antes de hacer un commit:
- Los tests deben pasar: `node tests/security.test.js`
- No subir el archivo `.env` (está en .gitignore)
- Cada función tiene comentarios explicando qué hace y por qué

## Licencia

Código Abierto por mandato ciudadano.
Propiedad de la ciudadanía uruguaya.
