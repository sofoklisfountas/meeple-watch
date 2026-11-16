// Post photos: grid (1–3) or swipeable carousel (4+). Tap a photo → full-screen lightbox
// with wraparound prev/next (arrows, keyboard ← →, swipe), Esc / backdrop to close.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cx } from './ui';

/** fill = phone reels: one big photo at a time filling the free space, swipe sideways. */
export function Photos({ images, fill }: { images: string[]; fill?: boolean }) {
  const [broken, setBroken] = useState<string[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const imgs = images.filter((s) => !broken.includes(s));
  if (!imgs.length) return null;
  const onError = (src: string) => setBroken((b) => [...b, src]);

  return (
    <>
      {fill ? (
        <Slides imgs={imgs} onOpen={setOpen} onError={onError} />
      ) : imgs.length > 3 ? (
        <Carousel imgs={imgs} onOpen={setOpen} onError={onError} />
      ) : (
        <div className={cx('mt-3 grid gap-1.5 overflow-hidden rounded-xl', imgs.length === 1 ? 'grid-cols-1' : imgs.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {imgs.map((src, i) => (
            <Tile key={src} src={src} onClick={() => setOpen(i)} onError={() => onError(src)} tall={imgs.length === 1} />
          ))}
        </div>
      )}
      {open != null && <Lightbox imgs={imgs} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Tile({ src, onClick, onError, tall, className }: { src: string; onClick: () => void; onError: () => void; tall?: boolean; className?: string }) {
  return (
    <button onClick={onClick} className={cx('relative cursor-zoom-in overflow-hidden bg-zinc-800', className)}>
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        draggable={false}
        onError={onError}
        className={cx('w-full object-cover transition duration-300 hover:scale-[1.03]', tall ? 'max-h-80' : 'aspect-square')}
      />
    </button>
  );
}

/** In-card strip: 3 photos per view, swipe or arrows, dots show the position. */
function Carousel({ imgs, onOpen, onError }: { imgs: string[]; onOpen: (i: number) => void; onError: (src: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ start: true, end: false, page: 0 });
  const pages = Math.ceil(imgs.length / 3);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({ start: el.scrollLeft < 4, end: el.scrollLeft > max - 4, page: Math.round((el.scrollLeft / Math.max(max, 1)) * (pages - 1)) });
  };
  const by = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="group/car relative mt-3">
      <div
        ref={ref}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {imgs.map((src, i) => (
          <Tile
            key={src}
            src={src}
            onClick={() => onOpen(i)}
            onError={() => onError(src)}
            className="w-[calc((100%-0.75rem)/3)] shrink-0 snap-start"
          />
        ))}
      </div>
      {!pos.start && <Arrow side="left" onClick={() => by(-1)} />}
      {!pos.end && <Arrow side="right" onClick={() => by(1)} />}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className={cx('h-1.5 rounded-full transition-all', i === pos.page ? 'w-4 bg-indigo-400' : 'w-1.5 bg-zinc-700')} />
        ))}
        <span className="ml-1.5 text-[11px] text-zinc-500">{imgs.length} photos</span>
      </div>
    </div>
  );
}

/** Reels: full-width slides, native sideways swipe, counter + dots. */
function Slides({ imgs, onOpen, onError }: { imgs: string[]; onOpen: (i: number) => void; onError: (src: string) => void }) {
  const [i, setI] = useState(0);
  return (
    <div className="relative mt-3 min-h-[30%] flex-1 overflow-hidden rounded-2xl bg-zinc-900">
      <div
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {imgs.map((src, k) => (
          <button key={src} onClick={() => onOpen(k)} className="h-full w-full shrink-0 snap-center">
            <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" draggable={false} onError={() => onError(src)} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {imgs.length > 1 && (
        <>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-zinc-950/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur">
            {i + 1}/{imgs.length}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {imgs.map((s, k) => (
              <span key={s} className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photos' : 'Next photos'}
      className={cx(
        'absolute top-[calc(50%-0.875rem)] grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-zinc-950/70 text-white shadow-lg ring-1 ring-white/10 backdrop-blur transition hover:bg-zinc-950/90',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      {side === 'left' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}

/** Full-screen viewer. Wraps around: next on the last photo goes to the first. */
function Lightbox({ imgs, start, onClose }: { imgs: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = imgs.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  // Touch drag: the photo follows the finger; let go past 60 px → next/previous, swipe down → close.
  const touch = useRef<{ x: number; y: number } | null>(null);
  // Mouse wheel: down = next, up = previous (wraps). One photo per gesture, so a trackpad's
  // stream of small wheel events doesn't fly through all photos.
  const wheel = useRef({ sum: 0, last: 0 });
  const onWheel = (e: React.WheelEvent) => {
    if (n < 2) return;
    const now = Date.now();
    const w = wheel.current;
    if (now - w.last < 280) return; // still the same gesture
    w.sum += e.deltaY || e.deltaX;
    if (Math.abs(w.sum) < 30) return;
    go(w.sum > 0 ? 1 : -1);
    w.sum = 0;
    w.last = now;
  };
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex animate-[fadeIn_.15s_ease-out] flex-col bg-zinc-950/95 backdrop-blur-sm"
      onClick={onClose}
      onWheel={onWheel}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchMove={(e) => {
        if (!touch.current) return;
        const x = e.touches[0].clientX - touch.current.x;
        const y = e.touches[0].clientY - touch.current.y;
        setDrag(Math.abs(x) > Math.abs(y) ? { x: n > 1 ? x : 0, y: 0 } : { x: 0, y: Math.max(0, y) });
      }}
      onTouchEnd={() => {
        if (!touch.current) return;
        touch.current = null;
        if (drag.y > 100) onClose();
        else if (Math.abs(drag.x) > 60) go(drag.x < 0 ? 1 : -1);
        setDrag({ x: 0, y: 0 });
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-sm text-zinc-300">
        <span className="tabular-nums">{i + 1} / {n}</span>
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-white/10">
          <X size={22} />
        </button>
      </div>

      {/* Photo */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        <img
          key={imgs[i]}
          src={imgs[i]}
          alt=""
          referrerPolicy="no-referrer"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - drag.y / 1500})`,
            opacity: 1 - drag.y / 500,
            transition: touch.current ? 'none' : 'transform .2s ease-out, opacity .2s',
          }}
          className="max-h-full max-w-full animate-[fadeIn_.15s_ease-out] touch-none rounded-lg object-contain shadow-2xl"
        />
        {n > 1 && (
          <>
            <NavBtn side="left" onClick={() => go(-1)} />
            <NavBtn side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      {/* Thumbnails */}
      {n > 1 && (
        <div className="overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto flex w-max gap-2">
          {imgs.map((src, k) => (
            <button
              key={src}
              ref={(el) => { if (el && k === i) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }}
              onClick={() => setI(k)}
              className={cx('h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg transition', k === i ? 'ring-2 ring-indigo-400' : 'opacity-50 hover:opacity-90')}
            >
              <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            </button>
          ))}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function NavBtn({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={cx(
        'absolute top-1/2 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20',
        side === 'left' ? 'left-2 sm:left-4' : 'right-2 sm:right-4',
      )}
    >
      {side === 'left' ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
    </button>
  );
}
