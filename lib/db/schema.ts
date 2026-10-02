import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const severityEnum = pgEnum("severity", ["critical", "major", "minor"]);
export const rubricKindEnum = pgEnum("rubric_kind", ["llm", "code"]);
export const statusEnum = pgEnum("status", ["pending", "running", "completed", "failed"]);
export const endReasonEnum = pgEnum("end_reason", [
  "caller_ended",
  "agent_transferred",
  "max_turns",
  "error",
]);
export const verdictEnum = pgEnum("verdict", ["pass", "fail"]);
export const turnRoleEnum = pgEnum("turn_role", ["caller", "agent"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull(),
  temperature: real("temperature").notNull().default(0.3),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suites = pgTable("suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scenario: text("scenario").notNull(),
  createdAt: createdAt(),
});

export const rubricItems = pgTable("rubric_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id")
    .notNull()
    .references(() => suites.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  question: text("question").notNull(),
  severity: severityEnum("severity").notNull(),
  kind: rubricKindEnum("kind").notNull(),
  codeCheck: text("code_check"),
  order: integer("order").notNull().default(0),
  createdAt: createdAt(),
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  suiteId: uuid("suite_id")
    .notNull()
    .references(() => suites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Full persona JSON (see lib/sim/personas.ts). Typed loosely here; validated with Zod on read.
  data: jsonb("data").notNull(),
  noiseLevel: real("noise_level").notNull().default(0),
  createdAt: createdAt(),
});

export type AgentSnapshot = {
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
};

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  suiteId: uuid("suite_id")
    .notNull()
    .references(() => suites.id, { onDelete: "cascade" }),
  status: statusEnum("status").notNull().default("pending"),
  agentSnapshot: jsonb("agent_snapshot").$type<AgentSnapshot>().notNull(),
  seed: integer("seed").notNull(),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "cascade" }),
  status: statusEnum("status").notNull().default("pending"),
  endReason: endReasonEnum("end_reason"),
  verdict: verdictEnum("verdict"),
  score: real("score"),
  summary: text("summary"),
  error: text("error"),
  createdAt: createdAt(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const turns = pgTable("turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  role: turnRoleEnum("role").notNull(),
  rawText: text("raw_text").notNull(),
  heardText: text("heard_text"),
  createdAt: createdAt(),
});

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  rubricItemId: uuid("rubric_item_id")
    .notNull()
    .references(() => rubricItems.id, { onDelete: "cascade" }),
  passed: boolean("passed").notNull(),
  evidence: text("evidence").notNull(),
  turnIndex: integer("turn_index"),
  source: rubricKindEnum("source").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Suite = typeof suites.$inferSelect;
export type RubricItem = typeof rubricItems.$inferSelect;
export type PersonaRow = typeof personas.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type Score = typeof scores.$inferSelect;
