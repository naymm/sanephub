import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import type { AtrasoAssiduidade } from '@/types';
import { podeJustificarAtrasoMesmoDia } from '@/services/assiduidade/attendanceValidation';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from 'lucide-react';

export default function PortalAssiduidadePage() {
  const { user } = useAuth();
  const { colaboradoresTodos, assiduidadeAtrasos, addAssiduidadeAtraso, updateAssiduidadeAtraso } = useData();

  const colaboradorId = user?.colaboradorId;
  const meuColab = useMemo(
    () => (colaboradorId != null ? colaboradoresTodos.find(c => c.id === colaboradorId) : undefined),
    [colaboradoresTodos, colaboradorId],
  );

  const meusAtrasos = useMemo(() => {
    if (colaboradorId == null) return [];
    return [...assiduidadeAtrasos]
      .filter(a => a.colaboradorId === colaboradorId)
      .sort((a, b) => String(b.dataRef).localeCompare(String(a.dataRef)));
  }, [assiduidadeAtrasos, colaboradorId]);

  const hoje = new Date().toISOString().slice(0, 10);
  const [minutos, setMinutos] = useState(15);
  const [justOpen, setJustOpen] = useState<AtrasoAssiduidade | null>(null);
  const [justText, setJustText] = useState('');

  const registarHoje = async () => {
    if (!meuColab) {
      toast.error('Perfil sem colaborador associado.');
      return;
    }
    const existente = meusAtrasos.find(a => String(a.dataRef).slice(0, 10) === hoje);
    const base = {
      colaboradorId: meuColab.id,
      empresaId: meuColab.empresaId,
      dataRef: hoje,
      minutosAtraso: Math.max(0, Math.floor(minutos)),
      registadoPor: user?.nome ?? '',
    };
    try {
      if (existente) {
        await updateAssiduidadeAtraso(existente.id, { ...base, justificado: existente.justificado });
        toast.success('Atraso de hoje actualizado.');
      } else {
        await addAssiduidadeAtraso(base);
        toast.success('Atraso de hoje registado.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar');
    }
  };

  const abrirJustificar = (a: AtrasoAssiduidade) => {
    if (!podeJustificarAtrasoMesmoDia(String(a.dataRef))) {
      toast.error('Só pode justificar no próprio dia do atraso.');
      return;
    }
    if (a.justificado) {
      toast.message('Já justificado.');
      return;
    }
    setJustOpen(a);
    setJustText('');
  };

  const confirmarJustificacao = async () => {
    if (!justOpen) return;
    try {
      await updateAssiduidadeAtraso(justOpen.id, {
        justificado: true,
        justificacao: justText.trim() || 'Justificado',
        justificadoEm: new Date().toISOString(),
      });
      toast.success('Atraso justificado.');
      setJustOpen(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    }
  };

  if (colaboradorId == null || !meuColab) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Assiduidade</h1>
        <p className="text-muted-foreground text-sm">Esta área está disponível para utilizadores com colaborador associado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Os meus atrasos</h1>
        <p className="text-muted-foreground text-sm">Registe o atraso do dia e justifique ainda hoje, se aplicável.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registar atraso ({formatDate(hoje)})</CardTitle>
          <CardDescription>Um único registo por dia; voltar a guardar actualiza os minutos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2 flex-1">
            <Label>Minutos</Label>
            <Input type="number" min={0} value={minutos} onChange={e => setMinutos(Number(e.target.value))} />
          </div>
          <Button onClick={registarHoje}>Guardar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Dia</th>
                <th className="py-2 pr-4">Minutos</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {meusAtrasos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    Sem registos.
                  </td>
                </tr>
              ) : (
                meusAtrasos.map(a => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{formatDate(a.dataRef)}</td>
                    <td className="py-2 pr-4 tabular-nums">{a.minutosAtraso}</td>
                    <td className="py-2 pr-4">
                      {a.justificado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-4 w-4" /> Justificado
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pendente</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {!a.justificado && podeJustificarAtrasoMesmoDia(String(a.dataRef)) ? (
                        <Button size="sm" variant="outline" onClick={() => abrirJustificar(a)}>
                          Justificar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!justOpen} onOpenChange={o => !o && setJustOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar atraso</DialogTitle>
            <DialogDescription>Motivo do atraso (mesmo dia apenas).</DialogDescription>
          </DialogHeader>
          <Textarea value={justText} onChange={e => setJustText(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setJustOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarJustificacao}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
