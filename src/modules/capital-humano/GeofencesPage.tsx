import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useMobileCreateRoute } from '@/hooks/useMobileCreateRoute';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import type { Geofence } from '@/types';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import {
  MobileCreateFormDialogContent,
  mobileCreateDesktopHeader,
} from '@/components/shared/MobileCreateFormDialogContent';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

const LIST_PATH = '/capital-humano/zonas-trabalho';
const NOVO_PATH = '/capital-humano/zonas-trabalho/novo';

const emptyForm: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'> = {
  empresaId: 1,
  nome: '',
  centerLat: -8.8383,
  centerLng: 13.2344,
  radiusMeters: 500,
  activo: true,
};

export default function GeofencesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { empresas, geofences, addGeofence, updateGeofence, deleteGeofence } = useData();
  const isMobileViewport = useIsMobileViewport();
  const canEliminar = user?.perfil === 'Admin';
  const { currentEmpresaId } = useTenant();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [form, setForm] = useState(emptyForm);

  const empresaOptions = useMemo(() => empresas.filter(e => e.activo), [empresas]);

  const prepareCreate = useCallback(() => {
    setEditing(null);
    const defaultEmpresa =
      currentEmpresaId === 'consolidado' ? (empresaOptions[0]?.id ?? 1) : (currentEmpresaId as number);
    setForm({ ...emptyForm, empresaId: defaultEmpresa });
  }, [currentEmpresaId, empresaOptions]);

  const resetModal = useCallback(() => {
    setEditing(null);
    setForm(emptyForm);
  }, []);

  const {
    isNovoRoute,
    showMobileCreate,
    openCreateNavigateOrDialog,
    closeMobileCreate,
    onDialogOpenChange,
    endMobileCreateFlow,
  } = useMobileCreateRoute({
    listPath: LIST_PATH,
    novoPath: NOVO_PATH,
    dialogOpen,
    setDialogOpen,
    prepareCreate,
    resetModal,
  });

  const filtered = useMemo(() => {
    return geofences.filter(g => {
      const q = search.trim().toLowerCase();
      const match =
        !q ||
        g.nome.toLowerCase().includes(q) ||
        empresas.find(e => e.id === g.empresaId)?.nome.toLowerCase().includes(q);
      return match;
    });
  }, [geofences, search, empresas]);

  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('nome');
  const empresaNome = useCallback((g: Geofence) => empresas.find(e => e.id === g.empresaId)?.nome ?? `Empresa #${g.empresaId}`, [empresas]);
  const mobileComparators = useMemo(
    () => ({
      nome: (a: Geofence, b: Geofence) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
      empresa: (a: Geofence, b: Geofence) => empresaNome(a).localeCompare(empresaNome(b), 'pt', { sensitivity: 'base' }),
    }),
    [empresaNome],
  );
  const sortedMobileRows = useSortedMobileSlice(pagination.slice, mobileSort, mobileComparators);

  const openCreate = () => openCreateNavigateOrDialog();

  const openEdit = (g: Geofence) => {
    setEditing(g);
    setForm({
      empresaId: g.empresaId,
      nome: g.nome,
      centerLat: g.centerLat,
      centerLng: g.centerLng,
      radiusMeters: g.radiusMeters,
      activo: g.activo,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      toast.error('Indique o nome da zona.');
      return;
    }
    if (
      !Number.isFinite(form.centerLat) ||
      !Number.isFinite(form.centerLng) ||
      !Number.isFinite(form.radiusMeters) ||
      form.radiusMeters <= 0
    ) {
      toast.error('Coordenadas e raio inválidos.');
      return;
    }
    try {
      if (editing) {
        await updateGeofence(editing.id, { ...form });
      } else {
        await addGeofence({ ...form });
      }
      setDialogOpen(false);
      setEditing(null);
      if (isNovoRoute) {
        endMobileCreateFlow();
        navigate(LIST_PATH, { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const remove = async (g: Geofence) => {
    if (!canEliminar) {
      toast.error('Apenas administradores podem eliminar zonas de trabalho.');
      return;
    }
    if (!window.confirm(`Remover a zona «${g.nome}»? As permissões dos colaboradores para esta zona serão removidas.`)) {
      return;
    }
    try {
      await deleteGeofence(g.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const mapPreviewUrl = (lat: number, lng: number) =>
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  const title = editing ? 'Editar zona de trabalho' : 'Nova zona de trabalho';
  const showMobileForm = showMobileCreate || (isMobileViewport && dialogOpen);
  const formBody = (
    <div className="grid gap-4 py-2">
      <div className="space-y-2">
        <Label>Empresa</Label>
        <Select
          value={String(form.empresaId)}
          onValueChange={v => setForm(f => ({ ...f, empresaId: Number(v) }))}
          disabled={currentEmpresaId !== 'consolidado'}
        >
          <SelectTrigger>
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            {empresaOptions.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentEmpresaId !== 'consolidado' ? (
          <p className="text-xs text-muted-foreground">A zona fica associada à empresa do contexto actual.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>Nome da zona</Label>
        <Input
          value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="ex: Sede Central"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={Number.isFinite(form.centerLat) ? form.centerLat : ''}
            onChange={e => setForm(f => ({ ...f, centerLat: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input
            type="number"
            step="any"
            value={Number.isFinite(form.centerLng) ? form.centerLng : ''}
            onChange={e => setForm(f => ({ ...f, centerLng: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Raio (metros)</Label>
        <Input
          type="number"
          min={1}
          step={1}
          value={Number.isFinite(form.radiusMeters) ? form.radiusMeters : ''}
          onChange={e => setForm(f => ({ ...f, radiusMeters: Number(e.target.value) }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="activo"
          checked={form.activo}
          onCheckedChange={c => setForm(f => ({ ...f, activo: c === true }))}
        />
        <Label htmlFor="activo" className="cursor-pointer font-normal">
          Zona activa
        </Label>
      </div>
      <Button variant="outline" size="sm" className="w-fit gap-2" asChild>
        <a href={mapPreviewUrl(form.centerLat, form.centerLng)} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
          Pré-visualizar no mapa
        </a>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Zonas de trabalho</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova zona
        </Button>
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Defina cercas geográficas (centro e raio em metros) por empresa. No cadastro do colaborador pode indicar em
        quais zonas ele pode registar ponto.
      </p>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="hidden md:block table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Empresa
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nome
              </th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Centro (lat, lng)
              </th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Raio (m)
              </th>
              <th className="text-center py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Activa
              </th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Acções
              </th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(g => (
              <tr key={g.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5">
                  {empresas.find(e => e.id === g.empresaId)?.nome ?? `Empresa #${g.empresaId}`}
                </td>
                <td className="py-3 px-5 font-medium">{g.nome}</td>
                <td className="py-3 px-5 font-mono text-xs">
                  {g.centerLat.toFixed(5)}, {g.centerLng.toFixed(5)}
                </td>
                <td className="py-3 px-5 text-right">{Math.round(g.radiusMeters)}</td>
                <td className="py-3 px-5 text-center">{g.activo ? 'Sim' : 'Não'}</td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Ver no mapa">
                    <a href={mapPreviewUrl(g.centerLat, g.centerLng)} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {canEliminar && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(g)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <MobileExpandableList
          items={sortedMobileRows}
          rowId={g => g.id}
          sortBar={{
            options: [
              { key: 'nome', label: 'Zona' },
              { key: 'empresa', label: 'Empresa' },
            ],
            state: mobileSort,
            onToggle: toggleMobileSort,
          }}
          renderSummary={g => ({
            title: g.nome,
            trailing: <span className="text-xs text-muted-foreground">{g.activo ? 'Activa' : 'Inactiva'}</span>,
          })}
          renderDetails={g => [
            { label: 'Empresa', value: empresaNome(g) },
            { label: 'Centro (lat, lng)', value: `${g.centerLat.toFixed(5)}, ${g.centerLng.toFixed(5)}` },
            { label: 'Raio (m)', value: String(Math.round(g.radiusMeters)) },
            { label: 'Activa', value: g.activo ? 'Sim' : 'Não' },
          ]}
          renderActions={g => (
            <>
              <Button type="button" variant="outline" className="min-h-11 flex-1 gap-2" asChild>
                <a href={mapPreviewUrl(g.centerLat, g.centerLng)} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4 shrink-0" />
                  Mapa
                </a>
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => openEdit(g)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              {canEliminar && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(g)}
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma zona encontrada.</p>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <MobileCreateFormDialogContent
          showMobileCreate={showMobileForm}
          onCloseMobile={() => onDialogOpenChange(false)}
          moduleKicker="Capital Humano"
          screenTitle={title}
          desktopContentClassName="max-w-md max-h-[90vh] overflow-y-auto"
          desktopHeader={mobileCreateDesktopHeader(
            title,
            'A empresa associa esta zona ao seu tenant. Use coordenadas decimais (ex.: Luanda ≈ −8,838 / 13,234).',
          )}
          formBody={formBody}
          desktopFooter={
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!form.nome.trim()}>
                {editing ? 'Guardar' : 'Criar'}
              </Button>
            </DialogFooter>
          }
          mobileFooter={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 rounded-xl"
                onClick={() => onDialogOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="min-h-11 flex-1 rounded-xl" disabled={!form.nome.trim()} onClick={() => void save()}>
                {editing ? 'Guardar' : 'Criar'}
              </Button>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
