import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import type { RescisaoContrato, TipoRescisao } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText } from 'lucide-react';

const TIPOS_RESCISAO: TipoRescisao[] = ['Resolução', 'Revogação', 'Caducidade'];

export default function RescisoesContratuaisPage() {
  const { rescissoesContrato, addRescisaoContrato, contratos, empresas } = useData();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<RescisaoContrato> & { contratoId?: number }>({
    tipo: 'Resolução',
    motivoDetalhado: '',
    dataRescisao: new Date().toISOString().slice(0, 10),
    documentoPdf: '',
  });

  const canEdit = user?.perfil === 'Admin' || user?.perfil === 'Juridico';

  const getContrato = (id: number) => contratos.find(c => c.id === id);
  const getEmpresaNome = (empresaId: number) =>
    empresas.find(e => e.id === empresaId)?.nome ?? `Empresa ${empresaId}`;

  const contratosActivos = contratos.filter(c => c.status !== 'Rescindido' && c.status !== 'Expirado');

  const openCreate = () => {
    const primeiroContrato = contratosActivos[0];
    setForm({
      contratoId: primeiroContrato?.id,
      empresaId: primeiroContrato?.empresaId ?? 1,
      tipo: 'Resolução',
      motivoDetalhado: '',
      dataRescisao: new Date().toISOString().slice(0, 10),
      documentoPdf: '',
    });
    setDialogOpen(true);
  };

  const onContratoChange = (contratoIdStr: string) => {
    const cid = Number(contratoIdStr);
    const c = contratos.find(x => x.id === cid);
    setForm(f => ({ ...f, contratoId: cid, empresaId: c?.empresaId ?? f.empresaId }));
  };

  const save = async () => {
    if (!form.contratoId || !form.motivoDetalhado?.trim() || !form.dataRescisao || !form.empresaId) return;
    const payload: Partial<RescisaoContrato> = {
      contratoId: form.contratoId,
      empresaId: form.empresaId,
      tipo: form.tipo ?? 'Resolução',
      motivoDetalhado: form.motivoDetalhado.trim(),
      dataRescisao: form.dataRescisao,
      documentoPdf: form.documentoPdf?.trim() || undefined,
      criadoPor: user?.nome ?? 'Sistema',
      criadoEm: new Date().toISOString(),
    };
    try {
      await addRescisaoContrato(payload);
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Rescisões Contratuais</h1>
          <p className="text-sm text-muted-foreground">
            Registo estruturado de resoluções, revogações e caducidades de contratos do grupo.
          </p>
        </div>
        {canEdit && contratosActivos.length > 0 && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Registar rescisão
          </Button>
        )}
      </div>

      <div className="table-container overflow-x-auto rounded-lg border border-border/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-3 font-medium text-muted-foreground">Contrato</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo de rescisão</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Data de rescisão</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Motivo</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Documento</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Registado</th>
            </tr>
          </thead>
          <tbody>
            {rescissoesContrato.map(r => {
              const contrato = getContrato(r.contratoId);
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{contrato?.numero ?? `Contrato #${r.contratoId}`}</span>
                      {contrato && (
                        <span className="text-xs text-muted-foreground truncate max-w-[260px]" title={contrato.objecto}>
                          {contrato.objecto}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{getEmpresaNome(r.empresaId)}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                      {r.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(r.dataRescisao)}</td>
                  <td className="p-3 text-muted-foreground max-w-[320px] truncate" title={r.motivoDetalhado}>
                    {r.motivoDetalhado}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.documentoPdf ? (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {r.documentoPdf}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {r.criadoPor} — {formatDate(r.criadoEm.slice(0, 10))}
                  </td>
                </tr>
              );
            })}
            {rescissoesContrato.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground text-sm" colSpan={7}>
                  Nenhuma rescisão contratual registada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registar rescisão contratual</DialogTitle>
            <DialogDescription>
              Associa a rescisão a um contrato e regista tipo, data e motivo. Opcionalmente indica o nome do ficheiro PDF do documento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={form.contratoId != null ? String(form.contratoId) : ''} onValueChange={onContratoChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar contrato" /></SelectTrigger>
                <SelectContent>
                  {contratosActivos.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.numero} — {c.objecto.slice(0, 50)}{c.objecto.length > 50 ? '…' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de rescisão</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoRescisao }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESCISAO.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de rescisão</Label>
                <Input type="date" value={form.dataRescisao || ''} onChange={e => setForm(f => ({ ...f, dataRescisao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo (detalhado)</Label>
              <Textarea value={form.motivoDetalhado} onChange={e => setForm(f => ({ ...f, motivoDetalhado: e.target.value }))} rows={4} placeholder="Descreva o motivo da rescisão..." required />
            </div>
            <div className="space-y-2">
              <Label>Documento PDF (nome do ficheiro)</Label>
              <Input value={form.documentoPdf} onChange={e => setForm(f => ({ ...f, documentoPdf: e.target.value }))} placeholder="Ex.: rescisao_CONT-2024-0012.pdf" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.contratoId || !form.motivoDetalhado?.trim() || !form.dataRescisao}>
              Registar rescisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
