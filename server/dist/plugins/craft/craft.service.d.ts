export declare function initCraftForProject(projectId: string, userId: string): Promise<void>;
export declare function deleteCraftForProject(projectId: string): Promise<void>;
export declare function getTreeByProjectId(projectId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    projectId: string;
    parentId: string | null;
    nodeType: number;
    sortOrder: number;
}[]>;
export declare function getNodeById(nodeId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    projectId: string;
    parentId: string | null;
    nodeType: number;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
} | null>;
export declare function createNode(projectId: string, createdBy: string, data: {
    name: string;
    nodeType: number;
    parentId?: string;
    content?: string;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    projectId: string;
    parentId: string | null;
    nodeType: number;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
}>;
export declare function updateNode(nodeId: string, data: {
    name?: string;
    content?: string;
    parentId?: string | null;
    sortOrder?: number;
}): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    projectId: string;
    parentId: string | null;
    nodeType: number;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
}>;
export declare function deleteNode(projectId: string, nodeId: string): Promise<void>;
export declare function activateProjectIfDraft(projectId: string): Promise<void>;
//# sourceMappingURL=craft.service.d.ts.map