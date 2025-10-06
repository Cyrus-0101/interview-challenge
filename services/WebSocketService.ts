import { WebSocketServer, WebSocket } from 'ws';
import type { Elevator, ElevatorLog, QueryLog } from '../utils/types';

interface WebSocketMessage {
  type: 'elevator_update' | 'elevator_log' | 'query_log' | 'error' | 'connected';
  data?: any;
  timestamp: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        data: {
          message: 'Connected to Elevator System WebSocket',
          availableEvents: [
            'elevator_update - Real-time elevator status changes',
            'elevator_log - Event logs as they happen',
            'query_log - SQL query execution logs'
          ]
        },
        timestamp: new Date().toISOString()
      });

      // Handle client messages (for subscriptions)
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          this.sendToClient(ws, {
            type: 'error',
            data: { message: 'Invalid JSON message' },
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, data: any) {
    // Handle subscription requests, filters, etc.
    if (data.action === 'subscribe') {
      // Store subscription preferences (could extend this)
      ws.send(JSON.stringify({
        type: 'info',
        data: { message: `Subscribed to ${data.events || 'all events'}` },
        timestamp: new Date().toISOString()
      }));
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast elevator status update to all connected clients
   */
  broadcastElevatorUpdate(elevator: Elevator) {
    const message: WebSocketMessage = {
      type: 'elevator_update',
      data: elevator,
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
  }

  /**
   * Broadcast elevator event log to all connected clients
   */
  broadcastElevatorLog(log: ElevatorLog) {
    const message: WebSocketMessage = {
      type: 'elevator_log',
      data: log,
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
  }

  /**
   * Broadcast SQL query log to all connected clients
   */
  broadcastQueryLog(log: QueryLog) {
    const message: WebSocketMessage = {
      type: 'query_log',
      data: log,
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
  }

  /**
   * Send message to all connected clients
   */
  private broadcast(message: WebSocketMessage) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Get count of connected clients
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  closeAll() {
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients.clear();
  }
}