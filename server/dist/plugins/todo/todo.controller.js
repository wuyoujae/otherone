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
exports.getModules = getModules;
exports.createModule = createModule;
exports.updateModule = updateModule;
exports.deleteModule = deleteModule;
exports.getTodos = getTodos;
exports.createTodo = createTodo;
exports.batchCreateTodos = batchCreateTodos;
exports.updateTodo = updateTodo;
exports.deleteTodo = deleteTodo;
const response_1 = require("../../utils/response");
const todoService = __importStar(require("./todo.service"));
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
/* ═══════════ Module Handlers ═══════════ */
async function getModules(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const modules = await todoService.getModulesByProjectId(projectId);
        (0, response_1.sendSuccess)(res, modules);
    }
    catch (error) {
        next(error);
    }
}
async function createModule(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const { name, parentId, color } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            (0, response_1.sendError)(res, 'Module name is required', 400);
            return;
        }
        if (parentId) {
            const parent = await todoService.getModuleById(parentId);
            if (!parent || parent.projectId !== projectId) {
                (0, response_1.sendError)(res, 'Parent module not found', 404);
                return;
            }
        }
        const mod = await todoService.createModule(projectId, req.user.userId, {
            name: name.trim(),
            parentId,
            color,
        });
        (0, response_1.sendSuccess)(res, mod, undefined, 201);
    }
    catch (error) {
        next(error);
    }
}
async function updateModule(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const moduleId = req.params.moduleId;
        const existing = await todoService.getModuleById(moduleId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Module not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const mod = await todoService.updateModule(moduleId, req.body);
        (0, response_1.sendSuccess)(res, mod);
    }
    catch (error) {
        next(error);
    }
}
async function deleteModule(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const moduleId = req.params.moduleId;
        const existing = await todoService.getModuleById(moduleId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Module not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        await todoService.deleteModule(projectId, moduleId);
        (0, response_1.sendSuccess)(res, null);
    }
    catch (error) {
        next(error);
    }
}
/* ═══════════ Todo Handlers ═══════════ */
async function getTodos(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const todos = await todoService.getTodosByProjectId(projectId);
        (0, response_1.sendSuccess)(res, todos);
    }
    catch (error) {
        next(error);
    }
}
async function createTodo(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const { title, description, content, moduleId, priority, assigneeId, startDate, endDate, startTime, endTime } = req.body;
        if (!title || typeof title !== 'string' || !title.trim()) {
            (0, response_1.sendError)(res, 'Title is required', 400);
            return;
        }
        if (moduleId) {
            const mod = await todoService.getModuleById(moduleId);
            if (!mod || mod.projectId !== projectId) {
                (0, response_1.sendError)(res, 'Module not found', 404);
                return;
            }
        }
        const todo = await todoService.createTodo(projectId, req.user.userId, {
            title: title.trim(),
            description,
            content,
            moduleId,
            priority,
            assigneeId,
            startDate,
            endDate,
            startTime,
            endTime,
        });
        (0, response_1.sendSuccess)(res, todo, undefined, 201);
    }
    catch (error) {
        next(error);
    }
}
async function batchCreateTodos(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            (0, response_1.sendError)(res, 'Items array is required and must not be empty', 400);
            return;
        }
        if (items.length > 50) {
            (0, response_1.sendError)(res, 'Cannot create more than 50 items at once', 400);
            return;
        }
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
                (0, response_1.sendError)(res, `Item ${i + 1}: title is required`, 400);
                return;
            }
        }
        const todos = await todoService.batchCreateTodos(projectId, req.user.userId, items.map((item) => ({
            ...item,
            title: item.title.trim(),
        })));
        (0, response_1.sendSuccess)(res, todos, undefined, 201);
    }
    catch (error) {
        next(error);
    }
}
async function updateTodo(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const todoId = req.params.todoId;
        const existing = await todoService.getTodoById(todoId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Todo not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        const todo = await todoService.updateTodo(todoId, req.body);
        (0, response_1.sendSuccess)(res, todo);
    }
    catch (error) {
        next(error);
    }
}
async function deleteTodo(req, res, next) {
    try {
        const projectId = await validateProjectAccess(req, res);
        if (!projectId)
            return;
        const todoId = req.params.todoId;
        const existing = await todoService.getTodoById(todoId);
        if (!existing) {
            (0, response_1.sendError)(res, 'Todo not found', 404);
            return;
        }
        if (existing.projectId !== projectId) {
            (0, response_1.sendError)(res, 'Forbidden', 403);
            return;
        }
        await todoService.deleteTodo(todoId);
        (0, response_1.sendSuccess)(res, null);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=todo.controller.js.map