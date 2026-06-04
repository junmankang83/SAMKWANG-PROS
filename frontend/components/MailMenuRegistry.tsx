'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@samkwang/ui-kit';
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

async function readApiError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const body = raw ? JSON.parse(raw) : null;
    if (body && typeof body === 'object') {
      const m = (body as { message?: unknown }).message;
      if (typeof m === 'string') {
        return m;
      }
      if (Array.isArray(m)) {
        return m.map(String).join(', ');
      }
    }
  } catch {
    /* ignore */
  }
  return raw.trim().slice(0, 400) || `요청 실패 (${res.status})`;
}

/** MailSendRule.dailyDaysMask 와 동일: bit0=일 … bit6=토 */
const WD_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  return v.filter((x): x is string => typeof x === 'string');
}

function formatDaysSummary(mask: number): string {
  const picked = WD_LABELS.filter((_, i) => (mask & (1 << i)) !== 0);
  if (picked.length === 0) {
    return '—';
  }
  if (picked.length === 7) {
    return '매일';
  }
  return picked.join('·');
}

type MenuRow = {
  id: string;
  code: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  sortOrder: number;
  recipientEmails: string[];
  sendDaysMask: number;
  sendTimes: string[];
  mailSmtpProfileId: string | null;
  mailSmtpProfile: { id: string; name: string } | null;
  scheduleAutoSendEnabled: boolean;
};

/** 수신·발송 시각·요일이 갖춰진 경우만 발송 목록에 표시(「목록에 저장」·수정과 동일 기준) */
function hasCompleteSendSchedule(r: MenuRow): boolean {
  return r.recipientEmails.length > 0 && r.sendTimes.length > 0 && r.sendDaysMask !== 0;
}

function normalizeApiMenuRow(raw: Record<string, unknown>): MenuRow {
  const mp = raw.mailSmtpProfile;
  let mailSmtpProfile: { id: string; name: string } | null = null;
  if (mp && typeof mp === 'object' && mp !== null && 'id' in mp) {
    const o = mp as Record<string, unknown>;
    mailSmtpProfile = { id: String(o.id ?? ''), name: String(o.name ?? '') };
  }
  const sid = raw.mailSmtpProfileId;
  const mailSmtpProfileId = sid != null && String(sid).trim() !== '' ? String(sid) : null;
  const sa = raw.scheduleAutoSendEnabled;
  const scheduleAutoSendEnabled = typeof sa === 'boolean' ? sa : sa === false ? false : true;
  return {
    id: String(raw.id ?? ''),
    code: String(raw.code ?? ''),
    label: String(raw.label ?? ''),
    defaultSubject: String(raw.defaultSubject ?? ''),
    defaultBody: String(raw.defaultBody ?? ''),
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : Number(raw.sortOrder) || 0,
    recipientEmails: parseStringArray(raw.recipientEmails),
    sendDaysMask: typeof raw.sendDaysMask === 'number' ? raw.sendDaysMask : Number(raw.sendDaysMask) || 0,
    sendTimes: parseStringArray(raw.sendTimes),
    mailSmtpProfileId,
    mailSmtpProfile,
    scheduleAutoSendEnabled,
  };
}

type SmtpProfileOption = {
  id: string;
  name: string;
};

type DraftState = {
  id: string | null;
  code: string;
  label: string;
  defaultSubject: string;
  defaultBody: string;
  sortOrder: string;
  recipientEmails: string[];
  sendDaysMask: number;
  sendTimes: string[];
  mailSmtpProfileId: string;
};

function emptyDraft(): DraftState {
  return {
    id: null,
    code: '',
    label: '',
    defaultSubject: '',
    defaultBody: '',
    sortOrder: '0',
    recipientEmails: [],
    sendDaysMask: 127,
    sendTimes: [],
    mailSmtpProfileId: '',
  };
}

type MailMenuRegistryProps = {
  /** 페이지 상단 제목 (기본: 메일발송관리) */
  title?: string;
  /** 페이지 상단 설명 */
  description?: string;
};

