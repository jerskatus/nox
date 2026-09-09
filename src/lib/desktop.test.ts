import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { updateStatusLabel } from "./desktop.ts";

describe("updateStatusLabel", () => {
  it("prefers an explicit message", () => {
    assert.equal(updateStatusLabel({ status: "error", message: " Feed down. " }), "Feed down.");
  });

  it("labels a check in progress", () => {
    assert.equal(updateStatusLabel({ status: "checking" }), "Checking for updates…");
  });

  it("labels a ready install", () => {
    assert.equal(updateStatusLabel({ status: "ready", version: "1.3.5" }), "Nox 1.3.5 is ready to install.");
  });

  it("stays quiet before a check", () => {
    assert.equal(updateStatusLabel({ status: "idle" }), "");
  });
});
