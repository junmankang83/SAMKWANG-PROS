'use client';

import type { SparePartMasterRow } from '@samkwang/shared';
import { Input } from '@samkwang/ui-kit';
import { useEffect, useMemo, useRef, useState } from 'react';

export function formatMasterLabel(m: SparePartMasterRow): string {
  const spec = m.spec ? ` · ${m.spec}` : '';
  return `${m.partCode} · ${m.productName}${spec}`;
}

export function filterMasters(masters: SparePartMasterRow[], query: string): SparePartMasterRow[] {
  const term = query.trim().toLowerCase();
  if (!term) {
    return masters;
  }
  return masters.filter(
    (m) =>
      m.partCode.toLowerCase().includes(term) ||
      m.productName.toLowerCase().includes(term) ||
      (m.spec?.toLowerCase().includes(term) ?? false),
  );
}

type MasterPartSearchSelectProps = {
  masters: SparePartMasterRow[];
  value: string;
  onChange: (masterId: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function MasterPartSearchSelect({
  masters,
  value,
  onChange,
  required,
  disabled,
  placeholder = '코드·제품명 검색',
}: MasterPartSearchSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => masters.find((m) => m.id === value), [masters, value]);

  const filtered = useMemo(() => filterMasters(masters, query), [masters, query]);

  useEffect(() => {
    if (!open && selected) {
      setQuery(formatMasterLabel(selected));
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
          setQuery(formatMasterLabel(selected));
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

  function pickMaster(m: SparePartMasterRow) {
    onChange(m.id);
    setQuery(formatMasterLabel(m));
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
        aria-controls="master-part-listbox"
      />
      {open && filtered.length > 0 ? (
        <ul
          id="master-part-listbox"
          role="listbox"
          className="pros-master-combobox-list absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-app-border bg-app-surface-02 py-1 shadow-card"
        >
          {filtered.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === value}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-app-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMaster(m)}
              >
                <span className="font-mono text-xs text-app-muted">{m.partCode}</span>
                <span className="ml-2">{m.productName}</span>
                {m.spec ? <span className="ml-1 text-app-muted">({m.spec})</span> : null}
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
