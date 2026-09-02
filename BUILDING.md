# Setup

Make sure to have cloned the [SDK repository](https://github.com/couchbase/couchnode.git) and have the submodules appropriately synced (`git submodule update --init --recursive`).

# Building

## Set CPM Cache
The C++ core utilizes the CMake Package Manager (CPM) to include depencies.  These can be set to a cache directory and can be used for future builds.  Periodically the dependencies should be updated.  So, in general it is good practice to configure the build environment by setting the CPM cache.

### Via npm command
```console
npm run prebuild -- --configure --set-cpm-cache --use-boringssl
```

### Available Options
>Note: Section under construction

### Via cmake-js

Set the cache directory `CXXCBC_CACHE_DIR`:
```console
export CXXCBC_CACHE_DIR=$PWD/deps/couchbase-cxx-cache
```

Remove the cache directory
```console
rm -rf $CXXCBC_CACHE_DIR
```

Configure the build:
```console
$ npx cmake-js configure \
--runtime node \
--runtime-version $(node --version) \
--CDUSE_STATIC_OPENSSL=OFF \
--CDCPM_DOWNLOAD_ALL=OFF \
--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON \
--CDCPM_USE_LOCAL_PACKAGES=OFF \
--CDCPM_SOURCE_CACHE=$CXXCBC_CACHE_DIR
```

## Build the client binary

### Via npm command
```console
npm run prebuild -- --use-boringssl
```

### Available Options
>Note: Section under construction

### Via cmake-js

>NOTE:  If using the `compile` command, the build will automatically clean and re-execute a build upon a failure.  Use the `build` command to only attempt a single build.

Set the cache directory (if it has not already been set) `CXXCBC_CACHE_DIR`:
```console
export CXXCBC_CACHE_DIR=$PWD/deps/couchbase-cxx-cache
```

```console
npx cmake-js compile \
--runtime node \
--runtime-version $(node --version) \
--CDUSE_STATIC_OPENSSL=OFF \
--CDCPM_DOWNLOAD_ALL=OFF \
--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON \
--CDCPM_USE_LOCAL_PACKAGES=OFF \
--CDCPM_SOURCE_CACHE=$CXXCBC_CACHE_DIR
```

# Autogen

>**IMPORTANT**: Autogen is only needed for maintainers of the library.  If not making updates to the core bindings, running the autogen tooling should *NOT* be required.

The generator parses the C++ core headers with libclang and writes the generated code into
the `//#region` blocks of `lib/binding.ts`, `src/connection.cpp`, `src/connection.hpp`,
`src/connection_autogen.cpp`, `src/constants.cpp` and `src/jstocbpp_autogen.hpp`.

What gets parsed and what gets emitted is configured in
[`tools/autogen/config/bindings.yaml`](tools/autogen/config/bindings.yaml) — adding a binding
should mean editing that file, not the generator.

If you have never run the tool before, start with
[`tools/autogen/QUICK_START.md`](tools/autogen/QUICK_START.md).
[`tools/autogen/README.md`](tools/autogen/README.md) is the full reference.

>**NOTE**: All autogen commands are run from the **repository root**.

## Prerequisites

The CPM cache must be populated first (see [Set CPM Cache](#set-cpm-cache)), and the C++ core
submodule must be checked out:
```console
git submodule update --init --recursive deps/couchbase-cxx-client
```

### Python Environment

>NOTE: Python >= 3.9 required

Setup virtual env:
```console
python3 -m venv <path to virtualenv>
```
Example: `python3 -m venv $(pwd)/couchnode`

Activate virtual env:
```console
source <path to virtualenv>/bin/activate
```
Example: `source $(pwd)/couchnode/bin/activate`

Install the tool requirements:
```console
python3 -m pip install -r tools/autogen/tools_requirements.txt
```

### LLVM

On macOS the tool locates LLVM automatically.  If your environment is non-standard, override
it with flags or environment variables:

```console
python3 -m tools.autogen bindings generate \
  --llvm-version $(llvm-config --version) \
  --llvm-includedir $(llvm-config --includedir) \
  --llvm-libdir $(llvm-config --libdir) \
  --system-headers $(xcrun --show-sdk-path)
```

Available environment variables:
- `CN_LLVM_VERSION`: LLVM version
- `CN_LLVM_INCLUDE`: LLVM include directory path
- `CN_LLVM_LIB`:  LLVM lib directory path
- `CN_SYS_HEADERS`: System headers path

>**NOTE**: The pip `clang` package binds to the system `libclang`.  If the pip package is newer
>than your system LLVM you may hit loading or parsing errors; the tool warns when it detects
>this.  Either `brew upgrade llvm` or install a matching pip package.

## Generate

```console
python3 -m tools.autogen bindings generate
```

Or, equivalently, `npm run gen:bindings`.  The npm scripts shell straight out to `python3`, so
the virtualenv still has to be active.

This parses the C++ core, renders the generated regions, then finishes with the post-processing
tail: format the generated files, and restore the ones that did not really change.
`clang-format` and `prettier` must be available (see
[Post-processing](#post-processing-formatting--churn) below).

To find out whether a regeneration would change anything without modifying the working tree:

```console
python3 -m tools.autogen bindings generate --dry-run
```

This does the real thing — generate and format — then puts every file back, so it reaches the
same answer as a real run rather than an approximation of one.

For CI, `--check` (or `npm run gen:bindings:check`) is the same measurement with an exit code:
non-zero when the committed bindings are out of date.

Add `--verbose` for detailed parser and clang output.  Use `--parse-only` to write just the
parsed type model (`tools/bindings.json`) without rendering.  `--no-format` and
`--no-restore-unchanged` opt out of the two post-processing steps individually; without
formatting the output will not match what is committed.

For a full list of options:
```console
python3 -m tools.autogen bindings generate --help
```

### If generation stops with validation errors

The parsed model is checked before anything is rendered.  Generation aborts, listing every
problem, if a struct parsed with no fields, a struct lost a field named under
`validation.required_fields` in the config, or an enum parsed with no values:

```console
  couchbase::core::operations::query_request: parsed with no fields
Error: 1 validation error(s); nothing was generated.
```

That almost always means the C++ core changed the shape of a declaration and the parser
mis-read it — see [Debugging a struct](#debugging-a-struct).  A struct that really is empty
belongs in `validation.allow_empty_fields`.

## Debugging a struct

When a generated binding looks wrong or empty, dump exactly what the libclang pass sees.  This
renders nothing and writes no files:

```console
# a single struct — fully-qualified name, leaf name, or substring
python3 -m tools.autogen bindings inspect --type couchbase::core::operations::query_request
python3 -m tools.autogen bindings inspect --type query_request

# several at once, as JSON
python3 -m tools.autogen bindings inspect --type query_request --type analytics_request --as-json

# everything declared in one header
python3 -m tools.autogen bindings inspect --header core/operations/document_get.hxx
```

A struct reported as `(no fields)` that should have fields means the parser mis-read the header
— most often because the C++ core changed the shape of the declaration.

## Post-Processing (formatting & churn)

`bindings generate` finishes with two extra steps:

1. **Format** — runs the formatter configured for each file suffix under `format.formatters`;
   today that is `clang-format` for the C++ files and `prettier` for `lib/binding.ts`.
2. **Restore unchanged** — restores any generated file whose only delta against `HEAD` is run
   metadata, so a regeneration that changes nothing leaves a clean `git status`.

On MacOS, make sure LLVM clang-format is used (configure the PATH appropriately):
```console
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

Opt out with `--no-format` and `--no-restore-unchanged`.  If generation and formatting were
done by hand, run the same tail on its own:

```console
python3 -m tools.autogen bindings tidy
```

Or `npm run gen:bindings:tidy`.

`tidy` parses nothing and needs no LLVM.  Any file that ends up byte-identical keeps its
original mtime, so a no-op regeneration does not trigger a rebuild.

## clean-up

### Remove the parsed type model

`tools/bindings.json` is an intermediate artifact and is gitignored.  It can be removed once
generation is complete:

```console
rm tools/bindings.json
```

### Format the autogen sources

This should rarely be needed (e.g. updating the autogen logic).

```console
python3 -m pip install autopep8 flake8
autopep8 -i -a -a --max-line-length 120 -r tools/autogen
flake8 --max-line-length 120 tools/autogen
```

If a virtualenv was setup (hopefully it was ;)), deactivate and remove the environment
```console
deactivate
rm -rf <path to virtualenv>
```
Example: `deactivate && rm -rf $(pwd)/couchnode`
