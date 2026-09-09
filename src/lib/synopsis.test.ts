import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanSynopsis, synopsisFitsHero } from "./synopsis.ts";

const plot =
  "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family's future.";

describe("cleanSynopsis", () => {
  it("leaves a normal Cinemeta plot alone", () => {
    assert.equal(cleanSynopsis(plot), plot);
  });

  it("drops a duplicated paragraph", () => {
    assert.equal(cleanSynopsis(`${plot}\n\n${plot}`), plot);
  });

  it("drops the same plot concatenated twice", () => {
    assert.equal(cleanSynopsis(`${plot} ${plot}`), plot);
  });

  it("drops a repeated last sentence", () => {
    assert.equal(cleanSynopsis(`${plot} ${plot}`), plot);
  });

  it("does not treat two different sentences as a duplicate", () => {
    const text = "Winter is coming. The night is dark and full of terrors.";
    assert.equal(cleanSynopsis(text), text);
  });
});

describe("synopsisFitsHero", () => {
  it("treats short Cinemeta plots as already shown on the billboard", () => {
    assert.equal(synopsisFitsHero(plot), true);
  });
});
