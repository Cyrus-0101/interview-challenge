import Database from "sqlite3";
import { promisify } from "util";
import type { Elevator, ElevatorLog, QueryLog } from "../utils/types";

/**
 * @brief Database manager class
 * @description This class is used to manage the database connection and queries
 */
export class DatabaseManager {
  /**
   * @brief Database instance
   * @description The database instance
   */
  private db: Database.Database;
  /**
   * @brief Run a query
   * @description This is a promise that returns the result of the query
   */
  private run: (sql: string, params?: any[]) => Promise<any>;
  /**
   * @description This is a promise that returns a single row from the database
   */
  private get: (sql: string, params?: any[]) => Promise<any>;
  /**
   * @description This is a promise that returns all rows from the database
   */
  private all: (sql: string, params?: any[]) => Promise<any[]>;

  constructor() {
    // Path to the database
    this.db = new Database.Database(
      process.env.DB_PATH || "./Database/Elevator.db"
    );

    // Initialize the promises with promisify
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
    this.all = promisify(this.db.all.bind(this.db));

    // Initialize the database
    this.initializeDatabase();
  }

  /**
   * @brief Initialize the database
   * @description Initialize the database with the elevators table, elevator_logs table, and query_logs table
   */
  private async initializeDatabase() {
    // Create the elevators table
    await this.run(`
            CREATE TABLE IF NOT EXISTS elevators (
                id TEXT PRIMARY KEY,
                current_floor INTEGER NOT NULL,
                target_floor INTEGER,
                state TEXT NOT NULL,
                direction TEXT,
                is_moving BOOLEAN NOT NULL,
                last_updated TEXT NOT NULL
            )
        `);

    // Create elevator_logs table
    await this.run(`
            CREATE TABLE IF NOT EXISTS elevator_logs (
            id TEXT PRIMARY KEY,
            elevator_id TEXT NOT NULL,
            event TEXT NOT NULL,
            from_floor INTEGER,
            to_floor INTEGER,
            state TEXT NOT NULL,
            direction TEXT,
            timestamp TEXT NOT NULL,
            details TEXT NOT NULL,
            FOREIGN KEY (elevator_id) REFERENCES elevators (id)
            )
        `);

    // Create query_logs table
    await this.run(`
            CREATE TABLE IF NOT EXISTS query_logs (
            id TEXT PRIMARY KEY,
            query TEXT NOT NULL,
            executed_by TEXT NOT NULL,
            executed_at TEXT NOT NULL,
            source TEXT NOT NULL,
            parameters TEXT
            )
        `);

    // Initialize default elevators
    const exisitingElevators = await this.all(
      "SELECT COUNT(*) as count from elevators"
    );
    if (exisitingElevators[0].count === 0) {
      await this.initializeDefaultElevators();
    }
  }

  /**
   * @brief Initialize default elevators
   * @description Initialize default elevators with id, current floor, state, and direction
   */
  private async initializeDefaultElevators() {
    const elevators = [
      { id: "elevator-1", currentFloor: 1, state: "idle", direction: null },
      { id: "elevator-2", currentFloor: 1, state: "idle", direction: null },
      { id: "elevator-3", currentFloor: 1, state: "idle", direction: null },
      { id: "elevator-4", currentFloor: 1, state: "idle", direction: null },
      { id: "elevator-5", currentFloor: 1, state: "idle", direction: null },
    ];

    for (const elevator of elevators) {
      await this.run(
        `
              INSERT INTO elevators (id, current_floor, target_floor, state, direction, is_moving, last_updated)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
        [
          elevator.id,
          elevator.currentFloor,
          null,
          elevator.state,
          elevator.direction,
          false,
          new Date().toISOString(),
        ]
      );
    }
  }

  /**
   * @brief Log a query
   * @description Log a query with id, query, executed by, executed at, source, and parameters
   * @param query - The query to log
   * @param executedBy - The user who executed the query
   * @param source - The source of the query
   * @param parameters - The parameters of the query
   */
  async logQuery(
    query: string,
    executedBy: string,
    source: string,
    parameters?: any
  ) {
    const id = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.run(
      `
      INSERT INTO query_logs (id, query, executed_by, executed_at, source, parameters)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        query,
        executedBy,
        new Date().toISOString(),
        source,
        JSON.stringify(parameters),
      ]
    );
  }

  /**
   * @brief Get all elevators
   * @description Get all elevators from the database
   * @returns All elevators
   */
  async getAllElevators(): Promise<Elevator[]> {
    await this.logQuery("SELECT * FROM elevators", "system", "getAllElevators");
    const rows = await this.all("SELECT * FROM elevators");
    return rows.map(this.mapRowToElevator);
  }

