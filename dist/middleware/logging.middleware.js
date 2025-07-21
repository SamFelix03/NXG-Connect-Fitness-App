"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = void 0;
const morgan_1 = __importDefault(require("morgan"));
const uuid_1 = require("uuid");
const correlationIdMiddleware = (req, res, next) => {
    const existingCorrelationId = req.headers['x-correlation-id'];
    req.correlationId = (typeof existingCorrelationId === 'string' ? existingCorrelationId : (0, uuid_1.v4)());
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
morgan_1.default.token('correlation-id', (req) => req.correlationId || 'unknown');
morgan_1.default.token('user-id', (req) => {
    return req.user?.id || 'anonymous';
});
const logFormat = process.env['NODE_ENV'] === 'production'
    ? ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :correlation-id :response-time ms'
    : ':method :url :status :response-time ms - :correlation-id';
const loggingMiddleware = (0, morgan_1.default)(logFormat, {
    stream: {
        write: (message) => {
            console.log(message.trim());
        }
    },
    skip: (req, _res) => {
        if (process.env['NODE_ENV'] === 'production') {
            return req.url === '/health' || req.url === '/';
        }
        return false;
    }
});
exports.default = loggingMiddleware;
//# sourceMappingURL=logging.middleware.js.map