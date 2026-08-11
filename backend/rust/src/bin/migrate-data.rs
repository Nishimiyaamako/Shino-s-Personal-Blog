//! M3：SQLite → Postgres 数据迁移工具（一次性，幂等可重跑）
//!
//! 用法:
//!   cargo run --bin migrate-data -- <SQLITE_PATH> <DATABASE_URL> [VERIFY_PASSWORD]
//!
//! 行为:
//!   1. 备份快照：迁移前将 SQLite 文件复制为同目录 `<file>.<UTC时间戳>`（回滚用）
//!   2. 只读打开 SQLite（OpenFlags::SQLITE_OPEN_READ_ONLY，源库零写入）
//!   3. PG 目标表全部 TRUNCATE ... RESTART IDENTITY CASCADE 后重导（幂等）
//!   4. 逐表迁移：admin_users → posts → tags → post_tags → media_assets →
//!      friend_links → about_page → profile_card → profile_contacts → site_config
//!      - posts 丢弃 is_featured / featured_order（精选已废弃）
//!      - friend_links.enabled SQLite INTEGER(0/1) → PG boolean
//!      - site_config 源表无 slogan 列（PRAGMA 探测）时补默认 ''
//!      - about_page 源表缺 hero_* / timeline_* 等列时补默认（'' / '[]'）
//!      - 时间戳 TEXT ISO 8601 原样复制；media_assets.url 相对路径不变
//!   5. 重建 posts_search 全文镜像（仅 published，tags 空格连接，对齐旧 rebuildSearchIndex）
//!   6. 校验报告：逐表 count 对比 + 抽样字段级比对 + 专项断言
//!      （featured 未迁移 / slogan=='' / enabled boolean / 密码哈希 argon2 兼容 / FTS 行数）
//!
//! 密码哈希校验：可选第 3 参数 <VERIFY_PASSWORD> 提供时做真实 argon2 验证（演练/测试用）；
//! 缺省时仅校验 PHC 格式可解析（证明哈希兼容 argon2 生态，无需重哈希）。
//! 生产迁移请勿在命令行传真实密码（ps 可见）——缺省格式校验已足够；
//! 如确需真实验证，用一次性环境变量或迁移后首次登录验证。
//!
//! 退出码：0 校验通过；1 校验失败；2 用法错误

use std::collections::HashMap;
use std::path::Path;

use anyhow::Context;
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use rusqlite::types::ValueRef;
use rusqlite::{Connection, OpenFlags, Row};
use sqlx::postgres::PgPoolOptions;
use sqlx::{Column as _, PgPool, Row as _};

/// 迁移表顺序（含 posts_search 用于校验，不参与逐表 INSERT）
const MIGRATE_TABLES: &[&str] = &[
    "admin_users",
    "posts",
    "tags",
    "post_tags",
    "media_assets",
    "friend_links",
    "about_page",
    "profile_card",
    "profile_contacts",
    "site_config",
];

/// 抽样比对规格：目标列清单 + 仅目标侧存在的列（期望默认值）+ bool 列
struct TableCheck {
    name: &'static str,
    pg_cols: &'static [&'static str],
    /// 源表无此列时的期望默认值（如 site_config.slogan、about_page.hero_*）
    defaults: &'static [(&'static str, &'static str)],
    /// PG boolean 列（SQLite 侧 1/0 → 归一化为 true/false 比对）
    bool_cols: &'static [&'static str],
    /// posts：抽样需至少含 1 篇 draft
    sample_with_draft: bool,
    /// 抽样排序（post_tags 无 id 列，用联合主键）
    order_by: &'static str,
}

