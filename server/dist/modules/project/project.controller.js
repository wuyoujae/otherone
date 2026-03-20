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
exports.getProjects = getProjects;
exports.getRecentProjects = getRecentProjects;
exports.createProject = createProject;
exports.getProject = getProject;
exports.updateProject = updateProject;
exports.archiveProject = archiveProject;
exports.deleteProject = deleteProject;
const response_1 = require("../../utils/response");
const projectService = __importStar(require("./project.service"));
async function getProjects(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const filter = req.query.filter;
        const search = req.query.search;
        const [projects, counts] = await Promise.all([
            projectService.getProjects(req.user.userId, filter, search),
            projectService.getProjectCounts(req.user.userId),
        ]);
        (0, response_1.sendSuccess)(res, { projects, counts });
    }
    catch (error) {
        next(error);
    }
}
async function getRecentProjects(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const projects = await projectService.getRecentProjects(req.user.userId);
        (0, response_1.sendSuccess)(res, projects);
    }
    catch (error) {
        next(error);
    }
}
async function createProject(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const displayName = req.body.displayName || 'U';
        const project = await projectService.createProject(req.user.userId, displayName);
        (0, response_1.sendSuccess)(res, project, 'Project created', 201);
    }
    catch (error) {
        next(error);
    }
}
async function getProject(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const project = await projectService.getProjectById(req.params.id);
        if (!project) {
            (0, response_1.sendError)(res, 'Project not found', 404);
            return;
        }
        if (project.userId !== req.user.userId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        (0, response_1.sendSuccess)(res, project);
    }
    catch (error) {
        next(error);
    }
}
async function updateProject(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const project = await projectService.getProjectById(req.params.id);
        if (!project) {
            (0, response_1.sendError)(res, 'Project not found', 404);
            return;
        }
        if (project.userId !== req.user.userId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const { name, description, systemPrompt } = req.body;
        if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
            (0, response_1.sendError)(res, 'Project name cannot be empty');
            return;
        }
        const updated = await projectService.updateProject(project.id, {
            name: name?.trim(),
            description: description !== undefined ? description : undefined,
            systemPrompt: systemPrompt !== undefined ? systemPrompt : undefined,
        });
        (0, response_1.sendSuccess)(res, updated);
    }
    catch (error) {
        next(error);
    }
}
async function archiveProject(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const project = await projectService.getProjectById(req.params.id);
        if (!project) {
            (0, response_1.sendError)(res, 'Project not found', 404);
            return;
        }
        if (project.userId !== req.user.userId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const updated = await projectService.archiveProject(project.id);
        (0, response_1.sendSuccess)(res, updated);
    }
    catch (error) {
        next(error);
    }
}
async function deleteProject(req, res, next) {
    try {
        if (!req.user) {
            (0, response_1.sendError)(res, 'Authentication required', 401);
            return;
        }
        const project = await projectService.getProjectById(req.params.id);
        if (!project) {
            (0, response_1.sendError)(res, 'Project not found', 404);
            return;
        }
        if (project.userId !== req.user.userId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        await projectService.deleteProject(project.id);
        (0, response_1.sendSuccess)(res, null, 'Project deleted');
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=project.controller.js.map