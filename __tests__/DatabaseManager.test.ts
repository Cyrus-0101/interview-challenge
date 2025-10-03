import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../Database/DatabaseManager';
import type { Elevator, ElevatorLog } from '../utils/types';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    // Use in-memory database for testing
    process.env.DB_PATH = ':memory:';
    db = new DatabaseManager();
    await db.initialize();
  });

  afterEach(async () => {
    // Wait for any pending database operations to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (db) {
      try {
        db.close();
      } catch (error) {
        // Ignore close errors - this is expected for in-memory databases
        // when there are pending operations
      }
    }
  });

  describe('initialization', () => {
    it('should create database instance', () => {
      expect(db).toBeInstanceOf(DatabaseManager);
    });

    it('should initialize with default elevators', async () => {
      const elevators = await db.getAllElevators();
      expect(elevators).toHaveLength(5);
      expect(elevators[0].id).toBe('elevator-1');
      expect(elevators[4].id).toBe('elevator-5');
    });
  });

  describe('elevator operations', () => {
    it('should get all elevators', async () => {
      const elevators = await db.getAllElevators();
      expect(elevators).toHaveLength(5);
      expect(elevators[0]).toMatchObject({
        id: 'elevator-1',
        currentFloor: 1,
        state: 'idle',
        isMoving: false
      });
    });

    it('should get specific elevator by ID', async () => {
      const elevator = await db.getElevator('elevator-1');
      expect(elevator).toMatchObject({
        id: 'elevator-1',
        currentFloor: 1,
        state: 'idle',
        isMoving: false
      });
    });

    it('should return null for non-existent elevator', async () => {
      const elevator = await db.getElevator('nonexistent');
      expect(elevator).toBeNull();
    });

    it('should update elevator', async () => {
      const elevator: Elevator = {
        id: 'elevator-1',
        currentFloor: 2,
        targetFloor: 5,
        state: 'moving_up',
        direction: 'up',
        isMoving: true,
        lastUpdated: new Date()
      };

      await db.updateElevator(elevator);
      const updatedElevator = await db.getElevator('elevator-1');
      
      expect(updatedElevator).toMatchObject({
        id: 'elevator-1',
        currentFloor: 2,
        targetFloor: 5,
        state: 'moving_up',
        direction: 'up',
        isMoving: true
      });
    });
  });

  describe('logging operations', () => {
    it('should log elevator events', async () => {
      const logData: Omit<ElevatorLog, 'id'> = {
        elevatorId: 'elevator-1',
        event: 'elevator_called',
        fromFloor: 1,
        toFloor: 5,
        state: 'idle',
        direction: 'up',
        timestamp: new Date(),
        details: 'Test event'
      };

      await db.logElevatorEvent(logData);
      const logs = await db.getElevatorLogs('elevator-1', 10);
      
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        elevatorId: 'elevator-1',
        event: 'elevator_called',
        fromFloor: 1,
        toFloor: 5,
        state: 'idle',
        direction: 'up',
        details: 'Test event'
      });
    });

    it('should get elevator logs with limit', async () => {
      // Log multiple events
      for (let i = 0; i < 5; i++) {
        const logData: Omit<ElevatorLog, 'id'> = {
          elevatorId: 'elevator-1',
          event: 'elevator_called',
          fromFloor: 1,
          toFloor: i + 1,
          state: 'idle',
          direction: 'up',
          timestamp: new Date(),
          details: `Test event ${i}`
        };
        await db.logElevatorEvent(logData);
      }

      const logs = await db.getElevatorLogs('elevator-1', 3);
      expect(logs).toHaveLength(3);
    });

    it('should get all elevator logs when no ID provided', async () => {
      const logData: Omit<ElevatorLog, 'id'> = {
        elevatorId: 'elevator-1',
        event: 'elevator_called',
        fromFloor: 1,
        toFloor: 5,
        state: 'idle',
        direction: 'up',
        timestamp: new Date(),
        details: 'Test event'
      };

      await db.logElevatorEvent(logData);
      const logs = await db.getElevatorLogs(undefined, 10);
      
      expect(logs).toHaveLength(1);
      expect(logs[0].elevatorId).toBe('elevator-1');
    });

    it('should get query logs with limit', async () => {
      // Log multiple queries
      for (let i = 0; i < 5; i++) {
        await db.logQuery(`SELECT * FROM elevators WHERE id = ?`, 'test-user', 'test-function', [`elevator-${i}`]);
      }

      const queryLogs = await db.getQueryLogs(3);
      expect(queryLogs).toHaveLength(3);
    });
  });

  describe('data mapping', () => {
    it('should handle boolean conversion for is_moving field', async () => {
      const elevator = await db.getElevator('elevator-1');
      expect(typeof elevator?.isMoving).toBe('boolean');
      expect(elevator?.isMoving).toBe(false);
    });

    it('should handle null values correctly', async () => {
      const elevator = await db.getElevator('elevator-1');
      expect(elevator?.targetFloor).toBeNull();
      expect(elevator?.direction).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle invalid elevator ID gracefully', async () => {
      const elevator = await db.getElevator('');
      expect(elevator).toBeNull();
    });
  });

  describe('database connection', () => {
    it('should close database connection without errors', () => {
      expect(() => db.close()).not.toThrow();
    });
  });
});