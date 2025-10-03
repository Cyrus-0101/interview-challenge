import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ElevatorService } from '../services/ElevatorService';
import { DatabaseManager } from '../Database/DatabaseManager';
import type { Elevator } from '../utils/types';

// Mock the DatabaseManager
vi.mock('../Database/DatabaseManager');

describe('ElevatorService', () => {
  let elevatorService: ElevatorService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock database
    mockDb = {
      getAllElevators: vi.fn(),
      getElevator: vi.fn(),
      updateElevator: vi.fn(),
      logElevatorEvent: vi.fn(),
      getElevatorLogs: vi.fn(),
      getQueryLogs: vi.fn()
    };

    // Mock DatabaseManager constructor
    vi.mocked(DatabaseManager).mockImplementation(() => mockDb);

    elevatorService = new ElevatorService(mockDb, {
      totalFloors: 10,
      floorMoveTime: 1, // 1 second for testing
      doorOpenCloseTime: 0.5 // 0.5 seconds for testing
    });
  });

  afterEach(() => {
    elevatorService.stopAllMovements();
  });

  describe('callElevator', () => {
    it('should successfully call an elevator', async () => {
      const mockElevator: Elevator = {
        id: 'elevator-1',
        currentFloor: 1,
        targetFloor: 0,
        state: 'idle',
        direction: null,
        isMoving: false,
        lastUpdated: new Date()
      };

      mockDb.getAllElevators.mockResolvedValue([mockElevator]);
      mockDb.updateElevator.mockResolvedValue(undefined);
      mockDb.logElevatorEvent.mockResolvedValue(undefined);

      const result = await elevatorService.callElevator({
        fromFloor: 1,
        toFloor: 5,
        requestedBy: 'test-user'
      });

      expect(result).toHaveProperty('elevatorId', 'elevator-1');
      expect(result).toHaveProperty('estimatedTime');
      expect(result.estimatedTime).toBeGreaterThan(0);
      
      expect(mockDb.updateElevator).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'elevator-1',
          targetFloor: 5,
          direction: 'up'
        })
      );
      
      expect(mockDb.logElevatorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          elevatorId: 'elevator-1',
          event: 'elevator_called',
          fromFloor: 1,
          toFloor: 5
        })
      );
    });

    it('should throw error for invalid floors', async () => {
      await expect(
        elevatorService.callElevator({
          fromFloor: 0,
          toFloor: 5
        })
      ).rejects.toThrow('Invalid floor');

      await expect(
        elevatorService.callElevator({
          fromFloor: 1,
          toFloor: 15
        })
      ).rejects.toThrow('Invalid floor');
    });

    it('should throw error when from and to floors are the same', async () => {
      await expect(
        elevatorService.callElevator({
          fromFloor: 3,
          toFloor: 3
        })
      ).rejects.toThrow('From floor and to floor cannot be the same');
    });

    it('should select the best elevator based on scoring algorithm', async () => {
      const mockElevators: Elevator[] = [
        {
          id: 'elevator-1',
          currentFloor: 5,
          targetFloor: 0,
          state: 'idle',
          direction: null,
          isMoving: false,
          lastUpdated: new Date()
        },
        {
          id: 'elevator-2',
          currentFloor: 1,
          targetFloor: 0,
          state: 'idle',
          direction: null,
          isMoving: false,
          lastUpdated: new Date()
        }
      ];

      mockDb.getAllElevators.mockResolvedValue(mockElevators);
      mockDb.updateElevator.mockResolvedValue(undefined);
      mockDb.logElevatorEvent.mockResolvedValue(undefined);

      await elevatorService.callElevator({
        fromFloor: 1,
        toFloor: 3
      });

      // Should select elevator-2 (closer to fromFloor)
      expect(mockDb.updateElevator).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'elevator-2'
        })
      );
    });

    it('should prefer idle elevators over moving ones', async () => {
      const mockElevators: Elevator[] = [
        {
          id: 'elevator-1',
          currentFloor: 1,
          targetFloor: 0,
          state: 'moving_up',
          direction: 'up',
          isMoving: true,
          lastUpdated: new Date()
        },
        {
          id: 'elevator-2',
          currentFloor: 2,
          targetFloor: 0,
          state: 'idle',
          direction: null,
          isMoving: false,
          lastUpdated: new Date()
        }
      ];

      mockDb.getAllElevators.mockResolvedValue(mockElevators);
      mockDb.updateElevator.mockResolvedValue(undefined);
      mockDb.logElevatorEvent.mockResolvedValue(undefined);

      await elevatorService.callElevator({
        fromFloor: 1,
        toFloor: 3
      });

      // Should select elevator-2 (idle) over elevator-1 (moving)
      expect(mockDb.updateElevator).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'elevator-2'
        })
      );
    });
  });

  describe('getElevatorStatus', () => {
    it('should return all elevators when no ID provided', async () => {
      const mockElevators: Elevator[] = [
        {
          id: 'elevator-1',
          currentFloor: 1,
          targetFloor: 0,
          state: 'idle',
          direction: null,
          isMoving: false,
          lastUpdated: new Date()
        },
        {
          id: 'elevator-2',
          currentFloor: 3,
          targetFloor: 5,
          state: 'moving_up',
          direction: 'up',
          isMoving: true,
          lastUpdated: new Date()
        }
      ];

      mockDb.getAllElevators.mockResolvedValue(mockElevators);

      const result = await elevatorService.getElevatorStatus();
      expect(result).toEqual(mockElevators);
    });

    it('should return specific elevator when ID provided', async () => {
      const mockElevator: Elevator = {
        id: 'elevator-1',
        currentFloor: 1,
        targetFloor: 0,
        state: 'idle',
        direction: null,
        isMoving: false,
        lastUpdated: new Date()
      };

      mockDb.getElevator.mockResolvedValue(mockElevator);

      const result = await elevatorService.getElevatorStatus('elevator-1');
      expect(result).toEqual(mockElevator);
    });

    it('should throw error when elevator not found', async () => {
      mockDb.getElevator.mockResolvedValue(null);

      await expect(
        elevatorService.getElevatorStatus('nonexistent-elevator')
      ).rejects.toThrow('Elevator nonexistent-elevator not found');
    });
  });

  describe('getElevatorLogs', () => {
    it('should return elevator logs with default limit', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          elevatorId: 'elevator-1',
          event: 'elevator_called',
          fromFloor: 1,
          toFloor: 5,
          state: 'idle',
          direction: 'up',
          timestamp: new Date(),
          details: 'Test event'
        }
      ];

      mockDb.getElevatorLogs.mockResolvedValue(mockLogs);

      const result = await elevatorService.getElevatorLogs();
      expect(result).toEqual(mockLogs);
      expect(mockDb.getElevatorLogs).toHaveBeenCalledWith(undefined, 100);
    });

    it('should return elevator logs with custom limit', async () => {
      const mockLogs: any[] = [];
      mockDb.getElevatorLogs.mockResolvedValue(mockLogs);

      await elevatorService.getElevatorLogs('elevator-1', 50);
      expect(mockDb.getElevatorLogs).toHaveBeenCalledWith('elevator-1', 50);
    });
  });

  describe('getQueryLogs', () => {
    it('should return query logs with default limit', async () => {
      const mockLogs = [
        {
          id: 'query-1',
          query: 'SELECT * FROM elevators',
          executedBy: 'system',
          executedAt: '2024-01-15T10:30:00.000Z',
          source: 'getAllElevators',
          parameters: '[]'
        }
      ];

      mockDb.getQueryLogs.mockResolvedValue(mockLogs);

      const result = await elevatorService.getQueryLogs();
      expect(result).toEqual(mockLogs);
      expect(mockDb.getQueryLogs).toHaveBeenCalledWith(100);
    });

    it('should return query logs with custom limit', async () => {
      const mockLogs: any[] = [];
      mockDb.getQueryLogs.mockResolvedValue(mockLogs);

      await elevatorService.getQueryLogs(50);
      expect(mockDb.getQueryLogs).toHaveBeenCalledWith(50);
    });
  });

  describe('building configuration', () => {
    it('should update building configuration', async () => {
      const newConfig = {
        totalFloors: 20,
        floorMoveTime: 3,
        doorOpenCloseTime: 1
      };

      await elevatorService.updateBuildingConfig(newConfig);
      const config = elevatorService.getBuildingConfig();

      expect(config.totalFloors).toBe(20);
      expect(config.floorMoveTime).toBe(3);
      expect(config.doorOpenCloseTime).toBe(1);
    });

    it('should return current building configuration', () => {
      const config = elevatorService.getBuildingConfig();
      
      expect(config).toHaveProperty('totalFloors');
      expect(config).toHaveProperty('floorMoveTime');
      expect(config).toHaveProperty('doorOpenCloseTime');
      expect(config.totalFloors).toBe(10);
      expect(config.floorMoveTime).toBe(1);
      expect(config.doorOpenCloseTime).toBe(0.5);
    });

    it('should partially update configuration', async () => {
      await elevatorService.updateBuildingConfig({ totalFloors: 15 });
      const config = elevatorService.getBuildingConfig();

      expect(config.totalFloors).toBe(15);
      expect(config.floorMoveTime).toBe(1); // Should remain unchanged
      expect(config.doorOpenCloseTime).toBe(0.5); // Should remain unchanged
    });
  });

  describe('estimated time calculation', () => {
    it('should calculate correct estimated time', async () => {
      const mockElevator: Elevator = {
        id: 'elevator-1',
        currentFloor: 1,
        targetFloor: 0,
        state: 'idle',
        direction: null,
        isMoving: false,
        lastUpdated: new Date()
      };

      mockDb.getAllElevators.mockResolvedValue([mockElevator]);
      mockDb.updateElevator.mockResolvedValue(undefined);
      mockDb.logElevatorEvent.mockResolvedValue(undefined);

      const result = await elevatorService.callElevator({
        fromFloor: 1,
        toFloor: 5
      });

      // From floor 1 to 5 = 4 floors * 1 second + 2 door operations * 0.5 seconds = 5 seconds
      expect(result.estimatedTime).toBe(5);
    });

    it('should calculate estimated time when elevator is on different floor', async () => {
      const mockElevator: Elevator = {
        id: 'elevator-1',
        currentFloor: 3,
        targetFloor: 0,
        state: 'idle',
        direction: null,
        isMoving: false,
        lastUpdated: new Date()
      };

      mockDb.getAllElevators.mockResolvedValue([mockElevator]);
      mockDb.updateElevator.mockResolvedValue(undefined);
      mockDb.logElevatorEvent.mockResolvedValue(undefined);

      const result = await elevatorService.callElevator({
        fromFloor: 1,
        toFloor: 5
      });

      // From elevator at 3 to 1 (2 floors) + from 1 to 5 (4 floors) = 6 floors * 1 second + 2 door operations * 0.5 seconds = 7 seconds
      expect(result.estimatedTime).toBe(7);
    });
  });

  describe('movement management', () => {
    it('should stop all movements when stopAllMovements is called', () => {
      // This is a bit tricky to test since we're dealing with internal timeouts
      // We can at least verify the method doesn't throw
      expect(() => elevatorService.stopAllMovements()).not.toThrow();
    });
  });
});