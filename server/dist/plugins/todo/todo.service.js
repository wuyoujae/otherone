"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModulesByProjectId = getModulesByProjectId;
exports.getModuleById = getModuleById;
exports.createModule = createModule;
exports.updateModule = updateModule;
exports.deleteModule = deleteModule;
exports.deleteModulesForProject = deleteModulesForProject;
exports.deleteTodosForProject = deleteTodosForProject;
exports.deleteAllForProject = deleteAllForProject;
exports.getTodosByProjectId = getTodosByProjectId;
exports.getTodoById = getTodoById;
exports.createTodo = createTodo;
exports.batchCreateTodos = batchCreateTodos;
exports.updateTodo = updateTodo;
exports.deleteTodo = deleteTodo;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
/* ═══════════ Module CRUD ═══════════ */
async function getModulesByProjectId(projectId) {
    return database_1.default.todoModule.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
}
async function getModuleById(moduleId) {
    return database_1.default.todoModule.findUnique({ where: { id: moduleId } });
}
async function createModule(projectId, createdBy, data) {
    const id = crypto_1.default.randomUUID();
    const maxSort = await database_1.default.todoModule.aggregate({
        where: { projectId, parentId: data.parentId || null },
        _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1;
    return database_1.default.todoModule.create({
        data: {
            id,
            projectId,
            parentId: data.parentId || null,
            name: data.name,
            color: data.color || null,
            sortOrder: nextSort,
            createdBy,
            updatedAt: new Date(),
        },
    });
}
async function updateModule(moduleId, data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = { updatedAt: new Date() };
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.parentId !== undefined)
        updateData.parentId = data.parentId || null;
    if (data.color !== undefined)
        updateData.color = data.color || null;
    if (data.sortOrder !== undefined)
        updateData.sortOrder = data.sortOrder;
    return database_1.default.todoModule.update({ where: { id: moduleId }, data: updateData });
}
async function collectModuleDescendantIds(projectId, moduleId) {
    const children = await database_1.default.todoModule.findMany({
        where: { projectId, parentId: moduleId },
        select: { id: true },
    });
    const ids = [];
    for (const child of children) {
        ids.push(child.id);
        const nested = await collectModuleDescendantIds(projectId, child.id);
        ids.push(...nested);
    }
    return ids;
}
async function deleteModule(projectId, moduleId) {
    const descendantIds = await collectModuleDescendantIds(projectId, moduleId);
    const allIds = [moduleId, ...descendantIds];
    // Unlink todos from deleted modules (set moduleId to null)
    await database_1.default.todoItem.updateMany({
        where: { projectId, moduleId: { in: allIds } },
        data: { moduleId: null, updatedAt: new Date() },
    });
    // Delete modules bottom-up
    await database_1.default.todoModule.deleteMany({ where: { id: { in: allIds } } });
}
async function deleteModulesForProject(projectId) {
    await database_1.default.todoModule.deleteMany({ where: { projectId } });
}
/* ═══════════ Todo CRUD ═══════════ */
async function deleteTodosForProject(projectId) {
    await database_1.default.todoItem.deleteMany({ where: { projectId } });
}
async function deleteAllForProject(projectId) {
    await deleteTodosForProject(projectId);
    await deleteModulesForProject(projectId);
}
async function getTodosByProjectId(projectId) {
    return database_1.default.todoItem.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
}
async function getTodoById(todoId) {
    return database_1.default.todoItem.findUnique({ where: { id: todoId } });
}
async function createTodo(projectId, createdBy, data) {
    const id = crypto_1.default.randomUUID();
    return database_1.default.todoItem.create({
        data: {
            id,
            projectId,
            moduleId: data.moduleId || null,
            title: data.title,
            description: data.description || null,
            content: data.content || null,
            status: 1,
            priority: data.priority || 2,
            assigneeId: data.assigneeId || null,
            startDate: data.startDate ? new Date(data.startDate) : null,
            endDate: data.endDate ? new Date(data.endDate) : null,
            startTime: data.startTime || null,
            endTime: data.endTime || null,
            createdBy,
            updatedAt: new Date(),
        },
    });
}
async function batchCreateTodos(projectId, createdBy, items) {
    const results = [];
    for (const item of items) {
        const todo = await createTodo(projectId, createdBy, item);
        results.push(todo);
    }
    return results;
}
async function updateTodo(todoId, data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = { updatedAt: new Date() };
    if (data.title !== undefined)
        updateData.title = data.title;
    if (data.description !== undefined)
        updateData.description = data.description;
    if (data.content !== undefined)
        updateData.content = data.content || null;
    if (data.moduleId !== undefined)
        updateData.moduleId = data.moduleId || null;
    if (data.status !== undefined)
        updateData.status = data.status;
    if (data.priority !== undefined)
        updateData.priority = data.priority;
    if (data.assigneeId !== undefined)
        updateData.assigneeId = data.assigneeId;
    if (data.startDate !== undefined)
        updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
        updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.startTime !== undefined)
        updateData.startTime = data.startTime || null;
    if (data.endTime !== undefined)
        updateData.endTime = data.endTime || null;
    if (data.sortOrder !== undefined)
        updateData.sortOrder = data.sortOrder;
    return database_1.default.todoItem.update({ where: { id: todoId }, data: updateData });
}
async function deleteTodo(todoId) {
    return database_1.default.todoItem.delete({ where: { id: todoId } });
}
//# sourceMappingURL=todo.service.js.map