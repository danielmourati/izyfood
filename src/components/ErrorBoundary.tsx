import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-lg w-full bg-card border border-destructive/30 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <div>
                <h2 className="text-xl font-bold font-heading">Ops! Ocorreu um erro na renderização</h2>
                <p className="text-xs text-muted-foreground">O React capturou uma exceção inesperada nesta tela.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3 bg-muted/80 rounded-lg border border-border font-mono text-xs overflow-x-auto max-h-48 text-destructive">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                Tentar Novamente
              </Button>
              <Button onClick={this.handleReload} className="flex-1 gap-2">
                <RefreshCw className="h-4 w-4" /> Recarregar Página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
