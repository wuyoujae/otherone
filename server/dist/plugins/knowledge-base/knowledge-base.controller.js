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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArticles = getArticles;
exports.createArticle = createArticle;
exports.updateArticle = updateArticle;
exports.deleteArticle = deleteArticle;
const response_1 = require("../../utils/response");
const kbService = __importStar(require("./knowledge-base.service"));
const database_1 = __importDefault(require("../../config/database"));
async function validateProjectAccess(req, res) {
    if (!req.user) {
        (0, response_1.sendError)(res, 'Authentication required', 401);
        return null;
    }
    const projectId = req.params.projectId;
    const project = await database_1.default.project.findUnique({ where: { id: projectId } });
    if (!project) {
        (0, response_1.sendError)(res, 'Project not found', 404);
        return null;
    }
    if (project.userId !== req.user.userId) {
        (0, response_1.sendError)(res, 'Forbidden', 403);
        return null;
    }
    return projectId;
}
async function getArticles(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const articles = await kbService.getArticlesByProjectId(projectId);
        (0, response_1.sendSuccess)(res, articles);
    }
    catch (error) {
        next(error);
    }
}
async function createArticle(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const { title, content, category, fileUrl, fileType } = req.body;
        if (!title || typeof title !== 'string' || !title.trim()) {
            (0, response_1.sendError)(res, 'Title is required', 400);
            return;
        }
        const article = await kbService.createArticle(projectId, req.user.userId, {
            title: title.trim(),
            content,
            category,
            fileUrl,
            fileType,
        });
        (0, response_1.sendSuccess)(res, article, undefined, 201);
    }
    catch (error) {
        next(error);
    }
}
async function updateArticle(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const articleId = req.params.articleId;
        const existing = await kbService.getArticleById(articleId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Article not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const article = await kbService.updateArticle(articleId, req.body);
        (0, response_1.sendSuccess)(res, article);
    }
    catch (error) {
        next(error);
    }
}
async function deleteArticle(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const articleId = req.params.articleId;
        const existing = await kbService.getArticleById(articleId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Article not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        await kbService.deleteArticle(articleId);
        (0, response_1.sendSuccess)(res, null);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=knowledge-base.controller.js.map