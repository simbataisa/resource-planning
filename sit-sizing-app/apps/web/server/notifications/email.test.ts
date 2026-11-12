import { describe, expect, it } from 'vitest';
import { noticeLink, renderEmail } from './email';

const payload = {
  actorName: 'Synthetic Lead',
  projectName: 'Synthetic · Retail',
  estimateId: 'cm0estimate000000000000',
  estimateName: 'Onboarding <R3>',
  versionNumber: 2,
};

describe('notification emails (N-01)', () => {
  it('renders subject, text and HTML in English', () => {
    const m = renderEmail('SUBMITTED', payload, 'en', 'http://localhost:3000/');
    expect(m.subject).toBe('Approval needed: Onboarding <R3> v2');
    expect(m.text).toContain('Synthetic Lead submitted Onboarding <R3> v2 (Synthetic · Retail)');
    expect(m.text).toContain(
      'Open in SIT Sizing: http://localhost:3000/en/estimates/cm0estimate000000000000',
    );
    // Names are escaped in HTML.
    expect(m.html).toContain('Onboarding &lt;R3&gt; v2');
    expect(m.html).not.toContain('<R3>');
  });

  it('renders in Vietnamese for a Vietnamese recipient, with the note', () => {
    const m = renderEmail(
      'RETURNED',
      { ...payload, note: 'Thêm "batch" <ngay>' },
      'vi',
      'https://sit.example',
    );
    expect(m.subject).toBe('Đã trả lại: Onboarding <R3> v2');
    expect(m.text).toContain('Ghi chú: Thêm "batch" <ngay>');
    expect(m.html).toContain('Ghi chú: Thêm &quot;batch&quot; &lt;ngay&gt;');
    expect(m.text).toContain('https://sit.example/vi/estimates/');
  });

  it('links profile notices to the profile, and names global scope', () => {
    const p = {
      actorName: 'Synthetic Admin',
      projectName: null,
      profileId: 'cm0profile0000000000000',
      profileName: 'Default 2027',
    };
    const m = renderEmail('PROFILE_PUBLISHED', p, 'en', 'http://x');
    expect(m.text).toContain('published the assumption profile Default 2027 (global)');
    expect(noticeLink('http://x', 'en', 'PROFILE_PUBLISHED', p)).toBe(
      'http://x/en/profiles/cm0profile0000000000000',
    );
  });

  it('falls back to English for an unknown locale', () => {
    expect(renderEmail('APPROVED', payload, 'fr', 'http://x').subject).toMatch(/^Approved:/);
  });
});
