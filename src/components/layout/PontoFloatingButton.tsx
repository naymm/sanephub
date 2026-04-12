import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Fingerprint } from 'lucide-react';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { marcarPontoPeloErp } from '@/lib/marcarPontoErp';
import { obterPosicaoDispositivoPrecisa, obterPosicaoDispositivoSimples } from '@/lib/geolocationDevice';
import { rpcPerfilTemPontoPin, rpcVerificarMeuPontoPin } from '@/lib/pontoPinRpc';
import { geofencesParaMarcacaoPonto, validarMarcacaoComGeofences } from '@/lib/pontoGeofence';
import { PontoPinOtpFields } from '@/components/ponto/PontoPinOtpFields';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  chaveSessionEntradaHoje,
  chaveSessionSaidaHoje,
  localDiaCivilBounds,
  rowPareceEntrada,
  rowPareceSaida,
} from '@/lib/pontoEntradaHoje';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ProximaAccaoPonto = 'entrada' | 'saida' | 'completo';

/**
 * Marcação de entrada/saída pelo ERP (intranet), ao lado do botão de chat.
 */
export function PontoFloatingButton() {
  const { user } = useAuth();
  const { colaboradoresTodos, empresas, geofences, colaboradorGeofenceLinks } = useData();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entradaHoje, setEntradaHoje] = useState(false);
  const [saidaHoje, setSaidaHoje] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [temPontoPin, setTemPontoPin] = useState<boolean | null>(null);

  const mecPerfil = user?.numeroMec?.trim() ?? '';

  const colaborador = useMemo(() => {
    if (!user) return undefined;
    if (user.colaboradorId) {
      const porId = colaboradoresTodos.find(c => c.id === user.colaboradorId);
      if (porId) return porId;
    }
    const mec = mecPerfil.toLowerCase();
    if (!mec) return undefined;
    return colaboradoresTodos.find(c => (c.numeroMec ?? '').trim().toLowerCase() === mec);
  }, [user, colaboradoresTodos, mecPerfil]);

  /** Tem de ser o mesmo valor que `profiles.numero_mec` (exigido pela RLS). */
  const numeroMecRegisto = mecPerfil;

  const empresaIdRegisto =
    colaborador?.empresaId != null && Number.isFinite(Number(colaborador.empresaId))
      ? colaborador.empresaId
      : user?.empresaId != null && Number.isFinite(Number(user.empresaId))
        ? Number(user.empresaId)
        : null;

  const empresaNome = useMemo(() => {
    if (empresaIdRegisto == null) return null;
    return empresas.find(e => e.id === empresaIdRegisto)?.nome ?? null;
  }, [empresaIdRegisto, empresas]);

  const podeMarcar =
    isSupabaseConfigured() &&
    !!user &&
    hasModuleAccess(user, 'dashboard') &&
    numeroMecRegisto.length > 0 &&
    empresaIdRegisto != null &&
    Boolean(empresaNome?.trim());

  /** Zonas activas usadas na validação: atribuídas ao colaborador ou, se não houver, todas as da empresa. */
  const zonasValidacaoPonto = useMemo(() => {
    if (empresaIdRegisto == null) return [];
    const cid = colaborador?.id != null && Number.isFinite(Number(colaborador.id)) ? colaborador.id : 0;
    return geofencesParaMarcacaoPonto(cid, empresaIdRegisto, geofences, colaboradorGeofenceLinks);
  }, [colaborador?.id, empresaIdRegisto, geofences, colaboradorGeofenceLinks]);

  const precisaLocalizacao = zonasValidacaoPonto.length > 0;

  const sincronizarMarcacoesHoje = useCallback(async () => {
    if (!numeroMecRegisto) {
      setEntradaHoje(false);
      setSaidaHoje(false);
      return;
    }
    const { startIso, endIso, dateKey } = localDiaCivilBounds();
    const ke = chaveSessionEntradaHoje(numeroMecRegisto, dateKey);
    const ks = chaveSessionSaidaHoje(numeroMecRegisto, dateKey);

    let hasEntrada = false;
    let hasSaida = false;
    let leuBdComSucesso = false;

    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('biometrico_registros')
          .select('id, tipo')
          .eq('numero_mec', numeroMecRegisto.trim())
          .gte('data_hora', startIso)
          .lt('data_hora', endIso)
          .limit(60);
        if (!error && data != null) {
          leuBdComSucesso = true;
          for (const r of data) {
            const row = r as { tipo?: unknown; kind?: unknown };
            if (!hasEntrada && rowPareceEntrada(row)) hasEntrada = true;
            if (!hasSaida && rowPareceSaida(row)) hasSaida = true;
            if (hasEntrada && hasSaida) break;
          }
        }
      } catch {
        /* RLS ou coluna ausente */
      }
    }

    if (!leuBdComSucesso) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (sessionStorage.getItem(ke) === '1') hasEntrada = true;
          if (sessionStorage.getItem(ks) === '1') hasSaida = true;
        }
      } catch {
        /* modo privado / storage indisponível */
      }
    } else {
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (!hasEntrada) sessionStorage.removeItem(ke);
          if (!hasSaida) sessionStorage.removeItem(ks);
        }
      } catch {
        /* ignorar */
      }
    }

    setEntradaHoje(hasEntrada);
    setSaidaHoje(hasSaida);
  }, [numeroMecRegisto]);

  const proximaAccao: ProximaAccaoPonto = useMemo(() => {
    if (!entradaHoje) return 'entrada';
    if (!saidaHoje) return 'saida';
    return 'completo';
  }, [entradaHoje, saidaHoje]);

  useEffect(() => {
    if (!podeMarcar) return;
    void sincronizarMarcacoesHoje();
  }, [podeMarcar, sincronizarMarcacoesHoje]);

  useEffect(() => {
    if (open && podeMarcar) void sincronizarMarcacoesHoje();
  }, [open, podeMarcar, sincronizarMarcacoesHoje]);

  const diaCompleto = proximaAccao === 'completo';

  useEffect(() => {
    if (diaCompleto) setOpen(false);
  }, [diaCompleto]);

  useEffect(() => {
    if (!open || !podeMarcar) return;
    if (!supabase || !isSupabaseConfigured()) {
      setTemPontoPin(false);
      return;
    }
    setTemPontoPin(null);
    void rpcPerfilTemPontoPin(supabase)
      .then(setTemPontoPin)
      .catch(() => setTemPontoPin(false));
  }, [open, podeMarcar]);

  useEffect(() => {
    if (!open) setPinValue('');
  }, [open]);

  const confirmar = useCallback(async () => {
    if (!supabase || !user || !numeroMecRegisto || empresaIdRegisto == null) return;
    const nomeEmp = empresaNome?.trim();
    if (!nomeEmp) {
      toast.error('Não foi possível resolver o nome da empresa para o registo.');
      return;
    }

    const modo: ProximaAccaoPonto =
      !entradaHoje ? 'entrada' : !saidaHoje ? 'saida' : 'completo';
    if (modo === 'completo') return;

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const authUserId = authData.user?.id;
    if (authErr || !authUserId) {
      toast.error('Sessão inválida. Inicie sessão novamente.');
      return;
    }

    setLoading(true);
    try {
      if (temPontoPin !== true) {
        toast.error('Configure um PIN de 4 dígitos em Os Meus Dados (portal) antes de marcar o ponto.');
        return;
      }
      if (pinValue.length !== 4) {
        toast.error('Introduza o PIN de 4 dígitos.');
        return;
      }
      const pinOk = await rpcVerificarMeuPontoPin(supabase, pinValue);
      if (!pinOk) {
        toast.error('PIN incorreto.');
        return;
      }

      const coords = precisaLocalizacao
        ? await obterPosicaoDispositivoPrecisa()
        : await obterPosicaoDispositivoSimples();
      const geo = validarMarcacaoComGeofences({
        colaboradorId: colaborador?.id ?? 0,
        empresaId: empresaIdRegisto,
        coords: coords
          ? {
              lat: coords.lat,
              lng: coords.lng,
              accuracyM: coords.accuracyM ?? undefined,
            }
          : null,
        geofences,
        links: colaboradorGeofenceLinks,
      });
      if (geo.ok === false) {
        if (geo.codigo === 'fora_da_zona') {
          toast.error('Fora de zona permitida', {
            description: geo.mensagem,
            duration: 16_000,
          });
        } else {
          toast.error('Localização necessária', {
            description: geo.mensagem,
            duration: 14_000,
          });
        }
        return;
      }

      if (zonasValidacaoPonto.length > 0 && (!coords || geo.exigeZona !== true)) {
        toast.error('Fora de zona permitida', {
          description:
            'Não foi possível confirmar que está dentro do raio de uma zona cadastrada. O ponto não foi registado.',
          duration: 14_000,
        });
        return;
      }

      const tipoMarcacao = modo === 'saida' ? 'Saída' : 'Entrada';
      const { error } = await marcarPontoPeloErp(supabase, {
        numeroMec: numeroMecRegisto,
        empresaId: empresaIdRegisto,
        empresaNomeTexto: nomeEmp,
        coords: coords
          ? { lat: coords.lat, lng: coords.lng, accuracyM: coords.accuracyM ?? undefined }
          : undefined,
        geofenceId: geo.exigeZona ? geo.geofenceId : undefined,
        isWithinGeofence: geo.exigeZona ? true : undefined,
        tipoMarcacao,
      });
      if (error) {
        toast.error(error);
        return;
      }
      const { dateKey } = localDiaCivilBounds();
      try {
        if (modo === 'entrada') {
          sessionStorage.setItem(chaveSessionEntradaHoje(numeroMecRegisto, dateKey), '1');
        } else {
          sessionStorage.setItem(chaveSessionSaidaHoje(numeroMecRegisto, dateKey), '1');
        }
      } catch {
        /* modo privado / storage indisponível */
      }
      if (modo === 'entrada') {
        setEntradaHoje(true);
        toast.success('Entrada registada com sucesso.');
      } else {
        setSaidaHoje(true);
        toast.success('Saída registada com sucesso.');
      }
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    colaborador?.id,
    numeroMecRegisto,
    empresaIdRegisto,
    empresaNome,
    entradaHoje,
    saidaHoje,
    precisaLocalizacao,
    zonasValidacaoPonto,
    geofences,
    colaboradorGeofenceLinks,
    temPontoPin,
    pinValue,
  ]);

  if (!podeMarcar) return null;

  const botaoClass =
    proximaAccao === 'entrada'
      ? 'bg-emerald-600 text-white hover:bg-emerald-600/90'
      : proximaAccao === 'saida'
        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
        : 'bg-muted text-muted-foreground';

  const ariaLabel =
    proximaAccao === 'entrada'
      ? 'Marcar entrada (ponto)'
      : proximaAccao === 'saida'
        ? 'Marcar saída (ponto)'
        : 'Ponto desactivado: entrada e saída já registadas hoje';

  const titleBtn =
    proximaAccao === 'entrada'
      ? 'Marcar entrada'
      : proximaAccao === 'saida'
        ? 'Marcar saída'
        : 'Dia completo — já marcou entrada e saída';

  return (
    <>
      <button
        type="button"
        disabled={diaCompleto}
        onClick={() => setOpen(true)}
        className={cn(
          'relative z-10 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          !diaCompleto && 'hover:scale-105 active:scale-95',
          diaCompleto && 'cursor-not-allowed opacity-70 shadow-none',
          botaoClass,
        )}
        aria-label={ariaLabel}
        title={titleBtn}
      >
        <Fingerprint className="h-6 w-6" strokeWidth={2} aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {proximaAccao === 'saida' ? 'Marcar saída' : 'Marcar entrada'}
            </DialogTitle>
            <DialogDescription>
              {proximaAccao === 'saida'
                ? 'Confirme o PIN e a localização para registar a saída.'
                : 'Confirme o PIN e a localização para registar a entrada.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {/* <p className="text-muted-foreground">
              {proximaAccao === 'saida' ? (
                <>
                  Será criado um registo de <strong className="text-foreground">saída</strong> em{' '}
                  <code className="text-xs">biometrico_registros</code> com o seu nº mecanográfico (
                  <span className="font-mono text-xs">{numeroMecRegisto}</span>
                  ), hora actual e origem ERP.
                </>
              ) : (
                <>
                  Será criado um registo em <code className="text-xs">biometrico_registros</code> com o seu nº
                  mecanográfico (<span className="font-mono text-xs">{numeroMecRegisto}</span>
                  ), hora actual e origem ERP.
                </>
              )}
            </p> */}
            {temPontoPin === null ? (
              <p className="text-muted-foreground">A verificar configuração do PIN…</p>
            ) : temPontoPin === false ? (
              <Alert variant="destructive">
                <AlertTitle>PIN não configurado</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>Defina um PIN de 4 dígitos em «Os Meus Dados» no portal do colaborador para poder marcar o ponto.</p>
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <Link to="/portal/dados">Abrir Os Meus Dados</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {/* <p className="font-medium text-foreground">Confirmar PIN</p>
                <p className="text-muted-foreground">
                  Introduza o código de 4 dígitos que definiu em Os Meus Dados para continuar.
                </p> */}
                <PontoPinOtpFields value={pinValue} onChange={setPinValue} disabled={loading} />
              </div>
            )}
            {/* <p className="text-muted-foreground">
              {precisaLocalizacao ? (
                <>
                  A empresa tem <strong className="text-foreground">{zonasValidacaoPonto.length}</strong> zona(s) de ponto
                  cadastrada(s). O dispositivo vai pedir localização com{' '}
                  <strong className="text-foreground">alta precisão</strong> (GPS); é obrigatório estar dentro do{' '}
                  <strong className="text-foreground">raio</strong> de pelo menos uma delas (com margem de erro do GPS).
                </>
              ) : (
                <>
                  
                </>
              )}
            </p> */}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void confirmar()}
              disabled={
                loading ||
                temPontoPin !== true ||
                pinValue.length !== 4
              }
            >
              {loading
                ? 'A registar…'
                : proximaAccao === 'saida'
                  ? 'Confirmar saída'
                  : 'Confirmar entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
