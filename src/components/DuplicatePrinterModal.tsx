import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { PrinterConfig } from '@/hooks/use-printer';

const SECTORS = [
  { value: 'recibo', label: 'Recibo (padrão)' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'bar', label: 'Bar' },
  { value: 'balcao', label: 'Balcão' },
];

interface Props {
  open: boolean;
  source: PrinterConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Duplicates an existing printer config so the same physical device
 * can be reused for another sector (e.g. balcão printer also as cozinha).
 */
export function DuplicatePrinterModal({ open, source, onClose, onSaved }: Props) {
  const [sector, setSector] = useState<string>('cozinha');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!source) return;
    setSaving(true);
    try {
      const payload: any = {
        name: (name || `${source.name} — ${SECTORS.find(s => s.value === sector)?.label}`).trim(),
        model: (source as any).model || 'ESC/POS compatível',
        escpos_profile: (source as any).escpos_profile || 'generic',
        auto_connect_qz: (source as any).auto_connect_qz ?? true,
        connection_type: source.connection_type,
        address: source.address || '',
        paper_width: source.paper_width || 80,
        is_default: false,
        sector,
        tenant_id: (source as any).tenant_id,
      };
      const { error } = await supabase.from('printer_configs').insert(payload);
      if (error) throw error;
      onSaved();
      onClose();
      setName('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao duplicar impressora');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reutilizar impressora</DialogTitle>
        </DialogHeader>
        {source && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30 text-sm">
              <p className="font-medium">{source.name}</p>
              <p className="text-xs text-muted-foreground">
                {source.connection_type} · {source.address || 'sem endereço'} · {source.paper_width}mm
              </p>
            </div>
            <div>
              <Label>Novo papel/setor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome (opcional)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={`${source.name} — ${SECTORS.find(s => s.value === sector)?.label}`} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
