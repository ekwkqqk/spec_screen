import { useRef } from 'react';
import type { ScreenItem } from '../types';

interface Props {
  src: string;
  items: ScreenItem[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
  /** true면 이미지를 클릭해 마커를 찍고 드래그로 옮길 수 있다 */
  editable?: boolean;
  /** 특정 행의 마커 위치를 지정하는 중인지 (커서 모양만 바뀜) */
  placing?: boolean;
  onImageClick?: (x: number, y: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onMarkerClick?: (id: string) => void;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export default function ImageMarkerCanvas({
  src,
  items,
  hoverId,
  onHover,
  editable,
  placing,
  onImageClick,
  onMove,
  onMarkerClick,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);

  // 컨테이너 기준 0~1 비율 좌표로 바꿔서, 화면 크기가 달라져도 마커 위치가 유지되게 한다
  const toRatio = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };

  return (
    <div ref={ref} className={`canvas${editable ? ' editable' : ''}${placing ? ' placing' : ''}`}>
      <img
        src={src}
        alt="화면 이미지"
        draggable={false}
        onClick={(e) => {
          if (!editable) return;
          const { x, y } = toRatio(e);
          onImageClick?.(x, y);
        }}
      />
      {items.map((it, i) =>
        it.x == null || it.y == null ? null : (
          <div
            key={it.id}
            className={`marker${hoverId === it.id ? ' active' : ''}`}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%` }}
            title={it.name}
            onPointerEnter={() => onHover(it.id)}
            onPointerLeave={() => onHover(null)}
            onPointerDown={
              editable
                ? (e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragging.current = it.id;
                  }
                : undefined
            }
            onPointerMove={(e) => {
              if (dragging.current !== it.id) return;
              const { x, y } = toRatio(e);
              onMove?.(it.id, x, y);
            }}
            onPointerUp={() => (dragging.current = null)}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick?.(it.id);
            }}
          >
            {i + 1}
          </div>
        ),
      )}
    </div>
  );
}
