'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  Loader,
  FileText,
  FolderOpen,
  Folder,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Plus,
  List,
  PanelLeftClose,
  PanelLeft,
  Hash,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useMessage } from '@/components/ui/message/message-provider';
import { CraftEditor } from '@/components/editor/craft-editor';
import http from '@/lib/http';

// --- Types ---

interface CraftNodeData {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  nodeType: number; // 1: file, 2: directory
  content?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isTodo?: boolean; // true if this node comes from todo_item
}

// --- Todo ID helpers (prefixed to avoid collision with craft_node IDs) ---
function todoId(id: string) { return `t-${id}`; }
function todoModId(id: string) { return `tm-${id}`; }
function isTodoItem(id: string) { return id.startsWith('t-'); }
function isTodoMod(id: string) { return id.startsWith('tm-'); }
function realId(id: string) { return id.startsWith('tm-') ? id.slice(3) : id.slice(2); }

interface TreeNode {
  node: CraftNodeData;
  children: TreeNode[];
}

interface HeadingItem {
  level: number;
  text: string;
  index: number;
}

type SidebarTab = 'files' | 'outline';

// --- Helpers ---

function buildTree(nodes: CraftNodeData[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const n of nodes) map.set(n.id, { node: n, children: [] });

  for (const n of nodes) {
    const tn = map.get(n.id)!;
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(tn);
    } else {
      roots.push(tn);
    }
  }

  const sortChildren = (arr: TreeNode[]) => {
    arr.sort((a, b) => {
      if (a.node.nodeType !== b.node.nodeType) return b.node.nodeType - a.node.nodeType;
      return a.node.sortOrder - b.node.sortOrder;
    });
    arr.forEach((c) => sortChildren(c.children));
  };
  sortChildren(roots);
  return roots;
}

function findFirstFile(tree: TreeNode[]): string | null {
  for (const tn of tree) {
    if (tn.node.nodeType === 1) return tn.node.id;
    const found = findFirstFile(tn.children);
    if (found) return found;
  }
  return null;
}

function parseOutline(content: string): HeadingItem[] {
  if (!content) return [];
  const lines = content.split('\n');
  const items: HeadingItem[] = [];
  let idx = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)/);
    if (m) {
      items.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, ''), index: idx });
      idx++;
    }
  }
  return items;
}

function getExtension(nodeType: number, isTodo?: boolean): string {
  if (isTodo) return '.todo';
  return nodeType === 1 ? '.craft' : '.module';
}

// --- Main Component ---

