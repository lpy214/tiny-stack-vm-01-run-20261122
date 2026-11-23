// Tiny stack VM for make.fun's tiny stack ISA v1: 32-bit wrapping integers,
// a 256-value data stack, a 64-deep call stack, 256 words of memory, at most
// 1,000,000 steps and 65,536 output bytes per program. A trap ends the program
// at once; its code is the exit code and earlier output is kept.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Per-opcode [opcode, immediate bytes, popped, pushed]; an opcode missing
// here is unknown. Only HALT and RET have all-zero facts, so they double as
// the known-opcode test.
const T = [
  0,0,0,0, 1,1,0,1, 2,4,0,1, 3,0,1,0, 4,0,1,2, 5,0,2,2, 6,0,2,3, 7,0,3,3,
  16,0,2,1, 17,0,2,1, 18,0,2,1, 19,0,2,1, 20,0,2,1, 21,0,2,1, 22,0,2,1,
  23,0,1,1, 24,0,2,1, 25,0,2,1, 26,0,2,1, 27,0,1,1, 28,0,2,1, 29,0,2,1,
  30,0,2,1, 32,0,2,1, 33,0,2,1, 34,0,2,1, 48,2,0,0, 49,2,1,0, 50,2,1,0,
  51,2,0,0, 52,0,0,0, 64,0,1,1, 65,0,2,0, 80,0,1,0, 81,0,1,0, 82,0,0,1, 83,0,1,0,
];
const IMM = new Uint8Array(256), POP = new Uint8Array(256), PSH = new Uint8Array(256);
for (let i = 0; i < 148; i += 4) {
  const o = T[i];
  IMM[o] = T[i + 1]; POP[o] = T[i + 2]; PSH[o] = T[i + 3];
}
const enc = new TextEncoder();

function run(prog: Uint8Array, input: Uint8Array): { out: Uint8Array; code: number } {
  const n = prog.length;
  const st = new Int32Array(256), cs = new Int32Array(64), mem = new Int32Array(256);
  const out = new Uint8Array(65536);
  let sp = 0, cp = 0, ip = 0, pc = 0, steps = 0, len = 0;
  const end = (code: number) => ({ out: out.slice(0, len), code });

  for (;;) {
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = prog[pc];
    if (!IMM[op] && !POP[op] && !PSH[op] && op !== 0 && op !== 0x34) return end(5);
    const imm = IMM[op];
    if (pc + imm >= n) return end(9);
    steps++;
    const nx = pc + 1 + imm;
    if (sp < POP[op]) return end(2);
    if (sp - POP[op] + PSH[op] > 256) return end(3);
    pc = nx;
    switch (op) {
      case 0x00: return end(0);
      case 0x01: st[sp++] = (prog[nx - 1] << 24) >> 24; break;
      case 0x02:
        st[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24);
        break;
      case 0x03: sp--; break;
      case 0x04: st[sp] = st[sp - 1]; sp++; break;
      case 0x05: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 0x06: st[sp] = st[sp - 2]; sp++; break;
      case 0x07: { const a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break; }
      case 0x17: st[sp - 1] = -st[sp - 1] | 0; break;
      case 0x1b: st[sp - 1] = ~st[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = st[sp - 1], a = st[sp - 2];
        let r: number;
        switch (op) {
          case 0x10: r = (a + b) | 0; break;
          case 0x11: r = (a - b) | 0; break;
          case 0x12: r = Math.imul(a, b); break;
          case 0x13:
            if (b === 0) return end(4);
            r = a === -2147483648 && b === -1 ? a : (a / b) | 0; break;
          case 0x14:
            if (b === 0) return end(4);
            r = b === -1 ? 0 : (a % b) | 0; break;
          case 0x15:
            if (b === 0) return end(4);
            r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 0x16:
            if (b === 0) return end(4);
            r = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 0x18: r = a & b; break;
          case 0x19: r = a | b; break;
          case 0x1a: r = a ^ b; break;
          case 0x1c: r = a << (b & 31); break;
          case 0x1d: r = a >> (b & 31); break;
          case 0x1e: r = (a >>> (b & 31)) | 0; break;
          case 0x20: r = a === b ? 1 : 0; break;
          case 0x21: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        sp -= 2;
        st[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (op !== 0x30) { const v = st[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return end(7);
        cs[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return end(8);
        pc = cs[--cp];
        break;
      case 0x40: {
        const addr = st[sp - 1];
        if (addr < 0 || addr >= 256) return end(6);
        st[sp - 1] = mem[addr];
        break;
      }
      case 0x41: {
        const addr = st[sp - 1], v = st[sp - 2];
        if (addr < 0 || addr >= 256) return end(6);
        sp -= 2;
        mem[addr] = v;
        break;
      }
      case 0x50: {
        const bytes = enc.encode(String(st[sp - 1]));
        if (len + bytes.length > 65536) return end(11);
        sp--;
        out.set(bytes, len);
        len += bytes.length;
        break;
      }
      case 0x51:
        if (len + 1 > 65536) return end(11);
        out[len++] = st[--sp] & 255;
        break;
      case 0x52:
        st[sp++] = ip < input.length ? input[ip++] : -1;
        break;
      default:
        return end(st[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(
    new Uint8Array(readFileSync(join(I, id, 'program.bin'))),
    new Uint8Array(readFileSync(join(I, id, 'input.bin'))),
  );
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
