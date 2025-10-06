import { WebSocketService } from './WebSocketService';
import type { DatabaseManager } from "../Database/DatabaseManager";
import type {
  BuildingConfig,
  Elevator,
  ElevatorLog,
  ElevatorRequest,
} from "../utils/types";

export class ElevatorService {
  private db: DatabaseManager;
  private config: BuildingConfig;
  private activeMovements: Map<string, NodeJS.Timeout> = new Map();
  private activeDoorOperations: Map<string, NodeJS.Timeout> = new Map();
  private wsService?: WebSocketService;
  private floorQueues: Map<string, number[]> = new Map(); // Queue to track multi-stage journeys: [pickupFloor, destinationFloor, ...]

  /**
   * Constructor for ElevatorService
   * @param db - DatabaseManager instance
   * @param config - Building configuration
   * @param wsService - WebSocketService instance
   */
  constructor(
    db: DatabaseManager,
    config: BuildingConfig = {
      totalFloors: 10,
      floorMoveTime: 5,
      doorOpenCloseTime: 2,
    },
    wsService?: WebSocketService
  ) {
    this.db = db;
    this.config = config;
    this.wsService = wsService;
  }

  async callElevator(
    request: ElevatorRequest
  ): Promise<{ elevatorId: string; estimatedTime: number }> {
    const { fromFloor, toFloor, requestedBy = "anonymous" } = request;

    // Validate floors
    if (
      fromFloor < 1 ||
      fromFloor > this.config.totalFloors ||
      toFloor < 1 ||
      toFloor > this.config.totalFloors
    ) {
      throw new Error(
        `Invalid floor. Building has ${this.config.totalFloors} floors.`
      );
    }

    if (fromFloor === toFloor) {
      throw new Error("From floor and to floor cannot be the same.");
    }

    // Find the best elevator
    const bestElevator = await this.findBestElevator(fromFloor, toFloor);

    // Initialize or get the floor queue for this elevator
    if (!this.floorQueues.has(bestElevator.id)) {
      this.floorQueues.set(bestElevator.id, []);
    }
    const queue = this.floorQueues.get(bestElevator.id)!;

    // Add both pickup and destination floors to the queue
    // Only add fromFloor if elevator is not already there
    if (bestElevator.currentFloor !== fromFloor) {
      queue.push(fromFloor);
    }
    queue.push(toFloor);

    // Set the first target floor
    bestElevator.targetFloor = queue[0];
    bestElevator.direction = bestElevator.currentFloor < bestElevator.targetFloor ? "up" : "down";
    bestElevator.lastUpdated = new Date();

    await this.db.updateElevator(bestElevator);

    // Broadcast elevator update
    if (this.wsService) {
      this.wsService.broadcastElevatorUpdate(bestElevator);
    }

    // Log the request
    const logEntry = {
      elevatorId: bestElevator.id,
      event: "elevator_called",
      fromFloor,
      toFloor,
      state: bestElevator.state,
      direction: bestElevator.direction,
      timestamp: new Date(),
      details: `Elevator called from floor ${fromFloor} to floor ${toFloor} by ${requestedBy}`,
    };
    await this.db.logElevatorEvent(logEntry);

    this.wsService?.broadcastElevatorLog({
      id: `log-${Date.now()}`,
      ...logEntry
    } as any);

    // Start movement if not already moving
    if (!bestElevator.isMoving) {
      await this.startElevatorMovement(bestElevator.id);
    }

    // Calculate estimated time
    const estimatedTime = this.calculateEstimatedTime(
      bestElevator,
      fromFloor,
      toFloor
    );

    return {
      elevatorId: bestElevator.id,
      estimatedTime,
    };
  }