  /**
   * @brief Get an elevator
   * @description Get an elevator from the database
   * @param id - The id of the elevator
   * @returns The elevator
   */
  async getElevator(id: string): Promise<Elevator | null> {
    await this.logQuery(
      "SELECT * FROM elevators WHERE id = ?",
      "system",
      "getElevator",
      [id]
    );
    const row = await this.get("SELECT * FROM elevators WHERE id = ?", [id]);
    return row ? this.mapRowToElevator(row) : null;
  }

  /**
   * @brief Update an elevator
   * @description Update an elevator in the database
   * @param elevator - The elevator to update
   */
  async updateElevator(elevator: Elevator): Promise<void> {
    await this.logQuery(
      "UPDATE elevators SET current_floor = ?, target_floor = ?, state = ?, direction = ?, is_moving = ?, last_updated = ? WHERE id = ?",
      "system",
      "updateElevator",
      [
        elevator.currentFloor,
        elevator.targetFloor,
        elevator.state,
        elevator.direction,
        elevator.isMoving,
        elevator.lastUpdated,
        elevator.id,
      ]
    );

    await this.run(
      `
      UPDATE elevators 
      SET current_floor = ?, target_floor = ?, state = ?, direction = ?, is_moving = ?, last_updated = ?
      WHERE id = ?
    `,
      [
        elevator.currentFloor,
        elevator.targetFloor,
        elevator.state,
        elevator.direction,
        elevator.isMoving,
        elevator.lastUpdated,
        elevator.id,
      ]
    );
  }

  /**
   * @brief Log an elevator event
   * @description Log an elevator event with id, elevator id, event, from floor, to floor, state, direction, timestamp, and details
   * @param log - The elevator log to log
   */
  async logElevatorEvent(log: Omit<ElevatorLog, "id">): Promise<void> {
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.run(
      `
      INSERT INTO elevator_logs (id, elevator_id, event, from_floor, to_floor, state, direction, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        log.elevatorId,
        log.event,
        log.fromFloor,
        log.toFloor,
        log.state,
        log.direction,
        log.timestamp,
        log.details,
      ]
    );
  }

  /**
   * @brief Get elevator logs
   * @description Get elevator logs from the database
   * @param elevatorId - The id of the elevator
   * @param limit - The limit of the logs
   * @returns The elevator logs
   */
  async getElevatorLogs(
    elevatorId?: string,
    limit: number = 100
  ): Promise<ElevatorLog[]> {
    let query = "SELECT * FROM elevator_logs";
    let params: any[] = [];

    if (elevatorId) {
      query += " WHERE elevator_id = ?";
      params.push(elevatorId);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    await this.logQuery(query, "system", "getElevatorLogs", params);
    const rows = await this.all(query, params);
    return rows.map(this.mapRowToElevatorLog);
  }

  /**
   * @brief Get query logs
   * @description Get query logs from the database
   * @param limit - The limit of the logs
   * @returns The query logs
   */
  async getQueryLogs(limit: number = 100): Promise<QueryLog[]> {
    await this.logQuery(
      "SELECT * FROM query_logs ORDER BY executed_at DESC LIMIT ?",
      "system",
      "getQueryLogs",
      [limit]
    );
    const rows = await this.all(
      "SELECT * FROM query_logs ORDER BY executed_at DESC LIMIT ?",
      [limit]
    );
    return rows.map(this.mapRowToQueryLog);
  }

  /**
   * @brief Map a row to an elevator
   * @description Map a row to an elevator
   * @param row - The row to map
   * @returns The elevator
   */
    private mapRowToElevator(row: any): Elevator {
    return {
      id: row.id,
      currentFloor: row.current_floor,
      targetFloor: row.target_floor,
      state: row.state,
      direction: row.direction,
      isMoving: Boolean(row.is_moving),
      lastUpdated: row.last_updated,
    };
  }

  /**
   * @brief Map a row to an elevator log
   * @description Map a row to an elevator log
   * @param row - The row to map
   * @returns The elevator log
   */
  private mapRowToElevatorLog(row: any): ElevatorLog {
    return {
      id: row.id,
      elevatorId: row.elevator_id,
      event: row.event,
      fromFloor: row.from_floor,
      toFloor: row.to_floor,
      state: row.state,
      direction: row.direction,
      timestamp: row.timestamp,
      details: row.details,
    };
  }

  /**
   * @brief Map a row to a query log
   * @description Map a row to a query log
   * @param row - The row to map
   * @returns The query log
   */
  private mapRowToQueryLog(row: any): QueryLog {
    return {
      id: row.id,
      query: row.query,
      executedBy: row.executed_by,
      executedAt: row.executed_at,
      source: row.source,
      parameters: row.parameters,
    };
  }

  /**
   * @brief Close the database
   * @description Close the database
   */
  close() {
    this.db.close();
  }
}
