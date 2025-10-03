# interview-challenge
# Elevator API System

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js 20+
- TypeScript 5+

### Installation
```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Server runs on `http://localhost:3000`

A comprehensive elevator management system built with Express.js, TypeScript, and SQLite3. This system provides real-time elevator control, logging, and monitoring capabilities for a configurable building with multiple elevators.

## Challenge Requirements Met

1. Call elevator from any floor to any other floor  
1. Real-time elevator information (place, state, direction)  
1. Comprehensive event logging with database storage  
1. SQL query tracking with source information  
1. Async elevator movement (5 elevators moving independently)  
1. Segregated logs by place/state/direction  
1. Configurable building (floors, timing)  
1. 2 API endpoints + comprehensive system  
1. Unit tests with full coverage  
1. Complete installation and testing documentation

## Challenge Deliverables

### API Endpoints
1. POST /api/elevator/call - Call elevator between floors
2. GET /api/elevator/status - Real-time elevator information

### Additional Endpoints
- GET /api/elevator/logs - Event logging
- GET /api/elevator/query-logs - SQL query tracking
- PUT/GET /api/elevator/config - Building configuration

### Unit Tests
- Comprehensive test suite with Jest
- Mock database operations
- Async movement testing
- Error handling validation

### Documentation
- Complete README with setup instructions
- API documentation with examples
- Architecture explanation
- Testing guidelines

## API Endpoints

### 1. Call Elevator
POST `/api/elevator/call`

Call an elevator from one floor to another.

Request:
```json
{
  "fromFloor": 1,
  "toFloor": 5,
  "requestedBy": "user123"  // optional
}
```

Response:
```json
{
  "success": true,
  "message": "Elevator called successfully",
  "data": {
    "elevatorId": "elevator-1",
    "estimatedTime": 25
  }
}
```

### 2. Get Real-time Status
GET `/api/elevator/status/:elevatorId?`

Get live elevator information.

- `GET /api/elevator/status` - All elevators
- `GET /api/elevator/status/elevator-1` - Specific elevator

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "elevator-1",
      "currentFloor": 3,
      "targetFloor": 5,
      "state": "moving_up",
      "direction": "up",
      "isMoving": true,
      "lastUpdated": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 3. Get Event Logs
GET `/api/elevator/logs/:elevatorId?`

Get comprehensive event logs.

- `GET /api/elevator/logs` - All logs
- `GET /api/elevator/logs/elevator-1` - Specific elevator
- `GET /api/elevator/logs?limit=50` - Limit results

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "log-123",
      "elevatorId": "elevator-1",
      "event": "elevator_called",
      "fromFloor": 1,
      "toFloor": 5,
      "state": "idle",
      "direction": "up",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "details": "Elevator called from floor 1 to floor 5 by user123"
    }
  ]
}
```

### 4. Get SQL Query Logs
GET `/api/elevator/query-logs`

Track all database operations with source information.

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "query-123",
      "query": "SELECT * FROM elevators",
      "executedBy": "system",
      "executedAt": "2024-01-15T10:30:00.000Z",
      "source": "getAllElevators",
      "parameters": "[]"
    }
  ]
}
```

### 5. Building Configuration
PUT `/api/elevator/config` - Update settings  
GET `/api/elevator/config` - Get current settings

Configuration:
```json
{
  "totalFloors": 10,
  "floorMoveTime": 5,      // seconds per floor
  "doorOpenCloseTime": 2   // seconds for door operations
}
```

## System Architecture

### Core Components

1. DatabaseManager (`src/database/schema.ts`)
   - SQLite database with 3 tables: `elevators`, `elevator_logs`, `query_logs`
   - Automatic query logging with source tracking
   - Type-safe database operations

2. ElevatorSystem (`src/elevator/ElevatorSystem.ts`)
   - Async elevator movement management
   - Smart elevator selection algorithm
   - Real-time state tracking
   - Event logging for all operations

3. API Routes (`src/routes/ElevatorRoutes.ts`)
   - RESTful endpoints with error handling
   - Input validation and sanitization
   - Comprehensive response formatting

4. Main Application (`app.ts`)
   - Express server setup
   - Middleware configuration
   - Graceful shutdown handling

### Database Schema