export default function CraftPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const t = useTranslations('craft');
  const { message, confirm } = useMessage();

  const [projectName, setProjectName] = useState('');
  const [nodes, setNodes] = useState<CraftNodeData[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState('');
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingNode, setCreatingNode] = useState<{ parentId: string | null; nodeType: number } | null>(null);
  const [createName, setCreateName] = useState('');
  const [editingHeaderName, setEditingHeaderName] = useState(false);
  const [headerNameValue, setHeaderNameValue] = useState('');
  const contentRef = useRef(activeContent);
  contentRef.current = activeContent;
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;

  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const activeNode = useMemo(() => nodes.find((n) => n.id === activeNodeId), [nodes, activeNodeId]);
  const outline = useMemo(() => parseOutline(activeContent), [activeContent]);

  // --- Data loading ---

  const loadTree = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await http.get(`/craft/${projectId}/tree`);
      setNodes(res.data || []);
      return res.data || [];
    } catch {
      return [];
    }
  }, [projectId]);

  const loadNode = useCallback(async (nodeId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await http.get(`/craft/${projectId}/node/${nodeId}`);
      return res.data as CraftNodeData;
    } catch {
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    async function init() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projRes: any = await http.get(`/projects/${projectId}`);
        setProjectName(projRes.data?.name || '');
      } catch { /* handled by interceptor */ }

      const craftNodes = await loadTree();

      // Also load todo modules + items and merge as virtual craft nodes
      let todoNodes: CraftNodeData[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [modsRes, todosRes]: any[] = await Promise.all([
          http.get(`/todo/${projectId}/modules`),
          http.get(`/todo/${projectId}`),
        ]);
        const mods = modsRes.data || [];
        const items = todosRes.data || [];
        todoNodes = [
          ...mods.map((m: { id: string; parentId: string | null; name: string; sortOrder: number; createdAt: string; updatedAt: string }) => ({
            id: todoModId(m.id),
            projectId,
            parentId: m.parentId ? todoModId(m.parentId) : null,
            name: m.name,
            nodeType: 2,
            sortOrder: m.sortOrder,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          })),
          ...items.map((t: { id: string; moduleId: string | null; title: string; content: string | null; sortOrder: number; createdAt: string; updatedAt: string }) => ({
            id: todoId(t.id),
            projectId,
            parentId: t.moduleId ? todoModId(t.moduleId) : null,
            name: t.title,
            nodeType: 1,
            content: t.content,
            sortOrder: t.sortOrder,
            isTodo: true,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
        ];
      } catch { /* skip if todo fetch fails */ }

      const allNodes = [...craftNodes, ...todoNodes];
      setNodes(allNodes);

      const builtTree = buildTree(allNodes);
      const firstFileId = findFirstFile(builtTree);

      // Expand all directories by default
      const dirs = new Set<string>();
      allNodes.forEach((n: CraftNodeData) => { if (n.nodeType === 2) dirs.add(n.id); });
      setExpandedDirs(dirs);

      if (firstFileId) {
        if (isTodoItem(firstFileId)) {
          const localNode = allNodes.find((n) => n.id === firstFileId);
          setActiveNodeId(firstFileId);
          setActiveContent(localNode?.content || '');
          setInitialContent(localNode?.content || '');
        } else {
          const node = await loadNode(firstFileId);
          if (node) {
            setActiveNodeId(firstFileId);
            setActiveContent(node.content || '');
            setInitialContent(node.content || '');
          }
        }
      }
      setLoading(false);
    }
    init();
  }, [projectId, loadTree, loadNode]);

  // --- Save ---

  const doSave = useCallback(async () => {
    const nodeId = activeNodeIdRef.current;
    if (!nodeId) return;
    setSaving(true);
    setSaved(false);
    try {
      if (isTodoItem(nodeId)) {
        await http.put(`/todo/${projectId}/${realId(nodeId)}`, { content: contentRef.current });
      } else {
        await http.put(`/craft/${projectId}/node/${nodeId}`, { content: contentRef.current });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      message.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [projectId, message]);

  // Ctrl/Cmd + S
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [doSave]);

  // Auto-save 3s after last change
  useEffect(() => {
    if (loading || initialContent === null || !activeNodeId) return;
    const timer = setTimeout(() => doSave(), 3000);
    return () => clearTimeout(timer);
  }, [activeContent, loading, initialContent, activeNodeId, doSave]);

  // --- File switching ---

  const switchToFile = useCallback(async (nodeId: string) => {
    if (nodeId === activeNodeId) return;

    // Save current file first
    if (activeNodeIdRef.current) {
      if (isTodoItem(activeNodeIdRef.current)) {
        await http.put(`/todo/${projectId}/${realId(activeNodeIdRef.current)}`, { content: contentRef.current }).catch(() => {});
      } else {
        await http.put(`/craft/${projectId}/node/${activeNodeIdRef.current}`, { content: contentRef.current }).catch(() => {});
      }
    }

    // Load the target node
    if (isTodoItem(nodeId)) {
      // Todo items: content already in nodes state, or fetch via API
      const localNode = nodes.find((n) => n.id === nodeId);
      setActiveNodeId(nodeId);
      setActiveContent(localNode?.content || '');
      setInitialContent(localNode?.content || '');
    } else {
      const node = await loadNode(nodeId);
      if (node) {
        setActiveNodeId(nodeId);
        setActiveContent(node.content || '');
        setInitialContent(node.content || '');
      }
    }
  }, [activeNodeId, projectId, loadNode, nodes]);

  // --- Tree operations ---

  const handleCreateNode = useCallback(async (name: string, nodeType: number, parentId: string | null) => {
    if (!name.trim()) return;
    try {
      await http.post(`/craft/${projectId}/node`, {
        name: name.trim(),
        nodeType,
        parentId: parentId || undefined,
      });
      const newNodes = await loadTree();

      // If a directory was created, expand it
      if (parentId) {
        setExpandedDirs((prev) => new Set([...prev, parentId]));
      }

      // If it's a file, open it
      if (nodeType === 1) {
        const builtTree = buildTree(newNodes);
        const created = newNodes.find((n: CraftNodeData) =>
          n.name === name.trim() && n.nodeType === nodeType && n.parentId === (parentId || null)
        );
        if (created) {
          // Save current first, then switch
          if (activeNodeIdRef.current) {
            await http.put(`/craft/${projectId}/node/${activeNodeIdRef.current}`, {
              content: contentRef.current,
            }).catch(() => {});
          }
          setActiveNodeId(created.id);
          setActiveContent('');
          setInitialContent('');
        }
      }
    } catch {
      message.error('Failed to create');
    }
  }, [projectId, loadTree, message]);

  const handleRename = useCallback(async (nodeId: string, newName: string) => {
    if (!newName.trim()) { setRenamingId(null); return; }
    try {
      if (isTodoItem(nodeId)) {
        await http.put(`/todo/${projectId}/${realId(nodeId)}`, { title: newName.trim() });
      } else if (isTodoMod(nodeId)) {
        await http.put(`/todo/${projectId}/modules/${realId(nodeId)}`, { name: newName.trim() });
      } else {
        await http.put(`/craft/${projectId}/node/${nodeId}`, { name: newName.trim() });
      }
      setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, name: newName.trim() } : n));
      setRenamingId(null);
    } catch {
      message.error('Failed to rename');
    }
  }, [projectId, message]);

  const handleDelete = useCallback(async (nodeId: string, nodeType: number) => {
    const msg = nodeType === 2 ? t('deleteFolderConfirm') : t('deleteConfirm');
    const ok = await confirm(msg, { cancelable: true });
    if (!ok) return;

    try {
      if (isTodoItem(nodeId)) {
        const todoItemId = realId(nodeId);
        // Need projectId from the node
        const nd = nodes.find((n) => n.id === nodeId);
        await http.delete(`/todo/${nd?.projectId || projectId}/${todoItemId}`);
      } else if (isTodoMod(nodeId)) {
        await http.delete(`/todo/${projectId}/modules/${realId(nodeId)}`);
      } else {
        await http.delete(`/craft/${projectId}/node/${nodeId}`);
      }

      // Remove from local state
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      const remainingNodes = nodes.filter((n) => n.id !== nodeId);

      // If deleted the active file, switch to next available
      if (nodeId === activeNodeId) {
        const builtTree = buildTree(remainingNodes);
        const nextFile = findFirstFile(builtTree);
        if (nextFile) {
          if (isTodoItem(nextFile)) {
            const localNode = remainingNodes.find((n) => n.id === nextFile);
            setActiveNodeId(nextFile);
            setActiveContent(localNode?.content || '');
            setInitialContent(localNode?.content || '');
          } else {
            const node = await loadNode(nextFile);
            if (node) {
              setActiveNodeId(nextFile);
              setActiveContent(node.content || '');
              setInitialContent(node.content || '');
            }
          }
        } else {
          setActiveNodeId(null);
          setActiveContent('');
          setInitialContent(null);
        }
      }
    } catch {
      message.error('Failed to delete');
    }
  }, [projectId, activeNodeId, loadTree, loadNode, confirm, t, message]);

  const handleHeaderRename = useCallback(async () => {
    if (!activeNodeId || !headerNameValue.trim()) {
      setEditingHeaderName(false);
      return;
    }
    try {
      if (isTodoItem(activeNodeId)) {
        await http.put(`/todo/${projectId}/${realId(activeNodeId)}`, { title: headerNameValue.trim() });
      } else {
        await http.put(`/craft/${projectId}/node/${activeNodeId}`, { name: headerNameValue.trim() });
      }
      // Update local nodes
      setNodes((prev) => prev.map((n) => n.id === activeNodeId ? { ...n, name: headerNameValue.trim() } : n));
    } catch {
      message.error('Failed to rename');
    }
    setEditingHeaderName(false);
  }, [activeNodeId, headerNameValue, projectId, message]);

  // --- Outline click ---

  const scrollToHeading = useCallback((index: number) => {
    const container = document.querySelector('.craft-editor-content');
    if (!container) return;
    const headings = container.querySelectorAll('h1, h2, h3, h4');
    if (headings[index]) {
      headings[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // --- Toggle directory ---

  const toggleDir = useCallback((dirId: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirId)) next.delete(dirId);
      else next.add(dirId);
      return next;
    });
  }, []);

  // --- Render ---

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex-shrink-0 border-r border-[var(--border)] bg-surface flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          sidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden border-r-0',
          'max-md:absolute max-md:z-30 max-md:h-full max-md:shadow-2xl',
          !sidebarOpen && 'max-md:w-0'
        )}
      >
        {/* Sidebar tabs */}
        <div className="flex items-center border-b border-[var(--border)] h-11 px-2 gap-1 flex-shrink-0">
          <button
            onClick={() => setSidebarTab('files')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all',
              sidebarTab === 'files'
                ? 'bg-surface-subtle text-foreground'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
            )}
          >
            <List size={14} />
            {t('filesTab')}
          </button>
          <button
            onClick={() => setSidebarTab('outline')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all',
              sidebarTab === 'outline'
                ? 'bg-surface-subtle text-foreground'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
            )}
          >
            <Hash size={14} />
            {t('outlineTab')}
          </button>
        </div>

        {sidebarTab === 'files' ? (
          <>
            {/* Action buttons */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] flex-shrink-0">
              <button
                onClick={() => {
                  setCreatingNode({ parentId: null, nodeType: 1 });
                  setCreateName(t('newFileName'));
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"
                title={t('newFile')}
              >
                <FilePlus size={15} />
              </button>
              <button
                onClick={() => {
                  setCreatingNode({ parentId: null, nodeType: 2 });
                  setCreateName(t('newFolderName'));
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-foreground-muted transition-all hover:bg-surface-subtle hover:text-foreground"
                title={t('newFolder')}
              >
                <FolderPlus size={15} />
              </button>
            </div>

            {/* File tree */}
            <div className="flex-1 overflow-y-auto py-1">
              {tree.length === 0 && !creatingNode ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                  <FileText size={24} className="text-foreground-lighter" />
                  <p className="text-sm text-foreground-muted">{t('noFiles')}</p>
                  <p className="text-sm text-foreground-lighter">{t('noFilesHint')}</p>
                </div>
              ) : (
                <>
                  {tree.map((tn) => (
                    <TreeItem
                      key={tn.node.id}
                      treeNode={tn}
                      depth={0}
                      activeNodeId={activeNodeId}
                      expandedDirs={expandedDirs}
                      renamingId={renamingId}
                      renameValue={renameValue}
                      creatingNode={creatingNode}
                      createName={createName}
                      onToggleDir={toggleDir}
                      onSelectFile={switchToFile}
                      onStartRename={(id, name) => { setRenamingId(id); setRenameValue(name); }}
                      onRenameChange={setRenameValue}
                      onRenameSubmit={handleRename}
                      onRenameCancel={() => setRenamingId(null)}
                      onDelete={handleDelete}
                      onStartCreate={(parentId, nodeType) => {
                        setCreatingNode({ parentId, nodeType });
                        setCreateName(nodeType === 1 ? t('newFileName') : t('newFolderName'));
                        if (parentId) setExpandedDirs((prev) => new Set([...prev, parentId]));
                      }}
                      onCreateChange={setCreateName}
                      onCreateSubmit={(name) => {
                        if (creatingNode) handleCreateNode(name, creatingNode.nodeType, creatingNode.parentId);
                        setCreatingNode(null);
                      }}
                      onCreateCancel={() => setCreatingNode(null)}
                      t={t}
                    />
                  ))}
                  {/* Root-level creating input */}
                  {creatingNode && creatingNode.parentId === null && (
                    <CreateInput
                      nodeType={creatingNode.nodeType}
                      depth={0}
                      value={createName}
                      onChange={setCreateName}
                      onSubmit={(name) => {
                        handleCreateNode(name, creatingNode.nodeType, null);
                        setCreatingNode(null);
                      }}
                      onCancel={() => setCreatingNode(null)}
                    />
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* Outline view */
          <div className="flex-1 overflow-y-auto py-2">
            {outline.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
                <Hash size={24} className="text-foreground-lighter" />
                <p className="text-sm text-foreground-muted">{t('noOutline')}</p>
                <p className="text-sm text-foreground-lighter">{t('noOutlineHint')}</p>
              </div>
            ) : (
              outline.map((h, i) => (
                <button
                  key={i}
                  onClick={() => scrollToHeading(h.index)}
                  className="w-full text-left px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors truncate"
                  style={{ paddingLeft: `${12 + (h.level - 1) * 16}px` }}
                >
                  <span className="text-foreground-lighter text-xs mr-1.5">{'#'.repeat(h.level)}</span>
                  {h.text}
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-5 border-b border-[var(--border)] flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-hover hover:text-foreground flex-shrink-0 border border-transparent hover:border-[var(--border)]"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-muted transition-all hover:bg-surface-hover hover:text-foreground flex-shrink-0 border border-transparent hover:border-[var(--border)]"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold truncate max-w-[200px] flex-shrink-0">{projectName}</span>
            {activeNode && (
              <>
                <span className="text-foreground-lighter flex-shrink-0">/</span>
                {editingHeaderName ? (
                  <input
                    type="text"
                    value={headerNameValue}
                    onChange={(e) => setHeaderNameValue(e.target.value)}
                    onBlur={handleHeaderRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleHeaderRename();
                      if (e.key === 'Escape') setEditingHeaderName(false);
                    }}
                    className="text-sm font-medium bg-surface-subtle border border-[var(--border)] rounded px-1.5 py-0.5 outline-none focus:border-foreground min-w-[60px] max-w-[200px]"
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-sm font-medium truncate cursor-pointer hover:bg-surface-subtle rounded px-1 py-0.5 transition-colors"
                    onDoubleClick={() => {
                      setEditingHeaderName(true);
                      setHeaderNameValue(activeNode.name);
                    }}
                    title={t('doubleClickRename')}
                  >
                    {activeNode.name}{getExtension(activeNode.nodeType, activeNode.isTodo)}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              'text-xs font-mono transition-colors',
              saving ? 'text-foreground-muted' : saved ? 'text-emerald-500' : 'text-transparent'
            )}>
              {saving ? '...' : saved ? t('saved') : '-'}
            </span>
            <button
              onClick={doSave}
              disabled={saving || !activeNodeId}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium text-foreground-muted border border-[var(--border)] transition-all hover:bg-surface-subtle hover:text-foreground disabled:opacity-40"
            >
              <Save size={14} />
            </button>
            <button className="flex items-center gap-1.5 h-8 px-4 rounded-md text-sm font-medium text-white bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700 shadow-md transition-all hover:-translate-y-px hover:shadow-lg">
              <Loader size={14} className="text-zinc-400" />
              {t('askAi')}
            </button>
          </div>
        </header>

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto flex justify-center pb-24 pt-10">
          {activeNodeId && initialContent !== null ? (
            <div className="w-full max-w-[800px] px-10 flex flex-col">
              <CraftEditor
                key={activeNodeId}
                content={initialContent}
                onChange={setActiveContent}
                placeholder={t('aiHint')}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <FileText size={32} className="text-foreground-lighter" />
              <p className="text-sm text-foreground-muted">{t('noFileSelected')}</p>
              <button
                onClick={() => {
                  setCreatingNode({ parentId: null, nodeType: 1 });
                  setCreateName(t('newFileName'));
                  setSidebarOpen(true);
                  setSidebarTab('files');
                }}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium bg-foreground text-white transition-all hover:bg-zinc-800"
              >
                <FilePlus size={14} />
                {t('newFile')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// --- Tree Item Component ---

interface TreeItemProps {
  treeNode: TreeNode;
  depth: number;
  activeNodeId: string | null;
  expandedDirs: Set<string>;
  renamingId: string | null;
  renameValue: string;
  creatingNode: { parentId: string | null; nodeType: number } | null;
  createName: string;
  onToggleDir: (id: string) => void;
  onSelectFile: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string, name: string) => void;
  onRenameCancel: () => void;
  onDelete: (id: string, nodeType: number) => void;
  onStartCreate: (parentId: string, nodeType: number) => void;
  onCreateChange: (v: string) => void;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

function TreeItem({
  treeNode,
  depth,
  activeNodeId,
  expandedDirs,
  renamingId,
  renameValue,
  creatingNode,
  createName,
  onToggleDir,
  onSelectFile,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onStartCreate,
  onCreateChange,
  onCreateSubmit,
  onCreateCancel,
  t,
}: TreeItemProps) {
  const { node, children } = treeNode;
  const isDir = node.nodeType === 2;
  const isExpanded = expandedDirs.has(node.id);
  const isActive = node.id === activeNodeId;
  const isRenaming = renamingId === node.id;
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (isDir) {
      onToggleDir(node.id);
    } else {
      onSelectFile(node.id);
    }
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-center h-8 pr-1 cursor-pointer transition-colors relative',
          isActive && !isDir ? 'bg-surface-subtle text-foreground' : 'text-foreground-muted hover:bg-surface-hover hover:text-foreground'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartRename(node.id, node.name);
        }}
      >
        {/* Chevron for directories */}
        {isDir ? (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-0.5">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-4 mr-0.5 flex-shrink-0" />
        )}

        {/* Icon */}
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5">
          {isDir ? (
            isExpanded ? <FolderOpen size={15} className="text-foreground-lighter" /> : <Folder size={15} className="text-foreground-lighter" />
          ) : (
            <FileText size={15} className={isActive ? 'text-foreground' : 'text-foreground-lighter'} />
          )}
        </span>

        {/* Name */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={() => onRenameSubmit(node.id, renameValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit(node.id, renameValue);
              if (e.key === 'Escape') onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm bg-surface border border-[var(--border)] rounded px-1.5 py-0.5 outline-none focus:border-foreground"
            autoFocus
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm truncate select-none">
            {node.name}
            <span className="text-foreground-lighter">{getExtension(node.nodeType)}</span>
          </span>
        )}

        {/* Hover actions */}
        {hovered && !isRenaming && (
          <div className="flex items-center gap-0 flex-shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
            {isDir && (
              <button
                onClick={() => onStartCreate(node.id, 1)}
                className="w-6 h-6 rounded flex items-center justify-center text-foreground-lighter hover:text-foreground hover:bg-surface-subtle transition-colors"
                title={t('newFile')}
              >
                <Plus size={13} />
              </button>
            )}
            <button
              onClick={() => onStartRename(node.id, node.name)}
              className="w-6 h-6 rounded flex items-center justify-center text-foreground-lighter hover:text-foreground hover:bg-surface-subtle transition-colors"
              title={t('rename')}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onDelete(node.id, node.nodeType)}
              className="w-6 h-6 rounded flex items-center justify-center text-foreground-lighter hover:text-red-500 hover:bg-red-50 transition-colors"
              title={t('delete')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Children (if directory is expanded) */}
      {isDir && isExpanded && (
        <>
          {children.map((child) => (
            <TreeItem
              key={child.node.id}
              treeNode={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              expandedDirs={expandedDirs}
              renamingId={renamingId}
              renameValue={renameValue}
              creatingNode={creatingNode}
              createName={createName}
              onToggleDir={onToggleDir}
              onSelectFile={onSelectFile}
              onStartRename={onStartRename}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onDelete={onDelete}
              onStartCreate={onStartCreate}
              onCreateChange={onCreateChange}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
              t={t}
            />
          ))}
          {/* Create input inside this directory */}
          {creatingNode && creatingNode.parentId === node.id && (
            <CreateInput
              nodeType={creatingNode.nodeType}
              depth={depth + 1}
              value={createName}
              onChange={onCreateChange}
              onSubmit={onCreateSubmit}
              onCancel={onCreateCancel}
            />
          )}
        </>
      )}
    </>
  );
}

// --- Create Input Component ---

function CreateInput({
  nodeType,
  depth,
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  nodeType: number;
  depth: number;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex items-center h-8 pr-1"
      style={{ paddingLeft: `${8 + depth * 16 + 20}px` }}
    >
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1.5">
        {nodeType === 2 ? (
          <Folder size={14} className="text-foreground-lighter" />
        ) : (
          <FileText size={14} className="text-foreground-lighter" />
        )}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value.trim()) onSubmit(value); else onCancel(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value);
          if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 min-w-0 text-sm bg-surface border border-[var(--border)] rounded px-1.5 py-0.5 outline-none focus:border-foreground"
        autoFocus
      />
    </div>
  );
}
