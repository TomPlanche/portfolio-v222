// Timestamp Identifier (TID) generation for record keys.
//
// A TID is a 64-bit integer -- a reserved top bit (0), 53 bits of UNIX
// microseconds, and a 10-bit per-process clock identifier -- encoded as
// 13 characters of atproto's sortable base32 alphabet. `@atcute/lexicons`
// only validates the shape (`isTid`); it does not generate them, so this
// is a small local implementation rather than a dependency.
//
// https://atproto.com/specs/tid

import { isTid } from '@atcute/lexicons/syntax';

const S32_ALPHABET = '234567abcdefghijklmnopqrstuvwxyz';

/** `value`'s low 65 bits as 13 base32-sortable characters, most significant first. */
const encode = (value: bigint): string => {
  let out = '';

  for (let shift = 60n; shift >= 0n; shift -= 5n) {
    out += S32_ALPHABET[Number((value >> shift) & 0x1fn)];
  }

  return out;
};

// Random per process, so two processes minting a TID in the same
// microsecond still produce distinct keys.
const clockId = BigInt(Math.floor(Math.random() * 1024));

let lastMicros = 0n;

/** A new TID, guaranteed greater than every TID this process has minted before it. */
export const nextTid = (): string => {
  let micros = BigInt(Date.now()) * 1000n;

  if (micros <= lastMicros) {
    micros = lastMicros + 1n;
  }
  lastMicros = micros;

  const tid = encode((micros << 10n) | clockId);

  if (!isTid(tid)) {
    throw new Error(`generated an invalid TID: ${tid}`);
  }

  return tid;
};