  private async findBestElevator(
    fromFloor: number,
    toFloor: number
  ): Promise<Elevator> {
    const elevators = await this.db.getAllElevators();

    // Score each elevator based on distance and current state
    const scoredElevators = elevators.map((elevator: Elevator) => {
      let score = 0;

      // Distance score (lower is better)
      const distance = Math.abs(elevator.currentFloor - fromFloor);
      score += distance * 10;

      // If elevator is idle, it's preferred
      if (elevator.state === "idle") {
        score -= 50;
      }

      // If elevator is already moving in the right direction
      if (elevator.isMoving && elevator.direction) {
        const isMovingTowards =
          (elevator.direction === "up" && fromFloor > elevator.currentFloor) ||
          (elevator.direction === "down" && fromFloor < elevator.currentFloor);
        if (isMovingTowards) {
          score -= 20;
        } else {
          score += 30; // Moving away is worse
        }
      }

      return { elevator, score };
    });

    // Sort by score and return the best one
    scoredElevators.sort(
      (
        a: { score: number; elevator: Elevator },
        b: { score: number; elevator: Elevator }
      ) => a.score - b.score
    );
    return scoredElevators[0].elevator;
  }

  private calculateEstimatedTime(
    elevator: Elevator,
    fromFloor: number,
    toFloor: number
  ): number {
    const currentFloor = elevator.currentFloor;
    const floorsToMove =
      Math.abs(currentFloor - fromFloor) + Math.abs(fromFloor - toFloor);
    const timeToMove = floorsToMove * this.config.floorMoveTime;
    const doorTime = this.config.doorOpenCloseTime * 2; // Open and close
    return timeToMove + doorTime;
  }

  private async startElevatorMovement(elevatorId: string): Promise<void> {
    if (this.activeMovements.has(elevatorId)) {
      return; // Already moving
    }

    const moveElevator = async () => {
      const elevator = await this.db.getElevator(elevatorId);
      if (!elevator || !elevator.targetFloor) {
        this.activeMovements.delete(elevatorId);
        return;
      }

      // Check if we've reached the target
      if (elevator.currentFloor === elevator.targetFloor) {
        await this.handleArrival(elevator);
        
        // Check if there are more floors in the queue
        const queue = this.floorQueues.get(elevatorId) || [];
        queue.shift(); // Remove the current target we just reached
        
        if (queue.length > 0) {
          // Set next target from queue
          elevator.targetFloor = queue[0];
          elevator.direction = elevator.currentFloor < elevator.targetFloor ? "up" : "down";
          elevator.state = "idle"; // Reset state before starting new journey
          elevator.isMoving = false;
          await this.db.updateElevator(elevator);
          
          if (this.wsService) {
            this.wsService.broadcastElevatorUpdate(elevator);
          }
          
          // Continue to next floor in queue
          this.activeMovements.delete(elevatorId);
          await this.startElevatorMovement(elevatorId);
          return;
        }
        
        this.activeMovements.delete(elevatorId);
        return;
      }

      // Move one floor
      const newFloor =
        elevator.direction === "up"
          ? elevator.currentFloor + 1
          : elevator.currentFloor - 1;

      // Clamp to valid floors
      if (newFloor < 1 || newFloor > this.config.totalFloors) {
        // Stop movement and set elevator to idle
        elevator.state = "idle";
        elevator.isMoving = false;
        elevator.direction = null;
        elevator.targetFloor = 1;
        await this.db.updateElevator(elevator);
        this.activeMovements.delete(elevatorId);
        await this.db.logElevatorEvent({
          elevatorId: elevator.id,
          event: "elevator_idle",
          fromFloor: elevator.currentFloor,
          toFloor: elevator.currentFloor,
          state: elevator.state,
          direction: elevator.direction,
          timestamp: new Date(),
          details: `Elevator stopped at invalid floor boundary`,
        });
        return;
      }
      elevator.currentFloor = newFloor;
      elevator.state =
        elevator.direction === "up" ? "moving_up" : "moving_down";
      elevator.isMoving = true;
      elevator.lastUpdated = new Date();

      await this.db.updateElevator(elevator);

      if (this.wsService) {
        this.wsService.broadcastElevatorUpdate(elevator);
      }

      // Log the movement
      const logEntry = {
        elevatorId: elevator.id,
        event: "floor_reached",
        fromFloor: elevator.direction === "up" ? newFloor - 1 : newFloor + 1,
        toFloor: newFloor,
        state: elevator.state,
        direction: elevator.direction,
        timestamp: new Date(),
        details: `Elevator moved to floor ${newFloor}`,
      };
      await this.db.logElevatorEvent(logEntry);

      this.wsService?.broadcastElevatorLog({
        id: `log-${Date.now()}`,
        ...logEntry
      } as any);

      // Schedule next movement
      const timeout = setTimeout(
        moveElevator,
        this.config.floorMoveTime * 1000
      );
      this.activeMovements.set(elevatorId, timeout);
    };

    // Start the movement
    moveElevator();
  }

