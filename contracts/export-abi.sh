#!/usr/bin/env bash
# Export ABI arrays to contracts/abi/*.json for SDK consumption.
set -euo pipefail
cd "$(dirname "$0")"
forge build >/dev/null
mkdir -p abi
for c in Monadow MonadowRegistry MockUSD; do
  jq '.abi' "out/$c.sol/$c.json" > "abi/$c.json"
done
echo "ABIs exported to $(pwd)/abi"
