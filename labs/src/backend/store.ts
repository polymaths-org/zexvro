import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { FetchHttpHandler } from '@smithy/fetch-http-handler';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { Lab, Badge, Certificate, User, UserLabProgress, Submission } from '../types';
import { sampleSubmissions, initialUser } from '../data/mockData';

// Single-table DynamoDB store for ZEXVRO Labs following repo conventions.
//   Lab:        pk LAB#<id>            sk META   gsi1pk SLUG#<slug>  gsi1sk LAB
//   User:       pk USER#<githubId>     sk META
//   Certificate:pk USER#<githubId>     sk CERT#<certId>
//   Progress:   pk USER#<githubId>     sk PROG#<labId>
//   Listing:    scan + entityType filter (lab/badge catalogs are small)

export interface LabsStore {
  listLabs(): Promise<Lab[]>;
  getLab(idOrSlug: string): Promise<Lab | undefined>;
  createLab(lab: Lab): Promise<Lab>;
  updateLab(id: string, patch: Partial<Lab>): Promise<Lab | undefined>;
  deleteLab(id: string): Promise<boolean>;
  saveLabPrivate(id: string, data: Record<string, unknown>): Promise<void>;
  getLabPrivate(id: string): Promise<Record<string, unknown> | undefined>;
  getUser(githubId: string): Promise<User | undefined>;
  upsertUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  findUserByUsername(username: string): Promise<User | undefined>;
  listBadges(): Promise<Badge[]>;
  createBadge(badge: Badge): Promise<Badge>;
  updateBadge(id: string, patch: Partial<Badge>): Promise<Badge | undefined>;
  deleteBadge(id: string): Promise<boolean>;
  listCertificates(githubId: string): Promise<Certificate[]>;
  saveCertificate(githubId: string, cert: Certificate): Promise<void>;
  findCertificateByNumber(number: string): Promise<Certificate | undefined>;
  getProgress(githubId: string, labId: string): Promise<UserLabProgress | undefined>;
  saveProgress(githubId: string, labId: string, progress: UserLabProgress): Promise<void>;
  listSubmissions(): Promise<Submission[]>;
  saveSubmission(submission: Submission): Promise<void>;
  updateSubmission(id: string, patch: Partial<Submission>): Promise<Submission | undefined>;
}

export interface StoreConfig {
  backend?: string;
  region?: string;
  tableName?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  useFetchHandler?: boolean;
  firestore?: { projectId: string; clientEmail: string; privateKey: string };
}

const KEY_FIELDS = new Set(['pk', 'sk', 'gsi1pk', 'gsi1sk', 'entityType']);

function stripKeys<T>(item: Record<string, unknown>): T {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (!KEY_FIELDS.has(key)) rest[key] = value;
  }
  return rest as T;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / no AWS creds)
// ---------------------------------------------------------------------------
export class MemoryStore implements LabsStore {
  // Starts empty — dummy/sample data must never surface to users. Real labs
  // come from Firestore; memory is only a dev fallback with user-created data.
  private labs: Lab[] = [];
  private badges: Badge[] = [];
  private users = new Map<string, User>([[initialUser.id, initialUser]]);
  private certs = new Map<string, Certificate[]>();
  private progress = new Map<string, Map<string, UserLabProgress>>();

