import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const empresaId = useCiEmpresaId();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: cache } = useQuery({
    queryKey: ['ci', 'relatorios', empresaId],
    enabled: false,
    queryFn: async () => null,
  });
  void cache;

  const exportAuditorias = async () => {
    if (!supabase || empresaId == null) return;
    setLoading('aud');
    try {
      const { data, error } = await supabase.from('ci_auditorias').select('*').eq('empresa_id', empresaId);
      if (error) throw error;
      const rows = (data ?? []).map(r => [
        String(r.codigo),
        String(r.titulo),
        String(r.tipo),
        String(r.estado),
        String(r.area_departamento ?? ''),
        String(r.data_inicio ?? ''),
        String(r.data_fim ?? ''),
      ]);
      downloadCsv(`auditorias-${empresaId}.csv`, ['Código', 'Título', 'Tipo', 'Estado', 'Área', 'Início', 'Fim'], rows);
      toast.success('CSV de auditorias exportado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na exportação');
    } finally {
      setLoading(null);
    }
  };

  const exportNc = async () => {
    if (!supabase || empresaId == null) return;
    setLoading('nc');
    try {
      const { data, error } = await supabase.from('ci_nao_conformidades').select('*').eq('empresa_id', empresaId);
      if (error) throw error;
      const rows = (data ?? []).map(r => [
        String(r.codigo),
        String(r.titulo),
        String(r.gravidade),
        String(r.estado),
        String(r.prazo_resolucao ?? ''),
      ]);
      downloadCsv(`nao-conformidades-${empresaId}.csv`, ['Código', 'Título', 'Gravidade', 'Estado', 'Prazo'], rows);
      toast.success('CSV exportado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(null);
    }
  };

  const exportRiscos = async () => {
    if (!supabase || empresaId == null) return;
    setLoading('riscos');
    try {
      const { data, error } = await supabase.from('ci_riscos').select('*').eq('empresa_id', empresaId);
      if (error) throw error;
      const rows = (data ?? []).map(r => [
        String(r.titulo),
        String(r.categoria),
        String(r.probabilidade),
        String(r.impacto),
        String(r.score),
        String(r.estado),
      ]);
      downloadCsv(`riscos-${empresaId}.csv`, ['Título', 'Categoria', 'Prob.', 'Impacto', 'Score', 'Estado'], rows);
      toast.success('CSV exportado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(null);
    }
  };

  const exportLogs = async () => {
    if (!supabase) return;
    setLoading('logs');
    try {
      const { data, error } = await supabase
        .from('intranet_audit_events')
        .select('created_at, event_category, action, summary, resource_type, resource_id')
        .eq('event_category', 'controlo_interno')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []).map(r => [
        String(r.created_at),
        String(r.event_category),
        String(r.action),
        String(r.summary ?? ''),
        String(r.resource_type ?? ''),
        String(r.resource_id ?? ''),
      ]);
      downloadCsv('logs-controlo-interno.csv', ['Data', 'Categoria', 'Acção', 'Resumo', 'Tipo', 'ID'], rows);
      toast.success('CSV de logs exportado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(null);
    }
  };

  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-muted-foreground">Relatórios requerem Supabase.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditorias</CardTitle>
          <CardDescription>Lista de auditorias planeadas e concluídas (CSV — abrir no Excel).</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void exportAuditorias()} disabled={empresaId == null || loading === 'aud'}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Não conformidades</CardTitle>
          <CardDescription>Registos de NC e prazos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void exportNc()} disabled={empresaId == null || loading === 'nc'}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riscos</CardTitle>
          <CardDescription>Matriz corporativa com scores calculados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void exportRiscos()} disabled={empresaId == null || loading === 'riscos'}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs (Controlo Interno)</CardTitle>
          <CardDescription>Rastreabilidade institucional do módulo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void exportLogs()} disabled={loading === 'logs'}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>
      <Card className="sm:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Relatórios PDF</CardTitle>
          <CardDescription>
            Exportação PDF institucional (layout completo) pode ser ligada ao motor de relatórios existente numa fase seguinte.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