const DEFAULT_DESCRIPTION =
  '아래 표는 받을사람·발송일·발송시간이 모두 저장된 항목만 보여 줍니다(발송 목록). 메뉴는 「메뉴관리」에서 등록하고, 「발송 추가」에서 SMTP 프로필·수신자·요일·시각을 지정한 뒤 「목록에 저장」하면 지정 시각(서울)에 자동 발송됩니다. SMTP 프로필을 비우면 메뉴에 저장된 프로필 또는 등록된 첫 SMTP 프로필이 사용됩니다. 각 행의 「해제」로 자동 발송만 끌 수 있으며(목록에는 그대로 표시), 「자동설정」으로 다시 켤 수 있습니다. 「지금 발송」은 메뉴의 기본 제목·본문으로 즉시 보냅니다.';

export function MailMenuRegistry({
  title = '메일발송관리',
  description = DEFAULT_DESCRIPTION,
}: MailMenuRegistryProps = {}) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendMenuId, setSendMenuId] = useState('');
  const [sendSmtpProfileId, setSendSmtpProfileId] = useState('');
  const [smtpProfileOptions, setSmtpProfileOptions] = useState<SmtpProfileOption[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendExtraRecipients, setSendExtraRecipients] = useState<string[]>([]);
  const [sendExtraDaysMask, setSendExtraDaysMask] = useState(127);
  const [sendExtraTimes, setSendExtraTimes] = useState<string[]>([]);
  const [scheduleAutoBusyId, setScheduleAutoBusyId] = useState<string | null>(null);
  const [manualSendBusyId, setManualSendBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/mail/menus', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        setRows([]);
        return;
      }
      const raw = (await res.json()) as Record<string, unknown>[];
      setRows(raw.map((r) => normalizeApiMenuRow(r)));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/mail/smtp', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) {
          return;
        }
        const raw = (await res.json()) as Record<string, unknown>[];
        const list = Array.isArray(raw)
          ? raw
              .map((p) => ({ id: String(p.id ?? ''), name: String(p.name ?? '') }))
              .filter((p) => p.id)
          : [];
        setSmtpProfileOptions(list);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedMenus = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const sortedDispatchRows = useMemo(
    () => [...rows].filter(hasCompleteSendSchedule).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    [rows],
  );

  async function openSend() {
    setSendError(null);
    setInfoMessage(null);
    setSendMenuId('');
    setSendSmtpProfileId('');
    setSendExtraRecipients([]);
    setSendExtraDaysMask(127);
    setSendExtraTimes([]);
    setSendDialogOpen(true);
    setSendBusy(true);
    try {
      const smtpRes = await fetch('/api/mail/smtp', { credentials: 'include', cache: 'no-store' });
      if (smtpRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (smtpRes.ok) {
        const smtpRaw = (await smtpRes.json()) as Record<string, unknown>[];
        const smtpList = Array.isArray(smtpRaw)
          ? smtpRaw.map((p) => ({ id: String(p.id ?? ''), name: String(p.name ?? '') })).filter((p) => p.id)
          : [];
        setSmtpProfileOptions(smtpList);
        setSendSmtpProfileId('');
      } else {
        setSendError(await readApiError(smtpRes));
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'SMTP 목록을 불러오지 못했습니다.');
    } finally {
      setSendBusy(false);
    }
  }

  function openEdit(r: MenuRow) {
    setInfoMessage(null);
    setDraft({
      id: r.id,
      code: r.code,
      label: r.label,
      defaultSubject: r.defaultSubject,
      defaultBody: r.defaultBody,
      sortOrder: String(r.sortOrder),
      recipientEmails: r.recipientEmails.length > 0 ? [...r.recipientEmails] : [],
      sendDaysMask: r.sendDaysMask,
      sendTimes: r.sendTimes.length > 0 ? [...r.sendTimes] : [],
      mailSmtpProfileId: r.mailSmtpProfileId ?? '',
    });
    setDialogOpen(true);
  }

  function toggleDayBit(dayIndex: number) {
    const bit = 1 << dayIndex;
    setDraft((d) => ({ ...d, sendDaysMask: d.sendDaysMask ^ bit }));
  }

  function addRecipientEmailRow() {
    setDraft((d) => ({ ...d, recipientEmails: [...d.recipientEmails, ''] }));
  }

  function removeRecipientEmailRow(index: number) {
    setDraft((d) => ({
      ...d,
      recipientEmails: d.recipientEmails.filter((_, i) => i !== index),
    }));
  }

  function setRecipientEmailAt(index: number, value: string) {
    setDraft((d) => {
      const next = [...d.recipientEmails];
      next[index] = value;
      return { ...d, recipientEmails: next };
    });
  }

  function addSendTimeRow() {
    setDraft((d) => ({ ...d, sendTimes: [...d.sendTimes, ''] }));
  }

  function removeSendTimeRow(index: number) {
    setDraft((d) => ({
      ...d,
      sendTimes: d.sendTimes.filter((_, i) => i !== index),
    }));
  }

  function setSendTimeAt(index: number, value: string) {
    setDraft((d) => {
      const next = [...d.sendTimes];
      next[index] = value;
      return { ...d, sendTimes: next };
    });
  }

  function addSendExtraRecipientRow() {
    setSendExtraRecipients((prev) => [...prev, '']);
  }

  function removeSendExtraRecipientRow(index: number) {
    setSendExtraRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function setSendExtraRecipientAt(index: number, value: string) {
    setSendExtraRecipients((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function toggleSendExtraDayBit(dayIndex: number) {
    const bit = 1 << dayIndex;
    setSendExtraDaysMask((m) => m ^ bit);
  }

  function addSendExtraTimeRow() {
    setSendExtraTimes((t) => [...t, '']);
  }

  function removeSendExtraTimeRow(index: number) {
    setSendExtraTimes((t) => t.filter((_, i) => i !== index));
  }

  function setSendExtraTimeAt(index: number, value: string) {
    setSendExtraTimes((t) => {
      const next = [...t];
      next[index] = value;
      return next;
    });
  }

  async function saveDraft() {
    if (!draft.id) {
      setLoadError('수정할 메뉴가 없습니다. 신규 메뉴는 메뉴관리에서 등록하세요.');
      return;
    }
    if (!draft.code.trim() || !draft.label.trim()) {
      setLoadError('메뉴코드와 메뉴명은 필수입니다.');
      return;
    }
    const sortOrder = Math.max(0, parseInt(draft.sortOrder, 10) || 0);
    const recipientEmails = draft.recipientEmails.map((e) => e.trim()).filter(Boolean);
    const sendTimes = draft.sendTimes.map((t) => t.trim()).filter(Boolean);
    const payload = {
      code: draft.code.trim(),
      label: draft.label.trim(),
      defaultSubject: draft.defaultSubject.trim(),
      defaultBody: draft.defaultBody,
      sortOrder,
      recipientEmails,
      sendDaysMask: draft.sendDaysMask,
      sendTimes,
      mailSmtpProfileId: draft.mailSmtpProfileId.trim() || null,
    };
    setBusy(true);
    setLoadError(null);
    setInfoMessage(null);
    try {
      const url = `/api/mail/menus/${draft.id}`;
      const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      setDialogOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveSendDialogToList() {
    if (!sendMenuId) {
      setSendError('메뉴를 선택하세요.');
      return;
    }
    if (sendExtraDaysMask === 0) {
      setSendError('발송 요일을 하나 이상 선택하세요.');
      return;
    }
    const recipientEmails = sendExtraRecipients.map((e) => e.trim()).filter(Boolean);
    const sendTimesPayload = sendExtraTimes.map((t) => t.trim()).filter(Boolean);
    if (recipientEmails.length === 0) {
      setSendError('받을사람 메일주소를 하나 이상 입력하세요.');
      return;
    }
    if (sendTimesPayload.length === 0) {
      setSendError('자동 발송을 위해 발송시간(HH:mm)을 하나 이상 추가하세요.');
      return;
    }
    setSendBusy(true);
    setSendError(null);
    try {
      const patchRes = await fetch(`/api/mail/menus/${sendMenuId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmails,
          sendDaysMask: sendExtraDaysMask,
          sendTimes: sendTimesPayload,
          mailSmtpProfileId: sendSmtpProfileId.trim() || null,
          scheduleAutoSendEnabled: true,
        }),
      });
      if (patchRes.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!patchRes.ok) {
        setSendError(await readApiError(patchRes));
        return;
      }
      setSendDialogOpen(false);
      setInfoMessage('목록에 저장되었습니다. 지정한 요일·시각(서울 기준)에 자동으로 메일이 발송됩니다.');
      await load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSendBusy(false);
    }
  }

  async function executeSendNow() {
    if (!sendMenuId) {
      setSendError('메뉴관리에서 등록한 메뉴를 선택하세요.');
      return;
    }
    const toAddresses = sendExtraRecipients.map((e) => e.trim()).filter(Boolean);
    if (toAddresses.length === 0) {
      setSendError('받을사람 메일주소를 하나 이상 입력하세요.');
      return;
    }
    setSendBusy(true);
    setSendError(null);
    try {
      const sendTimesPayload = sendExtraTimes.map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/mail/menus/${sendMenuId}/send-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddresses,
          ...(sendSmtpProfileId.trim() ? { mailSmtpProfileId: sendSmtpProfileId.trim() } : {}),
          sendDaysMask: sendExtraDaysMask,
          ...(sendTimesPayload.length > 0 ? { sendTimes: sendTimesPayload } : {}),
        }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setSendError(await readApiError(res));
        return;
      }
      setSendDialogOpen(false);
      setInfoMessage('메일이 발송되었습니다.');
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '발송 요청에 실패했습니다.');
    } finally {
      setSendBusy(false);
    }
  }

  async function toggleScheduleAutoSend(menuId: string, next: boolean) {
    setScheduleAutoBusyId(menuId);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/menus/${menuId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleAutoSendEnabled: next }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '자동 발송 설정을 바꾸지 못했습니다.');
    } finally {
      setScheduleAutoBusyId(null);
    }
  }

  async function manualSendFromRow(r: MenuRow) {
    if (!window.confirm('수동으로 발송하시겠습니까?')) {
      return;
    }
    const toAddresses = r.recipientEmails.map((e) => e.trim()).filter(Boolean);
    if (toAddresses.length === 0) {
      setLoadError('받을사람 메일 주소가 없습니다.');
      return;
    }
    setManualSendBusyId(r.id);
    setLoadError(null);
    setInfoMessage(null);
    try {
      const res = await fetch(`/api/mail/menus/${r.id}/send-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddresses,
          ...(r.mailSmtpProfileId ? { mailSmtpProfileId: r.mailSmtpProfileId } : {}),
          sendDaysMask: r.sendDaysMask,
          sendTimes: r.sendTimes,
        }),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      setInfoMessage(`「${r.label}」 메일을 수동 발송했습니다.`);
      await load();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '수동 발송에 실패했습니다.');
    } finally {
      setManualSendBusyId(null);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`「${label}」 메뉴를 삭제할까요? 메일발송정보에서 이 메뉴를 참조 중인 규칙이 있으면 메뉴 연결이 해제될 수 있습니다.`)) {
      return;
    }
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/mail/menus/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setLoadError(await readApiError(res));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-app-text">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-app-muted">{description}</p>
        </div>
        <Button type="button" variant="primary" size="sm" disabled={busy} onClick={() => void openSend()}>
          <span className="inline-flex items-center gap-1.5">
            <Icon icon="mdi:email-send-outline" className="h-4 w-4 shrink-0" aria-hidden />
            발송 추가
          </span>
        </Button>
      </div>

      {loadError ? (
        <Alert variant="error">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {infoMessage ? (
        <Alert variant="success">
          <AlertTitle>완료</AlertTitle>
          <AlertDescription>{infoMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">발송 목록</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-hidden p-0 sm:p-0">
          <table className="pros-data-table pros-mail-dispatch-table w-full max-w-full text-sm text-app-text">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[11%]" />
              <col className="w-[21%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[23%]" />
            </colgroup>
            <thead>
              <tr className="bg-app-muted/30">
                <th className="pros-cell-seq">순번</th>
                <th className="pros-cell-center">메뉴코드</th>
                <th className="text-left">메뉴명</th>
                <th className="text-left">SMTP 프로필</th>
                <th className="text-left">받을사람메일주소</th>
                <th className="pros-cell-center">발송일</th>
                <th className="text-left">발송시간</th>
                <th className="pros-cell-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedDispatchRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pros-table-empty text-app-muted">
                    {rows.length === 0
                      ? '메뉴관리에서 등록한 메뉴가 없습니다. 먼저 메뉴를 추가한 뒤 「발송 추가」로 발송 설정을 저장하세요.'
                      : '표시할 발송 설정이 없습니다. 「발송 추가」에서 「목록에 저장」하거나, 메뉴를 선택한 뒤 「수정」으로 받을사람·발송일·발송시간을 저장하세요.'}
                  </td>
                </tr>
              ) : (
                sortedDispatchRows.map((r) => (
                  <tr
                    key={r.id}
                    className={r.scheduleAutoSendEnabled ? undefined : 'bg-app-muted/20 opacity-90'}
                  >
                    <td className="pros-cell-seq">{r.sortOrder}</td>
                    <td className="pros-cell-truncate pros-cell-center text-sm font-mono" title={r.code}>
                      {r.code}
                    </td>
                    <td className="pros-cell-truncate text-left text-sm font-medium" title={r.label}>
                      {r.label}
                    </td>
                    <td
                      className="pros-cell-truncate text-left text-sm"
                      title={r.mailSmtpProfile?.name ?? (r.mailSmtpProfileId ? '' : '자동')}
                    >
                      {r.mailSmtpProfile?.name ?? (r.mailSmtpProfileId ? '—' : '자동')}
                    </td>
                    <td className="pros-cell-truncate text-left text-sm" title={r.recipientEmails.join(', ') || undefined}>
                      {r.recipientEmails.length ? r.recipientEmails.join(', ') : '—'}
                    </td>
                    <td className="pros-cell-center text-sm">{formatDaysSummary(r.sendDaysMask)}</td>
                    <td className="pros-cell-truncate text-left text-sm" title={r.sendTimes.join(', ') || undefined}>
                      {r.sendTimes.length ? r.sendTimes.join(', ') : '—'}
                    </td>
                    <td className="pros-cell-actions align-middle">
                      <div className="flex flex-nowrap items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={busy || scheduleAutoBusyId === r.id || manualSendBusyId === r.id}
                          onClick={() => openEdit(r)}
                        >
                          수정
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={busy || scheduleAutoBusyId === r.id || manualSendBusyId === r.id}
                          onClick={() => void remove(r.id, r.label)}
                        >
                          삭제
                        </Button>
                        <Button
                          type="button"
                          variant={r.scheduleAutoSendEnabled ? 'secondary' : 'primary'}
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={busy || scheduleAutoBusyId === r.id || manualSendBusyId === r.id}
                          loading={scheduleAutoBusyId === r.id}
                          title={
                            r.scheduleAutoSendEnabled
                              ? '지정 시각 자동 발송이 켜져 있습니다. 클릭하면 중지합니다.'
                              : '자동 발송이 꺼져 있습니다. 클릭하면 지정 시각에 다시 발송합니다.'
                          }
                          onClick={() => void toggleScheduleAutoSend(r.id, !r.scheduleAutoSendEnabled)}
                        >
                          {r.scheduleAutoSendEnabled ? '해제' : '자동설정'}
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          disabled={busy || scheduleAutoBusyId === r.id || manualSendBusyId === r.id}
                          loading={manualSendBusyId === r.id}
                          title="이 메뉴의 기본 제목·본문으로, 저장된 받는 사람에게 즉시 발송합니다."
                          onClick={() => void manualSendFromRow(r)}
                        >
                          수동발송
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>메뉴 수정</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[min(85vh,48rem)] space-y-4 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>메뉴코드 (영문·숫자·하이픈 등)</Label>
                <Input value={draft.code} disabled={busy || Boolean(draft.id)} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>순번</Label>
                <Input type="number" min={0} value={draft.sortOrder} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>메뉴명</Label>
              <Input value={draft.label} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">받을사람메일주소 (한 줄에 하나씩)</Label>
                <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" disabled={busy} onClick={addRecipientEmailRow}>
                  주소 추가
                </Button>
              </div>
              {draft.recipientEmails.length === 0 ? (
                <p className="text-xs text-app-muted">「주소 추가」로 수신 메일 주소를 한 줄씩 입력하세요.</p>
              ) : (
                <ul className="space-y-2">
                  {draft.recipientEmails.map((email, idx) => (
                    <li key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="email"
                        className="min-w-0 flex-1 max-w-xl font-mono text-sm"
                        placeholder="user@example.com"
                        autoComplete="email"
                        value={email}
                        disabled={busy}
                        onChange={(e) => setRecipientEmailAt(idx, e.target.value)}
                      />
                      <Button type="button" variant="danger" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => removeRecipientEmailRow(idx)}>
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label>발송일 (요일)</Label>
              <div className="flex flex-wrap gap-3">
                {WD_LABELS.map((wd, i) => (
                  <label key={wd} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-app-border"
                      checked={(draft.sendDaysMask & (1 << i)) !== 0}
                      disabled={busy}
                      onChange={() => toggleDayBit(i)}
                    />
                    {wd}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">발송시간 (HH:mm, 여러 개)</Label>
                <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" disabled={busy} onClick={addSendTimeRow}>
                  시간 추가
                </Button>
              </div>
              {draft.sendTimes.length === 0 ? (
                <p className="text-xs text-app-muted">「시간 추가」로 HH:mm 형식으로 입력하세요.</p>
              ) : (
                <ul className="space-y-2">
                  {draft.sendTimes.map((t, idx) => (
                    <li key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        className="w-32 font-mono text-sm"
                        placeholder="09:30"
                        autoComplete="off"
                        value={t}
                        disabled={busy}
                        onChange={(e) => setSendTimeAt(idx, e.target.value)}
                      />
                      <Button type="button" variant="danger" size="sm" className="h-8 text-xs" disabled={busy} onClick={() => removeSendTimeRow(idx)}>
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>SMTP 프로필 (메일설정)</Label>
              <select
                className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
                value={draft.mailSmtpProfileId}
                disabled={busy || smtpProfileOptions.length === 0}
                onChange={(e) => setDraft((d) => ({ ...d, mailSmtpProfileId: e.target.value }))}
              >
                <option value="">(비우면 첫 SMTP 프로필)</option>
                {smtpProfileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {smtpProfileOptions.length === 0 ? (
                <p className="text-xs text-app-muted">메일설정에서 SMTP 프로필을 등록하면 선택할 수 있습니다.</p>
              ) : null}
            </div>
            <div className="border-t border-app-border pt-4">
              <p className="mb-3 text-xs font-medium text-app-muted">
                기본 제목·본문 (메일발송정보에서 비웠을 때 사용). 실제 발송 시 제목은 서울 기준 발신일이{' '}
                <code className="rounded bg-app-muted/50 px-1">YYYY-MM-DD_</code> 형태로 앞에 붙습니다.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>기본 제목</Label>
                  <Input value={draft.defaultSubject} disabled={busy} onChange={(e) => setDraft((d) => ({ ...d, defaultSubject: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>기본 본문</Label>
                  <textarea
                    className="min-h-[10rem] w-full rounded-md border border-app-border bg-app-surface p-2 text-sm"
                    value={draft.defaultBody}
                    disabled={busy}
                    onChange={(e) => setDraft((d) => ({ ...d, defaultBody: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={busy} loading={busy} onClick={() => void saveDraft()}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sendDialogOpen}
        onOpenChange={(o) => {
          setSendDialogOpen(o);
          if (!o) {
            setSendError(null);
          }
        }}
      >
        <DialogContent size="lg" className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>발송 추가</DialogTitle>
          </DialogHeader>
          <DialogBody className="max-h-[min(85vh,48rem)] space-y-4 overflow-y-auto">
            <p className="text-sm text-app-muted">
              <strong className="text-app-text">메뉴관리</strong>에서 등록한 메뉴를 고르고, <strong className="text-app-text">메일설정</strong> SMTP 프로필(선택)·받을사람·발송 요일·시각을 지정합니다.{' '}
              <strong className="text-app-text">목록에 저장</strong>하면 해당 값이 메뉴에 반영되며 서울 기준 시각에 자동 발송됩니다.{' '}
              <strong className="text-app-text">지금 발송</strong>은 이 메뉴의 기본 제목·본문으로, 아래 받을사람 주소로 즉시 보냅니다. SMTP 프로필을 비우면 메뉴에 저장된 프로필 또는 등록된 첫 프로필을 사용합니다.
            </p>
            {sendError ? (
              <Alert variant="error">
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{sendError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-1.5">
              <Label>메뉴 (메뉴관리)</Label>
              <select
                className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
                value={sendMenuId}
                disabled={sendBusy || sortedMenus.length === 0}
                onChange={(e) => setSendMenuId(e.target.value)}
              >
                <option value="">선택하세요</option>
                {sortedMenus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sortOrder}. {m.label} ({m.code})
                  </option>
                ))}
              </select>
              {sortedMenus.length === 0 ? <p className="text-xs text-app-muted">목록이 비어 있습니다. 메뉴관리에서 메뉴를 먼저 등록하세요.</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>SMTP 프로필 (메일설정)</Label>
              <select
                className="w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
                value={sendSmtpProfileId}
                disabled={sendBusy}
                onChange={(e) => setSendSmtpProfileId(e.target.value)}
              >
                <option value="">(비우면 메뉴 저장값 또는 첫 SMTP 프로필)</option>
                {smtpProfileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {smtpProfileOptions.length === 0 && !sendBusy ? (
                <p className="text-xs text-app-muted">등록된 SMTP 프로필이 없습니다. 메일설정에서 프로필을 추가하세요.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">받을사람 메일주소 (한 줄에 하나씩)</Label>
                <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" disabled={sendBusy} onClick={addSendExtraRecipientRow}>
                  주소 추가
                </Button>
              </div>
              {sendExtraRecipients.length === 0 ? (
                <p className="text-xs text-app-muted">「주소 추가」로 수신 메일을 입력하세요. 자동 발송·지금 발송 모두 이 목록을 사용합니다.</p>
              ) : (
                <ul className="space-y-2">
                  {sendExtraRecipients.map((email, idx) => (
                    <li key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="email"
                        className="min-w-0 flex-1 max-w-xl font-mono text-sm"
                        placeholder="user@example.com"
                        autoComplete="email"
                        value={email}
                        disabled={sendBusy}
                        onChange={(e) => setSendExtraRecipientAt(idx, e.target.value)}
                      />
                      <Button type="button" variant="danger" size="sm" className="h-8 text-xs" disabled={sendBusy} onClick={() => removeSendExtraRecipientRow(idx)}>
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <Label>발송일 (요일)</Label>
              <div className="flex flex-wrap gap-3">
                {WD_LABELS.map((wd, i) => (
                  <label key={wd} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-app-border"
                      checked={(sendExtraDaysMask & (1 << i)) !== 0}
                      disabled={sendBusy}
                      onChange={() => toggleSendExtraDayBit(i)}
                    />
                    {wd}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="mb-0">발송시간 (HH:mm, 여러 개)</Label>
                <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" disabled={sendBusy} onClick={addSendExtraTimeRow}>
                  시간 추가
                </Button>
              </div>
              {sendExtraTimes.length === 0 ? (
                <p className="text-xs text-app-muted">「시간 추가」로 HH:mm 형식으로 입력하세요.</p>
              ) : (
                <ul className="space-y-2">
                  {sendExtraTimes.map((t, idx) => (
                    <li key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        className="w-32 font-mono text-sm"
                        placeholder="09:30"
                        autoComplete="off"
                        value={t}
                        disabled={sendBusy}
                        onChange={(e) => setSendExtraTimeAt(idx, e.target.value)}
                      />
                      <Button type="button" variant="danger" size="sm" className="h-8 text-xs" disabled={sendBusy} onClick={() => removeSendExtraTimeRow(idx)}>
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogBody>
          <DialogFooter className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={sendBusy} onClick={() => setSendDialogOpen(false)}>
              취소
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={sendBusy} loading={sendBusy} onClick={() => void saveSendDialogToList()}>
              목록에 저장
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={sendBusy} loading={sendBusy} onClick={() => void executeSendNow()}>
              지금 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