const CHECKS: &[TableCheck] = &[
    TableCheck {
        name: "admin_users",
        pg_cols: &["id", "username", "password_hash", "created_at"],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "posts",
        pg_cols: &[
            "id",
            "title",
            "slug",
            "date",
            "summary",
            "theme",
            "cover_image_url",
            "content_markdown",
            "content_html",
            "status",
            "view_count",
            "like_count",
            "comment_count",
            "created_at",
            "updated_at",
            "published_at",
        ],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: true,
        order_by: "id",
    },
    TableCheck {
        name: "tags",
        pg_cols: &["id", "name"],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "post_tags",
        pg_cols: &["post_id", "tag_id"],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "post_id, tag_id",
    },
    TableCheck {
        name: "media_assets",
        pg_cols: &["id", "file_name", "mime_type", "size", "url", "created_at"],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "friend_links",
        pg_cols: &[
            "id",
            "name",
            "description",
            "avatar",
            "url",
            "enabled",
            "display_order",
            "created_at",
            "updated_at",
        ],
        defaults: &[],
        bool_cols: &["enabled"],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "about_page",
        pg_cols: &[
            "id",
            "markdown",
            "hero_title",
            "hero_subtitle",
            "intro_paragraphs",
            "narrative_sections",
            "timeline_title",
            "timeline_events",
            "updated_at",
        ],
        defaults: &[
            ("hero_title", ""),
            ("hero_subtitle", ""),
            ("intro_paragraphs", "[]"),
            ("narrative_sections", "[]"),
            ("timeline_title", ""),
            ("timeline_events", "[]"),
        ],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "profile_card",
        pg_cols: &["id", "name", "bio", "avatar", "updated_at"],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "profile_contacts",
        pg_cols: &[
            "id",
            "profile_card_id",
            "platform",
            "label",
            "href",
            "display_order",
        ],
        defaults: &[],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
    TableCheck {
        name: "site_config",
        pg_cols: &[
            "id",
            "site_title",
            "site_subtitle",
            "slogan",
            "copyright_owner",
            "powered_by",
            "icp_record_text",
            "icp_record_url",
            "public_security_record_text",
            "public_security_record_url",
            "friend_link_template",
            "updated_at",
        ],
        defaults: &[("slogan", "")],
        bool_cols: &[],
        sample_with_draft: false,
        order_by: "id",
    },
];

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if !(3..=4).contains(&args.len()) {
        eprintln!("用法: migrate-data <SQLITE_PATH> <DATABASE_URL> [VERIFY_PASSWORD]");
        std::process::exit(2);
    }
    let sqlite_path = &args[1];
    let database_url = &args[2];
    let verify_password = args.get(3);

    // 1. 备份快照（先于打开源文件，保证副本为迁移前状态）
    let snapshot = backup_snapshot(sqlite_path)?;
    println!("[备份快照] {sqlite_path} -> {snapshot}");

    // 2. 只读打开 SQLite（源库零写入）
    let sqlite = Connection::open_with_flags(sqlite_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .with_context(|| format!("无法只读打开 SQLite: {sqlite_path}"))?;

    // 3. PG 连接 + schema 迁移（目标结构就绪）
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .context("Postgres 连接失败")?;
    sqlx::migrate!("./sql/migrations")
        .run(&pool)
        .await
        .context("PG schema 迁移失败")?;

    // 4. 幂等清空：TRUNCATE RESTART IDENTITY CASCADE（可重跑）
    sqlx::query(
        "TRUNCATE TABLE posts_search, admin_users, posts, tags, post_tags, media_assets,
                   friend_links, about_page, profile_card, profile_contacts, site_config
         RESTART IDENTITY CASCADE",
    )
    .execute(&pool)
    .await
    .context("TRUNCATE 失败")?;
    println!("[清空] PG 目标表已 TRUNCATE RESTART IDENTITY CASCADE（幂等重导）");

    // 5. 逐表迁移（FK 安全顺序）
    let mut migrated: Vec<(&str, usize)> = Vec::new();
    migrated.push(("admin_users", migrate_admin_users(&sqlite, &pool).await?));
    migrated.push(("posts", migrate_posts(&sqlite, &pool).await?));
    migrated.push(("tags", migrate_tags(&sqlite, &pool).await?));
    migrated.push(("post_tags", migrate_post_tags(&sqlite, &pool).await?));
    migrated.push(("media_assets", migrate_media_assets(&sqlite, &pool).await?));
    migrated.push(("friend_links", migrate_friend_links(&sqlite, &pool).await?));
    migrated.push(("about_page", migrate_about_page(&sqlite, &pool).await?));
    migrated.push(("profile_card", migrate_profile_card(&sqlite, &pool).await?));
    migrated.push((
        "profile_contacts",
        migrate_profile_contacts(&sqlite, &pool).await?,
    ));
    migrated.push(("site_config", migrate_site_config(&sqlite, &pool).await?));
    for (table, n) in &migrated {
        println!("[迁移] {table}: {n} 行");
    }

    // 6. 重建 posts_search（仅 published，tags 空格连接，对齐旧 rebuildSearchIndex）
    let fts_count = rebuild_posts_search(&pool).await?;
    println!("[迁移] posts_search: {fts_count} 行（published 重建）");

    // 7. 校验报告
    let mut ok = true;
    let mut fail_list: Vec<String> = Vec::new();
    println!();
    println!("=== 校验报告 ===");

    println!("[计数校验]");
    for table in MIGRATE_TABLES {
        let s = count_of_sqlite(&sqlite, table).await?;
        let p = count_of_pg(&pool, table).await?;
        if s == p {
            println!("{table:<16} | SQLite: {s:<4} | PG: {p:<4} | ✓");
        } else {
            ok = false;
            println!("{table:<16} | SQLite: {s:<4} | PG: {p:<4} | ✗");
            fail_list.push(format!("{table} 计数不一致: SQLite {s} vs PG {p}"));
        }
    }

    println!("[抽样比对]");
    for check in CHECKS {
        let (sn, pn, diffs) = verify_check(&pool, &sqlite, check).await?;
        let draft_note = if check.sample_with_draft {
            "（含 draft 1 篇）"
        } else {
            ""
        };
        if diffs.is_empty() && sn == pn {
            println!("{:<16} 抽样 {sn} 行字段级一致 ✓{draft_note}", check.name);
        } else {
            ok = false;
            println!("{:<16} 抽样失败 ✗ (SQLite {sn} vs PG {pn})", check.name);
            fail_list.push(format!("{} 抽样比对失败", check.name));
            for d in &diffs {
                println!("    {d}");
                fail_list.push(format!("{}: {}", check.name, d));
            }
        }
    }

    println!("[专项断言]");

    // 7.1 featured 未迁移：PG posts 无 is_featured/featured_order 列（SQLite 侧计数供人工核对）
    let src_featured: i64 = sqlite.query_row(
        "SELECT COUNT(*) FROM posts WHERE is_featured = 1",
        [],
        |r| r.get(0),
    )?;
    let pg_featured_cols: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'posts' AND column_name IN ('is_featured', 'featured_order')",
    )
    .fetch_one(&pool)
    .await?;
    if pg_featured_cols == 0 {
        println!(
            "featured 未迁移 ✓（PG posts 无 is_featured/featured_order 列；SQLite 侧 featured 计数: {src_featured}）"
        );
    } else {
        ok = false;
        println!("featured 未迁移 ✗（PG posts 仍存在 {pg_featured_cols} 个 featured 列）");
        fail_list.push("featured 列未删除".into());
    }

    // 7.2 site_config.slogan == ''
    let slogan: String = sqlx::query_scalar("SELECT slogan FROM site_config WHERE id = 1")
        .fetch_one(&pool)
        .await?;
    if slogan.is_empty() {
        println!("site_config.slogan == '' ✓");
    } else {
        ok = false;
        println!("site_config.slogan == '' ✗（实际: '{slogan}'）");
        fail_list.push(format!("slogan 非空: {slogan}"));
    }

    // 7.3 friend_links.enabled 为 boolean 类型且 1/0 语义保留
    let links: Vec<(bool, String)> =
        sqlx::query_as("SELECT enabled, pg_typeof(enabled)::text FROM friend_links ORDER BY id")
            .fetch_all(&pool)
            .await?;
    let all_bool = links.iter().all(|(_, t)| t == "boolean");
    let true_n = links.iter().filter(|(b, _)| *b).count();
    let false_n = links.len() - true_n;
    if all_bool {
        println!("friend_links.enabled boolean 类型 ✓（true×{true_n}, false×{false_n}）");
    } else {
        ok = false;
        println!("friend_links.enabled 类型异常 ✗");
        fail_list.push("friend_links.enabled 非 boolean".into());
    }

    // 7.4 密码哈希：argon2 兼容性校验（哈希原样复制，无需重哈希）
    //  - 提供 VERIFY_PASSWORD 时做真实 argon2 验证（演练/测试用）
    //  - 缺省时仅校验 PHC 格式可解析：$argon2id$... 可解析即证明兼容 argon2 生态
    //    （bcrypt $2y$ / 明文等非 PHC 格式会解析失败 → FAIL）
    let hash: String = sqlx::query_scalar(
        "SELECT password_hash FROM admin_users WHERE username = 'admin' LIMIT 1",
    )
    .fetch_one(&pool)
    .await?;
    match PasswordHash::new(&hash) {
        Ok(parsed) => {
            match verify_password {
                Some(pw) => {
                    let verify_ok = Argon2::default()
                        .verify_password(pw.as_bytes(), &parsed)
                        .is_ok();
                    if verify_ok {
                        println!("密码哈希验证: PASS（argon2id，提供的密码可验证，哈希原样复制无需重哈希）");
                    } else {
                        ok = false;
                        println!("密码哈希验证: FAIL（提供的密码无法用 argon2 验证现有哈希）");
                        fail_list.push("密码哈希验证失败".into());
                    }
                }
                None => {
                    println!("密码哈希格式: PASS（PHC 格式可解析，兼容 argon2 生态，无需重哈希）；未提供 VERIFY_PASSWORD，跳过实际密码验证");
                }
            }
        }
        Err(e) => {
            ok = false;
            println!("密码哈希格式: FAIL（无法解析为 argon2 PHC 哈希: {e:?}——迁移后登录将失败）");
            fail_list.push("password_hash 非 argon2 PHC 格式".into());
        }
    }

    // 7.5 posts_search 行数与旧 FTS5 一致（published 篇数）
    let sqlite_fts: i64 =
        sqlite.query_row("SELECT COUNT(*) FROM posts_search", [], |r| r.get(0))?;
    let pg_fts: i64 = count_of_pg(&pool, "posts_search").await?;
    if sqlite_fts == pg_fts {
        println!("posts_search 重建 ✓（PG {pg_fts} 行 = SQLite FTS5 {sqlite_fts} 行）");
    } else {
        ok = false;
        println!("posts_search 重建 ✗（PG {pg_fts} vs SQLite {sqlite_fts}）");
        fail_list.push(format!(
            "posts_search 计数不一致: PG {pg_fts} vs SQLite {sqlite_fts}"
        ));
    }

    println!();
    if ok {
        println!("迁移完成，校验通过");
    } else {
        println!("迁移完成，校验失败:");
        for f in &fail_list {
            println!("  - {f}");
        }
        std::process::exit(1);
    }
    Ok(())
}

