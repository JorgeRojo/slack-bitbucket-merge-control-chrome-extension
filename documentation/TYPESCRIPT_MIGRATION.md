# TypeScript Migration Plan

This document describes the plan to migrate the Slack-Bitbucket Merge Control Chrome Extension project from JavaScript to TypeScript.

## Benefits of Migration

- **Compile-time error detection**: TypeScript identifies errors before running the code
- **Improved development experience**: Enhanced autocompletion and documentation in the IDE
- **More maintainable code**: Types act as living documentation
- **Safer refactoring**: API changes are detected by the compiler
- **Better support for design patterns**: Interfaces, generics, and other advanced concepts

## Prerequisites

- Node.js and npm installed
- Basic knowledge of TypeScript

## Migration Steps

### 1. Initial Setup

1. **Install TypeScript dependencies**:
   ```bash
   npm install --save-dev typescript ts-loader @typescript-eslint/eslint-plugin @typescript-eslint/parser typescript-eslint @types/node
   ```

2. **Create tsconfig.json file**:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "node",
       "esModuleInterop": true,
       "strict": true,
       "sourceMap": true,
       "outDir": "./dist",
       "rootDir": "./src",
       "lib": ["DOM", "DOM.Iterable", "ESNext"],
       "jsx": "react",
       "allowJs": true,
       "checkJs": false,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

3. **Update package.json with TypeScript scripts**:
   ```json
   "scripts": {
     "build": "tsc",
     "watch": "tsc --watch",
     "type-check": "tsc --noEmit"
   }
   ```

4. **Configure ESLint for TypeScript**:
   Update `eslint.config.js` to include TypeScript support.

5. **Configure Prettier**:
   Create `.prettierrc` with appropriate TypeScript configuration.

### 2. Gradual Migration Strategy

The migration will be carried out in phases to minimize risk and allow for continuous testing:

#### Phase 1: Preparation and Configuration
- Configure TypeScript and related tools
- Create initial type definitions
- Update build scripts

#### Phase 2: Utility and Constants Files Migration
1. Migrate constants files (`constants.js` → `constants.ts`)
2. Migrate utilities (`utils/*.js` → `utils/*.ts`)
3. Define common interfaces and types in `src/types/`

#### Phase 3: Components Migration
1. Migrate smaller components first
2. Migrate more complex components
3. Update related tests

#### Phase 4: Main Scripts Migration
1. Migrate background scripts (`background.js` → `background.ts`)
2. Migrate content scripts (`content.js` → `content.ts`)
3. Migrate popup scripts (`popup.js` → `popup.ts`)

#### Phase 5: Testing and Refinement
1. Update all tests for TypeScript
2. Resolve remaining type issues
3. Improve type coverage where needed

### 3. File Conversion Guide

For each JavaScript file being migrated to TypeScript:

1. **Change the file extension** from `.js` to `.ts`
2. **Remove file extensions** in import statements:
   ```typescript
   // Before
   import { ErrorHandler } from './errorHandler.js';
   
   // After
   import { ErrorHandler } from './errorHandler';
   ```
3. **Add types** to variables, function parameters, and return values:
   ```typescript
   // Before
   function processMessage(message) {
     return message.text;
   }
   
   // After
   interface Message {
     text: string;
     user: string;
     timestamp: string;
   }
   
   function processMessage(message: Message): string {
     return message.text;
   }
   ```
4. **Convert constant objects to enums** when appropriate:
   ```typescript
   // Before
   export const APP_STATUS = {
     OK: 'ok',
     ERROR: 'error'
   };
   
   // After
   export enum APP_STATUS {
     OK = 'ok',
     ERROR = 'error'
   }
   ```

### 4. Test Updates

1. Change test file extensions from `.js` to `.ts`
2. Update imports (remove `.js` extensions)
3. Add types to test variables
4. Update test configurations for TypeScript

### 5. Manifest Update

Update `manifest.json` to point to the compiled files in the `dist` folder.

### 6. TypeScript Best Practices

- Use `interface` to define object shapes
- Use `type` for type aliases and unions
- Use `enum` for sets of related values
- Avoid `any` when possible, prefer `unknown`
- Use generics for reusable functions and classes
- Document interfaces and types with JSDoc comments

## Estimated Timeline

- **Week 1**: Setup and utilities migration
- **Week 2**: Components migration
- **Week 3**: Main scripts migration
- **Week 4**: Test updates and refinement

## Useful Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Chrome Extensions with TypeScript](https://developer.chrome.com/docs/extensions/develop/migrate-to-mv3)
- [Testing TypeScript with Vitest](https://vitest.dev/guide/testing-types.html)

## Common Issues and Solutions

### Error: Cannot find module
Make sure imports don't include file extensions (`.js`).

### Error: Property does not exist on type
Define interfaces for your objects or use utility types like `Partial<T>` or `Record<K, V>`.

### Error: Implicit any type
Add explicit type annotations to variables and function parameters.

### Error: No overload matches this call
Verify that the arguments you pass to functions match the expected types.
