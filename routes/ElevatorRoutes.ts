import { Router } from 'express';
import { ElevatorController } from '../controllers/ElevatorController';

/**
 * @brief Create elevator routes
 * @description Create elevator routes with elevatorController
 * @param elevatorController - The elevator controller instance
 * @returns The router
 */
export function createElevatorRoutes(elevatorController: ElevatorController): Router {
  const router = Router();

  // Call elevator
  router.post('/call', (req, res) => elevatorController.callElevator(req, res));

  // Get status
  router.get('/status{/:elevatorId}', (req, res) => elevatorController.getStatus(req, res));

  // Get logs
  router.get('/logs{/:elevatorId}', (req, res) => elevatorController.getLogs(req, res));

  // Get query logs
  router.get('/query-logs', (req, res) => elevatorController.getQueryLogs(req, res));

  /**
   * @brief Update config
   * @description Update config with totalFloors, floorMoveTime, and doorOpenCloseTime
   * @param req - The request object
   * @param res - The response object
   */
  router.put('/config', (req, res) => elevatorController.updateConfig(req, res));

  /**
   * @brief Get config
   * @description Get config
   * @param req - The request object
   * @param res - The response object
   */
  router.get('/config', (req, res) => elevatorController.getConfig(req, res));

  return router;
}