// ---------- 备份快照 ----------

/// 迁移前备份：`cp <sqlite_path> <sqlite_path>.<UTC时间戳>`（回滚路径：还原此快照即可恢复旧后端）
fn backup_snapshot(sqlite_path: &str) -> anyhow::Result<String> {
    let src = Path::new(sqlite_path);
    if !src.is_file() {
        anyhow::bail!("SQLite 文件不存在: {sqlite_path}");
    }
    // WAL 告警：非空 -wal 表示存在未 checkpoint 数据；生产迁移前应先停止旧后端
    let wal_file = format!("{sqlite_path}-wal");
    let wal_path = Path::new(&wal_file);
    if wal_path.is_file() && wal_path.metadata().map(|m| m.len() > 0).unwrap_or(false) {
        eprintln!(
            "警告: {sqlite_path}-wal 非空，快照不含 WAL 中未 checkpoint 的数据；生产迁移请先停止旧后端"
        );
    }
    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%S");
    let dest = format!("{sqlite_path}.{ts}");
    std::fs::copy(src, &dest).with_context(|| format!("备份快照失败: {sqlite_path} -> {dest}"))?;
    Ok(dest)
}

// ---------- 行读取辅助 ----------

/// 将 SQLite 行转为「列名 → 字符串值」映射（NULL → None，兼容源表缺列场景）
fn row_to_map(row: &Row) -> rusqlite::Result<HashMap<String, Option<String>>> {
    let mut map = HashMap::new();
    for i in 0..row.as_ref().column_count() {
        let name = row.as_ref().column_name(i).unwrap_or("").to_string();
        let value = match row.get_ref(i)? {
            ValueRef::Null => None,
            ValueRef::Integer(v) => Some(v.to_string()),
            ValueRef::Real(v) => Some(v.to_string()),
            ValueRef::Text(v) => Some(String::from_utf8_lossy(v).into_owned()),
            ValueRef::Blob(v) => Some(String::from_utf8_lossy(v).into_owned()),
        };
        map.insert(name, value);
    }
    Ok(map)
}

