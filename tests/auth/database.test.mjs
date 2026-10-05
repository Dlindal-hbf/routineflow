import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL approval policies, role isolation, review audit and legacy upgrades", async () => {
  const db = new PGlite();
  try {
    // Supabase normally provisions these roles and auth functions. Fixtures use
    // the actual PostgreSQL policy engine, not JavaScript authorization mocks.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (
        id uuid primary key, email text, email_confirmed_at timestamptz,
        is_anonymous boolean default false, raw_user_meta_data jsonb default '{}',
        created_at timestamptz default now()
      );
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    const migrations = (await readdir(new URL("../../supabase/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      const sql = await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
      if (name.endsWith("_enforce_approval.sql")) {
        await db.exec(`
          insert into auth.users(id,is_anonymous) values('00000000-0000-4000-8000-000000000099',true);
          insert into public.task_lists(user_id,app_id,title) values('00000000-0000-4000-8000-000000000099','legacy-preflight','Keep me');
        `);
        await assert.rejects(db.exec(sql), /Approval rollout stopped/);
        await db.exec("rollback");
        assert.equal((await db.query("select title from public.task_lists where app_id='legacy-preflight'")).rows[0].title, "Keep me");
        await db.exec(`
          update auth.users set is_anonymous=false,email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000099';
          update public.account_profiles set approval_status='approved' where id='00000000-0000-4000-8000-000000000099';
        `);
      }
      // gen_random_uuid is built into PostgreSQL; the separate pgcrypto extension
      // is not distributed with this embedded test runtime.
      await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
      if (name.endsWith("_enforce_approval.sql")) await db.exec("delete from auth.users where id='00000000-0000-4000-8000-000000000099'");
    }
    const sql = await readFile(new URL("../../supabase/migrations/tests/approval_auth.sql", import.meta.url), "utf8");
    await db.exec(sql);
    const result = await db.query("select count(*)::int as count from public.account_profiles");
    assert.equal(result.rows[0].count, 0, "SQL test fixtures roll back");
  } finally {
    await db.close();
  }
});
