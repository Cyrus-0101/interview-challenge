import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ElevatorController } from '../controllers/ElevatorController';
import { ElevatorService } from '../services/ElevatorService';

// Mock the ElevatorService
vi.mock('../services/ElevatorService');

describe('ElevatorController Integration Tests', () => {
  let controller: ElevatorController;
  let mockElevatorService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseData: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock service
    mockElevatorService = {
      callElevator: vi.fn(),
      getElevatorStatus: vi.fn(),
      getElevatorLogs: vi.fn(),
      getQueryLogs: vi.fn(),
      updateBuildingConfig: vi.fn(),
      getBuildingConfig: vi.fn()
    };

    // Create controller with mock service (no need to mock DatabaseManager)
    controller = new ElevatorController(mockElevatorService);

    // Setup mock request/response
    mockRequest = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return mockResponse;
      })
    };

    responseData = null;
  });

  describe('callElevator', () => {
    it('should successfully call elevator with valid data', async () => {
      const mockResult = { elevatorId: 'elevator-1', estimatedTime: 25 };
      mockElevatorService.callElevator.mockResolvedValue(mockResult);
      
      mockRequest.body = {
        fromFloor: 1,
        toFloor: 5,
        requestedBy: 'test-user'
      };

      await controller.callElevator(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.callElevator).toHaveBeenCalledWith({
        fromFloor: 1,
        toFloor: 5,
        requestedBy: 'test-user'
      });
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Elevator called successfully',
        data: mockResult
      });
    });

    it('should handle missing required fields', async () => {
      mockRequest.body = { fromFloor: 1 }; // Missing toFloor

      await controller.callElevator(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'fromFloor and toFloor are required'
      });
    });

    it('should handle service errors', async () => {
      mockElevatorService.callElevator.mockRejectedValue(new Error('Invalid floor'));
      mockRequest.body = { fromFloor: 1, toFloor: 5 };

      await controller.callElevator(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid floor'
      });
    });
  });

  describe('getStatus', () => {
    it('should return all elevators when no ID provided', async () => {
      const mockStatus = [
        { id: 'elevator-1', currentFloor: 1, state: 'idle' },
        { id: 'elevator-2', currentFloor: 3, state: 'moving_up' }
      ];
      mockElevatorService.getElevatorStatus.mockResolvedValue(mockStatus);

      await controller.getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getElevatorStatus).toHaveBeenCalledWith(undefined);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus
      });
    });

    it('should return specific elevator when ID provided', async () => {
      const mockStatus = { id: 'elevator-1', currentFloor: 1, state: 'idle' };
      mockElevatorService.getElevatorStatus.mockResolvedValue(mockStatus);
      mockRequest.params = { elevatorId: 'elevator-1' };

      await controller.getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getElevatorStatus).toHaveBeenCalledWith('elevator-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStatus
      });
    });

    it('should handle elevator not found', async () => {
      mockElevatorService.getElevatorStatus.mockRejectedValue(new Error('Elevator elevator-1 not found'));
      mockRequest.params = { elevatorId: 'elevator-1' };

      await controller.getStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Elevator elevator-1 not found'
      });
    });
  });

  describe('getLogs', () => {
    it('should return logs with default limit', async () => {
      const mockLogs = [
        { id: 'log-1', elevatorId: 'elevator-1', event: 'elevator_called' }
      ];
      mockElevatorService.getElevatorLogs.mockResolvedValue(mockLogs);

      await controller.getLogs(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getElevatorLogs).toHaveBeenCalledWith(undefined, 100);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs
      });
    });

    it('should return logs with custom limit', async () => {
      const mockLogs: any[] = [];
      mockElevatorService.getElevatorLogs.mockResolvedValue(mockLogs);
      mockRequest.query = { limit: '50' };

      await controller.getLogs(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getElevatorLogs).toHaveBeenCalledWith(undefined, 50);
    });

    it('should handle service errors', async () => {
      mockElevatorService.getElevatorLogs.mockRejectedValue(new Error('Database error'));

      await controller.getLogs(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });
  });

  describe('getQueryLogs', () => {
    it('should return query logs with default limit', async () => {
      const mockLogs = [
        { id: 'query-1', query: 'SELECT * FROM elevators', source: 'getAllElevators' }
      ];
      mockElevatorService.getQueryLogs.mockResolvedValue(mockLogs);

      await controller.getQueryLogs(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getQueryLogs).toHaveBeenCalledWith(100);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockLogs
      });
    });

    it('should return query logs with custom limit', async () => {
      const mockLogs: any[] = [];
      mockElevatorService.getQueryLogs.mockResolvedValue(mockLogs);
      mockRequest.query = { limit: '25' };

      await controller.getQueryLogs(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.getQueryLogs).toHaveBeenCalledWith(25);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration successfully', async () => {
      const newConfig = { totalFloors: 20, floorMoveTime: 3 };
      const currentConfig = { totalFloors: 20, floorMoveTime: 3, doorOpenCloseTime: 2 };
      
      mockElevatorService.updateBuildingConfig.mockResolvedValue(undefined);
      mockElevatorService.getBuildingConfig.mockReturnValue(currentConfig);
      mockRequest.body = newConfig;

      await controller.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockElevatorService.updateBuildingConfig).toHaveBeenCalledWith(newConfig);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Configuration updated successfully',
        data: currentConfig
      });
    });

    it('should handle configuration errors', async () => {
      mockElevatorService.updateBuildingConfig.mockRejectedValue(new Error('Invalid configuration'));
      mockRequest.body = { totalFloors: -1 };

      await controller.updateConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid configuration'
      });
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', async () => {
      const config = { totalFloors: 10, floorMoveTime: 5, doorOpenCloseTime: 2 };
      mockElevatorService.getBuildingConfig.mockReturnValue(config);

      await controller.getConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: config
      });
    });

    it('should handle configuration retrieval errors', async () => {
      mockElevatorService.getBuildingConfig.mockImplementation(() => {
        throw new Error('Configuration unavailable');
      });

      await controller.getConfig(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Configuration unavailable'
      });
    });
  });
});