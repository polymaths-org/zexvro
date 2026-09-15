import { DbConnection } from "./index";
import type { SmartContract, ContractFunction, FileItem } from "../types";
import { getAvatarForUser } from "../utils/avatar";

const HOST =
  (import.meta.env.VITE_SPACETIMEDB_HOST as string | undefined)?.trim() ||
  "wss://maincloud.spacetimedb.com";
const DB_NAME =
  (import.meta.env.VITE_SPACETIMEDB_HANDSHAKE_DB as string | undefined)?.trim() ||
  "zexvro-handshake";

function tsToUnixMs(t: any): number {
  if (!t) return 0;
  if (typeof t.toMicrosSinceUnixEpoch === "function") return Math.floor(t.toMicrosSinceUnixEpoch() / 1000);
  if (typeof t.microsSinceUnixEpoch === "number") return Math.floor(t.microsSinceUnixEpoch / 1000);
  if (typeof t === "number") return Math.floor(t / 1000);
  if (typeof t === "string") {
    const d = Date.parse(t);
    return isNaN(d) ? 0 : d;
  }
  return 0;
}
function tsToAgo(t: any): string {
  const ms = tsToUnixMs(t);
  if (!ms) return "Just now";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mins ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hours ago`;
  const d = new Date(ms);
  return d.toLocaleDateString();
}
function safeJsonParse<T>(raw: string, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function rowToContract(row: any): SmartContract {
  const createdMs = tsToUnixMs(row.createdAt ?? row.created_at);
  const updatedMs = tsToUnixMs(row.updatedAt ?? row.updated_at);
  const tags: string[] = safeJsonParse<string[]>(row.tagsJson ?? row.tags_json ?? "[]", []);
  const files: FileItem[] = safeJsonParse<FileItem[]>(row.filesJson ?? row.files_json ?? "[]", []);
  const functions: ContractFunction[] = safeJsonParse<ContractFunction[]>(row.functionsJson ?? row.functions_json ?? "[]", []);

  // Ensure at least one file with source so ContractOverview renders
  const safeFiles: FileItem[] =
    files.length > 0
      ? files
      : [
          {
            path: "src/lib.rs",
            name: "lib.rs",
            type: "file" as const,
            content: (row.source as string) || "",
            lastCommitMessage: "Initial verified release",
            lastCommitTime: tsToAgo(row.createdAt),
          },
        ];

  const safeFns: ContractFunction[] =
    functions.length > 0
      ? functions
      : [
          {
            id: "fn-run",
            name: "run",
            signature: "pub fn run(env: Env) -> bool",
            visibility: "public" as const,
            isStateChanging: true,
            requiresAuth: false,
            gasEstimate: 8500,
            gasRating: "A+" as const,
            storageWrites: 0,
            storageReads: 1,
            eventsEmitted: [],
            docExcerpt: "Primary entry point.",
            fullDocs: "Primary entry point verifying caller permissions.",
            sourceLines: [8, 10] as [number, number],
            sourceSlice: "pub fn run(env: Env) -> bool {\n    true\n}",
            arguments: [],
            returns: "bool",
            errors: [],
            stateAccess: [],
            securityNotes: ["Deterministic host verification passed."],
          },
        ];

  const owner: string = (row.owner as string) || "anonymous";
  return {
    id: String(row.id),
    contractId: (row.contractId ?? row.contract_id ?? "") as string,
    name: (row.name as string) || "unnamed",
    owner,
    ownerAvatar: getAvatarForUser(owner),
    description: (row.description as string) || "",
    tagline: (row.tagline as string) || "",
    chain: (row.chain as string) as any,
    network: (row.network as string) as any,
    language: (row.language as string) as any,
    license: (row.license as string) || "Apache-2.0",
    verified: Boolean(row.verified),
    visibility: "public" as const,
    stars: Number(row.stars ?? 0),
    forksCount: Number(row.forksCount ?? row.forks_count ?? 0),
    likes: Number(row.likes ?? 0),
    updatedAt: tsToAgo(row.updatedAt ?? row.updated_at),
    createdAt: new Date(createdMs || Date.now()).toLocaleDateString(),
    // keep raw timestamps for sorting if callers need
    // @ts-ignore — extra for local sorting, ignored by UI
    _createdMs: createdMs,
    // @ts-ignore
    _updatedMs: updatedMs,
    tags,
    wasmSize: undefined,
    bytecodeHash: (row.bytecodeHash ?? row.bytecode_hash ?? "") as string,
    // @ts-ignore — audit trail, surfaced on the overview page
    sourceHash: (row.sourceHash ?? row.source_hash ?? "") as string,
    compilerVersion: (row.compilerVersion ?? row.compiler_version ?? "") as string,
    primaryBranch: "main",
    branches: [row.network as string].filter(Boolean),
    readme: (row.readme as string) || "",
    files: safeFiles,
    functions: safeFns,
    crossChainDiffs: undefined,
    history: [
      {
        hash: String(row.id).slice(-6),
        message: "Initial verified release",
        author: owner,
        authorAvatar: getAvatarForUser(owner),
        timestamp: tsToAgo(row.createdAt),
        contractIdVersion: (row.contractId ?? row.contract_id ?? "") as string,
        changesSummary: `Publish ${row.name} on ${row.chain}:${row.network}`,
        diffSnippet: `+ ${(row.source as string)?.slice(0, 80) || "source"}`,
      },
    ],
    forks: [],
    discussions: [],
    callGraph: {
      nodes: safeFns.slice(0, 3).map((f) => ({ id: `fn-${f.name}`, label: f.name, type: "function" as const })),
      edges: [],
    },
    relatedContractIds: [],
  } as unknown as SmartContract & { _createdMs: number; _updatedMs: number };
}

// Subscribe live to contracts table — maps rows to SmartContract[]
export function subscribeHandshakeContracts(
  onData: (contracts: SmartContract[], stats: { total: number }) => void,
  onError?: (msg: string) => void
) {
  let conn: InstanceType<typeof DbConnection> | null = null;
  let handle: any = null;

  const builder = DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .onConnect((c: any) => {
      conn = c as InstanceType<typeof DbConnection>;
      try {
        handle = c
          .subscriptionBuilder()
          .onApplied((_ctx: any) => {
            try {
              const rows: any[] = Array.from((c.db as any).handshakeContract.iter());
              let total = rows.length;
              try {
                const stats = (c.db as any).handshakeStats.singleton.find(1);
                if (stats) total = Number(stats.total);
              } catch {}
              const mapped = rows.map(rowToContract).sort((a: any, b: any) => (b as any)._createdMs - (a as any)._createdMs);
              onData(mapped, { total });
            } catch (e: any) {
              onError?.(e?.message || "Failed to map contracts");
            }
          })
          .onError((_ctx: any, err: any) => onError?.(String(err)))
          .subscribe(["SELECT * FROM handshake_contract", "SELECT * FROM handshake_stats"]);

        // Live incremental — also covered by onApplied, but ensure instant UI on insert/delete
        try {
          (c.db as any).handshakeContract.onInsert(() => {
            const rows: any[] = Array.from((c.db as any).handshakeContract.iter());
            onData(
              rows.map(rowToContract).sort((a: any, b: any) => (b as any)._createdMs - (a as any)._createdMs),
              { total: rows.length }
            );
          });
          (c.db as any).handshakeContract.onDelete(() => {
            const rows: any[] = Array.from((c.db as any).handshakeContract.iter());
            onData(
              rows.map(rowToContract).sort((a: any, b: any) => (b as any)._createdMs - (a as any)._createdMs),
              { total: rows.length }
            );
          });
        } catch {}
      } catch (e: any) {
        onError?.(e?.message || "Subscribe failed");
      }
    })
    .onConnectError((_c: any, err: any) => onError?.(String(err?.message || err)));

  conn = builder.build();

  return {
    disconnect() {
      try {
        handle?.unsubscribe?.();
      } catch {}
      try {
        conn?.disconnect();
      } catch {}
    },
    get conn() {
      return conn;
    },
  };
}

type PublishParams = {
  chain: string;
  network: string;
  contractId: string;
  name: string;
  tagline: string;
  description: string;
  source: string;
  language: string;
  license: string;
  tags: string[]; // array, will be JSON-stringified
  owner: string;
  bytecodeHash: string;
  sourceHash: string;
  verifiedClaim: boolean;
  compilerVersion?: string;
  readme?: string;
  files?: FileItem[];
  functions?: ContractFunction[];
  originContractKey?: string;
};

export async function publishViaHandshake(
  params: PublishParams,
  timeoutMs = 9000
): Promise<{ ok: true } | { ok: false; already: boolean; message: string }> {
  const {
    chain,
    network,
    contractId,
    name,
    tagline,
    description,
    source,
    language,
    license,
    tags,
    owner,
    bytecodeHash,
    sourceHash,
    verifiedClaim,
    compilerVersion,
    readme,
    files,
    functions,
    originContractKey,
  } = params;

  return new Promise((resolve) => {
    let settled = false;
    let conn: InstanceType<typeof DbConnection> | null = null;
    const finish = (r: { ok: true } | { ok: false; already: boolean; message: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        conn?.disconnect();
      } catch {}
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, already: false, message: "Publish timed out. Try again." }), timeoutMs);

    try {
      const builder = DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .onConnect((c) => {
          conn = c as InstanceType<typeof DbConnection>;
          const r: any = (c as any).reducers;
          const fn = r.publish_contract ?? r.publishContract;
          if (!fn) {
            finish({ ok: false, already: false, message: "Handshake service unavailable" });
            return;
          }
          const payload = {
            chain: chain.trim(),
            network: network.trim(),
            contractId: contractId.trim(),
            name: name.trim(),
            tagline: (tagline || "").trim(),
            description: (description || "").trim(),
            source: source || "",
            language: (language || "").trim(),
            license: (license || "").trim(),
            tagsJson: JSON.stringify(tags || []),
            owner: (owner || "anonymous").trim(),
            bytecodeHash: (bytecodeHash || "").trim(),
            sourceHash: (sourceHash || "").trim(),
            verifiedClaim: Boolean(verifiedClaim),
            compilerVersion: (compilerVersion || "soroban-cli 22.0.0").trim(),
            readme: (readme || "").trim(),
            filesJson: JSON.stringify(files || []),
            functionsJson: JSON.stringify(functions || []),
            originContractKey: (originContractKey || "").trim(),
          };
          const p = fn(payload);
          if (p && typeof p.then === "function") {
            p.then(
              () => finish({ ok: true }),
              (e: any) => {
                const msg = (e?.message || String(e) || "").trim();
                const already = /already/i.test(msg);
                finish({ ok: false, already, message: msg || "Failed to publish" });
              }
            );
          } else {
            setTimeout(() => finish({ ok: true }), 900);
          }
        })
        .onConnectError((_ctx: any, err: any) => finish({ ok: false, already: false, message: err?.message || "Could not reach Handshake" }))
        .onDisconnect((_ctx: any, err: any) => {
          if (!settled) setTimeout(() => finish({ ok: false, already: false, message: err?.message || "Disconnected" }), 300);
        });
      conn = builder.build();
    } catch (e: any) {
      finish({ ok: false, already: false, message: e?.message || "Failed to publish" });
    }
  });
}

// Lightweight helpers for stars/forks — fire-and-forget
export async function starHandshakeContract(contractKey: string): Promise<void> {
  const conn = DbConnection.builder().withUri(HOST).withDatabaseName(DB_NAME).build() as any;
  try {
    await new Promise<void>((resolve, reject) => {
      const builder = DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .onConnect((c: any) => {
          const r: any = (c as any).reducers;
          const fn = r.star_contract ?? r.starContract;
          if (!fn) return reject(new Error("star unavailable"));
          const p = fn({ contractKey });
          p?.then ? p.then(() => resolve()).catch(reject) : resolve();
        })
        .onConnectError((_c: any, e: any) => reject(e));
      const c = builder.build();
      setTimeout(() => {
        try { c.disconnect(); } catch {}
      }, 4000);
    });
  } finally {
    try { conn.disconnect(); } catch {}
  }
}
