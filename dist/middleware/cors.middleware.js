"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin && process.env['NODE_ENV'] === 'development') {
            return callback(null, true);
        }
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://localhost:3000',
            'https://localhost:3001',
        ];
        if (process.env['FRONTEND_URL']) {
            allowedOrigins.push(process.env['FRONTEND_URL']);
        }
        if (process.env['ADMIN_URL']) {
            allowedOrigins.push(process.env['ADMIN_URL']);
        }
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS policy'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Correlation-ID'
    ],
    exposedHeaders: ['X-Correlation-ID'],
    maxAge: 86400,
    optionsSuccessStatus: 200,
};
exports.default = (0, cors_1.default)(corsOptions);
//# sourceMappingURL=cors.middleware.js.map