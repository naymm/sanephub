import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { MODULE_GROUPS } from '@/components/layout/HorizontalMenu';
import {
  MODULOS_DESACTIVAVEIS_PELA_ORG,
  MODULOS_PROTEGIDOS_ORG,
  RECURSOS_MENU_EXTRA,
} from '@/utils/orgFeatureAccess';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecursoLinha = { path: string; label: string; moduleId: string; groupLabel: string };

export default function ModulosRecursosPage() {
  const { user } = useAuth();
  const { organizacaoSettings, updateOrganizacaoSettings } = useData();
  const [modulosOff, setModulosOff] = useState<string[]>([]);
  const [recursosOff, setRecursosOff] = useState<string[]>([]);
  const [bannerFeriadosUrl, setBannerFeriadosUrl] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setModulosOff([...organizacaoSettings.modulosDesactivados]);
    setRecursosOff([...organizacaoSettings.recursosDesactivados]);
    setBannerFeriadosUrl((organizacaoSettings.dashboardBannerFeriadosUrl ?? '').trim());
    setDirty(false);
  }, [
    organizacaoSettings.modulosDesactivados,
    organizacaoSettings.recursosDesactivados,
    organizacaoSettings.dashboardBannerFeriadosUrl,
  ]);

  const recursosPorModulo = useMemo(() => {
    const fromMenu: RecursoLinha[] = MODULE_GROUPS.flatMap(g =>
      g.children.map(ch => ({
        path: ch.path,
        label: ch.label,
        moduleId: ch.module ?? g.module ?? '',
        groupLabel: g.label,
      })),
    );
    const extra: RecursoLinha[] = RECURSOS_MENU_EXTRA.map(r => ({
      path: r.path,
      label: r.label,
      moduleId: r.moduleId,
      groupLabel: r.groupLabel,
    }));
    const map = new Map<string, RecursoLinha[]>();
    for (const r of [...fromMenu, ...extra]) {
      if (!r.moduleId) continue;
      if (!map.has(r.groupLabel)) map.set(r.groupLabel, []);
      const list = map.get(r.groupLabel)!;
      if (!list.some(x => x.path === r.path)) list.push(r);
    }
    return map;
  }, []);

  const allRecursosFlat = useMemo(() => [...recursosPorModulo.values()].flat(), [recursosPorModulo]);

  const toggleModulo = (id: string) => {
    if (MODULOS_PROTEGIDOS_ORG.has(id)) return;
    setModulosOff(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
    setDirty(true);
  };

  const toggleRecurso = (path: string) => {
    setRecursosOff(prev => (prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]));
    setDirty(true);
  };

  const moduloActivadoNaForm = (moduleId: string) => !modulosOff.includes(moduleId);

  const save = async () => {
    const modulosSafe = modulosOff.filter(id => !MODULOS_PROTEGIDOS_ORG.has(id));
    const recursosSafe = recursosOff.filter(path => {
      const line = allRecursosFlat.find(r => r.path === path);
      if (!line) return true;
      return !modulosSafe.includes(line.moduleId);
    });
    try {
      await updateOrganizacaoSettings({
        modulosDesactivados: modulosSafe,
        recursosDesactivados: recursosSafe,
        dashboardBannerFeriadosUrl: bannerFeriadosUrl.trim() || null,
      });
      setDirty(false);
      toast.success('Visibilidade da organização actualizada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  if (user?.perfil !== 'Admin') {
    return (
      <div className="space-y-4">
        <h1 className="page-header">Módulos e recursos</h1>
        <p className="text-sm text-muted-foreground">Apenas administradores podem alterar estas definições.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-header flex items-center gap-2">
          <Layers className="h-7 w-7 text-muted-foreground" />
          Módulos e recursos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Desactive módulos ou páginas específicas enquanto estiverem incompletos ou em piloto. Afecta todos os
          utilizadores e empresas do grupo. Dashboard e Configurações permanecem sempre acessíveis aos perfis que já
          os tinham.
        </p>
        {!isSupabaseConfigured() && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
            Sem Supabase ligado, as preferências não serão persistidas entre sessões.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard — banner de feriados</CardTitle>
          <CardDescription>
            URL pública da imagem (recomendado PNG) mostrada à direita do resumo no Dashboard em ecrãs grandes.
            Pode ser um ficheiro no Storage Supabase (bucket público) ou outro URL HTTPS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="org-dashboard-banner">URL da imagem</Label>
          <Input
            id="org-dashboard-banner"
            type="url"
            placeholder="https://…/feriado.png"
            value={bannerFeriadosUrl}
            onChange={e => {
              setBannerFeriadosUrl(e.target.value);
              setDirty(true);
            }}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos</CardTitle>
          <CardDescription>
            Desmarcar oculta o módulo nos menus e bloqueia as respectivas rotas. As sub-páginas podem ainda ser
            desactivadas individualmente abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {MODULOS_DESACTIVAVEIS_PELA_ORG.map(m => {
              const active = moduloActivadoNaForm(m.id);
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`org-mod-${m.id}`}
                    checked={active}
                    onCheckedChange={() => toggleModulo(m.id)}
                  />
                  <Label htmlFor={`org-mod-${m.id}`} className="cursor-pointer text-sm font-normal leading-tight">
                    {m.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos (entrada de menu)</CardTitle>
          <CardDescription>
            Ocultar apenas um ecrã (ex.: «Zonas de trabalho») mantendo o resto do módulo activo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[...recursosPorModulo.entries()].map(([groupLabel, lines]) => (
            <div key={groupLabel}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{groupLabel}</p>
              <div className="grid sm:grid-cols-2 gap-2 pl-1">
                {lines.map(r => {
                  const moduloInativo = !moduloActivadoNaForm(r.moduleId);
                  const recursoOff = recursosOff.includes(r.path);
                  const visivel = !moduloInativo && !recursoOff;
                  return (
                    <div key={r.path} className="flex items-center gap-2">
                      <Checkbox
                        id={`org-rec-${r.path}`}
                        checked={visivel}
                        disabled={moduloInativo}
                        onCheckedChange={() => toggleRecurso(r.path)}
                      />
                      <Label
                        htmlFor={`org-rec-${r.path}`}
                        className={cn(
                          'text-sm font-normal leading-tight',
                          moduloInativo ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer',
                        )}
                      >
                        <span className="font-medium">{r.label}</span>
                        <span className="block text-[10px] text-muted-foreground font-mono truncate">{r.path}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={save} disabled={!dirty}>
          Guardar alterações
        </Button>
        <Button
          variant="outline"
          disabled={!dirty}
          onClick={() => {
            setModulosOff([...organizacaoSettings.modulosDesactivados]);
            setRecursosOff([...organizacaoSettings.recursosDesactivados]);
            setBannerFeriadosUrl((organizacaoSettings.dashboardBannerFeriadosUrl ?? '').trim());
            setDirty(false);
          }}
        >
          Repor
        </Button>
      </div>
    </div>
  );
}
