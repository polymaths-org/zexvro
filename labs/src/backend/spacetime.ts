import type {
  Badge,
  Certificate,
  Lab,
  LabIdea,
  Submission,
  User,
  UserLabProgress,
} from '../types';
import type { LabsStore, StoreConfig } from './store';

// SpacetimeDB backend for ZEXVRO Labs.
//
// Talks to a SpacetimeDB host over its HTTP API (SQL reads, reducer calls)
// so Cloudflare Pages Functions can use it without a WebSocket client.
// Asset bytes (banners, credential art) are never stored here: rows keep
// Firebase Storage URLs plus sha256 hashes, images load from the CDN.

// Column orders must match labs/spacetimedb/src/index.ts.
const SUMMARY_COLS = [
  'id', 'slug', 'title', 'description_snippet', 'category', 'difficulty',
  'duration_minutes', 'xp_reward', 'enrolled_count', 'completions',
  'is_published', 'featured', 'banner_url', 'banner_hash', 'updated_at',
] as const;

const CONTENT_COLS = [
  'lab_id', 'overview_ref', 'pages_json', 'initial_code',
  'initial_terminal_command', 'updated_at',
] as const;

const USER_COLS = [
  'uid', 'username', 'name', 'email', 'avatar_url', 'role',
  'xp', 'streak_days', 'completed_labs_count',
] as const;

const CERT_COLS = [
  'id', 'certificate_number', 'student_id', 'student_name', 'lab_title',
  'category', 'issued_at', 'verification_url', 'status', 'design_json',
] as const;

const PROGRESS_COLS = [
  'id', 'user_id', 'lab_id', 'completed_tasks', 'completed_task_ids_json',
  'score', 'is_completed', 'detail_json', 'updated_at',
] as const;

const SUB_COLS = [
  'id', 'lab_id', 'user_id', 'user_name', 'status', 'score',
  'submitted_at', 'review_note', 'payload_json',
] as const;

const BADGE_COLS = [
  'id', 'name', 'description', 'category', 'icon_name', 'color',
  'image_url', 'xp_bonus',
] as const;

const IDEA_COLS = ['id', 'lab_id', 'title', 'description', 'taken_by', 'taken_at'] as const;

// Sum-type encoding for Option<T> on the HTTP API:
// queries return [0, value] (some) or [1, []] (none),
// calls accept { some: value } or { none: {} }.
export function decodeOption(cell: unknown): unknown {
  if (Array.isArray(cell)) return cell[0] === 0 ? cell[1] : undefined;
  return cell;
}

export function encodeOption(value: unknown): unknown {
  return value === undefined || value === null ? { none: {} } : { some: value };
}

function rowObject<T extends string>(cols: readonly T[], row: unknown[]): Record<T, unknown> {
  const obj = {} as Record<T, unknown>;
  cols.forEach((c, i) => {
    obj[c] = decodeOption(row[i]);
  });
  return obj;
}

