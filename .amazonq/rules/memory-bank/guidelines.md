# Development Guidelines

## Code Quality Standards

### TypeScript Usage Patterns

- **Strict Type Safety**: All files use TypeScript with explicit type definitions
- **Interface Definitions**: Complex objects use interfaces (e.g., `UIElements`, `UpdateUIParams`, `LastKnownMergeState`)
- **Type Imports**: Use `import type` for type-only imports to optimize bundle size
- **Generic Types**: Leverage generic types for reusable patterns (e.g., `Record<string, Function>`)
- **Type Helpers**: Utility functions like `toErrorType()` for consistent error handling

### Naming Conventions

- **camelCase**: Variables, functions, and methods (`updateUI`, `loadAndDisplayData`, `messageHandlers`)
- **PascalCase**: Interfaces, types, and classes (`UIElements`, `MockElement`, `BitbucketMergeController`)
- **UPPER_SNAKE_CASE**: Constants and enums (`MERGE_STATUS`, `APP_STATUS`, `MESSAGE_ACTIONS`)
- **Descriptive Names**: Function names clearly describe their purpose (`showConfigNeededUI`, `setupSlackChannelLink`)

### Function Structure

- **Small Functions**: Most functions under 30 lines, focused on single responsibility
- **Early Returns**: Use early returns to avoid deep nesting (seen in `updateContentByState`)
- **Parameter Objects**: Functions with multiple parameters use object destructuring
- **Async/Await**: Consistent use of async/await over Promise chains
- **Error Handling**: Comprehensive try-catch blocks with proper error logging

## Architectural Patterns

### Chrome Extension Architecture

- **Service Worker Pattern**: Background script as service worker with message handlers
- **Message Passing**: Structured communication using action-based message system
- **Storage Management**: Separation between `chrome.storage.sync` (config) and `chrome.storage.local` (state)
- **Content Script Isolation**: Encapsulated content scripts with IIFE pattern

### Module Organization

- **Index Files**: Each module has index.ts for clean imports
- **Separation of Concerns**: Clear boundaries between UI, business logic, and integration
- **Shared Common Module**: Reusable components, types, and utilities in common/
- **Mirror Test Structure**: Test files mirror source structure exactly

### State Management

- **Centralized Storage**: Chrome storage APIs for persistent state
- **State Synchronization**: Real-time updates via storage change listeners
- **Status Enums**: Consistent status management using predefined enums
- **State Validation**: Proper handling of missing or malformed state data

## Testing Standards

### Test Structure Patterns

- **Comprehensive Mocking**: Extensive mock implementations for Chrome APIs and DOM
- **Mock Factories**: Reusable mock creation functions (`createMockElement`)
- **Test Organization**: Logical grouping with descriptive describe blocks
- **Edge Case Coverage**: Thorough testing of error conditions and edge cases

### Testing Practices

- **Async Testing**: Proper handling of async operations with await patterns
- **Mock Lifecycle**: Consistent setup/teardown with `beforeEach`/`afterEach`
- **Assertion Patterns**: Clear, specific assertions with meaningful error messages
- **Integration Testing**: End-to-end flow testing alongside unit tests

### Mock Patterns

- **Interface Mocking**: Mock objects implement expected interfaces
- **Callback Simulation**: Proper simulation of Chrome API callback patterns
- **Event Handler Testing**: Verification of event listener setup and execution
- **Storage Mocking**: Comprehensive Chrome storage API mocking

## Error Handling Patterns

### Consistent Error Management

- **Logger Integration**: Centralized logging with context information
- **Error Type Conversion**: Use `toErrorType()` for consistent error handling
- **Graceful Degradation**: UI continues to function with missing elements
- **User Feedback**: Clear error messages and status indicators

### Error Recovery

- **Fallback Values**: Default values for missing configuration
- **Retry Logic**: Automatic retry for transient failures
- **State Recovery**: Ability to recover from corrupted state
- **Silent Failures**: Appropriate handling of non-critical errors

## UI Development Standards

### DOM Manipulation

- **Element Safety**: Null checks before DOM operations
- **Style Management**: Programmatic style updates with proper state management
- **Event Handling**: Clean event listener setup and cleanup
- **Dynamic Content**: Safe innerHTML updates with proper escaping

### Component Patterns

- **Web Components**: Custom elements for reusable UI components
- **State-Driven UI**: UI updates based on application state
- **Responsive Design**: CSS custom properties for consistent theming
- **Accessibility**: Proper semantic HTML and ARIA attributes

## Integration Patterns

### API Integration

- **Error Handling**: Comprehensive error handling for external APIs
- **Rate Limiting**: Proper handling of API rate limits
- **Authentication**: Secure token management and validation
- **Response Processing**: Structured response handling with type safety

### WebSocket Management

- **Connection Lifecycle**: Proper connection setup, maintenance, and cleanup
- **Reconnection Logic**: Automatic reconnection with backoff strategies
- **Message Processing**: Structured message handling with type validation
- **Error Recovery**: Graceful handling of connection failures

## Build and Development

### Code Organization

- **Import Grouping**: Logical grouping of imports (external, internal, types)
- **Path Aliases**: Use of path aliases for clean imports (`@src/`, `@tests/`)
- **Module Boundaries**: Clear separation between different functional areas
- **Dependency Management**: Minimal external dependencies, prefer native APIs

### Development Workflow

- **Type Checking**: Continuous type checking during development
- **Linting**: ESLint integration with TypeScript rules
- **Testing**: Comprehensive test coverage with Vitest
- **Build Optimization**: Separate development and production builds

## Documentation Standards

### Code Documentation

- **JSDoc Comments**: Comprehensive function and class documentation
- **Inline Comments**: Explanatory comments for complex logic
- **Type Annotations**: Self-documenting code through proper typing
- **README Files**: Clear setup and usage instructions

### Maintenance Practices

- **Version Management**: Consistent versioning across manifest and package.json
- **Change Tracking**: Proper Git commit messages and change documentation
- **Issue Tracking**: Structured issue templates and tracking
- **Release Process**: Documented release workflow and procedures