fn cell(map: &HashMap<String, Option<String>>, key: &str) -> Option<String> {
    map.get(key).and_then(|v| v.clone())
}
fn str_of(map: &HashMap<String, Option<String>>, key: &str) -> String {
    cell(map, key).unwrap_or_default()
}
fn opt_of(map: &HashMap<String, Option<String>>, key: &str) -> Option<String> {
    cell(map, key)
}
fn int_of(map: &HashMap<String, Option<String>>, key: &str) -> i64 {
    cell(map, key).and_then(|v| v.parse().ok()).unwrap_or(0)
}
/// SQLite INTEGER(0/1) → bool（缺列/NULL 视为 false）
fn bool_of(map: &HashMap<String, Option<String>>, key: &str) -> bool {
    cell(map, key).map(|v| v == "1").unwrap_or(false)
}
/// 源表缺列时使用默认值（兼容旧生产库结构，如 slogan）
fn defaulted_of(map: &HashMap<String, Option<String>>, key: &str, default: &str) -> String {
    cell(map, key).unwrap_or_else(|| default.to_string())
}

// ---------- 逐表迁移 ----------

async fn migrate_admin_users(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite
        .prepare("SELECT id, username, password_hash, created_at FROM admin_users ORDER BY id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO admin_users (id, username, password_hash, created_at)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "username"))
        .bind(str_of(&m, "password_hash"))
        .bind(str_of(&m, "created_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

/// posts：显式丢弃 is_featured / featured_order（精选已废弃）
async fn migrate_posts(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare(
        "SELECT id, title, slug, date, summary, theme, cover_image_url,
                content_markdown, content_html, status,
                view_count, like_count, comment_count,
                created_at, updated_at, published_at
         FROM posts ORDER BY id",
    )?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO posts (id, title, slug, date, summary, theme, cover_image_url,
                                content_markdown, content_html, status,
                                view_count, like_count, comment_count,
                                created_at, updated_at, published_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "title"))
        .bind(str_of(&m, "slug"))
        .bind(str_of(&m, "date"))
        .bind(str_of(&m, "summary"))
        .bind(opt_of(&m, "theme"))
        .bind(opt_of(&m, "cover_image_url"))
        .bind(str_of(&m, "content_markdown"))
        .bind(str_of(&m, "content_html"))
        .bind(str_of(&m, "status"))
        .bind(int_of(&m, "view_count"))
        .bind(int_of(&m, "like_count"))
        .bind(int_of(&m, "comment_count"))
        .bind(str_of(&m, "created_at"))
        .bind(str_of(&m, "updated_at"))
        .bind(opt_of(&m, "published_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

async fn migrate_tags(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare("SELECT id, name FROM tags ORDER BY id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query("INSERT INTO tags (id, name) VALUES ($1, $2)")
            .bind(int_of(&m, "id"))
            .bind(str_of(&m, "name"))
            .execute(pool)
            .await?;
        n += 1;
    }
    Ok(n)
}

async fn migrate_post_tags(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt =
        sqlite.prepare("SELECT post_id, tag_id FROM post_tags ORDER BY post_id, tag_id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query("INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)")
            .bind(int_of(&m, "post_id"))
            .bind(int_of(&m, "tag_id"))
            .execute(pool)
            .await?;
        n += 1;
    }
    Ok(n)
}

async fn migrate_media_assets(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare(
        "SELECT id, file_name, mime_type, size, url, created_at FROM media_assets ORDER BY id",
    )?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO media_assets (id, file_name, mime_type, size, url, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "file_name"))
        .bind(str_of(&m, "mime_type"))
        .bind(int_of(&m, "size"))
        .bind(str_of(&m, "url"))
        .bind(str_of(&m, "created_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

/// friend_links：enabled INTEGER(0/1) → PG boolean
async fn migrate_friend_links(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare(
        "SELECT id, name, description, avatar, url, enabled, display_order, created_at, updated_at
         FROM friend_links ORDER BY id",
    )?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO friend_links (id, name, description, avatar, url, enabled, display_order, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "name"))
        .bind(str_of(&m, "description"))
        .bind(str_of(&m, "avatar"))
        .bind(str_of(&m, "url"))
        .bind(bool_of(&m, "enabled"))
        .bind(int_of(&m, "display_order"))
        .bind(str_of(&m, "created_at"))
        .bind(str_of(&m, "updated_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

/// about_page：源表缺 hero_*/timeline_* 列时补默认（'' / '[]'）
async fn migrate_about_page(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare("SELECT * FROM about_page ORDER BY id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO about_page (id, markdown, hero_title, hero_subtitle, intro_paragraphs,
                                     narrative_sections, timeline_title, timeline_events, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "markdown"))
        .bind(defaulted_of(&m, "hero_title", ""))
        .bind(defaulted_of(&m, "hero_subtitle", ""))
        .bind(defaulted_of(&m, "intro_paragraphs", "[]"))
        .bind(defaulted_of(&m, "narrative_sections", "[]"))
        .bind(defaulted_of(&m, "timeline_title", ""))
        .bind(defaulted_of(&m, "timeline_events", "[]"))
        .bind(str_of(&m, "updated_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

async fn migrate_profile_card(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt =
        sqlite.prepare("SELECT id, name, bio, avatar, updated_at FROM profile_card ORDER BY id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO profile_card (id, name, bio, avatar, updated_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "name"))
        .bind(str_of(&m, "bio"))
        .bind(str_of(&m, "avatar"))
        .bind(str_of(&m, "updated_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

async fn migrate_profile_contacts(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare(
        "SELECT id, profile_card_id, platform, label, href, display_order
         FROM profile_contacts ORDER BY id",
    )?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO profile_contacts (id, profile_card_id, platform, label, href, display_order)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(int_of(&m, "id"))
        .bind(int_of(&m, "profile_card_id"))
        .bind(str_of(&m, "platform"))
        .bind(str_of(&m, "label"))
        .bind(str_of(&m, "href"))
        .bind(int_of(&m, "display_order"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

/// site_config：源表无 slogan 列（PRAGMA 探测）时补默认 ''
async fn migrate_site_config(sqlite: &Connection, pool: &PgPool) -> anyhow::Result<usize> {
    let mut stmt = sqlite.prepare("SELECT * FROM site_config ORDER BY id")?;
    let rows = stmt.query_map([], row_to_map)?;
    let mut n = 0usize;
    for row in rows {
        let m = row?;
        sqlx::query(
            "INSERT INTO site_config (id, site_title, site_subtitle, slogan, copyright_owner, powered_by,
                                      icp_record_text, icp_record_url, public_security_record_text,
                                      public_security_record_url, friend_link_template, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        )
        .bind(int_of(&m, "id"))
        .bind(str_of(&m, "site_title"))
        .bind(str_of(&m, "site_subtitle"))
        .bind(defaulted_of(&m, "slogan", ""))
        .bind(str_of(&m, "copyright_owner"))
        .bind(str_of(&m, "powered_by"))
        .bind(str_of(&m, "icp_record_text"))
        .bind(str_of(&m, "icp_record_url"))
        .bind(str_of(&m, "public_security_record_text"))
        .bind(str_of(&m, "public_security_record_url"))
        .bind(str_of(&m, "friend_link_template"))
        .bind(str_of(&m, "updated_at"))
        .execute(pool)
        .await?;
        n += 1;
    }
    Ok(n)
}

/// 重建 posts_search 全文镜像：仅 published，tags 空格连接（对齐旧 rebuildSearchIndex）
async fn rebuild_posts_search(pool: &PgPool) -> anyhow::Result<i64> {
    let res = sqlx::query(
        "INSERT INTO posts_search (post_id, title, summary, tags, content)
         SELECT p.id, p.title, p.summary,
                COALESCE((
                  SELECT string_agg(t.name, ' ' ORDER BY t.name)
                  FROM post_tags pt INNER JOIN tags t ON t.id = pt.tag_id
                  WHERE pt.post_id = p.id
                ), '') AS tags,
                p.content_markdown
         FROM posts p
         WHERE p.status = 'published'",
    )
    .execute(pool)
    .await?;
    Ok(res.rows_affected() as i64)
}

// ---------- 校验 ----------

async fn count_of_sqlite(sqlite: &Connection, table: &str) -> anyhow::Result<i64> {
    Ok(sqlite.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?)
}

async fn count_of_pg(pool: &PgPool, table: &str) -> anyhow::Result<i64> {
    Ok(sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await?)
}

/// 读取 PG 行（全部列 ::text 便于字符串比对），可选按 id 取单行（补 draft 抽样）
async fn fetch_pg_maps(
    pool: &PgPool,
    sql: &str,
    bind_id: Option<i64>,
) -> anyhow::Result<Vec<HashMap<String, Option<String>>>> {
    let mut q = sqlx::query(sql);
    if let Some(id) = bind_id {
        q = q.bind(id);
    }
    let rows = q.fetch_all(pool).await?;
    let mut maps = Vec::with_capacity(rows.len());
    for row in rows {
        let mut map = HashMap::new();
        for (i, col) in row.columns().iter().enumerate() {
            let v: Option<String> = row.try_get(i)?;
            map.insert(col.name().to_string(), v);
        }
        maps.push(map);
    }
    Ok(maps)
}

/// bool 列归一化：SQLite 1/0 → true/false（与 PG text 表示对齐）
fn normalize_col(col: &str, v: &str, bool_cols: &[&str]) -> String {
    if bool_cols.contains(&col) {
        match v {
            "1" => "true".to_string(),
            "0" => "false".to_string(),
            other => other.to_string(),
        }
    } else {
        v.to_string()
    }
}

/// 抽样比对：SQLite 与 PG 各取前 3 行（posts 额外补 1 篇 draft），逐目标列字段级比对
/// 返回 (SQLite 抽样行数, PG 抽样行数, 差异列表)
async fn verify_check(
    pool: &PgPool,
    sqlite: &Connection,
    check: &TableCheck,
) -> anyhow::Result<(usize, usize, Vec<String>)> {
    let mut stmt = sqlite.prepare(&format!(
        "SELECT * FROM {} ORDER BY {} LIMIT 3",
        check.name, check.order_by
    ))?;
    let mut sqlite_maps: Vec<HashMap<String, Option<String>>> =
        stmt.query_map([], row_to_map)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut draft_id: Option<i64> = None;
    if check.sample_with_draft {
        let has_draft = sqlite_maps
            .iter()
            .any(|m| m.get("status").and_then(|v| v.as_deref()) == Some("draft"));
        if !has_draft {
            let draft = sqlite.query_row(
                &format!(
                    "SELECT * FROM {} WHERE status = 'draft' ORDER BY id LIMIT 1",
                    check.name
                ),
                [],
                row_to_map,
            )?;
            draft_id = cell(&draft, "id").and_then(|v| v.parse::<i64>().ok());
            sqlite_maps.push(draft);
        }
    }

    let cols_sql = check
        .pg_cols
        .iter()
        .map(|c| format!("{c}::text"))
        .collect::<Vec<_>>()
        .join(", ");
    let pg_sql = format!(
        "SELECT {cols_sql} FROM {} ORDER BY {} LIMIT 3",
        check.name, check.order_by
    );
    let mut pg_maps = fetch_pg_maps(pool, &pg_sql, None).await?;
    if let Some(id) = draft_id {
        let extra_sql = format!("SELECT {cols_sql} FROM {} WHERE id = $1", check.name);
        let extra = fetch_pg_maps(pool, &extra_sql, Some(id)).await?;
        pg_maps.extend(extra);
    }

    let defaults: HashMap<&str, &str> = check.defaults.iter().copied().collect();
    let mut diffs = Vec::new();
    for (i, (sm, pm)) in sqlite_maps.iter().zip(pg_maps.iter()).enumerate() {
        for col in check.pg_cols {
            let expected = match sm.get(*col) {
                Some(Some(v)) => normalize_col(col, v, check.bool_cols),
                Some(None) => "NULL".to_string(),
                None => defaults
                    .get(col)
                    .copied()
                    .unwrap_or("<源列缺失>")
                    .to_string(),
            };
            let actual = match pm.get(*col) {
                Some(Some(v)) => v.clone(),
                Some(None) => "NULL".to_string(),
                None => "<目标列缺失>".to_string(),
            };
            if expected != actual {
                diffs.push(format!(
                    "行{} 列{col}: SQLite='{expected}' vs PG='{actual}'",
                    i + 1
                ));
            }
        }
    }
    if sqlite_maps.len() != pg_maps.len() {
        diffs.push(format!(
            "抽样行数不一致: SQLite {} vs PG {}",
            sqlite_maps.len(),
            pg_maps.len()
        ));
    }
    Ok((sqlite_maps.len(), pg_maps.len(), diffs))
}
