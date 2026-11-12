// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/tests/support/axe';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Checkbox } from './checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Label } from './label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('ui primitives (layer 2)', () => {
  it('Button: variants use tokens, asChild renders the child element', async () => {
    const { container } = render(
      <div>
        <Button>Save version</Button>
        <Button variant="outline" asChild>
          <a href="/x">Open</a>
        </Button>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Save version' })).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
    );
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('data-slot', 'button');
    await expectNoAxeViolations(container);
  });

  it('Label + Input, Checkbox, Badge, Card, Alert and Table are accessible', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="weeks">SIT window (weeks)</Label>
        <Input id="weeks" defaultValue="6" />
        <Checkbox aria-label="Include L4 journeys" defaultChecked />
        <Badge variant="good">Gate met</Badge>
        <Card>
          <CardHeader>
            <CardTitle>Rough · no FSD</CardTitle>
          </CardHeader>
          <CardContent>20.5 FTE</CardContent>
        </Card>
        <Alert variant="destructive">
          <AlertTitle>Could not save</AlertTitle>
          <AlertDescription>The draft changed since you loaded it.</AlertDescription>
        </Alert>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Cases</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>API endpoints</TableCell>
              <TableCell>176</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>,
    );
    expect(screen.getByLabelText('SIT window (weeks)')).toHaveValue('6');
    expect(screen.getByRole('checkbox', { name: 'Include L4 journeys' })).toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    await expectNoAxeViolations(container);
  });

  it('Tabs switch with the keyboard', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="rough">
        <TabsList>
          <TabsTrigger value="rough">Rough scope</TabsTrigger>
          <TabsTrigger value="detailed">Detailed scope</TabsTrigger>
        </TabsList>
        <TabsContent value="rough">Rough panel</TabsContent>
        <TabsContent value="detailed">Detailed panel</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole('tab', { name: 'Rough scope' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Detailed scope' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Detailed panel');
  });

  it('Dialog has an accessible name and a labelled close button', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Import</Button>
        </DialogTrigger>
        <DialogContent closeLabel="Close">
          <DialogTitle>Import a profile</DialogTitle>
          <DialogDescription>Paste a profile exported from the HTML tool.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: 'Import a profile' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Table: the scroll container is a tab stop only when it overflows', () => {
    const widths = (scroll: number, client: number) => {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        get: () => scroll,
      });
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => client,
      });
    };
    const table = (
      <Table aria-label="Versions">
        <TableBody>
          <TableRow>
            <TableCell>v1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    try {
      widths(400, 400);
      const fits = render(table);
      expect(fits.container.querySelector('[data-slot="table-container"]')).not.toHaveAttribute(
        'tabindex',
      );
      fits.unmount();
      widths(900, 400);
      const wide = render(table);
      expect(wide.container.querySelector('[data-slot="table-container"]')).toHaveAttribute(
        'tabindex',
        '0',
      );
    } finally {
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  it('Sheet: opens with its title and closes with the labelled button', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Menu</Button>
        </SheetTrigger>
        <SheetContent side="left" closeLabel="Close" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await expectNoAxeViolations(baseElement);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('DropdownMenu: opens on click and runs an item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Signed in</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSelect}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
