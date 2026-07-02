import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Minus, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { OrderItem } from '@/types';
import { useStore } from '@/contexts/StoreContext';

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
    const { noteOptions, products } = useStore();
    const [selectedObs, setSelectedObs] = useState<string[]>([]);
    const [otherNotes, setOtherNotes] = useState('');
    const [complements, setComplements] = useState<{ name: string; price: number; quantity: number }[]>([]);

    const product = item ? products.find(p => p.id === item.productId) : null;
    const categoryId = product?.categoryId;

    const availableNotes = useMemo(() => 
        noteOptions.filter(o => o.active && o.type === 'note' && (!categoryId || o.categoryIds.includes(categoryId))),
    [noteOptions, categoryId]);

    const availableComplements = useMemo(() => 
        noteOptions.filter(o => o.active && o.type === 'complement' && (!categoryId || o.categoryIds.includes(categoryId))),
    [noteOptions, categoryId]);

    useEffect(() => {
        if (open && item) {
            // Parse item.notes back into selectedObs and otherNotes (best effort MVP)
            const currentNotes = item.notes || '';

            const parts = currentNotes.split('|').map(s => s.trim()).filter(Boolean);
            const parsedObs: string[] = [];
            const others: string[] = [];

            for (const p of parts) {
                if (noteOptions.some(n => n.type === 'note' && n.name === p)) {
                    parsedObs.push(p);
                } else if (!p.startsWith('+')) { // Ignorando os textos gerados para os complementos por segurança. O estado 'complements' é q gerencia.
                    others.push(p);
                }
            }
            setSelectedObs(parsedObs);
            setOtherNotes(others.join(', '));
            setComplements(item.selectedComplements || []);
        }
    }, [open, item, noteOptions]);

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
                        {availableNotes.length === 0 && <p className="text-sm text-muted-foreground italic mb-2">Nenhuma observação pré-definida.</p>}
                        {availableNotes.map(obs => {
                            const isSelected = selectedObs.includes(obs.name);
                            return (
                                <button
                                    key={obs.id}
                                    onClick={() => toggleObs(obs.name)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isSelected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-transparent hover:bg-muted'}`}
                                >
                                    {obs.name}
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
                        {availableComplements.length === 0 && <p className="text-sm text-muted-foreground italic py-3">Nenhum complemento disponível.</p>}
                        {availableComplements.map(comp => {
                            const qty = getCompQty(comp.name);
                            return (
                                <div key={comp.id} className="flex justify-between items-center py-3 border-b">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground text-sm">{comp.name}</span>
                                        <span className="font-bold text-xs">{comp.price > 0 ? fmtBRL(comp.price) : 'Grátis'}</span>
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
                <Button className="flex-1 h-14 rounded-2xl text-lg font-bold bg-[#1e1e1e] hover:bg-foreground text-primary-foreground" onClick={handleConfirm}>
                    CONFIRMAR
                </Button>
            </div>
        </div >
    );
}
