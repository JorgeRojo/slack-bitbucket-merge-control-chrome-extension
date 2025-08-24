# Build Modes

Este proyecto tiene dos modos de build diferentes optimizados para distintos propósitos.

## Development Build (`npm run build`)

**Propósito**: Desarrollo local y testing
**Características**:

- ✅ Sourcemaps habilitados
- ❌ Sin minificación
- ✅ Console logs preservados
- ✅ Debugging información disponible

**Uso**:

```bash
npm run build
```

## Production Build (`npm run build:prod`)

**Propósito**: Distribución y releases de GitHub Actions
**Características**:

- ❌ Sin sourcemaps
- ✅ Minificación extrema con esbuild
- ❌ Console logs eliminados
- ✅ Tree shaking agresivo
- ✅ Debugger statements eliminados
- ✅ Tamaño ultra comprimido

**Uso**:

```bash
npm run build:prod
```

**Análisis de tamaño**:

```bash
npm run build:analyze  # Muestra tamaños comprimidos automáticamente
```

## Diferencias Técnicas

### Development Build

- Usa configuración estándar de Vite
- Mantiene código legible para debugging
- Archivos más grandes pero con mejor experiencia de desarrollo

### Production Build

- Usa configuración optimizada con `NODE_ENV=production`
- Elimina todo código no esencial
- Optimizado para el menor tamaño posible
- Usado automáticamente en GitHub Actions para releases

## GitHub Actions

El workflow de release (`prepare-close-publish-release.yml`) usa automáticamente el build de producción:

```yaml
- name: Build extension
  run: NODE_ENV=production npm run build:prod
```

Esto garantiza que las extensiones distribuidas tengan el menor tamaño posible y mejor rendimiento.
