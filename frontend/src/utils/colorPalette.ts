export interface LyricsPalette {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  shadow: string;
}

const fallbackPalette: LyricsPalette = {
  background: "color-mix(in srgb, var(--first-color) 34%, #080b0c)",
  foreground: "#fff7ed",
  muted: "rgba(255, 247, 237, 0.58)",
  accent: "var(--first-color)",
  shadow: "rgba(0, 0, 0, 0.42)",
};

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function luminance(red: number, green: number, blue: number) {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function rgb(red: number, green: number, blue: number) {
  return `rgb(${Math.round(clamp(red))} ${Math.round(clamp(green))} ${Math.round(clamp(blue))})`;
}

function lift(red: number, green: number, blue: number, amount: number): [number, number, number] {
  return [
    red + (255 - red) * amount,
    green + (255 - green) * amount,
    blue + (255 - blue) * amount,
  ];
}

function deepen(red: number, green: number, blue: number, amount: number): [number, number, number] {
  return [red * amount, green * amount, blue * amount];
}

export function getFallbackLyricsPalette() {
  return fallbackPalette;
}

export async function extractLyricsPalette(imageUrl: string): Promise<LyricsPalette> {
  const image = new Image();
  image.decoding = "async";
  image.src = imageUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  const size = 72;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return fallbackPalette;
  }

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 24) {
      continue;
    }
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }

  if (count === 0) {
    return fallbackPalette;
  }

  red /= count;
  green /= count;
  blue /= count;

  const isLight = luminance(red, green, blue) > 0.42;
  const background = isLight ? deepen(red, green, blue, 0.72) : lift(red, green, blue, 0.08);
  const accent = isLight ? deepen(red, green, blue, 0.45) : lift(red, green, blue, 0.42);
  const foreground = luminance(...background) > 0.36 ? "#11130f" : "#fffaf2";
  const muted =
    foreground === "#11130f" ? "rgba(17, 19, 15, 0.58)" : "rgba(255, 250, 242, 0.56)";

  return {
    background: rgb(...background),
    foreground,
    muted,
    accent: rgb(...accent),
    shadow: foreground === "#11130f" ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.48)",
  };
}
