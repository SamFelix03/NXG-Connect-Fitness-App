"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = __importDefault(require("../controllers/health.controller"));
const router = (0, express_1.Router)();
router.get('/health', health_controller_1.default.checkHealth);
router.get('/health/liveness', health_controller_1.default.liveness);
router.get('/health/readiness', health_controller_1.default.readiness);
exports.default = router;
//# sourceMappingURL=health.routes.js.map