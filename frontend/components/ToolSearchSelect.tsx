'use client';

import type { ToolRow } from '@samkwang/shared';
import { Input } from '@samkwang/ui-kit';
import { useEffect, useMemo, useRef, useState } from 'react';

export function formatToolLabel(t: ToolRow): string {
  return `${t.toolName} (${t.toolNo})`;
}

export function filterTools(tools: ToolRow[], query: string): ToolRow[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return tools;
  }
  return tools.filter(
    (t) =>
      String(t.toolSeq).includes(term) ||
      t.toolName.toLowerCase().includes(term) ||
      t.toolNo.toLowerCase().includes(term) ||
      (t.asstName?.toLowerCase().includes(term) ?? false),
  );
}

type ToolSearchSelectProps = {
  tools: ToolRow[];
  value: string;
  onChange: (toolId: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function ToolSearchSelect({
  tools,
  value,
  onChange,
  required,
  disabled,
  placeholder = '설비코드·설비명·번호 검색',
}: ToolSearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => tools.find((t) => t.id === value), [tools, value]);
  const filtered = useMemo(() => filterTools(tools, query), [tools, query]);

  useEffect(() => {
    if (!open && selected) {
      setQuery(formatToolLabel(selected));
    }
    if (!value && !open) {
      setQuery('');
    }
  }, [value, selected, open]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (selected) {
          setQuery(formatToolLabel(selected));
        }
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [selected]);

  function handleInputChange(text: string) {
    setQuery(text);
    setOpen(true);
    if (value) {
      onChange('');
    }
  }

  function pickTool(t: ToolRow) {
    onChange(t.id);
    setQuery(formatToolLabel(t));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="pros-master-combobox relative w-full">
      <input type="hidden" value={value} required={required} tabIndex={-1} aria-hidden readOnly />
      <Input
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          setOpen(true);
          if (selected) {
            setQuery('');
            onChange('');
          }
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="tool-listbox"
      />
      {open && filtered.length > 0 ? (
        <ul
          id="tool-listbox"
          role="listbox"
          className="pros-master-combobox-list absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-app-border bg-app-surface-02 py-1 shadow-card"
        >
          {filtered.map((t) => (
            <li key={t.id} role="option" aria-selected={t.id === value}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-app-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickTool(t)}
              >
                <span>{t.toolName}</span>
                <span className="ml-1 text-app-muted">({t.toolNo})</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && filtered.length === 0 ? (
        <div className="pros-master-combobox-empty absolute z-50 mt-1 w-full rounded-md border border-app-border bg-app-surface-02 px-3 py-2 text-sm text-app-muted shadow-card">
          검색 결과가 없습니다.
        </div>
      ) : null}
    </div>
  );
}
