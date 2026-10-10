FROM node:22 AS builder

RUN apt-get update && apt-get install -y cmake && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci --ignore-scripts
RUN npm run prebuild -- --configure --set-cpm-cache --use-boringssl
RUN CMAKE_BUILD_PARALLEL_LEVEL=8 npm run prebuild -- --use-boringssl --use-cmakejs-build
RUN npm run prepare

WORKDIR /app/performer

# Install the SDK as a real copy (install-links) rather than the symlink a
# file: dependency normally gets, so it resolves its peer dependencies
# (@opentelemetry/api) from performer/node_modules exactly as a registry install
# would. The copy holds only what root's package.json "files" ships, and its
# install script (scripts/install.js) copies in the addon built above from
# couchbase_local_prebuilds instead of recompiling. The .npmrc also keeps the
# later `npm prune` from relinking the copy.
RUN printf 'install-links=true\ncouchbase_local_prebuilds=/app/build/Release\n' > .npmrc
RUN npm install --unsafe-perm
RUN test -f node_modules/couchbase/build/Release/couchbase_impl.node
# The copy carries the C++ sources from "files"; none are needed at runtime.
RUN rm -rf node_modules/couchbase/deps node_modules/couchbase/src \
        node_modules/couchbase/tools node_modules/couchbase/CMakeLists.txt

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

FROM node:22-slim AS testing

# Passed by couchbaselabs/sdk-docker-build-action (build-arg SDK=...). Declared
# so the build arg is consumed cleanly and recorded as a label.
ARG SDK=node

LABEL org.opencontainers.image.title="${SDK}-fit-performer" \
      org.opencontainers.image.description="Couchbase Node.js SDK FIT performer (gRPC server)"

RUN apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

WORKDIR /app/performer

# Only the performer's compiled JS, generated proto stubs and node_modules. The
# SDK, including its native addon, is an ordinary installed package in there.
COPY --from=builder /app/performer/package.json ./package.json
COPY --from=builder /app/performer/node_modules ./node_modules
COPY --from=builder /app/performer/src/build ./src/build
COPY --from=builder /app/performer/src/proto ./src/proto
COPY --from=builder /app/performer/entrypoint.sh ./entrypoint.sh

# entrypoint.sh translates LOG_LEVEL (set generically by the FIT test
# framework) into CBPPLOGLEVEL, the env var the native addon reads at
# module-init time to configure the C++ core's console logger — see
# src/binding.cpp and LOGGING.md.
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "src/build/performer.js"]
