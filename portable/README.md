# Portable boxes

Actual component source is portable/payload, not a remote MSI path or stub. Runtime pinned to CultureReset/node-kit-runtime@22b20a47c9592adc19af82f1e1bf3dd35a92c431. Own licenses preserved where supplied; otherwise private custom-source license/provenance remains unresolved (not relicensed). Existing upstream/history and unrelated files preserved.

```
./portable/install.sh --stage-root /tmp/node-boxes-stage
./portable/install.sh --dry-run
# Optional dependency preparation only, never service activation:
./portable/install.sh --prepare
```
Installer installs disabled manual-only unit, per-box empty allowlists/origins and source. No service start/restart/tunnel/Funnel/agent wake/registration. Source differences block overwrites. Dependency components: none declared. Use ai-stack-kit pinned orchestrator for complete dependency assembly. Shared grants are separately versioned, not copied into this component.

Layout: ang/src/boxes; entry: daemon/dist/index.js; runtime: node; port: 7770; safe health: UNKNOWN/no operational probes. Source config values require per-box provisioning. Successful real phone/passkey/model/enrollment operations NOT proved by source staging tests. Controller /api/nodes contract still unavailable; no invented registration payload. No provider calls in installer tests.
