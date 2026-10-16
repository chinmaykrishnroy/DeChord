import type { ResponsiveLayouts } from "react-grid-layout";
import { moveElement, verticalCompactor } from "react-grid-layout/core";
export const widgetNames = {
  guitar: "Guitar fretboard",
  piano: "Piano keys",
  lyrics: "Synced lyrics",
  chords: "Chord sheet",
  analysis: "Analysis",
} as const;
export type WidgetId = keyof typeof widgetNames;
export function moveWidget(
  layout: NonNullable<ResponsiveLayouts[string]>,
  id: WidgetId,
  key: string,
  cols: number,
) {
  const copied = layout.map((item) => ({ ...item }));
  const item = copied.find((item) => item.i === id);
  if (!item) return layout;
  const x = Math.max(
    0,
    Math.min(
      cols - item.w,
      item.x +
        (key === "ArrowRight" ? item.w : key === "ArrowLeft" ? -item.w : 0),
    ),
  );
  const y = Math.max(
    0,
    item.y + (key === "ArrowDown" ? item.h : key === "ArrowUp" ? -item.h : 0),
  );
  return verticalCompactor.compact(
    moveElement(copied, item, x, y, true, false, "vertical", cols),
    cols,
  );
}
export const allWidgets = Object.keys(widgetNames) as WidgetId[];
const sizes: Record<WidgetId, [number, number]> = {
  guitar: [8, 9],
  piano: [8, 6],
  lyrics: [4, 15],
  chords: [8, 7],
  analysis: [4, 7],
};
export function defaultLayouts(): ResponsiveLayouts {
  return {
    lg: [
      { i: "guitar", x: 0, y: 0, w: 8, h: 9, minW: 4, minH: 9 },
      { i: "piano", x: 0, y: 9, w: 8, h: 6, minW: 4, minH: 6 },
      { i: "lyrics", x: 8, y: 0, w: 4, h: 15, minW: 3, minH: 8 },
      { i: "chords", x: 0, y: 15, w: 8, h: 7, minW: 3, minH: 6 },
      { i: "analysis", x: 8, y: 15, w: 4, h: 7, minW: 3, minH: 6 },
    ],
    md: [
      { i: "guitar", x: 0, y: 0, w: 5, h: 9, minW: 4, minH: 9 },
      { i: "piano", x: 0, y: 9, w: 5, h: 6, minW: 4, minH: 6 },
      { i: "lyrics", x: 5, y: 0, w: 3, h: 15, minW: 3, minH: 8 },
      { i: "chords", x: 0, y: 15, w: 5, h: 7, minW: 3, minH: 6 },
      { i: "analysis", x: 5, y: 15, w: 3, h: 7, minW: 3, minH: 6 },
    ],
    sm: ["guitar", "lyrics", "piano", "chords", "analysis"].map((i, index) => ({
      i,
      x: 0,
      y: index * 12,
      w: 1,
      h: i === "guitar" ? 12 : i === "lyrics" ? 12 : 8,
      minW: 1,
      minH: i === "guitar" ? 10 : 6,
    })),
  };
}
export interface WorkspaceLayout {
  visible: WidgetId[];
  layouts: ResponsiveLayouts;
}
export function mergeLayouts(
  previous: ResponsiveLayouts,
  next: ResponsiveLayouts,
): ResponsiveLayouts {
  return Object.fromEntries(
    Object.entries({ ...previous, ...next }).map(([bp, items]) => [
      bp,
      [
        ...new Map(
          [...(previous[bp] ?? []), ...(items ?? [])].map((item) => [
            item.i,
            item,
          ]),
        ).values(),
      ],
    ]),
  );
}
export function readLayout(raw: string | null): WorkspaceLayout {
  const fallback = {
    visible: ["guitar", "lyrics", "piano", "chords", "analysis"] as WidgetId[],
    layouts: defaultLayouts(),
  };
  try {
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    if (data.version !== 2 || !Array.isArray(data.visible) || !data.layouts)
      return fallback;
    const visible = [
      ...new Set<WidgetId>(
        data.visible.filter(
          (i: unknown) =>
            typeof i === "string" && allWidgets.includes(i as WidgetId),
        ),
      ),
    ];
    const layouts: ResponsiveLayouts = {};
    for (const [bp, cols] of Object.entries({ lg: 12, md: 8, sm: 1 })) {
      const items = data.layouts[bp];
      if (!Array.isArray(items)) return fallback;
      layouts[bp] = items
        .filter((i: { i: WidgetId }) => allWidgets.includes(i.i))
        .map((item: Record<string, unknown>) => {
          if (
            !["x", "y", "w", "h"].every(
              (k) =>
                typeof item[k] === "number" &&
                Number.isFinite(item[k]) &&
                Number(item[k]) >= 0,
            )
          )
            throw new Error("Invalid layout");
          const w = Math.max(1, Math.min(cols, Number(item.w)));
          const minH =
            item.i === "guitar"
              ? 9
              : item.i === "piano"
                ? 5
                : item.i === "lyrics"
                  ? 8
                  : 6;
          return {
            i: String(item.i),
            x: Math.max(0, Math.min(cols - w, Number(item.x))),
            y: Number(item.y),
            w,
            h: Math.max(minH, Math.min(40, Number(item.h))),
            minW: cols === 1 ? 1 : 3,
            minH,
          };
        });
    }
    return { visible, layouts };
  } catch {
    return fallback;
  }
}
export function addWidget(
  state: WorkspaceLayout,
  id: WidgetId,
): WorkspaceLayout {
  const layouts = { ...state.layouts };
  for (const [bp, cols] of Object.entries({ lg: 12, md: 8, sm: 1 }))
    if (!layouts[bp]?.some((i) => i.i === id)) {
      const list = layouts[bp] ?? [];
      layouts[bp] = [
        ...list,
        {
          i: id,
          x: 0,
          y: Math.max(0, ...list.map((i) => i.y + i.h)),
          w: Math.min(cols, sizes[id][0]),
          h: bp === "sm" && id === "guitar" ? 15 : sizes[id][1],
          minW: cols === 1 ? 1 : 3,
          minH:
            id === "guitar" ? 10 : id === "piano" ? 6 : id === "lyrics" ? 8 : 6,
        },
      ];
    }
  return { layouts, visible: [...new Set([...state.visible, id])] };
}
