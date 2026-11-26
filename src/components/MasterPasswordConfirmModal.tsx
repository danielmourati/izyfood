import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LockKeyhole, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  verifyTenantMasterPassword,
  hasTenantMasterPassword,
  MASTER_PASSWORD_NOT_CONFIGURED_REASON,
} from '@/lib/master-password';
import { withTimeout } from '@/lib/with-timeout';
import { useAuth } from '@/contexts/AuthContext';

/** Tempo máximo para descobrir se a Senha Mestra está configurada antes de mostrar o modal. */
const MASTER_PASSWORD_CHECK_MS = 8000;

export interface MasterPasswordConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  summaryText?: string;
  target: 'item' | 'order' | 'payment';
  entityId?: string;
  auditContext?: Record<string, unknown>;
  confirmButtonLabel?: string;
  requireReason?: boolean;
  onAuthorized: (payload: { reason: string }) => void | Promise<void>;
}

export function MasterPasswordConfirmModal({
  open,
  onClose,
  title,
  description,
  summaryText,
  target,
  entityId,
  auditContext,
  confirmButtonLabel = 'Autorizar e Excluir',
  requireReason = false,
  onAuthorized,
}: MasterPasswordConfirmModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const autoAuthorizedRef = useRef(false);
  const onAuthorizedRef = useRef(onAuthorized);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onAuthorizedRef.current = onAuthorized;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      autoAuthorizedRef.current = false;
      return;
    }

    setPassword('');
    setReason('');
    setError('');
    setShowPassword(false);
    setChecking(false);
    setConfigured(null);

    if (!user?.tenantId) {
      setConfigured(true);
      return;
    }

    let cancelled = false;
    withTimeout(hasTenantMasterPassword(user.tenantId), MASTER_PASSWORD_CHECK_MS)
      .then(value => {
        if (!cancelled) setConfigured(value);
      })
      .catch(() => {
        // Sem resposta, mantém a proteção: o modal é exibido normalmente.
        if (!cancelled) setConfigured(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user?.tenantId]);

  // Senha Mestra ainda não configurada: não mostra modal, a exclusão segue direto.
  useEffect(() => {
    if (!open || configured !== false || autoAuthorizedRef.current) return;
    autoAuthorizedRef.current = true;
    void (async () => {
      try {
        await onAuthorizedRef.current({ reason: MASTER_PASSWORD_NOT_CONFIGURED_REASON });
      } finally {
        onCloseRef.current();
      }
    })();
  }, [open, configured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;

    if (!password.trim()) {
      setError('Informe a Senha Mestra.');
      return;
    }
    if (requireReason && !reason.trim()) {
      setError('Informe o motivo da exclusão para registro na auditoria.');
      return;
    }

    setChecking(true);
    setError('');

    try {
      const res = await verifyTenantMasterPassword({
        tenantId: user?.tenantId,
        password: password.trim(),
        target,
        entityId,
        details: {
          ...auditContext,
          motivo_informado: reason.trim() || undefined,
          operador: user?.name || user?.email || 'Desconhecido',
        },
      });

      if (!res.ok) {
        setError(res.error || 'Senha Mestra incorreta.');
        setChecking(false);
        return;
      }

      await onAuthorized({ reason: reason.trim() });
      setChecking(false);
      setPassword('');
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao validar a Senha Mestra.');
      setChecking(false);
    }
  };

  // Enquanto não se sabe se a Senha Mestra existe, nada é exibido. Quando ela não existe,
  // o efeito acima autoriza a exclusão direto, sem mostrar o modal.
  if (configured !== true) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={val => {
        if (!val && !checking) onClose();
      }}
    >
      <DialogContent className="bg-card text-card-foreground border-border max-w-md p-5 font-sans shadow-2xl z-[120]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-base">
              <LockKeyhole className="h-5 w-5 shrink-0" />
              <span>{title}</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-3">
            {summaryText && (
              <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs font-semibold text-foreground">
                {summaryText}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5 text-primary" />
                Senha Mestra de Exclusão *
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a Senha Mestra (não é a senha de login)..."
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  autoFocus
                  className="text-sm bg-background border-border pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Motivo da exclusão {requireReason ? '*' : '(registrado na auditoria)'}
              </Label>
              <Input
                type="text"
                placeholder="Ex: Lançado por engano, troca de pedido, cliente desistiu..."
                value={reason}
                onChange={e => {
                  setReason(e.target.value);
                  setError('');
                }}
                className="text-xs bg-background border-border"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={checking}
              onClick={onClose}
              className="text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={checking || !password.trim()}
              className="text-xs font-bold gap-1.5"
            >
              {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {checking ? 'Verificando...' : confirmButtonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
