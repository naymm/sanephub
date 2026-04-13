import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Fingerprint, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PontoMobilePinDisplay } from '@/components/ponto/PontoMobilePinDisplay';
import { PontoNumericKeypad } from '@/components/ponto/PontoNumericKeypad';
import { cn } from '@/lib/utils';

export type ProximaAccaoPonto = 'entrada' | 'saida' | 'completo';

export type PontoMobileMarcacaoPanelProps = {
  podeMarcar: boolean;
  proximaAccao: ProximaAccaoPonto;
  motivosNaoPodeMarcar: string[];
  temPontoPin: boolean | null;
  pinValue: string;
  onPinChange: (v: string) => void;
  loading: boolean;
  precisaLocalizacao: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Erro de submissão (ex. GPS / zona); em mobile evita toast por cima do modal. */
  marcacaoErro?: { title: string; description: string } | null;
  onDismissMarcacaoErro?: () => void;
};

const PIN_LEN = 4;

export function PontoMobileMarcacaoPanel({
  podeMarcar,
  proximaAccao,
  motivosNaoPodeMarcar,
  temPontoPin,
  pinValue,
  onPinChange,
  loading,
  precisaLocalizacao,
  onClose,
  onConfirm,
  marcacaoErro,
  onDismissMarcacaoErro,
}: PontoMobileMarcacaoPanelProps) {
  const titulo = !podeMarcar
    ? 'Marcação de ponto'
    : proximaAccao === 'saida'
      ? 'Marcar saída'
      : 'Marcar entrada';

  const subtitulo = !podeMarcar
    ? 'Complete a configuração do perfil para registar entrada e saída no ERP.'
    : proximaAccao === 'saida'
      ? 'Introduza o seu PIN de 4 dígitos para confirmar a saída.'
      : 'Introduza o seu PIN de 4 dígitos para confirmar a entrada.';

  const appendDigit = (d: string) => {
    if (pinValue.length >= PIN_LEN) return;
    onPinChange(pinValue + d);
  };

  const backspace = () => {
    onPinChange(pinValue.slice(0, -1));
  };

  const podeSubmeter =
    podeMarcar && temPontoPin === true && pinValue.length === PIN_LEN && !loading;

  const showKeypadFooter = podeMarcar && temPontoPin === true;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full text-foreground"
          onClick={onClose}
          disabled={loading}
          aria-label="Fechar"
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2} />
        </Button>
      </div>

      {marcacaoErro ? (
        <div className="relative mx-4 mb-2 shrink-0 rounded-xl border border-border bg-card p-3 shadow-md">
          <button
            type="button"
            className="absolute -left-1 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shadow-md"
            onClick={() => onDismissMarcacaoErro?.()}
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </button>
          <div className="flex gap-3 pl-2 pt-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground">
              <AlertCircle className="h-5 w-5 text-background" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-foreground">{marcacaoErro.title}</p>
              {marcacaoErro.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{marcacaoErro.description}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-y-contain',
          showKeypadFooter && 'pb-1',
        )}
      >
        <div className="flex flex-col items-center px-5 pb-4 pt-1 text-center">
          <div
            className={cn(
              'mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full',
              'bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--navy)/0.1)]',
              'ring-[10px] ring-[hsl(var(--primary)/0.1)]',
            )}
          >
            <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-[hsl(var(--navy))] shadow-md">
              <Fingerprint className="h-8 w-8 text-[hsl(var(--primary))]" strokeWidth={2} aria-hidden />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--navy))] dark:text-foreground">{titulo}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{subtitulo}</p>
          {podeMarcar && precisaLocalizacao ? (
            <p className="mt-3 flex items-start justify-center gap-2 text-left text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary))]" aria-hidden />
              <span>Ao confirmar, será pedida a localização para validar a zona de ponto.</span>
            </p>
          ) : null}
        </div>

        <div className="px-4 pb-6">
          {!podeMarcar && (
            <Alert className="border-border/80">
              <AlertTitle>Falta configuração</AlertTitle>
              <AlertDescription className="space-y-3 pt-1">
                <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                  {motivosNaoPodeMarcar.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
                <Button type="button" className="w-full" asChild>
                  <Link to="/portal/dados">Os Meus Dados</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {podeMarcar && temPontoPin === null && (
            <p className="py-8 text-center text-sm text-muted-foreground">A verificar PIN…</p>
          )}

          {podeMarcar && temPontoPin === false && (
            <Alert variant="destructive" className="border-destructive/50">
              <AlertTitle>PIN não configurado</AlertTitle>
              <AlertDescription className="space-y-3 text-sm">
                <p>Defina um PIN de 4 dígitos em «Os Meus Dados» para marcar o ponto.</p>
                <Button type="button" variant="secondary" className="w-full" asChild>
                  <Link to="/portal/dados">Abrir Os Meus Dados</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {showKeypadFooter && (
            <div className="flex flex-col items-center pt-2">
              <PontoMobilePinDisplay value={pinValue} maxLength={PIN_LEN} />
            </div>
          )}
        </div>
      </div>

      {showKeypadFooter && (
        <div className="shrink-0 border-t border-border/60 bg-muted/40 dark:bg-muted/25">
          <div className="px-3 pb-2 pt-3">
            <PontoNumericKeypad onDigit={appendDigit} onBackspace={backspace} disabled={loading} />
          </div>
          <div className="border-t border-border/50 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={!podeSubmeter}
              onClick={() => void onConfirm()}
            >
              {loading
                ? 'A registar…'
                : proximaAccao === 'saida'
                  ? 'Confirmar saída'
                  : 'Confirmar entrada'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-1 h-11 w-full text-muted-foreground"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!podeMarcar && (
        <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
          <Button type="button" variant="secondary" className="h-12 w-full rounded-xl" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}

      {podeMarcar && temPontoPin === false && (
        <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
          <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}

      {podeMarcar && temPontoPin === null && (
        <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
          <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
