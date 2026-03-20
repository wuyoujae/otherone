"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.getProjectCounts = getProjectCounts;
exports.getRecentProjects = getRecentProjects;
exports.getProjectById = getProjectById;
exports.createProject = createProject;
exports.updateProject = updateProject;
exports.archiveProject = archiveProject;
exports.deleteProject = deleteProject;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
const plugins_1 = require("../../plugins");
// status: 0=draft, 1=active, 2=archived
async function getProjects(userId, filter, search) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = { userId };
    if (filter === 'archived') {
        where.status = 2;
    }
    else if (filter === 'ai') {
        where.status = { in: [0, 1] };
        where.aiStatus = 1;
    }
    else if (filter === 'review') {
        where.status = { in: [0, 1] };
        where.aiStatus = 2;
    }
    else {
        where.status = { in: [0, 1] };
    }
    if (search && search.trim()) {
        where.name = { contains: search.trim(), mode: 'insensitive' };
    }
    const projects = await database_1.default.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
    });
    const projectIds = projects.map((p) => p.id);
    const members = await database_1.default.projectMember.findMany({
        where: { projectId: { in: projectIds } },
    });
    const memberMap = new Map();
    for (const m of members) {
        const list = memberMap.get(m.projectId) || [];
        list.push(m);
        memberMap.set(m.projectId, list);
    }
    return projects.map((p) => ({
        ...p,
        members: memberMap.get(p.id) || [],
    }));
}
async function getProjectCounts(userId) {
    const [total, aiCount, reviewCount, archivedCount] = await Promise.all([
        database_1.default.project.count({ where: { userId, status: { in: [0, 1] } } }),
        database_1.default.project.count({ where: { userId, status: { in: [0, 1] }, aiStatus: 1 } }),
        database_1.default.project.count({ where: { userId, status: { in: [0, 1] }, aiStatus: 2 } }),
        database_1.default.project.count({ where: { userId, status: 2 } }),
    ]);
    return { total, aiCount, reviewCount, archivedCount };
}
async function getRecentProjects(userId, limit = 5) {
    return database_1.default.project.findMany({
        where: { userId, status: { in: [0, 1] } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
    });
}
async function getProjectById(projectId) {
    return database_1.default.project.findUnique({ where: { id: projectId } });
}
async function createProject(userId, displayName) {
    const id = crypto_1.default.randomUUID();
    const memberId = crypto_1.default.randomUUID();
    const now = new Date();
    const project = await database_1.default.project.create({
        data: {
            id,
            name: 'New Project',
            status: 0, // draft
            userId,
            updatedAt: now,
        },
    });
    await database_1.default.projectMember.create({
        data: {
            id: memberId,
            projectId: id,
            userId,
            memberType: 1,
            displayLabel: displayName.charAt(0).toUpperCase(),
            role: 1, // owner
        },
    });
    // Initialize all plugin data via lifecycle hooks
    await plugins_1.pluginRegistry.onProjectCreate(id, userId);
    return project;
}
async function updateProject(projectId, data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = { updatedAt: new Date() };
    if (data.name !== undefined)
        updateData.name = data.name;
    if (data.description !== undefined)
        updateData.description = data.description;
    if (data.systemPrompt !== undefined)
        updateData.systemPrompt = data.systemPrompt;
    return database_1.default.project.update({
        where: { id: projectId },
        data: updateData,
    });
}
async function archiveProject(projectId) {
    return database_1.default.project.update({
        where: { id: projectId },
        data: { status: 2, updatedAt: new Date() },
    });
}
async function deleteProject(projectId) {
    // Clean up all plugin data via lifecycle hooks
    await plugins_1.pluginRegistry.onProjectDelete(projectId);
    // Delete project members and the project itself
    await database_1.default.projectMember.deleteMany({ where: { projectId } });
    await database_1.default.project.delete({ where: { id: projectId } });
}
//# sourceMappingURL=project.service.js.map