  async listLabs() {
    return this.labs;
  }
  async getLab(idOrSlug: string) {
    return this.labs.find((l) => l.id === idOrSlug || l.slug === idOrSlug);
  }
  async createLab(lab: Lab) {
    this.labs = [lab, ...this.labs];
    return lab;
  }
  async updateLab(id: string, patch: Partial<Lab>) {
    const idx = this.labs.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    this.labs[idx] = { ...this.labs[idx], ...patch };
    return this.labs[idx];
  }
  async deleteLab(id: string) {
    const before = this.labs.length;
    this.labs = this.labs.filter((l) => l.id !== id);
    return this.labs.length !== before;
  }
  private labPrivates = new Map<string, Record<string, unknown>>();
  async saveLabPrivate(id: string, data: Record<string, unknown>) {
    this.labPrivates.set(id, data);
  }
  async getLabPrivate(id: string) {
    return this.labPrivates.get(id);
  }
  async getUser(githubId: string) {
    return this.users.get(githubId);
  }
  async upsertUser(user: User) {
    this.users.set(user.id, user);
    return user;
  }
  async listUsers() {
    return [...this.users.values()];
  }
  async findUserByUsername(username: string) {
    const u = username.toLowerCase();
    return [...this.users.values()].find((x) => (x.username || '').toLowerCase() === u);
  }
  async listBadges() {
    return this.badges;
  }
  async createBadge(badge: Badge) {
    this.badges = [badge, ...this.badges];
    return badge;
  }
  async updateBadge(id: string, patch: Partial<Badge>) {
    const idx = this.badges.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    this.badges[idx] = { ...this.badges[idx], ...patch };
    return this.badges[idx];
  }
  async deleteBadge(id: string) {
    const before = this.badges.length;
    this.badges = this.badges.filter((b) => b.id !== id);
    return this.badges.length !== before;
  }
  async listCertificates(githubId: string) {
    return this.certs.get(githubId) ?? [];
  }
  async saveCertificate(githubId: string, cert: Certificate) {
    const list = this.certs.get(githubId) ?? [];
    this.certs.set(githubId, [cert, ...list]);
  }
  async findCertificateByNumber(number: string) {
    for (const list of this.certs.values()) {
      const c = list.find((x) => x.certificateNumber === number);
      if (c) return c;
    }
    return undefined;
  }
  async getProgress(githubId: string, labId: string) {
    return this.progress.get(githubId)?.get(labId);
  }
  async saveProgress(githubId: string, labId: string, progress: UserLabProgress) {
    const map = this.progress.get(githubId) ?? new Map();
    map.set(labId, progress);
    this.progress.set(githubId, map);
  }
  private submissions: Submission[] = [];
  async listSubmissions() {
    return this.submissions;
  }
  async saveSubmission(submission: Submission) {
    this.submissions = [submission, ...this.submissions];
  }
  async updateSubmission(id: string, patch: Partial<Submission>) {
    const idx = this.submissions.findIndex((s) => s.id === id);
    if (idx === -1) return undefined;
    this.submissions[idx] = { ...this.submissions[idx], ...patch };
    return this.submissions[idx];
  }
}

// ---------------------------------------------------------------------------
// DynamoDB implementation
// ---------------------------------------------------------------------------
export class DynamoStore implements LabsStore {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private seeded = false;

