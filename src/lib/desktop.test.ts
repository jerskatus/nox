import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyUpdateResult, updateStatusLabel } from "./desktop.ts";

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

describe("applyUpdateResult", () => {
  it("treats a silent idle result as up to date", () => {
    const next = applyUpdateResult(
      { status: "checking", message: "Checking for updates…" },
      { status: "idle" },
    );
    assert.equal(next.status, "idle");
    assert.equal(next.message, "Nox is up to date.");
  });

  it("keeps an explicit idle message", () => {
    const next = applyUpdateResult({ status: "checking" }, { status: "idle", message: "Already current." });
    assert.equal(next.message, "Already current.");
  });
});
