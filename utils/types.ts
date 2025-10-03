/**
 * @brief Elevator interface
 */
export interface Elevator {
    id: string;
    currentFloor: number;
    targetFloor: number;
    state: 'idle' | 'moving_up' | 'moving_down' | 'doors_opening' | 'doors_closing' | 'doors_open';
    direction: 'up' | 'down' | null;
    isMoving: boolean;
    lastUpdated: Date;
}

/**
 * @brief Elevator log interface
 */
export interface ElevatorLog {
    id: string;
    elevatorId: string;
    event: string;
    fromFloor?: number;
    toFloor?: number;
    state: string;
    direction: string | null;
    timestamp: Date;
    details: string;
}
  
/**
 * @brief Query log interface
 */
export interface QueryLog {
    id: string;
    query: string;
    executedBy: string;
    executedAt: string;
    source: string;
    parameters?: string;
}

/**
 * @brief Building config interface
 */
export interface BuildingConfig {
    totalFloors: number;
    floorMoveTime: number; // seconds
    doorOpenCloseTime: number; // seconds
  }
  
  /**
   * @brief Elevator request interface
   */
  export interface ElevatorRequest {
    fromFloor: number;
    toFloor: number;
    requestedBy?: string;
  }