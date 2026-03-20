"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getProfile = getProfile;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../../config/database"));
const env_1 = require("../../config/env");
const SALT_ROUNDS = 12;
function generateToken(payload) {
    // 30 days in seconds
    return jsonwebtoken_1.default.sign(payload, env_1.env.jwtSecret, { expiresIn: 30 * 24 * 60 * 60 });
}
function sanitizeUser(user) {
    return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
    };
}
async function register(input) {
    const existing = await database_1.default.user.findUnique({ where: { email: input.email } });
    if (existing) {
        throw { status: 409, message: 'Email already registered' };
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, SALT_ROUNDS);
    const id = crypto_1.default.randomUUID();
    const user = await database_1.default.user.create({
        data: {
            id,
            displayName: input.displayName,
            email: input.email,
            passwordHash,
            updatedAt: new Date(),
        },
    });
    const token = generateToken({ userId: user.id, email: user.email });
    return { token, user: sanitizeUser(user) };
}
async function login(input) {
    const user = await database_1.default.user.findUnique({ where: { email: input.email } });
    if (!user) {
        throw { status: 401, message: 'Invalid email or password' };
    }
    if (user.status !== 0) {
        throw { status: 403, message: 'Account is disabled' };
    }
    const valid = await bcryptjs_1.default.compare(input.password, user.passwordHash);
    if (!valid) {
        throw { status: 401, message: 'Invalid email or password' };
    }
    const token = generateToken({ userId: user.id, email: user.email });
    return { token, user: sanitizeUser(user) };
}
async function getProfile(userId) {
    const user = await database_1.default.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw { status: 404, message: 'User not found' };
    }
    return sanitizeUser(user);
}
//# sourceMappingURL=auth.service.js.map