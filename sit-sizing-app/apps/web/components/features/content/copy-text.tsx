'use client';

import { useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Copies a fixed text, e.g. the Biz Case wording (prototype `#copyWording`). */
export function CopyText({
  text,
  label,
  copied,
  failed,
}: {
  text: string;
  label: string;
  copied: string;
  failed: string;
}) {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMessage(copied);
          } catch {
            setMessage(failed);
          }
        }}
      >
        <ClipboardCopy aria-hidden="true" />
        {label}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {message}
      </span>
    </div>
  );
}
