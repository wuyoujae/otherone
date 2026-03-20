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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getProfile = getProfile;
exports.resetPasswordLocal = resetPasswordLocal;
const response_1 = require("../../utils/response");
const env_1 = require("../../config/env");
const authService = __importStar(require("./auth.service"));
async function register(req, res, next) {
    try {
        const { displayName, email, password } = req.body;
        if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
            (0, response_1.sendError)(res, 'Display name is required');
            return;
        }
        if (displayName.trim().length > 100) {
            (0, response_1.sendError)(res, 'Display name must be 100 characters or less');
            return;
        }
        if (!email || typeof email !== 'string') {
            (0, response_1.sendError)(res, 'Email is required');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            (0, response_1.sendError)(res, 'Invalid email format');
            return;
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            (0, response_1.sendError)(res, 'Password must be at least 8 characters');
            return;
        }
        if (password.length > 128) {
            (0, response_1.sendError)(res, 'Password must be 128 characters or less');
            return;
        }
        const result = await authService.register({
            displayName: displayName.trim(),
            email: email.trim().toLowerCase(),
            password,
        });
        (0, response_1.sendSuccess)(res, result, 'Registration successful', 201);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
            const err = error;
            (0, response_1.sendError)(res, err.message, err.status);
            return;
        }
        next(error);
    }
}
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || typeof email !== 'string') {
            (0, response_1.sendError)(res, 'Email is required');
            return;
        }
        if (!password || typeof password !== 'string') {
            (0, response_1.sendError)(res, 'Password is required');
            return;
        }
        const result = await authService.login({
            email: email.trim().toLowerCase(),
            password,
        });
        (0, response_1.sendSuccess)(res, result);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
            const err = error;
            (0, response_1.sendError)(res, err.message, err.status);
            return;
        }
        next(error);
    }
}
async function getProfile(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const user = await authService.getProfile(req.user.userId);
        (0, response_1.sendSuccess)(res, user);
    }
    catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
            const err = error;
            (0, response_1.sendError)(res, err.message, err.status);
            return;
        }
        next(error);
    }
}
async function resetPasswordLocal(req, res, next) {
    try {
        const resetToken = req.headers['x-otherone-reset-token'];
        if (!env_1.env.internalPasswordResetToken || resetToken !== env_1.env.internalPasswordResetToken) {
            (0, response_1.sendError)(res, 'Unauthorized password reset request', 403);
            return;
        }
        const { email, password } = req.body;
        if (!email || typeof email !== 'string') {
            (0, response_1.sendError)(res, 'Email is required');
            return;
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            (0, response_1.sendError)(res, 'Password must be at least 8 characters');
            return;
        }
        if (password.length > 128) {
            (0, response_1.sendError)(res, 'Password must be 128 characters or less');
            return;
        }
        await authService.resetPasswordLocal({
            email: email.trim().toLowerCase(),
            password,
        });
        (0, response_1.sendSuccess)(res, { success: true }, 'Password reset successful');
    }
    catch (error) {
        if (error && typeof error === 'object' && 'status' in error) {
            const err = error;
            (0, response_1.sendError)(res, err.message, err.status);
            return;
        }
        next(error);
    }
}
//# sourceMappingURL=auth.controller.js.map