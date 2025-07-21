"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helmet_1 = __importDefault(require("helmet"));
const securityMiddleware = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            blockAllMixedContent: [],
            fontSrc: ["'self'", 'https:', 'data:'],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginResourcePolicy: {
        policy: 'cross-origin'
    },
    dnsPrefetchControl: {
        allow: false
    },
    frameguard: {
        action: 'deny'
    },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: {
        policy: ['no-referrer', 'strict-origin-when-cross-origin']
    },
    xssFilter: true,
});
exports.default = securityMiddleware;
//# sourceMappingURL=security.middleware.js.map