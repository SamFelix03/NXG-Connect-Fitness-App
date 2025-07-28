interface RefreshJobStats {
    plansChecked: number;
    plansRefreshed: number;
    plansSkipped: number;
    errors: number;
    startTime: Date;
    endTime?: Date;
    duration?: number;
}
declare class WorkoutPlanRefreshJob {
    private jobStats;
    private isRunning;
    constructor();
    private initializeStats;
    startJob(): void;
    executeRefreshJob(): Promise<RefreshJobStats>;
    private refreshSinglePlan;
    triggerManualRefresh(): Promise<RefreshJobStats>;
    getJobStats(): RefreshJobStats;
    isJobRunning(): boolean;
    getNextRunInfo(): {
        nextRun: Date;
        isRunning: boolean;
    };
}
declare const workoutPlanRefreshJob: WorkoutPlanRefreshJob;
export { workoutPlanRefreshJob, WorkoutPlanRefreshJob };
export default workoutPlanRefreshJob;
//# sourceMappingURL=workout-plan-refresh.job.d.ts.map