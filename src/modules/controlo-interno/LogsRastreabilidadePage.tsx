import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';

type LogRow = {
  id: number;
  createdAt: string;
  eventCategory: string;
  action: string;
  summary: string | null;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown>;
};

const CATEGORY_LABEL: Record<string, string> = {
  controlo_interno: 'Controlo Interno',
  login: 'Login',
  logout: 'Logout',
  produtividade_actividade: 'Produtividade',
  time_punch: 'Ponto',
};

export default function LogsRastreabilidadePage() {
  const [category, setCategory] = useState<string>('controlo_interno');
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['ci', 'logs', category, search],
    enabled: isSupabaseConfigured(),
    staleTime: 30_000,
    queryFn: async () => {
      if (!supabase) return [];
      let q = supabase
        .from('intranet_audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (category !== 'all') {
        q = q.eq('event_category', category);
      }
      const { data, error } = await q;
      if (error) throw error;
      let list = (data ?? []).map(r => {
        const m = mapRowFromDb<LogRow>('intranet_audit_events', r as Record<string, unknown>);
        return m;
      });
      const s = search.trim().toLowerCase();
      if (s) {
        list = list.filter(
          l =>
            (l.summary ?? '').toLowerCase().includes(s) ||
            (l.resourceType ?? '').toLowerCase().includes(s) ||
            (l.action ?? '').toLowerCase().includes(s),
        );
      }
      return list;
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Trilho centralizado de acções no ERP. Eventos do módulo Controlo Interno e integração com a{' '}
        <Link to="/configuracoes/auditoria" className="text-primary underline-offset-2 hover:underline">
          auditoria global (Admin)
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="controlo_interno">Controlo Interno</SelectItem>
            <SelectItem value="all">Todos os módulos</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="produtividade_actividade">Produtividade</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Pesquisar resumo, recurso…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </div>

      <div className="table-container overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b">
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-left py-2 px-3">Módulo</th>
              <th className="text-left py-2 px-3">Acção</th>
              <th className="text-left py-2 px-3">Resumo</th>
              <th className="text-left py-2 px-3">Recurso</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">A carregar…</td></tr>
            ) : (
              rows.map(l => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-3 whitespace-nowrap text-xs">
                    {format(new Date(l.createdAt), 'dd/MM/yyyy HH:mm', { locale: pt })}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="outline">{CATEGORY_LABEL[l.eventCategory] ?? l.eventCategory}</Badge>
                  </td>
                  <td className="py-2 px-3">{l.action}</td>
                  <td className="py-2 px-3 max-w-md truncate" title={l.summary ?? ''}>{l.summary ?? '—'}</td>
                  <td className="py-2 px-3 font-mono text-xs">
                    {l.resourceType ? `${l.resourceType}#${l.resourceId ?? ''}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
