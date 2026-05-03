import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinSanityBand, SANITY_BAND } from '../src/sanity.js';

describe('isWithinSanityBand', () => {
  it('default band is 20%', () => {
    assert.equal(SANITY_BAND, 0.2);
  });

  it('accepts candidate within ±20%', () => {
    assert.equal(isWithinSanityBand(2200, 2000), true);
    assert.equal(isWithinSanityBand(1800, 2000), true);
    assert.equal(isWithinSanityBand(2400, 2000), true);
    assert.equal(isWithinSanityBand(1600, 2000), true);
  });

  it('rejects candidate outside ±20%', () => {
    assert.equal(isWithinSanityBand(2401, 2000), false);
    assert.equal(isWithinSanityBand(1599, 2000), false);
    assert.equal(isWithinSanityBand(4000, 2000), false);
  });

  it('accepts any positive candidate when reference is invalid', () => {
    assert.equal(isWithinSanityBand(2000, 0), true);
    assert.equal(isWithinSanityBand(2000, NaN), true);
  });

  it('rejects non-finite or non-positive candidate regardless of reference', () => {
    assert.equal(isWithinSanityBand(NaN, 2000), false);
    assert.equal(isWithinSanityBand(0, 2000), false);
    assert.equal(isWithinSanityBand(-100, 2000), false);
  });

  it('respects custom band', () => {
    assert.equal(isWithinSanityBand(2050, 2000, 0.05), true);
    assert.equal(isWithinSanityBand(2150, 2000, 0.05), false);
  });
});
