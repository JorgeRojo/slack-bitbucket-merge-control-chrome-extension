# Sistema de Manejo de Errores Simplificado

Este documento describe cómo usar el sistema simplificado de manejo de errores en la extensión usando `Logger.error` con `silentMessages` en el contexto.

## Conceptos Clave

### Mensajes de Error Disponibles

Los mensajes de error que pueden ser silenciados están definidos en `src/constants.js`:

```javascript
export const ERROR_MESSAGES = {
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED: 'Could not establish connection. Receiving end does not exist',
  MESSAGE_PORT_CLOSED: 'The message port closed before a response was received',
};

// Array con todos los mensajes silenciables (para conveniencia)
export const ALL_SILENCEABLE_ERRORS = Object.values(ERROR_MESSAGES);
```

### Función Principal

```javascript
Logger.error(error, component, context)
```

**Parámetros:**
- `error`: El error a manejar (Error object o string)
- `component`: Nombre del componente (por defecto: 'General')
- `context`: Objeto de contexto que puede incluir `silentMessages` y otros datos

**Contexto con silentMessages:**
```javascript
{
  silentMessages: ['mensaje1', 'mensaje2'], // Array de mensajes a silenciar
  otherProperty: 'value',                   // Otras propiedades del contexto
}
```

**Retorna:**
```javascript
{
  error: Error,      // El error original
  context: Object,   // El contexto sin silentMessages
  silenced: boolean  // true si el error fue silenciado
}
```

## Ejemplos de Uso

### 1. Silenciar Errores Específicos

```javascript
import { Logger } from './utils/logger.js';
import { ERROR_MESSAGES } from './constants.js';

try {
  await chrome.runtime.sendMessage({ action: 'someAction' });
} catch (error) {
  // Solo silenciar errores de conexión
  Logger.error(error, 'MyComponent', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### 2. Silenciar Todos los Errores Conocidos

```javascript
import { Logger } from './utils/logger.js';
import { ALL_SILENCEABLE_ERRORS } from './constants.js';

try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silenciar todos los errores conocidos
  Logger.error(error, 'TabMessaging', {
    silentMessages: ALL_SILENCEABLE_ERRORS,
  });
}
```

### 3. Manejo Condicional Basado en Silenciamiento

```javascript
try {
  await chrome.tabs.sendMessage(bitbucketTabId, message);
} catch (error) {
  const result = Logger.error(error, 'Background', {
    silentMessages: [ERROR_MESSAGES.RECEIVING_END_NOT_EXIST],
  });
  
  // Limpiar el tabId solo si el error fue silenciado
  if (result.silenced) {
    bitbucketTabId = null;
    return;
  }
  
  // Si no fue silenciado, hacer algo más
  console.log('Error no silenciado, requiere atención');
}
```

### 4. Contexto Adicional con Silenciamiento

```javascript
try {
  await someOperation();
} catch (error) {
  Logger.error(error, 'CriticalOperation', {
    silentMessages: [ERROR_MESSAGES.CONNECTION_FAILED],
    userId: '123',
    operation: 'fetchData',
    timestamp: Date.now(),
  });
}
```

### 5. No Silenciar Ningún Error

```javascript
try {
  await someOperation();
} catch (error) {
  // Loguear todos los errores normalmente (sin silentMessages)
  Logger.error(error, 'CriticalOperation', {
    userId: '123',
    operation: 'criticalTask',
  });
}
```

## Casos de Uso Comunes

### Background Script - Mensajes al Popup

Cuando el popup no está abierto, los mensajes fallan con errores de conexión:

```javascript
try {
  await chrome.runtime.sendMessage({
    action: MESSAGE_ACTIONS.UPDATE_MESSAGES,
  });
} catch (error) {
  // Silenciar errores de conexión cuando el popup no está abierto
  Logger.error(error, 'Background', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
}
```

### Content Script - Mensajes a Pestañas

Cuando una pestaña se cierra o no está disponible:

```javascript
try {
  await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  // Silenciar errores de conexión cuando la pestaña no está disponible
  const result = Logger.error(error, 'TabMessaging', {
    silentMessages: [
      ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
      ERROR_MESSAGES.CONNECTION_FAILED,
    ],
  });
  
  if (result.silenced) {
    tabId = null; // Limpiar referencia a pestaña inválida
  }
}
```

### Popup - Manejo de chrome.runtime.lastError

```javascript
chrome.runtime.sendMessage(message, (response) => {
  if (chrome.runtime.lastError) {
    Logger.error(
      new Error(chrome.runtime.lastError.message),
      'Popup',
      {
        silentMessages: [
          ERROR_MESSAGES.RECEIVING_END_NOT_EXIST,
          ERROR_MESSAGES.MESSAGE_PORT_CLOSED,
        ],
      },
    );
    return;
  }
  // Procesar respuesta...
});
```

## Añadir Nuevos Mensajes Silenciables

1. Añadir el mensaje a `ERROR_MESSAGES` en `constants.js`:

```javascript
export const ERROR_MESSAGES = {
  RECEIVING_END_NOT_EXIST: 'Receiving end does not exist',
  CONNECTION_FAILED: 'Could not establish connection. Receiving end does not exist',
  MESSAGE_PORT_CLOSED: 'The message port closed before a response was received',
  NEW_ERROR_TYPE: 'Nuevo tipo de error', // ← Añadir aquí
};
```

2. Usar el nuevo mensaje donde sea necesario:

```javascript
Logger.error(error, 'Component', {
  silentMessages: [ERROR_MESSAGES.NEW_ERROR_TYPE],
});
```

## Mejores Prácticas

1. **Ser Específico**: Solo silenciar los errores que realmente necesitas silenciar
2. **Documentar**: Añadir comentarios explicando por qué se silencian ciertos errores
3. **Contexto**: Proporcionar contexto útil para debugging junto con silentMessages
4. **Condicional**: Usar el valor de retorno `silenced` para lógica condicional cuando sea necesario
5. **Consistencia**: Usar siempre `Logger.error` en lugar de `console.error` directamente

## Diferencias con el Sistema Anterior

- **Eliminado**: `handleErrorSilently` function
- **Simplificado**: Todo se maneja a través de `Logger.error`
- **Integrado**: `silentMessages` forma parte del contexto
- **Consistente**: Un solo punto de entrada para el manejo de errores

## Testing

```javascript
test('should handle errors with silentMessages', () => {
  expect(() => {
    Logger.error(new Error('test error'), 'TestComponent', {
      silentMessages: ['test error'],
      otherContext: 'value',
    });
  }).not.toThrow();
});
```
