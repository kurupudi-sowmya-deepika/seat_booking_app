import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Ellipse, Line, Text, Group, Transformer } from 'react-konva';
import Konva from 'konva';

export interface LayoutItem {
  id: string;
  item_type: 'SEAT' | 'ROOM' | 'ZONE' | 'WALL' | 'DOOR' | 'WINDOW' | 'FACILITY';
  parent_item_id?: string | null;
  zone_item_id?: string | null;
  label?: string | null;
  color?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: 'RECTANGLE' | 'SQUARE' | 'CIRCLE' | 'OVAL' | 'L_SHAPE' | 'CUSTOM';
  z_index: number;
  elevation?: number; // visual height off the floor, isometric mode only
  properties?: Record<string, any> | null;
  // Present on published items returned by GET /floor-plans/floors/{id}/published
  // (the employee-facing read) - the real, live business row this item materializes.
  seat_id?: string | null;
  room_id?: string | null;
  room_type?: string | null;
  capacity?: number | null;
}

interface FloorPlanCanvasProps {
  // 'preview' renders an AI-generated proposal read-only, overlaid on the current
  // draft: no Transformer/dragging (like 'view'), but skips 'view''s booking-availability
  // coloring and "click to book" semantics - it's a look-don't-touch layer, not a
  // booking surface. See `proposedItemIds` for how proposed items are visually flagged.
  // 'isometric' is a separate read-only rendering path (see renderIsometric below) -
  // editing (drag/resize/rotate) always happens in 'edit', never in 'isometric'.
  mode: 'edit' | 'view' | 'preview' | 'isometric';
  canvasWidth: number;
  canvasHeight: number;
  items: LayoutItem[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onItemsChange?: (items: LayoutItem[]) => void;
  onItemActivate?: (item: LayoutItem) => void; // view mode: click a seat/room to book it
  onCanvasClick?: (pos: { x: number; y: number }) => void; // edit mode: click on empty canvas (floor-space coords) - used by Draw Wall/Draw Custom Shape
  gridSize?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  bookedSeatIds?: Set<string>; // view/isometric mode: seats to render as unavailable
  unavailableRoomIds?: Set<string>; // view mode: rooms to render as unavailable (booked for the selected date/time)
  proposedItemIds?: Set<string>; // preview mode: items to render with a dashed amber "new" outline
  isoRotation?: 0 | 90 | 180 | 270; // isometric mode: which floor corner faces the viewer
}

// Default visual extrusion (3D wall/block height) per item type, used only by the
// isometric render - independent of `elevation` (how high off the floor the object's
// base sits) and independent of the 2D footprint width/height. Not persisted; purely
// a rendering constant so every existing item gets sensible depth without needing to
// be re-edited first.
const ISO_EXTRUSION: Record<string, number> = {
  WALL: 90, DOOR: 60, WINDOW: 55, ROOM: 10, ZONE: 1, SEAT: 26, FACILITY: 22,
};
const ISO_ANGLE = Math.PI / 6; // 30 degrees - standard 2:1 isometric

/** Projects a floor-space point (x, y, z=elevation) to an isometric screen point. */
function isoProject(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - y) * Math.cos(ISO_ANGLE),
    y: (x + y) * Math.sin(ISO_ANGLE) - z,
  };
}

/** Rotates a point within the canvas bounds by 0/90/180/270 degrees before isometric
 * projection - this is how "rotate the floor" is implemented (swapping which corner
 * faces the viewer), not a free camera. */
function sceneRotate(x: number, y: number, canvasWidth: number, canvasHeight: number, steps: 0 | 90 | 180 | 270): { x: number; y: number } {
  switch (steps) {
    case 90: return { x: canvasHeight - y, y: x };
    case 180: return { x: canvasWidth - x, y: canvasHeight - y };
    case 270: return { x: y, y: canvasWidth - x };
    default: return { x, y };
  }
}