```sql
-- Elevators table
CREATE TABLE elevators (
  id TEXT PRIMARY KEY,
  current_floor INTEGER NOT NULL,
  target_floor INTEGER,
  state TEXT NOT NULL,           -- idle, moving_up, moving_down, doors_opening, doors_closing, doors_open
  direction TEXT,                -- up, down, null
  is_moving BOOLEAN NOT NULL,
  last_updated TEXT NOT NULL
);

-- Event logs table
CREATE TABLE elevator_logs (
  id TEXT PRIMARY KEY,
  elevator_id TEXT NOT NULL,
  event TEXT NOT NULL,           -- elevator_called, floor_reached, doors_opening, etc.
  from_floor INTEGER,
  to_floor INTEGER,
  state TEXT NOT NULL,
  direction TEXT,
  timestamp TEXT NOT NULL,
  details TEXT NOT NULL
);

-- Query tracking table
CREATE TABLE query_logs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  executed_by TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  source TEXT NOT NULL,          -- function/method name
  parameters TEXT                -- JSON string of parameters
);
```

## Async Movement System

### How It Works
- 5 elevators can move independently and simultaneously
- Each elevator has its own movement timer
- Smart selection algorithm chooses the best elevator for each request
- Real-time state tracking with database persistence
- Event-driven logging captures every action

### Movement States
1. `idle` - Elevator waiting for requests
2. `moving_up` - Moving upward
3. `moving_down` - Moving downward  
4. `doors_opening` - Doors opening (2 seconds)
5. `doors_open` - Doors open (2 seconds)
6. `doors_closing` - Doors closing (2 seconds)

### Timing Configuration
- Floor movement: 5 seconds per floor (configurable)
- Door operations: 2 seconds open/close (configurable)
- Building floors: 10 floors default (configurable)

## Testing

### Run Tests
```bash
# Run all tests
bun run test

# Watch mode for development
bun run test:watch

# Coverage report
bun run test:coverage

# Vitest UI
bun run test:ui
```

### Test Coverage
- ElevatorSystem: Movement logic, elevator selection, state management
- DatabaseManager: CRUD operations, query logging, data mapping
- API Routes: Request handling, validation, error responses
- Integration: End-to-end elevator operations

### Test Files
- `src/tests/elevatorSystem.test.ts` - Core system logic
- `src/tests/database.test.ts` - Database operations
- `src/tests/setup.ts` - Test configuration

## Dependencies

### Production
```json
{
  "express": "^5.1.0",      // Web framework
  "sqlite3": "^5.1.6",      // Database
  "cors": "^2.8.5",         // CORS middleware
  "uuid": "^9.0.0",         // ID generation
  "dotenv": "^17.2.3"       // Environment variables
}
```

### Development
```json
{
  "jest": "^29.0.0",        // Testing framework
  "@types/jest": "^29.0.0", // Jest types
  "ts-jest": "^29.0.0",     // TypeScript Jest preset
  "@types/express": "^5.0.3" // Express types
}
```

## Production Deployment

### Build
```bash
bun run build
```

### Start Production
```bash
bun run start
```

### Environment Variables
```bash
PORT=3000  # Server port (optional, defaults to 3000)
```

## Monitoring & Logging

### Real-time Monitoring
- Elevator status: Current floor, target, state, direction
- Movement tracking: Live updates every 5 seconds
- Event streaming: All actions logged with timestamps

### Log Types
1. Elevator Events: Calls, movements, door operations
2. SQL Queries: All database operations with source tracking
3. System Events: Configuration changes, errors

### Log Segregation
- By Elevator: Filter logs by specific elevator ID
- By Event Type: Different event categories
- By Time: Chronological ordering with timestamps
- By Source: Track which function made each database call

## Configuration

### Building Settings
```typescript
interface BuildingConfig {
  totalFloors: number;        // Number of floors (default: 10)
  floorMoveTime: number;      // Seconds per floor (default: 5)
  doorOpenCloseTime: number;  // Door operation time (default: 2)
}
```

### Default Elevators
- 5 elevators initialized at floor 1
- IDs: elevator-1, elevator-2, elevator-3, elevator-4, elevator-5
- Initial state: All idle, ready for requests

## Error Handling

### Validation Errors
- Invalid floor numbers
- Same from/to floors
- Non-existent elevators

### System Errors
- Database connection issues
- Movement conflicts
- Configuration errors

### Response Format
```json
{
  "error": "Error message",
  "details": "Additional information"
}
```