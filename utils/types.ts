export interface Elevator {
    id: string;
    currentFloor: number;
    targetFloor: number;
    state: 'idle' | 'moving_up' | 'moving_down' | 'doors_opening' | 'doors_closing' | 'doors_open';
    direction: 'up' | 'down' | null;
    isMoving: boolean;
    lastUpdated: Date;
}

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
  
export interface QueryLog {
    id: string;
    query: string;
    executedBy: string;
    executedAt: string;
    source: string;
    parameters?: string;
}