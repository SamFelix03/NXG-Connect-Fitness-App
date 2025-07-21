import * as Sentry from '@sentry/node';
export interface SentryConfig {
    dsn: string;
    environment: string;
    release?: string;
    sampleRate: number;
    debug: boolean;
    tracesSampleRate: number;
    beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}
export declare const getSentryConfig: () => SentryConfig;
export declare const initializeSentry: () => void;
export { Sentry };
//# sourceMappingURL=sentry.config.d.ts.map