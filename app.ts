import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import type { Request, Response } from 'express';
import { DatabaseManager } from "./Database/DatabaseManager";
import { ElevatorService } from "./services/ElevatorService";
import { createElevatorRoutes } from "./routes/ElevatorRoutes";
import { ElevatorController } from "./controllers/ElevatorController";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { WebSocketService } from "./services/WebSocketService";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();

// Configure express
app.use(express.json());
app.use(cors());

// Serve static files from client directory
app.use(express.static('client'));

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize database
const db = new DatabaseManager();
await db.initialize();

// Initialize services
const wsService = new WebSocketService(wss);
const elevatorService = new ElevatorService(db, {
    totalFloors: 10,
    floorMoveTime: 5,
    doorOpenCloseTime: 2
}, wsService);
const elevatorController = new ElevatorController(elevatorService);

app.get("/", (req: Request, res: Response) => {
    res.json({
        message: "Elevator API System",
        version: "1.0.0",
        endpoints: {
            "GET /index.html": "Real Time Updates & Monitoring",
            "POST /api/elevator/call": "Call elevator from one floor to another",
            "GET /api/elevator/status/:elevatorId?": "Get elevator status (all or specific)",
            "GET /api/elevator/logs/:elevatorId?": "Get elevator logs",
            "GET /api/elevator/query-logs": "Get SQL query logs",
            "PUT /api/elevator/config": "Update building configuration",
            "GET /api/elevator/config": "Get building configuration"
        }
    });
})

// Elevator API routes
app.use("/api/elevator", createElevatorRoutes(elevatorController));

// Start server
server.listen(PORT, () => {
    console.log(`Elevator Server is running on port ${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
})

// Cleanup on shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    elevatorService.stopAllMovements();
    wss.close();
    server.close(() => {
        db.close();
        process.exit(0);
    });
});