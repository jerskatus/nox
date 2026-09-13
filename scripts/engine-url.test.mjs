import assert from "node:assert/strict";
import { jobIdFromUrl } from "../desktop/media-url.mjs";

assert.equal(jobIdFromUrl("http://127.0.0.1:17866/v/abc123def456.mp4"), "abc123def456");
assert.equal(jobIdFromUrl("http://127.0.0.1:17866/v/abc123def456"), "abc123def456");
assert.equal(jobIdFromUrl("noxmedia://v/abc123def456"), "abc123def456");
assert.equal(jobIdFromUrl("/v/zz99.mp4"), "zz99");
assert.equal(jobIdFromUrl("http://127.0.0.1:17866/v/abc?range=0"), "abc");
console.log("engine-url tests passed");