  constructor(cfg: StoreConfig) {
    this.tableName = cfg.tableName || 'zexvro-labs';
    const handler: any = cfg.useFetchHandler
      ? new FetchHttpHandler()
      : undefined;
    this.client = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: cfg.region || process.env.LABS_DYNAMO_REGION || 'us-east-1',
        credentials: cfg.credentials
          ? {
              accessKeyId: cfg.credentials.accessKeyId,
              secretAccessKey: cfg.credentials.secretAccessKey,
            }
          : undefined,
        ...(handler ? { requestHandler: handler } : {}),
      }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }

  async listLabs(): Promise<Lab[]> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :lab',
        ExpressionAttributeValues: { ':lab': 'lab' },
      }),
    );
    const items = (out.Items ?? []).map((i) => stripKeys<Lab>(i as Record<string, unknown>));
    return items.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  }

  async getLab(idOrSlug: string): Promise<Lab | undefined> {
    const byId = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `LAB#${idOrSlug}`, sk: 'META' } }),
    );
    if (byId.Item) return stripKeys<Lab>(byId.Item as Record<string, unknown>);
    const bySlug = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'gsi1pk-index',
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
        ExpressionAttributeValues: { ':pk': `SLUG#${idOrSlug}`, ':sk': 'LAB' },
        Limit: 1,
      }),
    );
    const item = bySlug.Items?.[0];
    return item ? stripKeys<Lab>(item as Record<string, unknown>) : undefined;
  }

  async createLab(lab: Lab): Promise<Lab> {
    await this.putLabItem(lab);
    return lab;
  }

  async updateLab(id: string, patch: Partial<Lab>): Promise<Lab | undefined> {
    const existing = await this.getLab(id);
    if (!existing) return undefined;
    const updated: Lab = {
      ...existing,
      ...patch,
      id: existing.id,
      slug: patch.slug ?? existing.slug,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    if (patch.slug && patch.slug !== existing.slug) {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: `SLUG#${existing.slug}`, sk: 'LAB' },
        }),
      );
    }
    await this.putLabItem(updated);
    return updated;
  }

  async deleteLab(id: string): Promise<boolean> {
    const existing = await this.getLab(id);
    if (!existing) return false;
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: `LAB#${id}`, sk: 'META' } }),
    );
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk: `SLUG#${existing.slug}`, sk: 'LAB' },
      }),
    );
    return true;
  }

  async saveLabPrivate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `LABPRIV#${id}`, sk: 'META', entityType: 'labprivate', ...data },
      }),
    );
  }

  async getLabPrivate(id: string): Promise<Record<string, unknown> | undefined> {
    const out = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `LABPRIV#${id}`, sk: 'META' } }),
    );
    return out.Item ? stripKeys<Record<string, unknown>>(out.Item as Record<string, unknown>) : undefined;
  }

  async getUser(githubId: string): Promise<User | undefined> {
    const out = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `USER#${githubId}`, sk: 'META' } }),
    );
    return out.Item ? stripKeys<User>(out.Item as Record<string, unknown>) : undefined;
  }

  async upsertUser(user: User): Promise<User> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `USER#${user.id}`, sk: 'META', entityType: 'user', ...user },
      }),
    );
    return user;
  }

  async listBadges(): Promise<Badge[]> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :badge',
        ExpressionAttributeValues: { ':badge': 'badge' },
      }),
    );
    const items = (out.Items ?? []).map((i) => stripKeys<Badge>(i as Record<string, unknown>));
    return items;
  }

  async createBadge(badge: Badge): Promise<Badge> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `BADGE#${badge.id}`, sk: 'META', entityType: 'badge', ...badge },
      }),
    );
    return badge;
  }

  async updateBadge(id: string, patch: Partial<Badge>): Promise<Badge | undefined> {
    const out = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `BADGE#${id}`, sk: 'META' } }),
    );
    if (!out.Item) return undefined;
    const updated: Badge = {
      ...stripKeys<Badge>(out.Item as Record<string, unknown>),
      ...patch,
    };
    await this.createBadge(updated);
    return updated;
  }

  async deleteBadge(id: string): Promise<boolean> {
    const out = await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: `BADGE#${id}`, sk: 'META' } }),
    );
    return !!out.$metadata;
  }

  async listCertificates(githubId: string): Promise<Certificate[]> {
    const out = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${githubId}`, ':prefix': 'CERT#' },
      }),
    );
    return (out.Items ?? []).map((i) => stripKeys<Certificate>(i as Record<string, unknown>));
  }

  async saveCertificate(githubId: string, cert: Certificate): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${githubId}`,
          sk: `CERT#${cert.id}`,
          entityType: 'certificate',
          ...cert,
        },
      }),
    );
  }

  async findCertificateByNumber(number: string): Promise<Certificate | undefined> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :c AND certificateNumber = :n',
        ExpressionAttributeValues: { ':c': 'certificate', ':n': number },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    return item ? stripKeys<Certificate>(item as Record<string, unknown>) : undefined;
  }

  async getProgress(githubId: string, labId: string): Promise<UserLabProgress | undefined> {
    const out = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `USER#${githubId}`, sk: `PROG#${labId}` },
      }),
    );
    return out.Item
      ? stripKeys<UserLabProgress>(out.Item as Record<string, unknown>)
      : undefined;
  }

  async saveProgress(githubId: string, labId: string, progress: UserLabProgress): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${githubId}`,
          sk: `PROG#${labId}`,
          entityType: 'progress',
          ...progress,
        },
      }),
    );
  }

  async listUsers(): Promise<User[]> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :user',
        ExpressionAttributeValues: { ':user': 'user' },
      }),
    );
    return (out.Items ?? []).map((i) => stripKeys<User>(i as Record<string, unknown>));
  }

  async findUserByUsername(username: string): Promise<User | undefined> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :user AND username = :u',
        ExpressionAttributeValues: { ':user': 'user', ':u': username },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0];
    return item ? stripKeys<User>(item as Record<string, unknown>) : undefined;
  }

  async listSubmissions(): Promise<Submission[]> {
    const out = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :sub',
        ExpressionAttributeValues: { ':sub': 'submission' },
      }),
    );
    return (out.Items ?? []).map((i) => stripKeys<Submission>(i as Record<string, unknown>));
  }

  async saveSubmission(submission: Submission): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `SUB#${submission.id}`,
          sk: 'META',
          entityType: 'submission',
          ...submission,
        },
      }),
    );
  }

  async updateSubmission(id: string, patch: Partial<Submission>): Promise<Submission | undefined> {
    const out = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `SUB#${id}`, sk: 'META' } }),
    );
    if (!out.Item) return undefined;
    const updated: Submission = {
      ...stripKeys<Submission>(out.Item as Record<string, unknown>),
      ...patch,
    };
    await this.saveSubmission(updated);
    return updated;
  }

  private async putLabItem(lab: Lab): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `LAB#${lab.id}`,
          sk: 'META',
          entityType: 'lab',
          gsi1pk: `SLUG#${lab.slug}`,
          gsi1sk: 'LAB',
          ...lab,
        },
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Firestore implementation (server-side, via the Firestore REST API + a
// Firebase service-account JSON). Works under Cloudflare Pages Functions
// (nodejs_compat) using only fetch + WebCrypto.
// ---------------------------------------------------------------------------
interface FirestoreConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function b64urlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(cleaned);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

function toValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  const t = typeof v;
  if (t === 'string') return { stringValue: v as string };
  if (t === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v as number };
  }
  if (t === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: (v as unknown[]).map(toValue) } };
  if (t === 'object') return { mapValue: { fields: objToFields(v as Record<string, unknown>) } };
  return { nullValue: null };
}

