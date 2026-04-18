import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cake } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';
import { formatDate } from '@/utils/formatters';

export type DashboardBannerBirthdayPerson = {
  id: number;
  name: string;
  birth_date: string;
  avatar?: string | null;
};

function birthdayProfilePhotoUrl(
  p: DashboardBannerBirthdayPerson,
  colaboradores: { id: number; fotoPerfilUrl?: string | null }[],
): string | null {
  const c = colaboradores.find(x => x.id === p.id);
  const foto = c?.fotoPerfilUrl?.trim();
  if (foto) return foto;
  const a = typeof p.avatar === 'string' ? p.avatar.trim() : '';
  if (a && (a.startsWith('http://') || a.startsWith('https://') || a.startsWith('/'))) return a;
  return null;
}

function normalizeBirthDateToCurrentYear(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  date.setFullYear(now.getFullYear());

  return date;
}

function ConfettiBackdrop() {
  const pieces = useMemo(
    () =>
      [
        { t: '\u2605', c: '#ec4899', top: '6%', left: '8%', r: -12, s: 0.85 },
        { t: '\u2726', c: '#3b82f6', top: '10%', left: '78%', r: 18, s: 0.7 },
        { t: '\u25CF', c: '#eab308', top: '22%', left: '18%', r: 8, s: 0.55 },
        { t: '\u25B2', c: '#a855f7', top: '18%', left: '88%', r: -22, s: 0.65 },
        { t: '\u25A0', c: '#f97316', top: '8%', left: '48%', r: 35, s: 0.5 },
        { t: '\u2605', c: '#22c55e', top: '72%', left: '12%', r: 15, s: 0.75 },
        { t: '\u25CF', c: '#06b6d4', top: '82%', left: '82%', r: -8, s: 0.6 },
        { t: '\u25C6', c: '#f472b6', top: '65%', left: '68%', r: 28, s: 0.55 },
        { t: '\u2727', c: '#6366f1', top: '38%', left: '6%', r: -18, s: 0.5 },
        { t: '\u2605', c: '#facc15', top: '52%', left: '90%', r: 10, s: 0.8 },
        { t: '\u25A0', c: '#14b8a6', top: '45%', left: '42%', r: -30, s: 0.45 },
        { t: '\u25CF', c: '#ef4444', top: '28%', left: '52%', r: 20, s: 0.5 },
      ] as const,
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute select-none font-bold leading-none opacity-[0.85]"
          style={{
            top: p.top,
            left: p.left,
            color: p.c,
            transform: `rotate(${p.r}deg) scale(${p.s})`,
            fontSize: 'clamp(10px, 2.8vw, 14px)',
          }}
        >
          {p.t}
        </span>
      ))}
    </div>
  );
}

function BirthdayBannerSlide({
  person,
  colaboradores,
  organizationName,
  onClick,
}: {
  person: DashboardBannerBirthdayPerson;
  colaboradores: { id: number; fotoPerfilUrl?: string | null }[];
  organizationName: string;
  onClick?: () => void;
}) {
  const photoUrl = birthdayProfilePhotoUrl(person, colaboradores);

const imgSrc = photoUrl
  ? normalizePublicMediaUrl(photoUrl) ?? photoUrl
  : undefined;

// 👉 Nome (primeiro + último)
const nameParts = (person.name || '').trim().split(/\s+/);

const firstName = nameParts[0] || '';
const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

const displayName = [firstName, lastName].filter(Boolean).join(' ');

// 👉 Iniciais (primeiro + último)
const initials = [firstName, lastName]
  .filter(Boolean)
  .map(n => n[0].toUpperCase())
  .join('');

  const inner = (
    <>
      <ConfettiBackdrop />
      <div className="relative z-[1] flex h-full min-h-0 flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:py-6">
        <p className="text-[clamp(0.85rem,2.8vw,1.05rem)] font-bold leading-tight text-[#D4A926] dark:text-[#60a5fa]">
          Feliz Aniversário!!
        </p>

        <Avatar className="h-[clamp(4rem,22vw,6.5rem)] w-[clamp(4rem,22vw,6.5rem)] border-0 shadow-md ring-2 ring-white/80 dark:ring-slate-700/80">
          {imgSrc ? <AvatarImage src={imgSrc} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-base font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[clamp(0.95rem,3vw,1.15rem)] font-bold text-slate-900 dark:text-slate-50">
            {displayName}
          </p>
          <p className="text-[clamp(0.8rem,2.5vw,0.95rem)] text-slate-700 dark:text-slate-300">{formatDate(normalizeBirthDateToCurrentYear(person.birth_date).toISOString())}</p>
        </div>

        <div className="flex w-full items-end justify-between gap-2 pt-1">
          <p className="min-w-0 truncate text-left text-[clamp(0.75rem,2.4vw,0.9rem)] font-bold text-[#D4A926] dark:text-[#60a5fa]">
            {organizationName}
          </p>
          <div className="shrink-0 text-amber-500 drop-shadow-sm" aria-hidden>
            <Cake className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'relative h-full w-full min-h-0 overflow-hidden rounded-2xl border border-border/80 bg-white text-left shadow-sm outline-none',
          'transition-opacity hover:opacity-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40',
          'dark:border-border/60 dark:bg-slate-950',
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'relative h-full w-full min-h-0 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm dark:border-border/60 dark:bg-slate-950',
      )}
    >
      {inner}
    </div>
  );
}

