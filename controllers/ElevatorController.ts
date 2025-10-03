import type { Request, Response } from 'express';
import { ElevatorService } from '../services/ElevatorService';

/**
 * @brief Elevator controller class
 * @description This class is used to control the elevator system
 */
export class ElevatorController {
  /**
   * @description Constructor for the ElevatorController class
   * @param elevatorService - The elevator service instance
   */
  constructor(private elevatorService: ElevatorService) {}

  // POST /call
  /**
   * @brief Call elevator
   * @description Call elevator with fromFloor, toFloor, and requestedBy
   * @param req - The request object
   * @param res - The response object
   */
  async callElevator(req: Request, res: Response) {
    try {
      const { fromFloor, toFloor, requestedBy } = req.body;

      if (!fromFloor || !toFloor) {
        return res.status(400).json({
          error: 'fromFloor and toFloor are required'
        });
      }

      const result = await this.elevatorService.callElevator({
        fromFloor: parseInt(fromFloor as string, 10),
        toFloor: parseInt(toFloor as string, 10),
        requestedBy: requestedBy || req.ip
      });

      res.json({
        success: true,
        message: 'Elevator called successfully',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  // GET /status/:elevatorId?
  /**
   * @brief Get elevator status
   * @description Get elevator status with elevatorId
   * @param req - The request object
   * @param res - The response object
   */
  async getStatus(req: Request, res: Response) {
    try {
      const { elevatorId } = req.params;
      const status = await this.elevatorService.getElevatorStatus(elevatorId);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(404).json({
        error: error instanceof Error ? error.message : 'Elevator not found'
      });
    }
  }

  // GET /logs/:elevatorId?
  /**
   * @brief Get elevator logs
   * @description Get elevator logs with elevatorId and limit
   * @param req - The request object
   * @param res - The response object
   */
  async getLogs(req: Request, res: Response) {
    try {
      const { elevatorId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const logs = await this.elevatorService.getElevatorLogs(elevatorId, limit);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch logs'
      });
    }
  }

  // GET /query-logs
  /**
   * @brief Get query logs
   * @description Get query logs with limit
   * @param req - The request object
   * @param res - The response object
   */
  async getQueryLogs(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await this.elevatorService.getQueryLogs(limit);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch query logs'
      });
    }
  }

  // PUT /config
  /**
   * @brief Update config
   * @description Update config with totalFloors, floorMoveTime, and doorOpenCloseTime
   * @param req - The request object
   * @param res - The response object
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const { totalFloors, floorMoveTime, doorOpenCloseTime } = req.body;
      
      await this.elevatorService.updateBuildingConfig({
        totalFloors,
        floorMoveTime,
        doorOpenCloseTime
      });

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: this.elevatorService.getBuildingConfig()
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to update configuration'
      });
    }
  }

  // GET /config
  /**
   * @brief Get config
   * @description Get config
   * @param req - The request object
   * @param res - The response object
   */
    async getConfig(req: Request, res: Response) {
    try {
      const config = this.elevatorService.getBuildingConfig();
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch configuration'
      });
    }
  }
}