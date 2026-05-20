import { parseVideoEmbedInput } from '@/utils/videoEmbed';
import type { TutorialVideo } from '@/types';
import { cn } from '@/lib/utils';

type TutorialVideoPlayerProps = {
  video: TutorialVideo;
  className?: string;
};

export function TutorialVideoPlayer({ video, className }: TutorialVideoPlayerProps) {
  const parsed = parseVideoEmbedInput(video.videoUrl, video.videoProvedor);
  if (!parsed) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground',
          className,
        )}
      >
        URL de vídeo inválida.
      </div>
    );
  }

  if (parsed.provedor === 'url') {
    return (
      <video
        className={cn('aspect-video w-full rounded-lg bg-black', className)}
        src={parsed.embedUrl}
        controls
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-lg bg-black', className)}>
      <iframe
        title={video.titulo}
        src={parsed.embedUrl}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
