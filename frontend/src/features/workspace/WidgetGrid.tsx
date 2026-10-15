import { useEffect, useState, type ReactNode } from "react";
import { Grip, X } from "lucide-react";
import {
  Responsive,
  useContainerWidth,
  type ResponsiveLayouts,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  addWidget,
  allWidgets,
  defaultLayouts,
  readLayout,
  widgetNames,
  moveWidget,
  mergeLayouts,
  type WidgetId,
} from "./layout";
export function WidgetGrid({
  render,
  customizing,
  onCustomizing,
  hasLyrics,
}: {
  render: (id: WidgetId) => ReactNode;
  customizing: boolean;
  onCustomizing: (v: boolean) => void;
  hasLyrics: boolean;
}) {
  const [state, setState] = useState(() =>
    readLayout(localStorage.getItem("dechord.workspace.v2")),
  );
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const breakpoint = width >= 1000 ? "lg" : width >= 650 ? "md" : "sm";
  const shown = state.visible.filter(
    (id) => id !== "lyrics" || hasLyrics || customizing,
  );
  useEffect(() => {
    localStorage.setItem(
      "dechord.workspace.v2",
      JSON.stringify({ version: 2, ...state }),
    );
  }, [state]);
  function save(layouts: ResponsiveLayouts) {
    setState((old) => ({
      ...old,
      layouts: mergeLayouts(old.layouts, layouts),
    }));
  }
  function move(id: WidgetId, key: string) {
    const cols = breakpoint === "lg" ? 12 : breakpoint === "md" ? 8 : 1;
    setState((s) => ({
      ...s,
      layouts: {
        ...s.layouts,
        [breakpoint]: moveWidget(s.layouts[breakpoint] ?? [], id, key, cols),
      },
    }));
  }
  return (
    <>
      {customizing && (
        <div className="layout-editor">
          <div>
            <strong>Make room for your practice.</strong>
            <span>
              Drag a handle, resize a corner, or use arrow keys on a handle to
              move a widget.
            </span>
          </div>
          <div className="widget-picker">
            {allWidgets.map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={state.visible.includes(id)}
                  onChange={(e) =>
                    setState((s) =>
                      e.target.checked
                        ? addWidget(s, id)
                        : { ...s, visible: s.visible.filter((w) => w !== id) },
                    )
                  }
                />
                {widgetNames[id]}
              </label>
            ))}
          </div>
          <div>
            <button
              onClick={() =>
                setState({
                  visible: ["guitar", "lyrics", "piano", "chords", "analysis"],
                  layouts: defaultLayouts(),
                })
              }
            >
              Reset layout
            </button>
            <button
              className="button-primary"
              onClick={() => onCustomizing(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
      <div
        className={`widget-grid ${customizing ? "is-editing" : ""}`}
        ref={containerRef}
      >
        {mounted && (
          <Responsive
            width={width}
            breakpoints={{ lg: 1000, md: 650, sm: 0 }}
            cols={{ lg: 12, md: 8, sm: 1 }}
            layouts={Object.fromEntries(
              Object.entries(state.layouts).map(([bp, layout]) => [
                bp,
                layout?.filter((i) => shown.includes(i.i as WidgetId)),
              ]),
            )}
            rowHeight={22}
            margin={[10, 10]}
            containerPadding={[0, 0]}
            dragConfig={{
              enabled: customizing,
              handle: ".widget-drag",
              cancel: "button:not(.widget-drag),input,select,textarea",
            }}
            resizeConfig={{ enabled: customizing, handles: ["se"] }}
            onDragStop={(layout) =>
              save({ ...state.layouts, [breakpoint]: layout })
            }
            onResizeStop={(layout) =>
              save({ ...state.layouts, [breakpoint]: layout })
            }
          >
            {shown.map((id) => (
              <section
                className={`widget widget--${id}`}
                key={id}
                aria-label={widgetNames[id]}
                data-widget={id}
              >
                <header className="widget-header">
                  <div>
                    <span className="widget-dot" />
                    <h2>{widgetNames[id]}</h2>
                  </div>
                  {customizing ? (
                    <div>
                      <button
                        className="widget-drag icon-button"
                        aria-label={`Move ${widgetNames[id]}`}
                        onKeyDown={(e) => {
                          if (e.key.startsWith("Arrow")) {
                            e.preventDefault();
                            move(id, e.key);
                          }
                        }}
                      >
                        <Grip size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Hide ${widgetNames[id]}`}
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            visible: s.visible.filter((w) => w !== id),
                          }))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="widget-hint">
                      {id === "guitar"
                        ? "E A D G B e"
                        : id === "lyrics"
                          ? "Follow the song"
                          : ""}
                    </span>
                  )}
                </header>
                <div className="widget-content">{render(id)}</div>
              </section>
            ))}
          </Responsive>
        )}
        {!state.visible.length && (
          <div className="empty-state">
            <strong>A workspace of your own</strong>
            <p>Add a fretboard, lyrics, or timeline to get started.</p>
            <button onClick={() => onCustomizing(true)}>Add widgets</button>
          </div>
        )}
      </div>
    </>
  );
}