  private async handleArrival(elevator: Elevator): Promise<void> {
    // Open doors
    elevator.state = "doors_opening";
    elevator.lastUpdated = new Date();
    await this.db.updateElevator(elevator);

    const logEntry: ElevatorLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      elevatorId: elevator.id,
      event: "doors_opening",
      fromFloor: elevator.currentFloor,
      toFloor: elevator.currentFloor,
      state: elevator.state,
      direction: elevator.direction,
      timestamp: new Date(),
      details: `Doors opening at floor ${elevator.currentFloor}`,
    };
    await this.db.logElevatorEvent(logEntry);

    if (this.wsService) {
      this.wsService.broadcastElevatorLog(logEntry);
    }

    // Wait for doors to open
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.doorOpenCloseTime * 1000)
    );

    // Doors are open
    elevator.state = "doors_open";
    elevator.lastUpdated = new Date();
    await this.db.updateElevator(elevator);

    await this.db.logElevatorEvent({
      elevatorId: elevator.id,
      event: "doors_open",
      fromFloor: elevator.currentFloor,
      toFloor: elevator.currentFloor,
      state: elevator.state,
      direction: elevator.direction,
      timestamp: new Date(),
      details: `Doors open at floor ${elevator.currentFloor}`,
    });

    // Wait for doors to be open
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 seconds open

    // Close doors
    elevator.state = "doors_closing";
    elevator.lastUpdated = new Date();
    await this.db.updateElevator(elevator);

    await this.db.logElevatorEvent({
      elevatorId: elevator.id,
      event: "doors_closing",
      fromFloor: elevator.currentFloor,
      toFloor: elevator.currentFloor,
      state: elevator.state,
      direction: elevator.direction,
      timestamp: new Date(),
      details: `Doors closing at floor ${elevator.currentFloor}`,
    });

    // Wait for doors to close
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.doorOpenCloseTime * 1000)
    );

    // Reset elevator to idle
    elevator.state = "idle";
    elevator.targetFloor = 0;
    elevator.direction = null;
    elevator.isMoving = false;
    elevator.lastUpdated = new Date();
    await this.db.updateElevator(elevator);

    await this.db.logElevatorEvent({
      elevatorId: elevator.id,
      event: "elevator_idle",
      fromFloor: elevator.currentFloor,
      toFloor: elevator.currentFloor,
      state: elevator.state,
      direction: elevator.direction,
      timestamp: new Date(),
      details: `Elevator idle at floor ${elevator.currentFloor}`,
    });
  }

  async getElevatorStatus(elevatorId?: string): Promise<Elevator | Elevator[]> {
    if (elevatorId) {
      const elevator = await this.db.getElevator(elevatorId);
      if (!elevator) {
        throw new Error(`Elevator ${elevatorId} not found`);
      }
      return elevator;
    }
    return await this.db.getAllElevators();
  }

  async getElevatorLogs(
    elevatorId?: string,
    limit: number = 100
  ): Promise<ElevatorLog[]> {
    return await this.db.getElevatorLogs(elevatorId, limit);
  }

  async getQueryLogs(limit: number = 100) {
    return await this.db.getQueryLogs(limit);
  }

  async updateBuildingConfig(
    newConfig: Partial<BuildingConfig>
  ): Promise<void> {
    this.config = { ...this.config, ...newConfig };
  }

  getBuildingConfig(): BuildingConfig {
    return { ...this.config };
  }

  // Cleanup method to stop all active movements
  stopAllMovements(): void {
    this.activeMovements.forEach((timeout) => clearTimeout(timeout));
    this.activeMovements.clear();
    this.activeDoorOperations.forEach((timeout) => clearTimeout(timeout));
    this.activeDoorOperations.clear();
    this.floorQueues.clear();
  }
}
