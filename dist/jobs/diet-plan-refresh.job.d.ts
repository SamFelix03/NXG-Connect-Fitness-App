interface RefreshJobStats {
    plansChecked: number;
    plansRefreshed: number;
    plansSkipped: number;
    errors: number;
    startTime: Date;
    endTime?: Date;
    duration?: number;
}
declare class DietPlanRefreshJob {
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
    refreshPlansForGoalChange(userId: string): Promise<void>;
}
declare const dietPlanRefreshJob: DietPlanRefreshJob;
export { dietPlanRefreshJob, DietPlanRefreshJob };
export default dietPlanRefreshJob;
//# sourceMappingURL=diet-plan-refresh.job.d.ts.map