function HolidayBannerSlide({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      role="presentation"
      sizes="(max-width: 1023px) 100vw, 32vw"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-center"
    />
  );
}

type Props = {
  holidayImageSrc: string | null;
  birthdayPeople: DashboardBannerBirthdayPerson[];
  /** Se true, gera um cartão por pessoa em `birthdayPeople`. */
  includeBirthdayBanners: boolean;
  colaboradores: { id: number; fotoPerfilUrl?: string | null }[];
  organizationName: string;
  onBirthdayBannerClick?: () => void;
};

export function DashboardTopBanners({
  holidayImageSrc,
  birthdayPeople,
  includeBirthdayBanners,
  colaboradores,
  organizationName,
  onBirthdayBannerClick,
}: Props) {
  const slides = useMemo(() => {
    const out: { key: string; kind: 'birthday' | 'holiday'; person?: DashboardBannerBirthdayPerson; src?: string }[] = [];
    if (includeBirthdayBanners) {
      for (const p of birthdayPeople) {
        out.push({ key: `birthday-${p.id}`, kind: 'birthday', person: p });
      }
    }
    if (holidayImageSrc) {
      out.push({ key: 'holiday', kind: 'holiday', src: holidayImageSrc });
    }
    return out;
  }, [includeBirthdayBanners, birthdayPeople, holidayImageSrc]);

  const [api, setApi] = useState<CarouselApi | null>(null);
  const [selected, setSelected] = useState(0);

  const onApi = useCallback((instance: CarouselApi | undefined) => {
    setApi(instance ?? null);
  }, []);

  useEffect(() => {
    if (!api || slides.length <= 1) return;
    setSelected(api.selectedScrollSnap());
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, slides.length]);

  useEffect(() => {
    if (!api || slides.length <= 1) return;
    const t = window.setInterval(() => {
      api.scrollNext();
    }, 6500);
    return () => window.clearInterval(t);
  }, [api, slides.length]);

  const shellClass = cn(
    'relative w-full min-h-0 overflow-hidden rounded-2xl border border-border/80 bg-muted/30',
    'aspect-[16/9] max-h-[min(42vh,360px)] sm:aspect-[21/9] sm:max-h-[min(44vh,400px)]',
    'lg:aspect-auto lg:h-full lg:max-h-none lg:min-h-[220px]',
  );

  if (slides.length === 0) {
    return (
      <div className={shellClass}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Banner</span>
          <p className="max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
            Sem imagem de feriado ou aniversariantes hoje. Configure o banner em Configuração → Módulos e recursos.
          </p>
        </div>
      </div>
    );
  }

  if (slides.length === 1) {
    const s = slides[0];
    return (
      <div className={shellClass}>
        {s.kind === 'holiday' && s.src ? (
          <HolidayBannerSlide src={s.src} />
        ) : s.kind === 'birthday' && s.person ? (
          <div className="absolute inset-0 p-0">
            <BirthdayBannerSlide
              person={s.person}
              colaboradores={colaboradores}
              organizationName={organizationName}
              onClick={onBirthdayBannerClick}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(shellClass, 'flex flex-col')}>
      <Carousel opts={{ loop: true, align: 'start' }} className="flex min-h-0 flex-1 flex-col" setApi={onApi}>
        <CarouselContent className="-ml-0 h-full flex-1">
          {slides.map(s => (
            <CarouselItem key={s.key} className="basis-full pl-0">
              <div className="relative h-full min-h-[12rem] w-full overflow-hidden rounded-2xl sm:min-h-[14rem] lg:min-h-0 lg:h-full">
                {s.kind === 'holiday' && s.src ? (
                  <HolidayBannerSlide src={s.src} />
                ) : s.kind === 'birthday' && s.person ? (
                  <BirthdayBannerSlide
                    person={s.person}
                    colaboradores={colaboradores}
                    organizationName={organizationName}
                    onClick={onBirthdayBannerClick}
                  />
                ) : null}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          variant="secondary"
          className="left-1.5 top-1/2 z-10 h-8 w-8 -translate-y-1/2 border-border/80 bg-background/90 shadow-sm"
        />
        <CarouselNext
          variant="secondary"
          className="right-1.5 top-1/2 z-10 h-8 w-8 -translate-y-1/2 border-border/80 bg-background/90 shadow-sm"
        />
      </Carousel>
      <div className="pointer-events-none absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === selected ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/40',
            )}
          />
        ))}
      </div>
    </div>
  );
}
