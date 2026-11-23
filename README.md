# Tiny Stack VM

[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/lpy214/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/lpy214/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine for [make.fun](https://make.fun)'s "Build a tiny stack virtual machine, 22 November 2026" bounty.

`main.ts` runs every bytecode program in a set and writes each program's output and exit code: 32-bit wrapping integers, a 256-value data stack, a 64-deep call stack, 256 words of memory, at most 1,000,000 steps and 65,536 output bytes per program. All ten traps end the program with their own exit code.

## Run it

```sh
node main.ts
```

Reads `/input/<id>/{program,input}.bin`, writes `/output/<id>/{stdout.bin,exit.txt}`; override the directories with `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR`. Node 22+, no dependencies.
