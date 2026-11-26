import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { uiDisplay, applyUiDisplay } from "./ui-display.js";

describe("uiDisplay", () => {
  const saved = { DISPLAY: process.env.DISPLAY, NODEOS_UI_DISPLAY: process.env.NODEOS_UI_DISPLAY };

  beforeEach(() => {
    delete process.env.DISPLAY;
    delete process.env.NODEOS_UI_DISPLAY;
  });
  afterEach(() => {
    if (saved.DISPLAY === undefined) delete process.env.DISPLAY;
    else process.env.DISPLAY = saved.DISPLAY;
    if (saved.NODEOS_UI_DISPLAY === undefined) delete process.env.NODEOS_UI_DISPLAY;
    else process.env.NODEOS_UI_DISPLAY = saved.NODEOS_UI_DISPLAY;
  });

  it("uses NODEOS_UI_DISPLAY when set", () => {
    process.env.DISPLAY = ":10.0";
    process.env.NODEOS_UI_DISPLAY = ":0";
    assert.equal(uiDisplay(), ":0");
  });

  it("points xrdp :10 at Plasma :0", () => {
    process.env.DISPLAY = ":10.0";
    assert.equal(uiDisplay(), ":0");
    process.env.DISPLAY = ":10";
    assert.equal(uiDisplay(), ":0");
  });

  it("keeps an already-Plasma DISPLAY", () => {
    process.env.DISPLAY = ":0";
    assert.equal(uiDisplay(), ":0");
    process.env.DISPLAY = ":0.0";
    assert.equal(uiDisplay(), ":0.0");
  });

  it("defaults to :0 when DISPLAY is unset", () => {
    assert.equal(uiDisplay(), ":0");
  });

  it("applyUiDisplay sets process.env so child launches follow", () => {
    process.env.DISPLAY = ":10.0";
    applyUiDisplay();
    assert.equal(process.env.DISPLAY, ":0");
    assert.equal(process.env.NODEOS_UI_DISPLAY, ":0");
  });
});
