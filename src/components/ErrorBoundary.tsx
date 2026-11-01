import React from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string;
}

/**
 * Catches a crash while rendering and shows what happened (instead of a blank page), with the
 * error details to copy — so a crash can be reported and fixed.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  private details() {
    const { error, componentStack } = this.state;
    return [
      `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      `Page: ${window.location.pathname}`,
      '',
      error?.stack ?? '',
      '',
      'Component stack:',
      componentStack.trim(),
    ].join('\n');
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This page crashed. Your plan data is saved up to the last auto-save. Copy the error details below
          and send them along, so the cause can be fixed.
        </p>
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
          {this.details()}
        </pre>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(this.details()); }}>
            <Copy className="h-4 w-4 mr-2" /> Copy error details
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reload page
          </Button>
        </div>
      </div>
    );
  }
}

/** Error boundary that resets when the coach navigates to another page */
export function RouteErrorBoundary({ children }: Props) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}
