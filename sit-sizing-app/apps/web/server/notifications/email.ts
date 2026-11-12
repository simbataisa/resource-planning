import type { NotificationPayload } from '@sit/schemas';
import { createTranslator } from 'next-intl';
import en from '@/messages/en.json';
import vi from '@/messages/vi.json';
import type { NotificationKind } from '../domain/notifications';

const MESSAGES = { en, vi } as const;
export type MailLocale = keyof typeof MESSAGES;

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** The page a notice points to, in the recipient's language. */
export function noticeLink(
  baseUrl: string,
  locale: MailLocale,
  kind: NotificationKind,
  p: NotificationPayload,
): string {
  const path =
    kind === 'PROFILE_PUBLISHED' ? `/profiles/${p.profileId}` : `/estimates/${p.estimateId}`;
  return `${baseUrl.replace(/\/$/, '')}/${locale}${path}`;
}

/**
 * One notification email in the recipient's language (N-01). Plain text and simple HTML
 * with the same content. Names and notes are escaped; no tracking, no external images.
 */
export function renderEmail(
  kind: NotificationKind,
  p: NotificationPayload,
  locale: string,
  baseUrl: string,
): RenderedEmail {
  const loc: MailLocale = locale === 'vi' ? 'vi' : 'en';
  const t = createTranslator({ locale: loc, messages: MESSAGES[loc], namespace: 'notifications' });
  const values = {
    actor: p.actorName,
    estimate: p.estimateName ?? '',
    version: p.versionNumber ?? 0,
    profile: p.profileName ?? '',
    project: p.projectName ?? t('globalScope'),
  };
  const subject = t(`subject.${kind}`, values);
  const line = t(`body.${kind}`, values);
  const link = noticeLink(baseUrl, loc, kind, p);
  const open = t('open');
  const footer = t('emailFooter');
  const note = p.note ? `${t('noteLabel')}: ${p.note}` : null;
  const text = [line, note, '', `${open}: ${link}`, '', '—', footer]
    .filter((x) => x !== null)
    .join('\n');
  const html = [
    '<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#212121">',
    `<div style="border-top:4px solid #ED1C24;padding-top:12px"><p>${esc(line)}</p>`,
    note
      ? `<blockquote style="margin:0 0 12px;padding-left:10px;border-left:3px solid #C4C4C4">${esc(note)}</blockquote>`
      : '',
    `<p><a href="${esc(link)}">${esc(open)}</a></p>`,
    `<p style="color:#595959;font-size:12px">${esc(footer)}</p></div></body></html>`,
  ].join('');
  return { subject, text, html };
}
