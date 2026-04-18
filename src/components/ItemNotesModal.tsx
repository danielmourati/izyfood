import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { OrderItem } from '@/types';

// Arrays de exemplo para o MVP, no futuro poderiam vir do Supabase atrelados ao CategoriaId do produto.
const PREDEFINED_OBSERVATIONS = [
    'Para viagem', 'Retirar no caixa', 'Sem maionese',
    'Sem mostarda', 'Sem pimenta', 'Sem tomate'
];

const PREDEFINED_COMPLEMENTS = [
    { id: 'c1', name: 'Bacon', price: 3.50 },
    { id: 'c2', name: 'Batata 100g', price: 3.00 },
    { id: 'c3', name: 'Calabresa', price: 2.50 }
];

export function ItemNotesModal({
    open,
    onClose,
    item,
    onConfirm
}: {
    open: boolean;
    onClose: () => void;
    item: OrderItem | null;
    onConfirm: (itemId: string, newNotes: string, newComplements: { name: string; price: number; quantity: number }[]) => void;
}) {
    const [selectedObs, setSelectedObs] = useState<string[]>([]);
    const [otherNotes, setOtherNotes] = useState('');
    const [complements, setComplements] = useState<{ name: string; price: number; quantity: number }[]>([]);

    useEffect(() => {
        if (open && item) {
            // Parse item.notes back into selectedObs and otherNotes (best effort MVP)
            const currentNotes = item.notes || '';

            const parts = currentNotes.split('|').map(s => s.trim()).filter(Boolean);
            const parsedObs: string[] = [];
            const others: string[] = [];

            for (const p of parts) {
                if (PREDEFINED_OBSERVATIONS.includes(p)) {
                    parsedObs.push(p);
                } else if (!p.startsWith('+')) { // Ignorando os textos gerados para os complementos por segurança. O estado 'complements' é q gerencia.
                    others.push(p);
                }
            }
            setSelectedObs(parsedObs);
            setOtherNotes(others.join(', '));
            setComplements(item.selectedComplements || []);
        }
    }, [open, item]);

    if (!open || !item) return null;

    const toggleObs = (obs: string) => {
        setSelectedObs(prev => prev.includes(obs) ? prev.filter(o => o !== obs) : [...prev, obs]);
    };

    const handleComplementQty = (comp: { name: string, price: number }, delta: number) => {
        setComplements(prev => {
            const existing = prev.find(c => c.name === comp.name);
            if (existing) {
                const newQty = existing.quantity + delta;
                if (newQty <= 0) return prev.filter(c => c.name !== comp.name);
                return prev.map(c => c.name === comp.name ? { ...c, quantity: newQty } : c);
            } else if (delta > 0) {
                return [...prev, { name: comp.name, price: comp.price, quantity: 1 }];
            }
            return prev;
        });
    };

    const getCompQty = (name: string) => complements.find(c => c.name === name)?.quantity || 0;

    const handleConfirm = () => {
        const finalNotesArray = [...selectedObs];
        if (otherNotes.trim()) {
            finalNotesArray.push(otherNotes.trim());
        }

        // Podemos formatar as notas ou apenas enviar
        const finalNotesString = finalNotesArray.join(' | ');
        onConfirm(item.id, finalNotesString, complements);
        onClose();
    };

    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col sm:max-w-md sm:mx-auto sm:border-x sm:shadow-2xl animate-in slide-in-from-bottom-5">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b shrink-0">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-muted/30">
                    <FileEdit className="h-5 w-5" />
                </Button>
                <span className="font-bold text-lg">{item.name}</span>
            </div>

            <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
                {/* Observações Section */}
                <div>
                    <h3 className="text-primary font-bold text-lg mb-3">Observações</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {PREDEFINED_OBSERVATIONS.map(obs => {
                            const isSelected = selectedObs.includes(obs);
                            return (
                                <button
                                    key={obs}
                                    onClick={() => toggleObs(obs)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-transparent hover:bg-muted'}`}
                                >
                                    {obs}
                                </button>
                            );
                        })}
                    </div>
                    <Input
                        placeholder="Outras observações..."
                        value={otherNotes}
                        onChange={e => setOtherNotes(e.target.value)}
                        className="h-12 bg-background shadow-sm"
                    />
                </div>

                {/* Complementos Section */}
                <div>
                    <h3 className="text-primary font-bold text-lg mb-3">Complementos</h3>
                    <div className="flex flex-col gap-1 border-t">
                        {PREDEFINED_COMPLEMENTS.map(comp => {
                            const qty = getCompQty(comp.name);
                            return (
                                <div key={comp.id} className="flex justify-between items-center py-3 border-b">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground text-sm">{comp.name}</span>
                                        <span className="font-bold text-xs">{fmtBRL(comp.price)}</span>
                                    </div>

                                    {qty > 0 ? (
                                        <div className="flex items-center gap-3 bg-muted rounded-full p-1 border">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleComplementQty(comp, -1)}>
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="w-4 text-center font-bold text-sm">{qty}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-primary" onClick={() => handleComplementQty(comp, 1)}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-primary/20 text-primary" onClick={() => handleComplementQty(comp, 1)}>
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-card border-t shrink-0 flex items-center justify-between gap-4 pb-safe pb-8 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)]">
                <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0 rounded-full" onClick={onClose}>
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <Button className="flex-1 h-14 rounded-2xl text-lg font-bold bg-[#1e1e1e] hover:bg-black text-white" onClick={handleConfirm}>
                    CONFIRMAR
                </Button>
            </div>
        </div >
    );
}
