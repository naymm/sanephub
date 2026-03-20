import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Globe } from 'lucide-react';
import { useData } from '@/context/DataContext';
import type { Evento } from '@/types';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function EventoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const eventoId = id ? Number(id) : null;

  const { eventos } = useData();

  const evento: Evento | undefined = useMemo(() => {
    if (eventoId == null) return undefined;
    return eventos.find(e => e.id === eventoId);
  }, [eventoId, eventos]);

  if (!eventoId) return null;

  if (!evento) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/eventos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Evento não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/eventos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={evento.isInterno ? 'Interno' : 'Externo'} />
        </div>
      </div>

      <div className="bg-card border border-border/80 rounded-xl overflow-hidden">
        {evento.imagemUrl && (
          <div className="h-60 bg-muted/30 overflow-hidden">
            <img src={evento.imagemUrl} alt={evento.titulo} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="page-header">{evento.titulo}</h1>
          </div>

          <div className="text-sm text-muted-foreground">
            {new Date(evento.dataInicio).toLocaleString('pt-PT')} • {evento.local}
          </div>

          {evento.descricao && <div className="whitespace-pre-wrap text-sm">{evento.descricao}</div>}

          {evento.alertaAntesHoras != null && evento.alertaEm && (
            <div className="text-xs text-muted-foreground">
              Alertar {evento.alertaAntesHoras}h antes (alerta em {new Date(evento.alertaEm).toLocaleString('pt-PT')}).
            </div>
          )}

          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {evento.isInterno ? <Globe className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              Tipo: {evento.isInterno ? 'Interno' : 'Externo'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

