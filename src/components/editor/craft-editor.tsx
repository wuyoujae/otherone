'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  CodeSquare,
  Table as TableIcon,
  Minus,
  ImageIcon,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Plus,
  X,
  Subscript as SubIcon,
  Superscript as SupIcon,
  ArrowLeftRight,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  PanelTop,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

interface CraftEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

const slashItems = [
  { id: 'h1', label: 'Heading 1', icon: Heading1, description: 'Large section heading', keywords: 'h1 title' },
  { id: 'h2', label: 'Heading 2', icon: Heading2, description: 'Medium section heading', keywords: 'h2 subtitle' },
  { id: 'h3', label: 'Heading 3', icon: Heading3, description: 'Small section heading', keywords: 'h3' },
  { id: 'h4', label: 'Heading 4', icon: Heading4, description: 'Sub-section heading', keywords: 'h4' },
  { id: 'paragraph', label: 'Text', icon: Type, description: 'Plain text block', keywords: 'text paragraph' },
  { id: 'bullet', label: 'Bullet List', icon: List, description: 'Unordered list', keywords: 'ul unordered dash' },
  { id: 'ordered', label: 'Numbered List', icon: ListOrdered, description: 'Ordered list', keywords: 'ol numbered' },
  { id: 'task', label: 'Task List', icon: CheckSquare, description: 'Checklist with toggles', keywords: 'todo checkbox' },
  { id: 'quote', label: 'Quote', icon: Quote, description: 'Block quote', keywords: 'blockquote' },
  { id: 'code', label: 'Code Block', icon: CodeSquare, description: 'Code with syntax highlighting', keywords: 'pre fenced' },
  { id: 'table2x2', label: 'Table 2x2', icon: TableIcon, description: 'Simple 2x2 table', keywords: 'grid table' },
  { id: 'table3x3', label: 'Table 3x3', icon: TableIcon, description: 'Standard 3x3 table', keywords: 'grid table' },
  { id: 'table4x4', label: 'Table 4x4', icon: TableIcon, description: 'Large 4x4 table', keywords: 'grid table' },
  { id: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal rule', keywords: 'hr line separator' },
  { id: 'image', label: 'Image', icon: ImageIcon, description: 'Embed an image via URL', keywords: 'img picture' },
];

export function CraftEditor({ content, onChange, placeholder }: CraftEditorProps) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const slashRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      Subscript,
      Superscript,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'craft-link' },
        autolink: true,
      }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: placeholder || 'Type / for commands...',
        emptyEditorClass: 'is-editor-empty',
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'craft-table' },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      // Output as markdown via tiptap-markdown
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (e.storage as any).markdown?.getMarkdown() || e.getHTML();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: 'craft-editor-content',
        spellcheck: 'false',
      },
      handleKeyDown: (view, event) => {
        if (slashOpen) return false;

        // Markdown table: | A | B | + Enter → table
        if (event.key === 'Enter') {
          const { state } = view;
          const { $from } = state.selection;
          const currentNode = $from.parent;
          if (currentNode.isTextblock) {
            const text = currentNode.textContent.trim();
            // Match: starts with |, ends with |, has at least 2 cells
            const tableRowRegex = /^\|(.+\|)+$/;
            if (tableRowRegex.test(text)) {
              const cells = text.split('|').slice(1, -1).map((c: string) => c.trim());
              // Skip if it looks like a separator line (| --- | --- |)
              const isSep = cells.every((c: string) => /^[-:\s]+$/.test(c));
              if (!isSep && cells.length >= 2) {
                event.preventDefault();
                const lineFrom = $from.before();
                const lineTo = $from.after();

                setTimeout(() => {
                  const e = editorRef.current;
                  if (!e) return;

                  // Build table HTML directly with header content filled in
                  const cols = cells.length;
                  const headerCells = cells.map((c: string) => `<th><p>${c}</p></th>`).join('');
                  const emptyCells = Array(cols).fill('<td><p></p></td>').join('');
                  const bodyRows = Array(cols - 1).fill(`<tr>${emptyCells}</tr>`).join('');
                  const tableHtml = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows.length > 0 ? bodyRows : `<tr>${emptyCells}</tr>`}</tbody></table>`;

                  e.chain()
                    .focus()
                    .deleteRange({ from: lineFrom, to: lineTo })
                    .insertContent(tableHtml)
                    .run();
                }, 0);
                return true;
              }
            }
          }
        }

        // Slash command
        if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
          setTimeout(() => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              setSlashPos({ top: rect.bottom + 8, left: rect.left });
            }
            setSlashOpen(true);
            setSlashFilter('');
            setSlashIndex(0);
          }, 10);
        }
        return false;
      },
    },
  });

  // Keep editorRef in sync
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const filteredSlashItems = slashItems.filter((item) => {
    const q = slashFilter.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.keywords.includes(q);
  });

  const executeSlashCommand = useCallback(
    (id: string) => {
      if (!editor) return;

      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - slashFilter.length - 1),
        from
      );
      const slashStart = from - textBefore.length;
      editor.chain().focus().deleteRange({ from: slashStart, to: from }).run();

      switch (id) {
        case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
        case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
        case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
        case 'h4': editor.chain().focus().toggleHeading({ level: 4 }).run(); break;
        case 'paragraph': editor.chain().focus().setParagraph().run(); break;
        case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
        case 'ordered': editor.chain().focus().toggleOrderedList().run(); break;
        case 'task': editor.chain().focus().toggleTaskList().run(); break;
        case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
        case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
        case 'table2x2': editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(); break;
        case 'table3x3': editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
        case 'table4x4': editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run(); break;
        case 'divider': editor.chain().focus().setHorizontalRule().run(); break;
        case 'image': {
          const url = window.prompt('Image URL');
          if (url) editor.chain().focus().setImage({ src: url }).run();
          break;
        }
      }
      setSlashOpen(false);
    },
    [editor, slashFilter]
  );

  useEffect(() => {
    if (!slashOpen || !editor) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSlashOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((p) => (p + 1) % filteredSlashItems.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((p) => (p - 1 + filteredSlashItems.length) % filteredSlashItems.length); return; }
      if (e.key === 'Enter' && filteredSlashItems.length > 0) { e.preventDefault(); executeSlashCommand(filteredSlashItems[slashIndex].id); return; }
      if (e.key === 'Backspace') { if (slashFilter.length === 0) { setSlashOpen(false); } else { setSlashFilter((p) => p.slice(0, -1)); } return; }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { setSlashFilter((p) => p + e.key); setSlashIndex(0); }
    };

    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [slashOpen, slashFilter, slashIndex, filteredSlashItems, executeSlashCommand, editor]);

  useEffect(() => {
    if (!slashOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (slashRef.current && !slashRef.current.contains(e.target as Node)) setSlashOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [slashOpen]);

  if (!editor) return null;

  return (
    <div className="relative">
      <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }} className="craft-bubble-menu">
        <BubbleToolbar editor={editor} />
      </BubbleMenu>

      <EditorContent editor={editor} />

      {editor.isActive('table') && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-0.5 px-2 py-1.5">
            {/* Insert */}
            <TableBtn icon={ArrowLeftRight} label="Insert column before" onClick={() => editor.chain().focus().addColumnBefore().run()} text="Col" />
            <TableBtn icon={Plus} label="Insert column after" onClick={() => editor.chain().focus().addColumnAfter().run()} />
            <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
            <TableBtn icon={ArrowUpDown} label="Insert row before" onClick={() => editor.chain().focus().addRowBefore().run()} text="Row" />
            <TableBtn icon={Plus} label="Insert row after" onClick={() => editor.chain().focus().addRowAfter().run()} />
            <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
            <TableBtn icon={Maximize2} label="Merge cells" onClick={() => editor.chain().focus().mergeCells().run()} />
            <TableBtn icon={Minimize2} label="Split cell" onClick={() => editor.chain().focus().splitCell().run()} />
            <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
            <TableBtn icon={PanelTop} label="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
            <div className="w-px h-5 bg-[var(--border)] mx-0.5" />
            {/* Delete */}
            <TableBtn icon={X} label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()} danger />
            <TableBtn icon={X} label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()} danger />
            <TableBtn icon={Trash2} label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} danger />
          </div>
        </div>
      )}

      {slashOpen && slashPos && (
        <div
          ref={slashRef}
          className="fixed z-[100] w-[280px] max-h-[340px] overflow-y-auto bg-surface border border-[var(--border)] rounded-xl shadow-2xl py-2 animate-slide-down"
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          {filteredSlashItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-foreground-muted">No results</div>
          ) : (
            filteredSlashItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => executeSlashCommand(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  i === slashIndex ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-[var(--border)] flex items-center justify-center text-foreground-muted flex-shrink-0">
                  <item.icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-foreground-muted">{item.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TableBtn({ icon: Icon, label, onClick, danger, text }: { icon: typeof Plus; label: string; onClick: () => void; danger?: boolean; text?: string }) {
  return (
    <button onClick={onClick} className={cn('craft-table-btn', danger && 'text-red-500')} title={label}>
      <Icon size={14} />
      {text && <span className="text-[10px] ml-0.5">{text}</span>}
    </button>
  );
}

/* ============ Bubble Toolbar ============ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleToolbar({ editor }: { editor: any }) {
  const [linkInput, setLinkInput] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  const setLink = () => {
    if (linkInput) {
      editor.chain().focus().setLink({ href: linkInput }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkForm(false);
    setLinkInput('');
  };

  if (showLinkForm) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          type="url"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); setLink(); }
            if (e.key === 'Escape') setShowLinkForm(false);
          }}
          placeholder="https://..."
          className="h-7 w-48 px-2 text-sm bg-transparent outline-none text-white placeholder:text-zinc-500"
          autoFocus
        />
        <button onClick={setLink} className="craft-bubble-btn text-emerald-400"><LinkIcon size={14} /></button>
        <button onClick={() => setShowLinkForm(false)} className="craft-bubble-btn text-zinc-400"><X size={14} /></button>
      </div>
    );
  }

  const btns: { icon: typeof Bold; action: () => void; active: boolean; key: string }[] = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), key: 'bold' },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), key: 'italic' },
    { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), key: 'underline' },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), key: 'strike' },
    { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), key: 'code' },
    { icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), key: 'highlight' },
    { icon: SubIcon, action: () => editor.chain().focus().toggleSubscript().run(), active: editor.isActive('subscript'), key: 'sub' },
    { icon: SupIcon, action: () => editor.chain().focus().toggleSuperscript().run(), active: editor.isActive('superscript'), key: 'sup' },
    { icon: LinkIcon, action: () => { setLinkInput(editor.getAttributes('link').href || ''); setShowLinkForm(true); }, active: editor.isActive('link'), key: 'link' },
  ];

  const alignBtns: { icon: typeof AlignLeft; align: string; key: string }[] = [
    { icon: AlignLeft, align: 'left', key: 'left' },
    { icon: AlignCenter, align: 'center', key: 'center' },
    { icon: AlignRight, align: 'right', key: 'right' },
  ];

  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5">
      {btns.map((btn) => (
        <button key={btn.key} onClick={btn.action} className={cn('craft-bubble-btn', btn.active && 'bg-zinc-600 text-white')}>
          <btn.icon size={14} />
        </button>
      ))}
      <div className="w-px h-4 bg-zinc-600 mx-0.5" />
      {alignBtns.map((btn) => (
        <button
          key={btn.key}
          onClick={() => editor.chain().focus().setTextAlign(btn.align).run()}
          className={cn('craft-bubble-btn', editor.isActive({ textAlign: btn.align }) && 'bg-zinc-600 text-white')}
        >
          <btn.icon size={14} />
        </button>
      ))}
    </div>
  );
}
