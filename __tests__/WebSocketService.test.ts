import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { WebSocketService } from '../services/WebSocketService';
import type { Elevator, ElevatorLog } from '../utils/types';

describe('WebSocketService', () => {
  let wss: WebSocketServer;
  let wsService: WebSocketService;
  let mockClient: WebSocket;
  let port: number;

  beforeEach(async () => {
    // Create a real WebSocket server for testing
    port = 8080 + Math.floor(Math.random() * 1000);
    wss = new WebSocketServer({ port });
    wsService = new WebSocketService(wss);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    wsService.closeAll();
    wss.close();
  });

  it('should accept WebSocket connections', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);
    
    await new Promise((resolve) => {
      client.on('open', resolve);
    });

    expect(wsService.getConnectedClientsCount()).toBe(1);
    client.close();
  });

  it('should broadcast elevator updates to all clients', async () => {
    const client1 = new WebSocket(`ws://localhost:${port}`);
    const client2 = new WebSocket(`ws://localhost:${port}`);

    await Promise.all([
      new Promise(resolve => client1.on('open', resolve)),
      new Promise(resolve => client2.on('open', resolve))
    ]);

    const elevator: Elevator = {
      id: 'elevator-1',
      currentFloor: 3,
      targetFloor: 5,
      state: 'moving_up',
      direction: 'up',
      isMoving: true,
      lastUpdated: new Date()
    };

    const messages: any[] = [];
    client1.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    wsService.broadcastElevatorUpdate(elevator);

    await new Promise(resolve => setTimeout(resolve, 100));

    const updateMessage = messages.find(m => m.type === 'elevator_update');
    expect(updateMessage).toBeDefined();
    expect(updateMessage.data.id).toBe('elevator-1');
    expect(updateMessage.data.currentFloor).toBe(3);

    client1.close();
    client2.close();
  });

  it('should broadcast elevator logs in real-time', async () => {
    const client = new WebSocket(`ws://localhost:${port}`);
    
    await new Promise(resolve => client.on('open', resolve));

    const log: ElevatorLog = {
      id: 'log-123',
      elevatorId: 'elevator-1',
      event: 'floor_reached',
      fromFloor: 2,
      toFloor: 3,
      state: 'moving_up',
      direction: 'up',
      timestamp: new Date(),
      details: 'Elevator moved to floor 3'
    };

    const messages: any[] = [];
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });

    wsService.broadcastElevatorLog(log);

    await new Promise(resolve => setTimeout(resolve, 100));

    const logMessage = messages.find(m => m.type === 'elevator_log');
    expect(logMessage).toBeDefined();
    expect(logMessage.data.event).toBe('floor_reached');

    client.close();
  });
});