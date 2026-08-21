FROM node:22 AS builder

RUN apt-get update && apt-get install -y cmake && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci --ignore-scripts
RUN npm run prebuild -- --configure --set-cpm-cache --use-boringssl
RUN CMAKE_BUILD_PARALLEL_LEVEL=8 npm run prebuild -- --use-boringssl --use-cmakejs-build
RUN npm run prepare

WORKDIR /app/performer

RUN npm install --unsafe-perm

RUN mkdir -p src/proto

RUN npx grpc_tools_node_protoc \
        --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
        --ts_out=grpc_js:./src/proto \
        --js_out=import_style=commonjs,binary:./src/proto \
        --grpc_out=grpc_js:./src/proto \
        -I ./proto/operational \
        ./proto/operational/*.proto

ENV NODE_ENV=production

RUN npm run build
RUN npm prune --omit=dev

# Root's own devDependencies (typescript, mocha, eslint, ...) are only needed up
# through the last step that can retrigger root's "prepare" lifecycle script —
# which is performer's `npm install` above, since npm re-runs a file: dependency's
# prepare script when linking it. Pruning any earlier breaks that reinstall.
RUN npm --prefix /app prune --omit=dev

FROM node:22-slim AS testing

# Passed by couchbaselabs/sdk-docker-build-action (build-arg SDK=...). Declared
# so the build arg is consumed cleanly and recorded as a label.
ARG SDK=node

LABEL org.opencontainers.image.title="${SDK}-fit-performer" \
      org.opencontainers.image.description="Couchbase Node.js SDK FIT performer (gRPC server)"

RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the pieces actually needed at runtime: the compiled SDK JS + its native
# addon, and the performer's own compiled JS + generated proto stubs. Skip
# deps/ (C++ source + CPM cache, ~670MB) and the rest of build/ (~180MB of
# CMake intermediates) — neither is touched once the addon is built.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build/Release ./build/Release
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/performer/package.json ./performer/package.json
COPY --from=builder /app/performer/node_modules ./performer/node_modules
COPY --from=builder /app/performer/src/build ./performer/src/build
COPY --from=builder /app/performer/src/proto ./performer/src/proto
COPY --from=builder /app/performer/entrypoint.sh ./performer/entrypoint.sh

WORKDIR /app/performer

# entrypoint.sh translates LOG_LEVEL (set generically by the FIT test
# framework) into CBPPLOGLEVEL, the env var the native addon reads at
# module-init time to configure the C++ core's console logger — see
# src/binding.cpp and LOGGING.md.
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "src/build/performer.js"]
