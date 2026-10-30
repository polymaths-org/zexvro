import {isTrustedGateway} from './authorization';
import { schema, table, t, SenderError } from 'spacetimedb/server';

// ZEXVRO Labs database module.
//
// Design rules (energy + latency):
// - Small hot rows (lab_summary, user_profile) are public and subscribed
//   globally. Large cold blobs (lab_content, lab_private) are fetched per
//   active lab only and never contain image bytes: banners and credential
//   art live in Firebase Storage, rows keep URL + sha256 references.
// - All writes go through reducers. Reducers use primary-key lookups, never
//   full-table scans on hot paths.
const spacetimedb = schema({
  lab_summary: table(
    { name: 'lab_summary', public: true },
    {
      id: t.string().primaryKey(),
      slug: t.string().unique(),
      title: t.string(),
      description_snippet: t.string(),
      category: t.string(),
      difficulty: t.string(),
      duration_minutes: t.u32(),
      xp_reward: t.u32(),
      enrolled_count: t.u32(),
      completions: t.u32(),
      is_published: t.bool(),
      featured: t.bool(),
      banner_url: t.string().optional(),
      banner_hash: t.string().optional(),
      updated_at: t.string(),
    }
  ),
  lab_content: table(
    { name: 'lab_content', public: true },
    {
      lab_id: t.string().primaryKey(),
      overview_ref: t.string(),
      pages_json: t.string(),
      initial_code: t.string().optional(),
      initial_terminal_command: t.string().optional(),
      updated_at: t.string(),
    }
  ),
  lab_private: table(
    { name: 'lab_private', public: false },
    {
      lab_id: t.string().primaryKey(),
      answers_json: t.string(),
      access_code_hash: t.string().optional(),
    }
  ),
  badge: table(
    { name: 'badge', public: true },
    {
      id: t.string().primaryKey(),
      name: t.string(),
      description: t.string(),
      category: t.string(),
      icon_name: t.string(),
      color: t.string(),
      image_url: t.string().optional(),
      xp_bonus: t.u32(),
    }
  ),
  user_profile: table(
    { name: 'user_profile', public: true },
    {
      uid: t.string().primaryKey(),
      username: t.string().unique(),
      name: t.string(),
      email: t.string(),
      avatar_url: t.string().optional(),
      role: t.string(),
      xp: t.u32(),
      streak_days: t.u32(),
      completed_labs_count: t.u32(),
    }
  ),
  certificate: table(
    { name: 'certificate', public: true },
    {
      id: t.string().primaryKey(),
      certificate_number: t.string().unique(),
      student_id: t.string(),
      student_name: t.string(),
      lab_title: t.string(),
      category: t.string(),
      issued_at: t.string(),
      verification_url: t.string(),
      status: t.string(),
      design_json: t.string().optional(),
    }
  ),
  progress: table(
    { name: 'progress', public: true },
    {
      id: t.string().primaryKey(),
      user_id: t.string(),
      lab_id: t.string(),
      completed_tasks: t.u32(),
      completed_task_ids_json: t.string(),
      score: t.u32(),
      is_completed: t.bool(),
      detail_json: t.string().optional(),
      updated_at: t.string(),
    }
  ),
  submission: table(
    { name: 'submission', public: true },
    {
      id: t.string().primaryKey(),
      lab_id: t.string(),
      user_id: t.string(),
      user_name: t.string(),
      status: t.string(),
      score: t.u32(),
      submitted_at: t.string(),
      review_note: t.string().optional(),
      payload_json: t.string().optional(),
    }
  ),
  lab_idea: table(
    { name: 'lab_idea', public: true },
    {
      id: t.string().primaryKey(),
      lab_id: t.string(),
      title: t.string(),
      description: t.string(),
      taken_by: t.string().optional(),
      taken_at: t.string().optional(),
    }
  ),
});
export default spacetimedb;

export const init = spacetimedb.init(_ctx => {});

// --- Catalog ---------------------------------------------------------------

