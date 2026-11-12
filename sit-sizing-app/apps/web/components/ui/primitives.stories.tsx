import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Checkbox } from './checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta: Meta = { title: 'Layer 2 · Primitives' };
export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button>Save version</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Discard draft</Button>
      <Button variant="link">Link</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};

export const Badges: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(
        ['default', 'secondary', 'outline', 'good', 'warn', 'bad', 'rough', 'detailed'] as const
      ).map((v) => (
        <Badge key={v} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
};

export const FormControls: StoryObj = {
  render: () => (
    <div className="grid max-w-sm gap-3">
      <Label htmlFor="s-weeks">SIT window (weeks)</Label>
      <Input id="s-weeks" type="number" defaultValue={6} />
      <div className="flex items-center gap-2">
        <Checkbox id="s-l4" defaultChecked />
        <Label htmlFor="s-l4">Include L4 journeys</Label>
      </div>
    </div>
  ),
};

export const CardsAndAlerts: StoryObj = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Synthetic · Mobile onboarding R3</CardTitle>
          <CardDescription>Saved version 2 · 21.5 FTE detailed</CardDescription>
        </CardHeader>
        <CardContent>Card content</CardContent>
      </Card>
      <Alert variant="info">
        <Info aria-hidden="true" />
        <AlertTitle>Uncalibrated defaults</AlertTitle>
        <AlertDescription>142 of 142 assumptions are still defaults.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Could not save</AlertTitle>
        <AlertDescription>The draft changed since you loaded it.</AlertDescription>
      </Alert>
    </div>
  ),
};

export const TabsAndTooltip: StoryObj = {
  render: () => (
    <Tabs defaultValue="rough">
      <TabsList>
        <TabsTrigger value="rough">Rough scope</TabsTrigger>
        <TabsTrigger value="detailed">Detailed scope</TabsTrigger>
        <TabsTrigger value="team">Window and team</TabsTrigger>
      </TabsList>
      <TabsContent value="rough">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">What is rough mode?</Button>
          </TooltipTrigger>
          <TooltipContent>Sizing from features before an FSD exists.</TooltipContent>
        </Tooltip>
      </TabsContent>
      <TabsContent value="detailed">Detailed panel</TabsContent>
      <TabsContent value="team">Team panel</TabsContent>
    </Tabs>
  ),
};

export const SheetAndMenu: StoryObj = {
  render: () => (
    <div className="flex gap-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open sheet</Button>
        </SheetTrigger>
        <SheetContent side="left" closeLabel="Close" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Synthetic Estimator</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};
