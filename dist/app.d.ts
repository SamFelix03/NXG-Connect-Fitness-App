/// <reference types="node" />
import { Application } from 'express';
import { Server } from 'http';
import './jobs/workout-plan-refresh.job';
declare class App {
    app: Application;
    port: number;
    private server;
    private isShuttingDown;
    constructor(port?: number);
    private initializeSentry;
    private initializeMiddlewares;
    private initializeRoutes;
    private initializeErrorHandling;
    private setupGracefulShutdown;
    private gracefulShutdown;
    start(): Promise<void>;
    listen(): void;
    getServer(): Server | null;
    isHealthy(): boolean;
}
export default App;
//# sourceMappingURL=app.d.ts.map