function fromValue(v: any): unknown {
  if (v == null) return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fieldsToObj(v.mapValue.fields || {});
  return null;
}

function objToFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return fields;
}

function fieldsToObj(fields: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromValue(v as any);
  return obj;
}

function docToObj(doc: any): any {
  if (!doc?.fields) return { id: doc?.name?.split('/').pop() };
  const obj = fieldsToObj(doc.fields);
  obj.id = doc.name.split('/').pop();
  return obj;
}

export class FirestoreStore implements LabsStore {
  private readonly projectId: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;
  private accessToken = '';
  private tokenExpiry = 0;

  constructor(cfg: FirestoreConfig) {
    this.projectId = cfg.projectId;
    this.clientEmail = cfg.clientEmail;
    this.privateKey = cfg.privateKey;
  }

  private get baseUrl() {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  private async signJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claims = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };
    const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claims))}`;
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToPkcs8(this.privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${b64urlEncode(new Uint8Array(sig))}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60_000) return this.accessToken;
    const assertion = await this.signJwt();
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) throw new Error(`Firestore OAuth failed (${res.status})`);
    const data: any = await res.json();
    this.accessToken = data.access_token || '';
    this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return this.accessToken;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      'Content-Type': 'application/json',
    };
  }

  private async fsGet(path: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${path}`, { headers: await this.authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore GET ${path} failed (${res.status})`);
    return res.json();
  }

  private async fsWrite(path: string, fields: Record<string, unknown>): Promise<any> {
    const body = JSON.stringify({ fields: objToFields(fields) });
    const res = await fetch(`${this.baseUrl}/${path}`, {
      method: 'PATCH',
      headers: await this.authHeaders(),
      body,
    });
    if (!res.ok) throw new Error(`Firestore write ${path} failed (${res.status})`);
    return res.json();
  }

  private async fsDelete(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${path}`, {
      method: 'DELETE',
      headers: await this.authHeaders(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete ${path} failed (${res.status})`);
  }

  private async runQuery(collectionId: string, field: string, value: unknown, limit = 1): Promise<any[]> {
    const valueKind = typeof value === 'number' ? 'integerValue' : 'stringValue';
    const structuredQuery = {
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: 'EQUAL',
            value: { [valueKind]: String(value) },
          },
        },
        limit,
      },
    };
    const res = await fetch(`${this.baseUrl}:runQuery`, {
      method: 'POST',
      headers: await this.authHeaders(),
      body: JSON.stringify(structuredQuery),
    });
    if (!res.ok) throw new Error(`Firestore query ${collectionId} failed (${res.status})`);
    const data: any = await res.json();
    return data
      .filter((r: any) => r.document)
      .map((r: any) => docToObj(r.document));
  }

  private async listCollection(collectionId: string): Promise<any[]> {
    const data = await this.fsGet(collectionId);
    return (data?.documents || []).map(docToObj);
  }

  private async writeDoc(collectionId: string, id: string, obj: Record<string, unknown>): Promise<void> {
    const { id: _id, ...fields } = obj;
    // PATCH on the document path is an upsert (Firestore REST: PATCH creates
    // or replaces the doc). POST ?documentId= only creates and 409s on update.
    await this.fsWrite(`${collectionId}/${encodeURIComponent(id)}`, fields);
  }

  private async readDoc(collectionId: string, id: string): Promise<any | undefined> {
    const doc = await this.fsGet(`${collectionId}/${encodeURIComponent(id)}`);
    return doc ? docToObj(doc) : undefined;
  }

  // --- Labs ---
  async listLabs(): Promise<Lab[]> {
    const docs = await this.listCollection('labs');
    return docs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))) as Lab[];
  }

  async getLab(idOrSlug: string): Promise<Lab | undefined> {
    const byId = await this.readDoc('labs', idOrSlug);
    if (byId) return byId as Lab;
    const bySlug = await this.runQuery('labs', 'slug', idOrSlug, 1);
    return bySlug[0] as Lab | undefined;
  }

  async createLab(lab: Lab): Promise<Lab> {
    await this.writeDoc('labs', lab.id, lab as unknown as Record<string, unknown>);
    return lab;
  }

  async updateLab(id: string, patch: Partial<Lab>): Promise<Lab | undefined> {
    const existing = await this.getLab(id);
    const updated: Lab = {
      ...(existing || ({ id, createdAt: new Date().toISOString().split('T')[0] } as Lab)),
      ...patch,
      id: existing?.id ?? id,
      slug: patch.slug ?? existing?.slug ?? id,
      updatedAt: new Date().toISOString().split('T')[0],
    } as Lab;
    await this.writeDoc('labs', updated.id, updated as unknown as Record<string, unknown>);
    return updated;
  }

  async deleteLab(id: string): Promise<boolean> {
    const existing = await this.getLab(id);
    if (!existing) return false;
    await this.fsDelete(`labs/${encodeURIComponent(id)}`);
    return true;
  }

  async saveLabPrivate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.writeDoc(`labs/${encodeURIComponent(id)}/private`, 'meta', data);
  }

  async getLabPrivate(id: string): Promise<Record<string, unknown> | undefined> {
    return (await this.readDoc(`labs/${encodeURIComponent(id)}/private`, 'meta')) as
      | Record<string, unknown>
      | undefined;
  }

  // --- Badges ---
  async listBadges(): Promise<Badge[]> {
    return (await this.listCollection('badges')) as Badge[];
  }
  async createBadge(badge: Badge): Promise<Badge> {
    await this.writeDoc('badges', badge.id, badge as unknown as Record<string, unknown>);
    return badge;
  }
  async updateBadge(id: string, patch: Partial<Badge>): Promise<Badge | undefined> {
    const existing = await this.readDoc('badges', id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    await this.writeDoc('badges', id, updated as Record<string, unknown>);
    return updated as Badge;
  }
  async deleteBadge(id: string): Promise<boolean> {
    const existing = await this.readDoc('badges', id);
    if (!existing) return false;
    await this.fsDelete(`badges/${encodeURIComponent(id)}`);
    return true;
  }

  // --- Users ---
  async getUser(githubId: string): Promise<User | undefined> {
    return (await this.readDoc('users', githubId)) as User | undefined;
  }
  async upsertUser(user: User): Promise<User> {
    await this.writeDoc('users', user.id, user as unknown as Record<string, unknown>);
    return user;
  }
  async listUsers(): Promise<User[]> {
    return (await this.listCollection('users')) as User[];
  }
  async findUserByUsername(username: string): Promise<User | undefined> {
    const res = await this.runQuery('users', 'username', username, 1);
    return res[0] as User | undefined;
  }

  // --- Certificates ---
  async listCertificates(githubId: string): Promise<Certificate[]> {
    const docs = await this.listCollection('certificates');
    return docs.filter((c) => c.studentId === githubId) as Certificate[];
  }
  async saveCertificate(githubId: string, cert: Certificate): Promise<void> {
    await this.writeDoc('certificates', cert.id, { ...cert, studentId: githubId });
  }
  async findCertificateByNumber(number: string): Promise<Certificate | undefined> {
    const res = await this.runQuery('certificates', 'certificateNumber', number, 1);
    return res[0] as Certificate | undefined;
  }

  // --- Progress ---
  async getProgress(githubId: string, labId: string): Promise<UserLabProgress | undefined> {
    return (await this.readDoc(`progress/${githubId}/labs`, labId)) as UserLabProgress | undefined;
  }
  async saveProgress(githubId: string, labId: string, progress: UserLabProgress): Promise<void> {
    await this.writeDoc(`progress/${githubId}/labs`, labId, progress as unknown as Record<string, unknown>);
  }

  // --- Submissions ---
  async listSubmissions(): Promise<Submission[]> {
    return (await this.listCollection('submissions')) as Submission[];
  }
  async saveSubmission(submission: Submission): Promise<void> {
    await this.writeDoc('submissions', submission.id, submission as unknown as Record<string, unknown>);
  }
  async updateSubmission(id: string, patch: Partial<Submission>): Promise<Submission | undefined> {
    const existing = await this.readDoc('submissions', id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, id };
    await this.writeDoc('submissions', id, updated as Record<string, unknown>);
    return updated as Submission;
  }
}

export function createStore(cfg: StoreConfig = {}): LabsStore {
  const backend = cfg.backend || process.env.LABS_STATE_BACKEND || 'firestore';
  if (backend === 'dynamo') {
    return new DynamoStore({
      region: cfg.region,
      tableName: cfg.tableName,
      credentials: cfg.credentials,
      useFetchHandler: cfg.useFetchHandler,
    });
  }
  if (backend === 'firestore' && cfg.firestore?.projectId && cfg.firestore.clientEmail && cfg.firestore.privateKey) {
    return new FirestoreStore(cfg.firestore);
  }
  return new MemoryStore();
}