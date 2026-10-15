export function centeredLyricScroll(
  scrollTop: number,
  viewportTop: number,
  viewportHeight: number,
  lineTop: number,
  lineHeight: number,
) {
  return Math.max(
    0,
    scrollTop + lineTop - viewportTop - (viewportHeight - lineHeight) / 2,
  );
}
