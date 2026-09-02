# Quick Start: C++ Binding Autogen

This tool generates the N-API binding code and TypeScript declarations that keep the Node.js
SDK aligned with the C++ core.

> **IMPORTANT**: Autogen is only needed by maintainers of the library.  If you are not changing
> the core bindings, you should never have to run it.

For the full reference — configuration, architecture, extensibility — see
[README.md](README.md).  For environment setup, see [BUILDING.md](../../BUILDING.md).

## Prerequisites

- Python 3.9+
- LLVM/Clang (macOS: `brew install llvm`)
- `clang-format` and `prettier` on `PATH` (see [Formatting](#formatting) below)
- Dependencies installed: `pip install -r tools/autogen/tools_requirements.txt`
- The C++ core submodule checked out: `git submodule update --init --recursive deps/couchbase-cxx-client`
- The CPM cache populated: `npm run prebuild -- --configure --set-cpm-cache --use-boringssl`
  (see [BUILDING doc](../../BUILDING.md))

## Basic Usage

All commands run from the **repository root**.

```bash
python -m tools.autogen bindings generate
```

Or through npm:

```bash
npm run gen:bindings
```

A run that changes nothing should leave `git status` clean:

```bash
git status --short -- lib src
```

## Common Tasks

### Dry Run
Find out whether a regeneration would change anything, without modifying the working tree:

```bash
python -m tools.autogen bindings generate --dry-run
```

This generates and formats for real and then puts every file back, so it reports the answer a
real run would give rather than an approximation of one.

### Check (CI)
The same measurement, but it exits non-zero when the committed bindings are out of date:

```bash
npm run gen:bindings:check
```

### Use a Specific LLVM Version
If you have several versions of LLVM installed:

```bash
python -m tools.autogen bindings generate --llvm-version 18
```

### Verbose Logging
Detailed parser and clang output, for troubleshooting a C++ parsing issue:

```bash
python -m tools.autogen bindings generate --verbose
```

### Inspect a Struct
When a generated binding looks wrong or empty, dump what the libclang pass actually sees.
This renders nothing and writes no files:

```bash
# by name - fully-qualified, leaf, or substring
python -m tools.autogen bindings inspect --type query_request

# everything declared in one header
python -m tools.autogen bindings inspect --header core/operations/document_get.hxx
```

A struct reported as `(no fields)` means the parser mis-read the header.

## Formatting

The generator renders unformatted code, so generation finishes by running `clang-format` over
the C++ files and `prettier` over `lib/binding.ts`.  Both must be on `PATH`.

On macOS, make sure LLVM's `clang-format` is the one found — not Apple's:

```bash
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

If generation and formatting were done by hand, the same tail runs on its own.  It parses
nothing and needs no LLVM:

```bash
npm run gen:bindings:tidy
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `N validation error(s); nothing was generated` | The C++ core changed a declaration and the parser mis-read it.  Run `bindings inspect --type <name>`. |
| `no formatter configured for .<ext>` | A new generated file has a suffix missing from `format.formatters` in `config/bindings.yaml`. |
| `formatter not found on PATH: clang-format` | LLVM is not on `PATH` — see [Formatting](#formatting). |
| libclang load or parse errors | The pip `clang` package is newer than the system LLVM.  `brew upgrade llvm`, or pin a matching pip package. |
| A no-op run still shows modified files | Formatting was skipped.  Run `bindings tidy`. |
| `alternative(s) with no configured tag` | The C++ core added or renamed a `std::variant` alternative.  Update that variant's `alternatives` in `renderer.cpp_core_variants`. |
| `warning: ... untagged std::variant` | A new `std::variant` field can be tagged but has no `renderer.cpp_core_variants` entry.  Marshalling it from JS throws until it gets one. |

## Help

For a full list of options:

```bash
python -m tools.autogen bindings generate --help
```
