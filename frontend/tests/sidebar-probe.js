// Run in the live app after scrolling the library. This measures painted geometry,
// since server rendering and Node-only tests cannot reproduce CSS clipping.
(() => {
  const area = document.querySelector(".sidebar-library");
  if (!area || getComputedStyle(area).display === "none")
    return { hidden: true };
  const header =
    area.querySelector(".sidebar-library-heading") ?? area.firstElementChild;
  const list = area.querySelector(".sidebar-song-list");
  const a = area.getBoundingClientRect(),
    h = header.getBoundingClientRect();
  const leaks = document
    .elementsFromPoint(a.left + 26, h.top - 3)
    .some((element) => element.closest(".library-mini"));
  if (leaks)
    throw new Error(
      "REGRESSION: a song paints above the Your music header after scrolling",
    );
  if (!list)
    throw new Error("REGRESSION: the library header shares the song scroller");
  const l = list.getBoundingClientRect();
  if (h.bottom > l.top + 1)
    throw new Error("REGRESSION: library header overlaps the song viewport");
  const first = list.querySelector(".library-mini");
  if (first && l.height < first.getBoundingClientRect().height)
    throw new Error(
      "REGRESSION: short desktop height leaves no complete song row",
    );
  const sidebar = area.closest(".studio-sidebar");
  if (sidebar.scrollHeight > sidebar.clientHeight + 1)
    throw new Error(
      "REGRESSION: nested sidebar scrolling clips navigation or Settings",
    );
  return {
    passed: true,
    headerBottom: h.bottom,
    listTop: l.top,
    listHeight: l.height,
    scrollTop: list.scrollTop,
  };
})();
