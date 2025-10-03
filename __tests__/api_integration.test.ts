import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseManager } from '../Database/DatabaseManager';
import { ElevatorService } from '../services/ElevatorService';
import { ElevatorController } from '../controllers/ElevatorController';
import { createElevatorRoutes } from '../routes/ElevatorRoutes';

describe('Elevator API End-to-End Tests', () => {
  let app: express.Application;
  let db: DatabaseManager;
  let elevatorService: ElevatorService;

  beforeAll(async () => {
    // Use in-memory database for testing
    process.env.DB_PATH = ':memory:';
    
    // Initialize database
    db = new DatabaseManager();
    await db.initialize();
    
    // Create services
    elevatorService = new ElevatorService(db);
    const elevatorController = new ElevatorController(elevatorService);
    
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/elevator', createElevatorRoutes(elevatorController));
  });

  afterAll(async () => {
    elevatorService.stopAllMovements();
    
    // Wait for any pending operations before closing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      db.close();
    } catch (error) {
      // Ignore close errors in tests
    }
  });

  beforeEach(async () => {
    // Reset all elevators to idle state
    const elevators = await db.getAllElevators();
    for (const elevator of elevators) {
      elevator.state = 'idle';
      elevator.targetFloor = 0;
      elevator.direction = null;
      elevator.isMoving = false;
      elevator.currentFloor = 1;
      elevator.lastUpdated = new Date();
      await db.updateElevator(elevator);
    }
  });

  describe('POST /api/elevator/call', () => {
    it('should successfully call an elevator', async () => {
      const response = await request(app)
        .post('/api/elevator/call')
        .send({
          fromFloor: 1,
          toFloor: 5,
          requestedBy: 'test-user'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Elevator called successfully',
        data: {
          elevatorId: expect.stringMatching(/^elevator-\d+$/),
          estimatedTime: expect.any(Number)
        }
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/elevator/call')
        .send({ fromFloor: 1 })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'fromFloor and toFloor are required'
      });
    });

    it('should return 400 for same from and to floors', async () => {
      const response = await request(app)
        .post('/api/elevator/call')
        .send({
          fromFloor: 3,
          toFloor: 3
        })
        .expect(400);

      expect(response.body.error).toContain('From floor and to floor cannot be the same');
    });

    it('should use IP address when requestedBy is not provided', async () => {
      const response = await request(app)
        .post('/api/elevator/call')
        .send({
          fromFloor: 1,
          toFloor: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/elevator/status', () => {
    it('should return all elevators status', async () => {
      const response = await request(app)
        .get('/api/elevator/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^elevator-\d+$/),
            currentFloor: expect.any(Number),
            state: expect.any(String),
            isMoving: expect.any(Boolean),
            lastUpdated: expect.any(String)
          })
        ])
      });

      expect(response.body.data).toHaveLength(5);
    });

    it('should return specific elevator status', async () => {
      const response = await request(app)
        .get('/api/elevator/status/elevator-1')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'elevator-1',
          currentFloor: expect.any(Number),
          state: expect.any(String),
          isMoving: expect.any(Boolean)
        })
      });
    });

    it('should return 404 for non-existent elevator', async () => {
      const response = await request(app)
        .get('/api/elevator/status/nonexistent')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/elevator/logs', () => {
    it('should return elevator logs', async () => {
      // First, create some logs by calling an elevator
      await request(app)
        .post('/api/elevator/call')
        .send({ fromFloor: 1, toFloor: 3 });

      const response = await request(app)
        .get('/api/elevator/logs')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            elevatorId: expect.any(String),
            event: expect.any(String),
            timestamp: expect.any(String),
            details: expect.any(String)
          })
        ])
      });
    });

    it('should return logs for specific elevator', async () => {
      await request(app)
        .post('/api/elevator/call')
        .send({ fromFloor: 1, toFloor: 3 });

      const response = await request(app)
        .get('/api/elevator/logs/elevator-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/elevator/logs?limit=5')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/elevator/query-logs', () => {
    it('should return SQL query logs', async () => {
      // Trigger some database operations
      await request(app).get('/api/elevator/status');

      const response = await request(app)
        .get('/api/elevator/query-logs')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            query: expect.any(String),
            executedBy: expect.any(String),
            executedAt: expect.any(String),
            source: expect.any(String)
          })
        ])
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/elevator/query-logs?limit=3')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('PUT /api/elevator/config', () => {
    it('should update building configuration', async () => {
      const newConfig = {
        totalFloors: 20,
        floorMoveTime: 3,
        doorOpenCloseTime: 1
      };

      const response = await request(app)
        .put('/api/elevator/config')
        .send(newConfig)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Configuration updated successfully',
        data: expect.objectContaining({
          totalFloors: 20,
          floorMoveTime: 3,
          doorOpenCloseTime: 1
        })
      });
    });
  });

  describe('GET /api/elevator/config', () => {
    it('should return current configuration', async () => {
      const response = await request(app)
        .get('/api/elevator/config')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          totalFloors: expect.any(Number),
          floorMoveTime: expect.any(Number),
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/elevator/call')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle unsupported HTTP methods', async () => {
      await request(app)
        .patch('/api/elevator/status')
        .expect(404);
    });

    it('should handle non-existent routes', async () => {
      await request(app)
        .get('/api/elevator/nonexistent')
        .expect(404);
    });
  });
});