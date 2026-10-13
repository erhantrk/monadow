import { describe, expect, it } from 'vitest';
import { VALID_SCHEME_ID, checkStealthAddress as slCheck, computeStealthKey, generateStealthAddress as slGenerate } from '@scopelift/stealth-address-sdk';
import { generatePrivateKey } from 'viem/accounts';
import { hexToBytes } from 'viem';
import { checkStealthAddress, computeStealthPrivateKey, deriveMonadowKeys, generateStealthAddress } from '../src/index.js';

describe('cross-check vs ScopeLift ERC-5564 reference SDK (scheme 1)', () => {
  it('identical stealth address, view tag, ephemeral key and stealth private key', () => {
    for (let i = 0; i < 25; i++) {
      const k = deriveMonadowKeys(crypto.getRandomValues(new Uint8Array(32)));
      const r = generatePrivateKey();
      const ours = generateStealthAddress(k.metaAddress, r);
      const uri = `st:eth:${k.metaAddress.slice('st:monad:'.length)}`;
      const theirs = slGenerate({ stealthMetaAddressURI: uri, schemeId: VALID_SCHEME_ID.SCHEME_ID_1, ephemeralPrivateKey: hexToBytes(r) });
      expect(ours).toEqual(theirs);
      const theirKey = computeStealthKey({
        viewingPrivateKey: k.viewingPrivateKey,
        spendingPrivateKey: k.spendingPrivateKey,
        ephemeralPublicKey: ours.ephemeralPublicKey,
        schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
      });
      expect(computeStealthPrivateKey(ours.ephemeralPublicKey, k.viewingPrivateKey, k.spendingPrivateKey)).toBe(theirKey.toLowerCase());
      // their generator → our checker
      const g2 = slGenerate({ stealthMetaAddressURI: uri, schemeId: VALID_SCHEME_ID.SCHEME_ID_1 });
      expect(checkStealthAddress(g2, k.viewingPrivateKey, k.spendingPublicKey)).toBe(true);
      expect(
        slCheck({
          userStealthAddress: ours.stealthAddress,
          viewTag: ours.viewTag,
          ephemeralPublicKey: ours.ephemeralPublicKey,
          spendingPublicKey: k.spendingPublicKey,
          viewingPrivateKey: k.viewingPrivateKey,
          schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
        }),
      ).toBe(true);
    }
  });
});