export const upsert_lab_summary = spacetimedb.reducer(
  {
    id: t.string(),
    slug: t.string(),
    title: t.string(),
    description_snippet: t.string(),
    category: t.string(),
    difficulty: t.string(),
    duration_minutes: t.u32(),
    xp_reward: t.u32(),
    is_published: t.bool(),
    featured: t.bool(),
    banner_url: t.string().optional(),
    banner_hash: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const existing = ctx.db.lab_summary.id.find(args.id);
    if (existing) {
      ctx.db.lab_summary.id.update({
        ...existing,
        slug: args.slug,
        title: args.title,
        description_snippet: args.description_snippet,
        category: args.category,
        difficulty: args.difficulty,
        duration_minutes: args.duration_minutes,
        xp_reward: args.xp_reward,
        is_published: args.is_published,
        featured: args.featured,
        banner_url: args.banner_url,
        banner_hash: args.banner_hash,
        updated_at: ctx.timestamp.toString(),
      });
    } else {
      ctx.db.lab_summary.insert({
        id: args.id,
        slug: args.slug,
        title: args.title,
        description_snippet: args.description_snippet,
        category: args.category,
        difficulty: args.difficulty,
        duration_minutes: args.duration_minutes,
        xp_reward: args.xp_reward,
        enrolled_count: 0,
        completions: 0,
        is_published: args.is_published,
        featured: args.featured,
        banner_url: args.banner_url,
        banner_hash: args.banner_hash,
        updated_at: ctx.timestamp.toString(),
      });
    }
  }
);

export const save_lab_content = spacetimedb.reducer(
  {
    lab_id: t.string(),
    overview_ref: t.string(),
    pages_json: t.string(),
    initial_code: t.string().optional(),
    initial_terminal_command: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const existing = ctx.db.lab_content.lab_id.find(args.lab_id);
    const row = {
      lab_id: args.lab_id,
      overview_ref: args.overview_ref,
      pages_json: args.pages_json,
      initial_code: args.initial_code,
      initial_terminal_command: args.initial_terminal_command,
      updated_at: ctx.timestamp.toString(),
    };
    if (existing) ctx.db.lab_content.lab_id.update(row);
    else ctx.db.lab_content.insert(row);
  }
);

export const delete_lab = spacetimedb.reducer({ lab_id: t.string() }, (ctx, { lab_id }) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
  ctx.db.lab_summary.id.delete(lab_id);
  ctx.db.lab_content.lab_id.delete(lab_id);
  ctx.db.lab_private.lab_id.delete(lab_id);
});

// --- Enrollment + progress ---------------------------------------------------

export const enroll_lab = spacetimedb.reducer({ lab_id: t.string() }, (ctx, { lab_id }) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
  const lab = ctx.db.lab_summary.id.find(lab_id);
  if (!lab) throw new SenderError('Lab not found');
  ctx.db.lab_summary.id.update({ ...lab, enrolled_count: lab.enrolled_count + 1 });
});

export const save_progress = spacetimedb.reducer(
  {
    user_id: t.string(),
    lab_id: t.string(),
    completed_tasks: t.u32(),
    completed_task_ids_json: t.string(),
    score: t.u32(),
    is_completed: t.bool(),
    detail_json: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const id = `${args.user_id}:${args.lab_id}`;
    const row = {
      id,
      user_id: args.user_id,
      lab_id: args.lab_id,
      completed_tasks: args.completed_tasks,
      completed_task_ids_json: args.completed_task_ids_json,
      score: args.score,
      is_completed: args.is_completed,
      detail_json: args.detail_json,
      updated_at: ctx.timestamp.toString(),
    };
    const existing = ctx.db.progress.id.find(id);
    if (existing) ctx.db.progress.id.update(row);
    else ctx.db.progress.insert(row);
  }
);

// --- Verification + completion (batched to one call per action) ---------------

export const save_lab_private = spacetimedb.reducer(
  { lab_id: t.string(), answers_json: t.string(), access_code_hash: t.string().optional() },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const existing = ctx.db.lab_private.lab_id.find(args.lab_id);
    const row = {
      lab_id: args.lab_id,
      answers_json: args.answers_json,
      access_code_hash: args.access_code_hash,
    };
    if (existing) ctx.db.lab_private.lab_id.update(row);
    else ctx.db.lab_private.insert(row);
  }
);

export const verify_task = spacetimedb.reducer(
  { lab_id: t.string(), task_id: t.string(), flag: t.string(), command: t.string() },
  (ctx, { lab_id, task_id, flag, command }) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const priv = ctx.db.lab_private.lab_id.find(lab_id);
    if (!priv) throw new SenderError('Lab not found');
    const answers = JSON.parse(priv.answers_json) as Record<
      string,
      { flag?: string; command?: string; output?: string }
    >;
    const expected = answers[task_id];
    if (!expected) throw new SenderError('Task not found');
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (expected.flag !== undefined) {
      if (norm(flag) !== norm(expected.flag)) throw new SenderError('Incorrect flag');
      return;
    }
    const cmd = norm(command);
    const reqCmd = norm(expected.command || '');
    const expectedOut = norm(expected.output || '');
    if (reqCmd && cmd.includes(reqCmd)) {
      if (expectedOut && !cmd.includes(expectedOut)) throw new SenderError('Output did not match');
      return;
    }
    if (expectedOut && cmd.length > 0) {
      if (!cmd.includes(expectedOut) && !expectedOut.includes(cmd)) {
        throw new SenderError(`Expected: ${expected.output}`);
      }
      return;
    }
    throw new SenderError('Check failed');
  }
);