function parseJson(text: string | undefined, fallback: unknown): unknown {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export interface SpacetimeConfig {
  url?: string;
  db?: string;
}

export function spacetimeConfigFrom(cfg: StoreConfig = {}): Required<SpacetimeConfig> {
  return {
    url:
      process.env.SPACETIME_URL ||
      (cfg as unknown as Record<string, string>).url ||
      'https://maincloud.spacetimedb.com',
    db:
      process.env.SPACETIME_DB ||
      (cfg as unknown as Record<string, string>).db ||
      'labs-beta',
  };
}

export class SpacetimeStore implements LabsStore {
  private readonly url: string;
  private readonly db: string;

  constructor(cfg: SpacetimeConfig = {}) {
    this.url = (cfg.url || 'https://maincloud.spacetimedb.com').replace(/\/$/, '');
    this.db = cfg.db || 'labs-beta';
  }

  private async sql<T>(query: string): Promise<T[][]> {
    const res = await fetch(`${this.url}/v1/database/${this.db}/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    if (!res.ok) throw new Error(`Spacetime SQL failed (${res.status})`);
    const data = (await res.json()) as Array<{ rows: T[][] }>;
    return data?.[0]?.rows || [];
  }

  private async call(reducer: string, args: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.url}/v1/database/${this.db}/call/${reducer}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Spacetime call ${reducer} failed (${res.status})`);
    }
  }

  // --- Row mapping -----------------------------------------------------------

  private summaryToPartial(r: unknown[]): Partial<Lab> & { id: string } {
    const o = rowObject(SUMMARY_COLS, r);
    return {
      id: o.id as string,
      slug: o.slug as string,
      title: o.title as string,
      description: o.description_snippet as string,
      category: o.category as Lab['category'],
      difficulty: o.difficulty as Lab['difficulty'],
      durationMinutes: o.duration_minutes as number,
      xpReward: o.xp_reward as number,
      enrolledCount: o.enrolled_count as number,
      completions: o.completions as number,
      isPublished: o.is_published as boolean,
      featured: o.featured as boolean,
      bannerUrl: o.banner_url as string | undefined,
      updatedAt: o.updated_at as string,
    };
  }

  private async hydrateLabs(summaries: unknown[][]): Promise<Lab[]> {
    const contentRows = await this.sql<unknown>('SELECT * FROM lab_content');
    const contentById = new Map<string, Record<(typeof CONTENT_COLS)[number], unknown>>();
    for (const c of contentRows) {
      const o = rowObject(CONTENT_COLS, c);
      contentById.set(o.lab_id as string, o);
    }
    return summaries.map((s) => this.mergeLab(this.summaryToPartial(s), contentById.get((s[0] as string) || '')));
  }

  private mergeLab(
    summary: Partial<Lab> & { id: string },
    content?: Record<(typeof CONTENT_COLS)[number], unknown>,
  ): Lab {
    const ext = (parseJson(content?.pages_json as string | undefined, {}) || {}) as Record<string, unknown>;
    const lab = { ...(ext as object), ...summary } as Lab;
    lab.overviewMarkdown =
      (content?.overview_ref as string) || (ext.overviewMarkdown as string) || '';
    lab.tasks = (ext.tasks as Lab['tasks']) || [];
    lab.pages = ext.pages as Lab['pages'];
    lab.initialCode = (content?.initial_code as string) || (ext.initialCode as string);
    lab.initialTerminalCommand =
      (content?.initial_terminal_command as string) || (ext.initialTerminalCommand as string);
    lab.author = (ext.author as string) || 'ZEXVRO Labs Team';
    lab.createdAt = (ext.createdAt as string) || (summary.updatedAt as string) || '';
    lab.tags = (ext.tags as string[]) || [];
    return lab;
  }

  // --- Labs -------------------------------------------------------------------

  async listLabs(): Promise<Lab[]> {
    const rows = await this.sql<unknown>('SELECT * FROM lab_summary');
    return this.hydrateLabs(rows);
  }

  async getLab(idOrSlug: string): Promise<Lab | undefined> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM lab_summary WHERE id = '${idOrSlug.replace(/'/g, "''")}'`,
    );
    let summaryRows = rows;
    if (summaryRows.length === 0) {
      summaryRows = await this.sql<unknown>(
        `SELECT * FROM lab_summary WHERE slug = '${idOrSlug.replace(/'/g, "''")}'`,
      );
    }
    if (summaryRows.length === 0) return undefined;
    return (await this.hydrateLabs(summaryRows))[0];
  }

  // Runs answer checking inside the database (reducers can read the private
  // answers table; anonymous HTTP reads cannot). Resolves on pass, throws
  // the reducer message on failure.
  async verifyTask(labId: string, taskId: string, flag: string, command: string): Promise<void> {
    await this.call('verify_task', {
      lab_id: labId,
      task_id: taskId,
      flag: flag || '',
      command: command || '',
    });
  }

  async createLab(lab: Lab): Promise<Lab> {
    const id = lab.id || `lab_${Date.now()}`;
    const full: Lab = { ...lab, id };
    await this.writeLab(full);
    return full;
  }

  async updateLab(id: string, patch: Partial<Lab>): Promise<Lab | undefined> {
    const existing = await this.getLab(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, id: existing.id };
    await this.writeLab(merged);
    return merged;
  }

  private async writeLab(lab: Lab): Promise<void> {
    const ext = {
      overviewMarkdown: lab.overviewMarkdown,
      tasks: lab.tasks,
      pages: lab.pages,
      author: lab.author,
      createdAt: lab.createdAt,
      tags: lab.tags,
      accessCode: lab.accessCode,
      password: lab.password,
      timeLimitMinutes: lab.timeLimitMinutes,
      moduleId: lab.moduleId,
      status: lab.status,
      editors: lab.editors,
      rules: lab.rules,
      credential: lab.credential,
      credentialName: lab.credentialName,
      badgeId: lab.badgeId,
      badgeName: lab.badgeName,
      badgeIconUrl: lab.badgeIconUrl,
    };
    await this.call('upsert_lab_summary', {
      id: lab.id,
      slug: lab.slug,
      title: lab.title,
      description_snippet: lab.description || '',
      category: lab.category,
      difficulty: lab.difficulty,
      duration_minutes: lab.durationMinutes || 0,
      xp_reward: lab.xpReward || 0,
      is_published: lab.isPublished !== false && lab.status !== 'draft',
      featured: lab.featured || false,
      banner_url: encodeOption(lab.bannerUrl),
      banner_hash: encodeOption(undefined),
    });
    await this.call('save_lab_content', {
      lab_id: lab.id,
      overview_ref: lab.overviewMarkdown || '',
      pages_json: JSON.stringify(ext),
      initial_code: encodeOption(lab.initialCode),
      initial_terminal_command: encodeOption(lab.initialTerminalCommand),
    });
  }

  async deleteLab(id: string): Promise<boolean> {
    const existing = await this.getLab(id);
    if (!existing) return false;
    await this.call('delete_lab', { lab_id: id });
    return true;
  }

  async saveLabPrivate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.call('save_lab_private', {
      lab_id: id,
      answers_json: JSON.stringify(data),
      access_code_hash: encodeOption(undefined),
    });
  }

  async getLabPrivate(): Promise<Record<string, unknown> | undefined> {
    // Private rows are readable only inside reducers (see verifyTask), never
    // over anonymous HTTP, so there is nothing to return here by design.
    return undefined;
  }

  // --- Users -------------------------------------------------------------------

  private userToUser(r: unknown[]): User {
    const o = rowObject(USER_COLS, r);
    return {
      id: o.uid as string,
      name: o.name as string,
      email: o.email as string,
      username: o.username as string,
      avatarUrl: (o.avatar_url as string) || '',
      role: (o.role as User['role']) || 'student',
      xp: (o.xp as number) || 0,
      streakDays: (o.streak_days as number) || 0,
      completedLabsCount: (o.completed_labs_count as number) || 0,
      githubConnected: false,
    };
  }

  async getUser(githubId: string): Promise<User | undefined> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM user_profile WHERE uid = '${githubId.replace(/'/g, "''")}'`,
    );
    return rows.length === 0 ? undefined : this.userToUser(rows[0]);
  }

  async upsertUser(user: User): Promise<User> {
    await this.call('upsert_user', {
      uid: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatar_url: encodeOption(user.avatarUrl || undefined),
      role: user.role,
    });
    return user;
  }

  async updateUserRole(githubId: string, role: User['role']): Promise<User | undefined> {
    const existing = await this.getUser(githubId);
    if (!existing) return undefined;
    const updated = { ...existing, role };
    await this.upsertUser(updated);
    return updated;
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.sql<unknown>('SELECT * FROM user_profile');
    return rows.map((r) => this.userToUser(r));
  }

  async findUserByUsername(username: string): Promise<User | undefined> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM user_profile WHERE username = '${username.replace(/'/g, "''")}'`,
    );
    return rows.length === 0 ? undefined : this.userToUser(rows[0]);
  }

  // --- Badges --------------------------------------------------------------------

  async listBadges(): Promise<Badge[]> {
    const rows = await this.sql<unknown>('SELECT * FROM badge');
    return rows.map((r) => {
      const o = rowObject(BADGE_COLS, r);
      return {
        id: o.id as string,
        name: o.name as string,
        description: o.description as string,
        category: o.category as Badge['category'],
        iconName: o.icon_name as string,
        color: o.color as string,
        imageUrl: o.image_url as string | undefined,
        xpBonus: (o.xp_bonus as number) || 0,
      } as Badge;
    });
  }

  async createBadge(badge: Badge): Promise<Badge> {
    throw new Error('SpacetimeStore.createBadge is not implemented in beta');
  }

  async updateBadge(): Promise<Badge | undefined> {
    throw new Error('SpacetimeStore.updateBadge is not implemented in beta');
  }

  async deleteBadge(): Promise<boolean> {
    throw new Error('SpacetimeStore.deleteBadge is not implemented in beta');
  }

  // --- Certificates -----------------------------------------------------------------

  async listCertificates(githubId: string): Promise<Certificate[]> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM certificate WHERE student_id = '${githubId.replace(/'/g, "''")}'`,
    );
    return rows.map((r) => {
      const o = rowObject(CERT_COLS, r);
      return {
        id: o.id as string,
        certificateNumber: o.certificate_number as string,
        studentId: o.student_id as string,
        studentName: o.student_name as string,
        labTitle: o.lab_title as string,
        category: o.category as Certificate['category'],
        issuedAt: o.issued_at as string,
        verificationUrl: o.verification_url as string,
        instructorName: 'Zexvro Certification Board',
        status: o.status as string,
        design: parseJson(o.design_json as string | undefined, undefined) as Certificate['design'],
      } as Certificate;
    });
  }

  async saveCertificate(): Promise<void> {
    throw new Error('SpacetimeStore.saveCertificate is not implemented in beta');
  }

  async findCertificateByNumber(number: string): Promise<Certificate | undefined> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM certificate WHERE certificate_number = '${number.replace(/'/g, "''")}'`,
    );
    if (rows.length === 0) return undefined;
    const o = rowObject(CERT_COLS, rows[0]);
    return {
      id: o.id as string,
      certificateNumber: o.certificate_number as string,
      studentId: o.student_id as string,
      studentName: o.student_name as string,
      labTitle: o.lab_title as string,
      category: o.category as Certificate['category'],
      issuedAt: o.issued_at as string,
      verificationUrl: o.verification_url as string,
      instructorName: 'Zexvro Certification Board',
      status: o.status as string,
    } as Certificate;
  }

  // --- Progress ----------------------------------------------------------------------

  async getProgress(githubId: string, labId: string): Promise<UserLabProgress | undefined> {
    const rows = await this.sql<unknown>(
      `SELECT * FROM progress WHERE id = '${`${githubId}:${labId}`.replace(/'/g, "''")}'`,
    );
    if (rows.length === 0) return undefined;
    const o = rowObject(PROGRESS_COLS, rows[0]);
    const detail = (parseJson(o.detail_json as string | undefined, {}) || {}) as Record<string, unknown>;
    return {
      labId: o.lab_id as string,
      startedAt: o.updated_at as string,
      completedAt: (o.is_completed as boolean) ? (o.updated_at as string) : undefined,
      currentTaskIndex: (detail.currentTaskIndex as number) || 0,
      completedTaskIds: (parseJson(o.completed_task_ids_json as string, []) || []) as string[],
      scorePercent: (o.score as number) || 0,
      terminalLogs: (detail.terminalLogs as string[]) || [],
      codeSnippet: detail.codeSnippet as string | undefined,
      isCompleted: (o.is_completed as boolean) || false,
    };
  }

  async saveProgress(githubId: string, labId: string, progress: UserLabProgress): Promise<void> {
    await this.call('save_progress', {
      user_id: githubId,
      lab_id: labId,
      completed_tasks: progress.completedTaskIds?.length || 0,
      completed_task_ids_json: JSON.stringify(progress.completedTaskIds || []),
      score: progress.scorePercent || 0,
      is_completed: progress.isCompleted || false,
      detail_json: encodeOption(
        JSON.stringify({
          currentTaskIndex: progress.currentTaskIndex,
          terminalLogs: (progress.terminalLogs || []).slice(-50),
          codeSnippet: progress.codeSnippet,
        }),
      ),
    });
  }

  // --- Submissions ---------------------------------------------------------------------

  async listSubmissions(): Promise<Submission[]> {
    const rows = await this.sql<unknown>('SELECT * FROM submission');
    return rows.map((r) => {
      const o = rowObject(SUB_COLS, r);
      const payload = (parseJson(o.payload_json as string | undefined, {}) || {}) as Record<string, unknown>;
      return {
        id: o.id as string,
        labId: o.lab_id as string,
        userId: o.user_id as string,
        userName: o.user_name as string,
        labTitle: (payload.labTitle as string) || '',
        status: o.status as Submission['status'],
        score: o.score as number,
        submittedAt: o.submitted_at as string,
        reviewedBy: payload.reviewedBy as string | undefined,
        reviewNote: (o.review_note as string) || (payload.reviewNote as string),
        repoUrl: payload.repoUrl as string | undefined,
        type: (payload.type as Submission['type']) || 'lab',
        formData: payload.formData as Record<string, string> | undefined,
      } as Submission;
    });
  }

  async saveSubmission(submission: Submission): Promise<void> {
    const payload = {
      labTitle: submission.labTitle,
      reviewedBy: submission.reviewedBy,
      reviewNote: submission.reviewNote,
      repoUrl: submission.repoUrl,
      type: submission.type,
      formData: submission.formData,
    };
    await this.call('save_submission', {
      id: submission.id,
      lab_id: submission.labId,
      user_id: submission.userId,
      user_name: submission.userName || '',
      status: submission.status,
      score: submission.score || 0,
      submitted_at: submission.submittedAt,
      review_note: encodeOption(submission.reviewNote),
      payload_json: encodeOption(JSON.stringify(payload)),
    });
  }

  async updateSubmission(id: string, patch: Partial<Submission>): Promise<Submission | undefined> {
    const all = await this.listSubmissions();
    const existing = all.find((s) => s.id === id);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, id };
    await this.call('update_submission', {
      id: merged.id,
      status: merged.status,
      score: merged.score || 0,
      review_note: encodeOption(merged.reviewNote),
      payload_json: encodeOption(
        JSON.stringify({
          labTitle: merged.labTitle,
          reviewedBy: merged.reviewedBy,
          reviewNote: merged.reviewNote,
          repoUrl: merged.repoUrl,
          type: merged.type,
          formData: merged.formData,
        }),
      ),
    });
    return merged;
  }

  // --- Lab ideas --------------------------------------------------------------------------

  async listLabIdeas(): Promise<LabIdea[]> {
    const rows = await this.sql<unknown>('SELECT * FROM lab_idea');
    return rows.map((r) => {
      const o = rowObject(IDEA_COLS, r);
      return {
        id: o.id as string,
        labId: o.lab_id as string,
        title: o.title as string,
        description: o.description as string,
        takenBy: o.taken_by as string | undefined,
        takenAt: o.taken_at as string | undefined,
      } as LabIdea;
    });
  }

  async createLabIdea(): Promise<LabIdea> {
    throw new Error('SpacetimeStore.createLabIdea is not implemented in beta');
  }

  async updateLabIdea(id: string, patch: Partial<LabIdea>): Promise<LabIdea | undefined> {
    const all = await this.listLabIdeas();
    const existing = all.find((i) => i.id === id);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, id };
    if (patch.takenBy !== undefined || patch.takenAt !== undefined) {
      await this.call('take_idea', { idea_id: id, user_id: merged.takenBy || '' });
      return merged;
    }
    throw new Error('SpacetimeStore.updateLabIdea supports take/release only in beta');
  }

  async deleteLabIdea(): Promise<boolean> {
    throw new Error('SpacetimeStore.deleteLabIdea is not implemented in beta');
  }
}
