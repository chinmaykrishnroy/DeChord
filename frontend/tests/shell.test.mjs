import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AppLogo } from "../src/app/shell/AppLogo.tsx";

test("the titlebar logo has bounded intrinsic dimensions even before CSS loads", () => {
  const markup = renderToStaticMarkup(createElement(AppLogo));
  const width = Number(markup.match(/width="(\d+)"/)?.[1]);
  const height = Number(markup.match(/height="(\d+)"/)?.[1]);
  assert.ok(width > 0 && width <= 32 && height > 0 && height <= 32, markup);
});