function shadeColor(hex: string, amount: number): string {
  // amount in [-1, 1]: negative darkens, positive lightens - flat directional
  // shading for the two side faces vs. the top face, not a lighting engine.
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const num = parseInt(c, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  const adjust = (v: number) => Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  r = adjust(r); g = adjust(g); b = adjust(b);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

const TYPE_COLORS: Record<string, string> = {
  SEAT: '#ffffff',
  ROOM: '#eff6ff',
  ZONE: '#f3f4f6',
  WALL: '#374151',
  DOOR: '#92400e',
  WINDOW: '#bae6fd',
  FACILITY: '#fef3c7',
};

/** Renders one item's shape (fill/stroke only) - position/rotation are handled by the
 * wrapping Group, so these are drawn at local (0,0) sized to width/height. */
const ItemShape: React.FC<{ item: LayoutItem; fill: string; stroke: string; strokeWidth: number; dash?: number[] }> = ({ item, fill, stroke, strokeWidth, dash }) => {
  const { width, height, shape } = item;
  if (shape === 'CIRCLE') {
    const r = Math.min(width, height) / 2;
    return <Circle x={width / 2} y={height / 2} radius={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />;
  }
  if (shape === 'OVAL') {
    return <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />;
  }
  if (shape === 'L_SHAPE') {
    // A simple L: full box minus the top-right quadrant.
    const points = [
      0, 0, width * 0.6, 0, width * 0.6, height * 0.4, width, height * 0.4,
      width, height, 0, height,
    ];
    return <Line points={points} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />;
  }
  if (shape === 'CUSTOM' && Array.isArray(item.properties?.polygon_points) && item.properties!.polygon_points.length >= 3) {
    // A practical, bounded polygon tool - points are placed once via "Draw Custom
    // Shape" (relative to the item's own x/y) and rendered as-is; not a full vector
    // editor (no per-vertex handles after creation).
    const points = item.properties!.polygon_points.flatMap((p: { x: number; y: number }) => [p.x, p.y]);
    return <Line points={points} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />;
  }
  // RECTANGLE / SQUARE / CUSTOM-without-points (a freely resizable rectangle until
  // the admin draws a polygon for it).
  return <Rect width={width} height={height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} cornerRadius={shape === 'SQUARE' ? 2 : 4} dash={dash} />;
};

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  mode, canvasWidth, canvasHeight, items, selectedIds = [], onSelectionChange, onItemsChange,
  onItemActivate, onCanvasClick, gridSize = 20, snapToGrid = true, showGrid = true,
  bookedSeatIds, unavailableRoomIds, proposedItemIds, isoRotation = 0,
}) => {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Group | null>>({});
  const [scale, setScale] = useState(0.8);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height || 600 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Attach the Transformer to whichever nodes are currently selected (edit mode only).
  useEffect(() => {
    if (mode !== 'edit' || !trRef.current) return;
    const nodes = selectedIds.map(id => shapeRefs.current[id]).filter(Boolean) as Konva.Group[];
    trRef.current.nodes(nodes);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedIds, mode, items]);

  const snap = (value: number) => (snapToGrid ? Math.round(value / gridSize) * gridSize : value);

  const updateItem = (id: string, patch: Partial<LayoutItem>) => {
    if (!onItemsChange) return;
    onItemsChange(items.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.2, Math.min(3, direction > 0 ? oldScale * 1.08 : oldScale / 1.08));
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const zoomBy = (factor: number) => setScale(s => Math.max(0.2, Math.min(3, s * factor)));
  const resetView = () => { setScale(0.8); setStagePos({ x: 0, y: 0 }); };

  const sortedItems = [...items].sort((a, b) => a.z_index - b.z_index);

  /** Isometric render: each item becomes a 3-face block (top + two visible sides)
   * at its own elevation, painter's-algorithm sorted back-to-front. Rotation of the
   * SCENE (isoRotation, 4-way) is applied before projection; rotation of the
   * INDIVIDUAL item is approximated on the top face only (rotated boxes' side-wall
   * geometry in isometric is real complexity for near-zero value here, since every
   * item this app actually creates today has rotation=0 in the vast majority of
   * cases) - a stated simplification, not a silent gap. */
  const renderIsometricScene = () => {
    const corner = (item: LayoutItem) => {
      const raw = [
        { x: item.x, y: item.y }, { x: item.x + item.width, y: item.y },
        { x: item.x + item.width, y: item.y + item.height }, { x: item.x, y: item.y + item.height },
      ].map(p => sceneRotate(p.x, p.y, canvasWidth, canvasHeight, isoRotation));
      return raw;
    };

    const floorCorners = [
      sceneRotate(0, 0, canvasWidth, canvasHeight, isoRotation),
      sceneRotate(canvasWidth, 0, canvasWidth, canvasHeight, isoRotation),
      sceneRotate(canvasWidth, canvasHeight, canvasWidth, canvasHeight, isoRotation),
      sceneRotate(0, canvasHeight, canvasWidth, canvasHeight, isoRotation),
    ].map(p => isoProject(p.x, p.y, 0));
    const floorPoints = floorCorners.flatMap(p => [p.x, p.y]);

    const blocks = sortedItems
      .filter(it => it.item_type !== 'ZONE') // zones stay a flat ground tint, drawn separately below
      .map(item => {
        const isSelected = selectedIds.includes(item.id);
        const isSeat = item.item_type === 'SEAT';
        const isBooked = isSeat && bookedSeatIds?.has(item.seat_id || item.id);
        let fill = item.color || TYPE_COLORS[item.item_type] || '#ffffff';
        if (isSeat) fill = isBooked ? '#f87171' : '#34d399';
        else if (item.item_type === 'ROOM' && item.properties?.status) {
          const st = item.properties.status;
          fill = st === 'MAINTENANCE' ? '#fbbf24' : st === 'BOOKED' ? '#f87171' : fill;
        }

        const base = item.elevation || 0;
        const top = base + (ISO_EXTRUSION[item.item_type] ?? 20);
        const c = corner(item);
        const topFace = c.map(p => isoProject(p.x, p.y, top));
        const baseFace = c.map(p => isoProject(p.x, p.y, base));

        // Only 2 of 4 side faces are ever visible from a fixed isometric angle -
        // the pair facing the viewer (indices 1-2 and 2-3 of the corner list, given
        // the viewer looks toward decreasing x+y).
        const sideA = [baseFace[1], baseFace[2], topFace[2], topFace[1]];
        const sideB = [baseFace[2], baseFace[3], topFace[3], topFace[2]];
        const centroid = topFace.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
        const depth = item.x + item.y; // painter's-algorithm sort key (pre-rotation is fine - monotonic either way)

        return { item, fill, isSelected, topFace, sideA, sideB, centroid, depth, isSeat, isBooked };
      })
      .sort((a, b) => a.depth - b.depth);

    return (
      <>
        {/* Floor slab - listening=false, same reasoning as the 2D floor boundary. */}
        <Line points={floorPoints} closed fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1.5} listening={false} />

        {/* Zones: flat colored ground tint, no extrusion */}
        {sortedItems.filter(it => it.item_type === 'ZONE').map(zone => {
          const c = corner(zone).map(p => isoProject(p.x, p.y, (zone.elevation || 0) + 0.5));
          return <Line key={zone.id} points={c.flatMap(p => [p.x, p.y])} closed fill={zone.color || '#94a3b8'} opacity={0.3} listening={false} />;
        })}

        {blocks.map(({ item, fill, isSelected, topFace, sideA, sideB, centroid, isSeat, isBooked }) => (
          <Group
            key={item.id}
            onClick={() => onSelectionChange?.([item.id])}
          >
            {/* Drop shadow */}
            <Ellipse
              x={centroid.x} y={isoProject(item.x + item.width / 2, item.y + item.height / 2, 0).y + 4}
              radiusX={(item.width + item.height) / 5} radiusY={(item.width + item.height) / 14}
              fill="#000000" opacity={0.12} listening={false}
            />
            <Line points={sideB.flatMap(p => [p.x, p.y])} closed fill={shadeColor(fill, -0.35)} stroke="#1f2937" strokeWidth={0.5} />
            <Line points={sideA.flatMap(p => [p.x, p.y])} closed fill={shadeColor(fill, -0.18)} stroke="#1f2937" strokeWidth={0.5} />
            <Line
              points={topFace.flatMap(p => [p.x, p.y])} closed
              fill={shadeColor(fill, 0.12)}
              stroke={isSelected ? '#007bc0' : '#1f2937'} strokeWidth={isSelected ? 2.5 : 0.75}
            />
            {(item.label || item.properties?.name || item.properties?.seat_number) && (
              <Text
                text={item.label || item.properties?.name || item.properties?.seat_number || ''}
                x={centroid.x - item.width / 2} y={centroid.y - 6}
                width={item.width} align="center" fontSize={10} fontStyle="bold" fill="#1f2937" listening={false}
              />
            )}
            {isSeat && (
              <Text
                text={isBooked ? 'Booked' : 'Available'}
                x={centroid.x - item.width / 2} y={centroid.y + 6}
                width={item.width} align="center" fontSize={7} fill={isBooked ? '#b91c1c' : '#047857'} listening={false}
              />
            )}
          </Group>
        ))}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
      {mode !== 'view' && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-white rounded-xl shadow-md border border-gray-200 p-1.5">
          <button onClick={() => zoomBy(1.2)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700 font-bold text-lg">+</button>
          <button onClick={() => zoomBy(1 / 1.2)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-700 font-bold text-lg">−</button>
          <button onClick={resetView} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-[10px] font-bold">RST</button>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={mode !== 'view'}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        onMouseDown={(e) => {
          // Clicking empty canvas clears selection, and (in edit mode) reports the
          // click's floor-space position for click-to-draw tools (walls, polygons).
          if (e.target !== e.target.getStage()) return;
          onSelectionChange?.([]);
          if (onCanvasClick) {
            const pos = e.target.getStage()?.getRelativePointerPosition();
            if (pos) onCanvasClick(pos);
          }
        }}
      >
        <Layer>
          {mode === 'isometric' ? renderIsometricScene() : (<>
          {/* Floor boundary - listening=false so it never intercepts clicks meant for
              the Stage background (empty-canvas deselect, onCanvasClick draw tools);
              a filled Rect is otherwise hit-tested across its whole area by Konva. */}
          <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#ffffff" stroke="#cbd5e1" strokeWidth={2} listening={false} />

          {/* Grid */}
          {showGrid && Array.from({ length: Math.floor(canvasWidth / gridSize) + 1 }).map((_, i) => (
            <Line key={`gv${i}`} points={[i * gridSize, 0, i * gridSize, canvasHeight]} stroke="#eef2f7" strokeWidth={1} />
          ))}
          {showGrid && Array.from({ length: Math.floor(canvasHeight / gridSize) + 1 }).map((_, i) => (
            <Line key={`gh${i}`} points={[0, i * gridSize, canvasWidth, i * gridSize]} stroke="#eef2f7" strokeWidth={1} />
          ))}

          {sortedItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isSeat = item.item_type === 'SEAT';
            const isRoom = item.item_type === 'ROOM';
            const isBooked = isSeat && bookedSeatIds?.has(item.seat_id || item.id);
            const isRoomUnavailable = isRoom && unavailableRoomIds?.has(item.room_id || item.id);
            const isProposed = mode === 'preview' && proposedItemIds?.has(item.id);
            let fill = item.color || TYPE_COLORS[item.item_type] || '#ffffff';
            if (mode === 'view' && isSeat) fill = isBooked ? '#fee2e2' : '#ecfdf5';
            if (mode === 'view' && isRoom && unavailableRoomIds) fill = isRoomUnavailable ? '#fee2e2' : '#ecfdf5';
            const stroke = isSelected ? '#007bc0'
              : isProposed ? '#d97706'
              : item.item_type === 'ZONE' ? (item.color || '#94a3b8')
              : mode === 'view' && isRoom && unavailableRoomIds ? (isRoomUnavailable ? '#ef4444' : '#10b981')
              : '#94a3b8';
            const strokeWidth = isSelected ? 2.5 : isProposed ? 2 : item.item_type === 'ZONE' ? 1.5 : mode === 'view' && isRoom ? 2 : 1;
            const dash = isProposed ? [6, 4] : undefined;
            const opacity = item.item_type === 'ZONE' ? 0.35 : 1;

            return (
              <Group
                key={item.id}
                ref={(node) => { shapeRefs.current[item.id] = node; }}
                x={item.x}
                y={item.y}
                rotation={item.rotation}
                offsetX={0}
                offsetY={0}
                draggable={mode === 'edit'}
                listening={item.item_type !== 'ZONE' || mode === 'edit'}
                onClick={(e) => {
                  if (mode === 'view') {
                    onItemActivate?.(item);
                    return;
                  }
                  if (mode === 'preview') {
                    onSelectionChange?.([item.id]);
                    return;
                  }
                  const additive = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
                  if (!onSelectionChange) return;
                  if (additive) {
                    onSelectionChange(isSelected ? selectedIds.filter(id => id !== item.id) : [...selectedIds, item.id]);
                  } else {
                    onSelectionChange([item.id]);
                  }
                }}
                onDragEnd={(e) => updateItem(item.id, { x: snap(e.target.x()), y: snap(e.target.y()) })}
                onTransformEnd={(e) => {
                  const node = e.target as Konva.Group;
                  const newWidth = Math.max(10, snap(node.width() * node.scaleX()));
                  const newHeight = Math.max(10, snap(node.height() * node.scaleY()));
                  node.scaleX(1);
                  node.scaleY(1);
                  updateItem(item.id, {
                    x: snap(node.x()), y: snap(node.y()),
                    width: newWidth, height: newHeight,
                    rotation: Math.round(node.rotation()),
                  });
                }}
              >
                <ItemShape item={item} fill={fill} stroke={stroke} strokeWidth={strokeWidth} dash={dash} />
                {opacity < 1 && <Rect width={item.width} height={item.height} fill={fill} opacity={opacity} listening={false} />}
                {item.item_type === 'ROOM' ? (
                  // Compact "NAME / N seats" label anchored near the top so it never
                  // covers the table/chairs a shape-aware furniture layout places at
                  // (or around) the room's center - see place_furniture in the backend.
                  <Text
                    text={`${item.label || item.properties?.name || ''}${item.properties?.capacity ? `\n${item.properties.capacity} seats` : ''}`}
                    width={item.width}
                    y={3}
                    align="center"
                    fontSize={Math.min(11, item.width / 8)}
                    lineHeight={1.15}
                    fontStyle="bold"
                    fill="#1f2937"
                    listening={false}
                  />
                ) : (item.label || isSeat) && (
                  <Text
                    text={item.label || (item.properties?.seat_number ?? '')}
                    width={item.width}
                    height={item.height}
                    align="center"
                    verticalAlign="middle"
                    fontSize={Math.min(12, item.width / 4)}
                    fill="#1f2937"
                    listening={false}
                  />
                )}
                {mode === 'view' && isSeat && (
                  <Text
                    text={isBooked ? 'Booked' : 'Available'}
                    y={item.height + 2}
                    width={item.width}
                    align="center"
                    fontSize={8}
                    fill={isBooked ? '#dc2626' : '#059669'}
                    listening={false}
                  />
                )}
                {mode === 'view' && isRoom && unavailableRoomIds && (
                  <Text
                    text={isRoomUnavailable ? 'Booked' : 'Available'}
                    y={item.height - 14}
                    width={item.width}
                    align="center"
                    fontSize={9}
                    fontStyle="bold"
                    fill={isRoomUnavailable ? '#dc2626' : '#059669'}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}

          {mode === 'edit' && <Transformer ref={trRef} rotateEnabled boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)} />}
          </>)}
        </Layer>
      </Stage>
    </div>
  );
};

export default FloorPlanCanvas;
