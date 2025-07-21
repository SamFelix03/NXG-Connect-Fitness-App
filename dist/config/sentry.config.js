"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = exports.initializeSentry = exports.getSentryConfig = void 0;
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
const getSentryConfig = () => {
    const environment = process.env['NODE_ENV'] || 'development';
    const dsn = process.env['SENTRY_DSN'];
    if (environment === 'test' || !dsn) {
        return {
            dsn: '',
            environment,
            sampleRate: 0,
            debug: false,
            tracesSampleRate: 0,
        };
    }
    const config = {
        dsn,
        environment,
        release: process.env['APP_VERSION'] || '1.0.0',
        sampleRate: parseFloat(process.env['SENTRY_SAMPLE_RATE'] || '1.0'),
        debug: environment === 'development',
        tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] || '0.1'),
        beforeSend: (event) => {
            if (environment === 'development' && process.env['SENTRY_DEBUG_MODE'] !== 'true') {
                return null;
            }
            if (event.exception?.values) {
                for (const exception of event.exception.values) {
                    const errorType = exception.type;
                    if (errorType && ['ValidationError', 'AuthenticationError', 'AuthorizationError', 'NotFoundError'].includes(errorType)) {
                        return null;
                    }
                }
            }
            return event;
        },
    };
    return config;
};
exports.getSentryConfig = getSentryConfig;
const initializeSentry = () => {
    const config = (0, exports.getSentryConfig)();
    if (!config.dsn) {
        console.log('📊 Sentry initialization skipped (no DSN or test environment)');
        return;
    }
    Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        ...(config.release && { release: config.release }),
        sampleRate: config.sampleRate,
        debug: config.debug,
        tracesSampleRate: config.tracesSampleRate,
        ...(config.beforeSend && { beforeSend: config.beforeSend }),
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
        ],
        beforeSendTransaction: (event) => {
            if (config.environment === 'development' && event.transaction === 'GET /health') {
                return null;
            }
            return event;
        },
    });
    console.log(`📊 Sentry initialized for ${config.environment} environment`);
};
exports.initializeSentry = initializeSentry;
//# sourceMappingURL=sentry.config.js.map