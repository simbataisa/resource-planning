import { MOBILE_CHANNELS } from './catalogue.ts';
import type { Ctx } from './context.ts';
import { bands, num, sum3, type Triple } from './util.ts';

/** Second web stack, languages, iOS/Android and accessibility. */
export function channelGroups(ctx: Ctx, screen: Readonly<Triple>, journey: Readonly<Triple>) {
  const { A, c, E } = ctx;
  const xl = (c.languages - 1) * A.languageShare;
  const w2 = c.ch.web2 ? A.channelShares.web2 : 0;
  const channel: Triple = bands((b) => screen[b] * (xl + w2) + journey[b] * w2);

  const mobOn = MOBILE_CHANNELS.filter((k) => c.ch[k]);
  const devX = Math.max(0, A.deviceCombos - 1) * A.deviceExtra;
  const mobBase: Triple = [0, 0, 0];
  const mobWeak: ('ios' | 'android')[] = [];
  for (const k of mobOn) {
    const sh = A.channelShares[k];
    const ok = num(k === 'ios' ? E.iosUnit : E.androidUnit) >= A.mobileUnitGate;
    if (!ok) mobWeak.push(k);
    for (const b of [0, 1, 2] as const) {
      const up = ok ? 1 : 1 + A.mobileUplift;
      mobBase[b] += (journey[b] * sh + screen[b] * sh * (1 + devX)) * up;
      mobBase[0] += c.screen[b] * sh * A.mobileCases[b] * (1 + devX) * up;
    }
  }
  const mobile: Triple = [mobBase[0], mobBase[1], mobBase[2]];
  mobile[0] += mobOn.length * A.releaseCases;

  const chOn = 1 + (c.ch.web2 ? 1 : 0) + mobOn.length;
  const a11y: Triple = [c.a11y ? sum3(c.screen) * A.a11yCases * chOn : 0, 0, 0];
  return { channel, mobile, a11y, xl, w2, mobOn, mobWeak, devX, chOn };
}
