#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="demo-reverso-qa"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/source"
FIREBASE_CONFIG="$PROJECT_ROOT/firebase.json"
VITEST_CONFIG="$(mktemp "$SOURCE_DIR/.vitest-emulators.XXXXXX.mts")"

cleanup() {
  rm -f "$VITEST_CONFIG"
}
trap cleanup EXIT INT TERM

if [[ ! -f "$FIREBASE_CONFIG" ]]; then
  printf 'Configuração de emuladores não encontrada: %s\n' "$FIREBASE_CONFIG" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/gestor-emulator.test.ts" ]]; then
  printf 'Suíte de emuladores não encontrada: %s\n' "$SOURCE_DIR/gestor-emulator.test.ts" >&2
  exit 1
fi

cat >"$VITEST_CONFIG" <<'EOF'
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["gestor-emulator.test.ts"],
    environment: "node",
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 90_000,
    hookTimeout: 30_000,
  },
});
EOF

# No credential, production project, or browser is used. The CLI starts local
# emulators only and injects the three *_EMULATOR_HOST variables for Vitest.
unset FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS
export GCLOUD_PROJECT="$PROJECT_ID"
export FIREBASE_PROJECT="$PROJECT_ID"

cd "$SOURCE_DIR"
if [[ -n "${FIREBASE_CLI:-}" ]]; then
  FIREBASE_COMMAND=("$FIREBASE_CLI")
else
  FIREBASE_COMMAND=(npx --yes firebase-tools@14.22.0)
fi
"${FIREBASE_COMMAND[@]}" --config "$FIREBASE_CONFIG" emulators:exec \
  --project "$PROJECT_ID" --only auth,firestore,storage \
  "npx --yes pnpm@10.4.1 exec vitest run --config \"$VITEST_CONFIG\""
