import { CircleAlert, CircleCheck, CircleMinus, CircleX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type StatusTone = 'good' | 'warn' | 'bad' | 'neutral';

const icon = { good: CircleCheck, warn: CircleAlert, bad: CircleX, neutral: CircleMinus } as const;

/**
 * Gate and credit status ("Gate met", "50–99% · partial", "Below 50%"). Colour is never
 * the only signal: every tone has its own icon and the text says the state.
 */
export function StatusChip({ tone, children }: { tone: StatusTone; children: string }) {
  const Icon = icon[tone];
  return (
    <Badge variant={tone === 'neutral' ? 'secondary' : tone}>
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
}