export const complete_lab = spacetimedb.reducer(
  {
    user_id: t.string(),
    user_name: t.string(),
    lab_id: t.string(),
    lab_title: t.string(),
    category: t.string(),
    score: t.u32(),
    certificate_number: t.string(),
    design_json: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const now = ctx.timestamp.toString();
    ctx.db.submission.insert({
      id: `sub_${now}_${args.user_id}`,
      lab_id: args.lab_id,
      user_id: args.user_id,
      user_name: args.user_name,
      status: 'for_review',
      score: args.score,
      submitted_at: now,
      review_note: undefined,
      payload_json: undefined,
    });
    ctx.db.certificate.insert({
      id: `cert_${now}_${args.user_id}`,
      certificate_number: args.certificate_number,
      student_id: args.user_id,
      student_name: args.user_name,
      lab_title: args.lab_title,
      category: args.category,
      issued_at: now,
      verification_url: `https://labs.zexvro.in/verify/${args.certificate_number}`,
      status: 'issued',
      design_json: args.design_json,
    });
    const lab = ctx.db.lab_summary.id.find(args.lab_id);
    if (lab) ctx.db.lab_summary.id.update({ ...lab, completions: lab.completions + 1 });
    const profile = ctx.db.user_profile.uid.find(args.user_id);
    if (profile) {
      ctx.db.user_profile.uid.update({
        ...profile,
        xp: profile.xp + args.score,
        completed_labs_count: profile.completed_labs_count + 1,
      });
    }
  }
);

export const save_submission = spacetimedb.reducer(
  {
    id: t.string(),
    lab_id: t.string(),
    user_id: t.string(),
    user_name: t.string(),
    status: t.string(),
    score: t.u32(),
    submitted_at: t.string(),
    review_note: t.string().optional(),
    payload_json: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    ctx.db.submission.insert({
      id: args.id,
      lab_id: args.lab_id,
      user_id: args.user_id,
      user_name: args.user_name,
      status: args.status,
      score: args.score,
      submitted_at: args.submitted_at,
      review_note: args.review_note,
      payload_json: args.payload_json,
    });
  }
);

export const update_submission = spacetimedb.reducer(
  {
    id: t.string(),
    status: t.string(),
    score: t.u32(),
    review_note: t.string().optional(),
    payload_json: t.string().optional(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const existing = ctx.db.submission.id.find(args.id);
    if (!existing) throw new SenderError('Submission not found');
    ctx.db.submission.id.update({
      ...existing,
      status: args.status,
      score: args.score,
      review_note: args.review_note,
      payload_json: args.payload_json,
    });
  }
);

// --- Users / badges / ideas -----------------------------------------------------

export const upsert_user = spacetimedb.reducer(
  {
    uid: t.string(),
    username: t.string(),
    name: t.string(),
    email: t.string(),
    avatar_url: t.string().optional(),
    role: t.string(),
  },
  (ctx, args) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const existing = ctx.db.user_profile.uid.find(args.uid);
    if (existing) {
      ctx.db.user_profile.uid.update({
        ...existing,
        username: args.username,
        name: args.name,
        email: args.email,
        avatar_url: args.avatar_url,
        role: args.role,
      });
    } else {
      ctx.db.user_profile.insert({
        uid: args.uid,
        username: args.username,
        name: args.name,
        email: args.email,
        avatar_url: args.avatar_url,
        role: args.role,
        xp: 0,
        streak_days: 0,
        completed_labs_count: 0,
      });
    }
  }
);

export const take_idea = spacetimedb.reducer(
  { idea_id: t.string(), user_id: t.string() },
  (ctx, { idea_id, user_id }) => {
    if(!isTrustedGateway(ctx.sender))throw new SenderError('Trusted gateway authentication required');
    const idea = ctx.db.lab_idea.id.find(idea_id);
    if (!idea) throw new SenderError('Idea not found');
    if (idea.taken_by) throw new SenderError('This idea is already taken');
    ctx.db.lab_idea.id.update({ ...idea, taken_by: user_id, taken_at: ctx.timestamp.toString() });
  }
);
