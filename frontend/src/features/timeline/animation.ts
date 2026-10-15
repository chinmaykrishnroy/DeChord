/** Read the media clock on every paint without rerendering the workspace. */
export function animateTimeline(
  readTime: () => number,
  draw: (time: number) => void,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
) {
  let frame = 0;
  const paint = () => {
    draw(readTime());
    frame = requestFrame(paint);
  };
  frame = requestFrame(paint);
  return () => cancelFrame(frame);
}
