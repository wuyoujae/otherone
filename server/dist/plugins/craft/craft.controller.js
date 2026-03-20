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
exports.getTree = getTree;
exports.getNode = getNode;
exports.createNode = createNode;
exports.updateNode = updateNode;
exports.deleteNode = deleteNode;
const response_1 = require("../../utils/response");
const craftService = __importStar(require("./craft.service"));
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
async function getTree(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const nodes = await craftService.getTreeByProjectId(projectId);
        (0, response_1.sendSuccess)(res, nodes);
    }
    catch (error) {
        next(error);
    }
}
async function getNode(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const nodeId = req.params.nodeId;
        const node = await craftService.getNodeById(nodeId);
        if (!node) {
            (0, response_1.sendError)(res, 'Node not found', 404);
            return;
        }
        if (node.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        (0, response_1.sendSuccess)(res, node);
    }
    catch (error) {
        next(error);
    }
}
async function createNode(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const { name, nodeType, parentId, content } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            (0, response_1.sendError)(res, 'Name is required', 400);
            return;
        }
        if (nodeType !== 1 && nodeType !== 2) {
            (0, response_1.sendError)(res, 'nodeType must be 1 (file) or 2 (directory)', 400);
            return;
        }
        // Validate parent exists and belongs to project (if provided)
        if (parentId) {
            const parent = await craftService.getNodeById(parentId);
            if (!parent) {
                (0, response_1.sendError)(res, 'Parent node not found', 404);
                return;
            }
            if (parent.projectId !== projectId) {
                (0, response_1.sendError)(res, 'Forbidden', 403);
                return;
            }
            if (parent.nodeType !== 2) {
                (0, response_1.sendError)(res, 'Parent must be a directory', 400);
                return;
            }
        }
        const node = await craftService.createNode(projectId, req.user.userId, {
            name: name.trim(),
            nodeType,
            parentId,
            content,
        });
        (0, response_1.sendSuccess)(res, node, undefined, 201);
    }
    catch (error) {
        next(error);
    }
}
async function updateNode(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const nodeId = req.params.nodeId;
        const existing = await craftService.getNodeById(nodeId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Node not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const { name, content, parentId, sortOrder } = req.body;
        // If renaming, validate name
        if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
            (0, response_1.sendError)(res, 'Name cannot be empty', 400);
            return;
        }
        // If moving to a new parent, validate
        if (parentId !== undefined && parentId !== null) {
            if (parentId === nodeId) {
                (0, response_1.sendError)(res, 'Cannot move node into itself', 400);
                return;
            }
            const parent = await craftService.getNodeById(parentId);
            if (!parent) {
                (0, response_1.sendError)(res, 'Parent node not found', 404);
                return;
            }
            if (parent.projectId !== projectId) {
                (0, response_1.sendError)(res, 'Forbidden', 403);
                return;
            }
            if (parent.nodeType !== 2) {
                (0, response_1.sendError)(res, 'Parent must be a directory', 400);
                return;
            }
        }
        const node = await craftService.updateNode(nodeId, {
            name: name?.trim(),
            content,
            parentId,
            sortOrder,
        });
        // Activate project if content is saved and project is still draft
        if (content !== undefined) {
            await craftService.activateProjectIfDraft(projectId);
        }
        (0, response_1.sendSuccess)(res, node);
    }
    catch (error) {
        next(error);
    }
}
async function deleteNode(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const nodeId = req.params.nodeId;
        const existing = await craftService.getNodeById(nodeId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Node not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        await craftService.deleteNode(projectId, nodeId);
        (0, response_1.sendSuccess)(res, null);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=craft.controller.js.map