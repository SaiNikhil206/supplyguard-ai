import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Inbox } from 'lucide-react';
import {
  AiChip,
  Alert,
  TablePagination,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  KpiTile,
  Progress,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Toaster,
  toast,
} from '..';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('px-2 py-1', 'px-4', undefined)).toBe('py-1 px-4');
  });
});

describe('Button', () => {
  it('shows a spinner and disables while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('asChild renders the child element with button styles', () => {
    render(
      <Button asChild variant="outline">
        <a href="/x">Go</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/x');
    expect(link.className).toContain('border');
  });
});

describe('KpiTile', () => {
  it('renders the sparkline slot plus an accessible delta (v2: no icon squares)', () => {
    render(
      <KpiTile
        label="Exposure"
        value="12"
        icon={<Inbox data-testid="ico" />}
        sparkline={<div data-testid="spark" />}
        delta={{ value: '4%', direction: 'down', tone: 'good' }}
      />,
    );
    expect(screen.queryByTestId('ico')).not.toBeInTheDocument();
    expect(screen.getByTestId('spark')).toBeInTheDocument();
    expect(screen.getByText(/decrease, favourable/)).toBeInTheDocument();
  });
});

describe('overlays', () => {
  it('Dialog opens from its trigger and closes with Escape', async () => {
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Confirm</DialogTitle>
          <DialogDescription>Are you sure?</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Confirm' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Sheet opens and has a Close control', async () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent side="left">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigation</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('DropdownMenu items are reachable and fire onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Do it</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Tooltip shows its content on keyboard focus', async () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Helpful hint</TooltipContent>
      </Tooltip>,
    );
    await userEvent.tab();
    expect((await screen.findAllByText('Helpful hint')).length).toBeGreaterThan(0);
  });
});

describe('Tabs / Progress / Alert', () => {
  it('Tabs switch panels', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });

  it('Progress exposes its value', () => {
    render(<Progress value={40} aria-label="Done" />);
    expect(screen.getByRole('progressbar', { name: 'Done' })).toHaveAttribute('aria-valuenow', '40');
  });

  it('Alert has role alert with title and description', () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something changed</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Heads upSomething changed');
  });
});

describe('toast', () => {
  it('toast() renders through the Toaster', async () => {
    render(
      <ThemeProvider>
        <Toaster />
      </ThemeProvider>,
    );
    toast.success('Saved changes');
    expect(await screen.findByText('Saved changes')).toBeInTheDocument();
  });
});

describe('v2 additions', () => {
  it('AiChip labels AI content', () => {
    render(<AiChip />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('TablePagination reports the range and pages', async () => {
    const onPageChange = vi.fn();
    render(<TablePagination page={1} pageSize={10} total={52} onPageChange={onPageChange} />);
    expect(screen.getByText('1-10 of 52')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
