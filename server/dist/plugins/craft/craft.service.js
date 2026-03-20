"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCraftForProject = initCraftForProject;
exports.deleteCraftForProject = deleteCraftForProject;
exports.getTreeByProjectId = getTreeByProjectId;
exports.getNodeById = getNodeById;
exports.createNode = createNode;
exports.updateNode = updateNode;
exports.deleteNode = deleteNode;
exports.activateProjectIfDraft = activateProjectIfDraft;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
// node_type: 1 = file (.craft), 2 = directory (.module)
// --- Lifecycle hooks ---
async function initCraftForProject(projectId, userId) {
    const nodeId = crypto_1.default.randomUUID();
    await database_1.default.craftNode.create({
        data: {
            id: nodeId,
            projectId,
            parentId: null,
            name: 'Untitled',
            nodeType: 1,
            content: '',
            sortOrder: 0,
            createdBy: userId,
            updatedAt: new Date(),
        },
    });
    // Also create legacy craft record for backward compatibility
    const craftId = crypto_1.default.randomUUID();
    await database_1.default.craft.create({
        data: {
            id: craftId,
            projectId,
            updatedAt: new Date(),
        },
    });
}
async function deleteCraftForProject(projectId) {
    await database_1.default.craftNode.deleteMany({ where: { projectId } });
    await database_1.default.craft.deleteMany({ where: { projectId } });
}
// --- Tree operations ---
async function getTreeByProjectId(projectId) {
    return database_1.default.craftNode.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
            id: true,
            projectId: true,
            parentId: true,
            name: true,
            nodeType: true,
            sortOrder: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}
// --- Node CRUD ---
async function getNodeById(nodeId) {
    return database_1.default.craftNode.findUnique({ where: { id: nodeId } });
}
async function createNode(projectId, createdBy, data) {
    // Get max sort_order among siblings
    const siblings = await database_1.default.craftNode.findMany({
        where: { projectId, parentId: data.parentId || null },
        orderBy: { sortOrder: 'desc' },
        take: 1,
        select: { sortOrder: true },
    });
    const nextOrder = siblings.length > 0 ? siblings[0].sortOrder + 1 : 0;
    const id = crypto_1.default.randomUUID();
    return database_1.default.craftNode.create({
        data: {
            id,
            projectId,
            parentId: data.parentId || null,
            name: data.name,
            nodeType: data.nodeType,
            content: data.nodeType === 1 ? (data.content ?? '') : null,
            sortOrder: nextOrder,
            createdBy,
            updatedAt: new Date(),
        },
    });
}
async function updateNode(nodeId, data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = { updatedAt: new Date() };
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.content !== undefined)
        updateData.content = data.content;
    if (data.parentId !== undefined)
        updateData.parentId = data.parentId;
    if (data.sortOrder !== undefined)
        updateData.sortOrder = data.sortOrder;
    return database_1.default.craftNode.update({
        where: { id: nodeId },
        data: updateData,
    });
}
async function deleteNode(projectId, nodeId) {
    // Recursively collect all descendant IDs for directory deletion
    const allIds = await collectDescendantIds(projectId, nodeId);
    allIds.push(nodeId);
    await database_1.default.craftNode.deleteMany({
        where: { id: { in: allIds } },
    });
}
async function collectDescendantIds(projectId, parentId) {
    const children = await database_1.default.craftNode.findMany({
        where: { projectId, parentId },
        select: { id: true, nodeType: true },
    });
    const ids = [];
    for (const child of children) {
        ids.push(child.id);
        if (child.nodeType === 2) {
            const grandchildren = await collectDescendantIds(projectId, child.id);
            ids.push(...grandchildren);
        }
    }
    return ids;
}
// --- Project status helper ---
async function activateProjectIfDraft(projectId) {
    const now = new Date();
    await database_1.default.project.updateMany({
        where: { id: projectId, status: 0 },
        data: { status: 1, updatedAt: now },
    });
}
//# sourceMappingURL=craft.service.js.map