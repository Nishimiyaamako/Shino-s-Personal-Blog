//! API 兼容集成测试：等价 backend/src/__tests__/api.test.ts + 全端点冒烟。
//! 使用独立测试库 shino_blog_test（自行 CREATE DATABASE）；测试串行执行（共享库 + TRUNCATE 重置）。

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use serde_json::{json, Value};
use shino_blog_backend::{auth, build_router, config::Config, db};
use tower::ServiceExt;

/// 测试库连接串（可用 TEST_DATABASE_URL 覆盖）
fn test_db_url() -> String {
    std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgres://shino_blog:local-dev-pg-password@127.0.0.1:5433/shino_blog_test".to_string()
    })
}

fn admin_db_url() -> String {
    std::env::var("TEST_DATABASE_URL")
        .map(|url| url.replace("shino_blog_test", "postgres"))
        .unwrap_or_else(|_| {
            "postgres://shino_blog:local-dev-pg-password@127.0.0.1:5433/postgres".to_string()
        })
}

/// 串行化：所有用例共享同一测试库（TRUNCATE 重置）；
/// tokio 异步互斥（await 安全，无中毒级联问题）
static DB_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

async fn lock_db() -> tokio::sync::MutexGuard<'static, ()> {
    DB_LOCK.lock().await
}

async fn create_test_database() {
    let pool = sqlx::PgPool::connect(&admin_db_url())
        .await
        .expect("连维护库失败");
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = 'shino_blog_test')",
    )
    .fetch_one(&pool)
    .await
    .expect("查询 pg_database 失败");
    if !exists {
        sqlx::query("CREATE DATABASE shino_blog_test")
            .execute(&pool)
            .await
            .expect("CREATE DATABASE shino_blog_test 失败");
    }
    pool.close().await;
}

/// 每用例独立 setup：建库 → 迁移 → 清空 → 播种默认管理员 → 全新上传目录
async fn setup() -> (Router, std::path::PathBuf) {
    create_test_database().await;

    let pool = db::init_pool(&test_db_url()).await.expect("测试库迁移失败");

    sqlx::query(
        "TRUNCATE admin_users, posts, tags, post_tags, media_assets, friend_links,
                 about_page, profile_card, profile_contacts, site_config, posts_search
         RESTART IDENTITY CASCADE",
    )
    .execute(&pool)
    .await
    .expect("TRUNCATE 失败");

    let uploads_root = std::env::temp_dir().join("shino-blog-uploads-api-compat");
    let _ = tokio::fs::remove_dir_all(&uploads_root).await;
    tokio::fs::create_dir_all(&uploads_root)
        .await
        .expect("创建上传目录失败");

    let config = Config {
        host: "127.0.0.1".to_string(),
        port: 3101,
        database_url: test_db_url(),
        uploads_root: uploads_root.to_string_lossy().into_owned(),
        node_env: "test".to_string(),
        admin_username: "admin".to_string(),
        admin_password: "admin123".to_string(),
        admin_jwt_secret: "test-jwt-secret".to_string(),
        admin_jwt_expires_hours: 24,
    };

    auth::ensure_default_admin(&pool, &config.admin_username, &config.admin_password)
        .await
        .expect("播种默认管理员失败");

    let router = build_router(db::AppState { pool, config });
    (router, uploads_root)
}

/// JSON 请求助手（对齐 api.test.ts requestJson）
async fn send(
    router: &Router,
    method: &str,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> (StatusCode, Value) {
    let mut req = Request::builder()
        .method(method)
        .uri(format!("http://localhost{path}"));

    if body.is_some() {
        req = req.header(header::CONTENT_TYPE, "application/json");
    }
    if let Some(t) = token {
        req = req.header(header::AUTHORIZATION, format!("Bearer {t}"));
    }

    let req = req
        .body(Body::from(body.map(|b| b.to_string()).unwrap_or_default()))
        .unwrap();

    let resp = router.clone().oneshot(req).await.expect("请求失败");
    let status = resp.status();
    let bytes = resp
        .into_body()
        .collect()
        .await
        .expect("读响应体失败")
        .to_bytes();
    let value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, value)
}

/// multipart 上传请求（对齐 api.test.ts requestForm）
fn upload_request(file_name: &str, mime: &str, data: Vec<u8>, token: &str) -> Request<Body> {
    let boundary = "----shino-blog-test-boundary";
    let mut buf = Vec::new();
    buf.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\nContent-Type: {mime}\r\n\r\n"
        )
        .as_bytes(),
    );
    buf.extend_from_slice(&data);
    buf.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    Request::builder()
        .method("POST")
        .uri("http://localhost/api/admin/uploads/image")
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::from(buf))
        .unwrap()
}

async fn upload(
    router: &Router,
    token: &str,
    file_name: &str,
    mime: &str,
    data: Vec<u8>,
) -> (StatusCode, Value) {
    let resp = router
        .clone()
        .oneshot(upload_request(file_name, mime, data, token))
        .await
        .unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, value)
}

async fn login(router: &Router) -> String {
    let (status, body) = send(
        router,
        "POST",
        "/api/admin/auth/login",
        Some(json!({ "username": "admin", "password": "admin123" })),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "登录失败: {body}");
    let token = body["token"].as_str().expect("响应缺 token").to_string();
    assert!(token.len() > 20, "token 过短");
    token
}

async fn create_post(router: &Router, token: &str, payload: Value) -> Value {
    let (status, body) = send(
        router,
        "POST",
        "/api/admin/posts",
        Some(payload),
        Some(token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "创建文章失败: {body}");
    body
}

fn post_payload(title: &str, slug: &str, status: &str, tags: &[&str]) -> Value {
    json!({
        "title": title,
        "slug": slug,
        "date": "2026-04-01",
        "summary": format!("{title} summary"),
        "tags": tags,
        "contentMarkdown": format!("# {title}\n\nbody of {slug}"),
        "status": status
    })
}

// ---------- 用例 ----------

#[tokio::test]
async fn login_success_with_default_admin() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;

    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/auth/login",
        Some(json!({ "username": "admin", "password": "admin123" })),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["token"].as_str().unwrap().len() > 20);
    assert_eq!(body["user"]["username"], "admin");
}

#[tokio::test]
async fn login_rejects_wrong_credentials() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;

    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/auth/login",
        Some(json!({ "username": "admin", "password": "wrong" })),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "账号或密码错误");

    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/auth/login",
        Some(json!({ "username": "", "password": "" })),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "username/password 不能为空");
}

#[tokio::test]
async fn reject_admin_endpoint_without_token() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;

    let (status, body) = send(&router, "GET", "/api/admin/posts", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Unauthorized");

    // 无效 token 同样 401
    let (status, _) = send(
        &router,
        "GET",
        "/api/admin/posts",
        None,
        Some("not-a-token"),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn draft_post_is_not_visible_in_public_list() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    create_post(
        &router,
        &token,
        json!({
            "title": "Draft Article",
            "slug": "draft-article",
            "date": "2026-04-01",
            "summary": "draft summary",
            "tags": ["draft"],
            "contentMarkdown": "# draft",
            "status": "draft"
        }),
    )
    .await;

    let (status, body) = send(&router, "GET", "/api/posts", None, None).await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(!items.iter().any(|i| i["slug"] == "draft-article"));

    // 公开详情也 404
    let (status, _) = send(&router, "GET", "/api/posts/draft-article", None, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn published_post_can_be_searched() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    create_post(
        &router,
        &token,
        json!({
            "title": "Searchable Article",
            "slug": "searchable-article",
            "date": "2026-04-01",
            "summary": "find me maybe",
            "tags": ["search"],
            "contentMarkdown": "hello keyword-shino-search",
            "status": "published"
        }),
    )
    .await;

    let (status, body) = send(
        &router,
        "GET",
        "/api/search?q=keyword-shino-search",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(
        items.iter().any(|i| i["slug"] == "searchable-article"),
        "搜索未命中: {body}"
    );
}

#[tokio::test]
async fn search_supports_title_tag_and_markdown_hits_including_chinese() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    let cases = [
        json!({
            "title": "中文标题命中测试", "slug": "search-title-hit", "date": "2026-04-01",
            "summary": "title hit", "tags": ["search-title"],
            "contentMarkdown": "normal content", "status": "published"
        }),
        json!({
            "title": "Tag Search Case", "slug": "search-tag-hit", "date": "2026-04-01",
            "summary": "tag hit", "tags": ["tag-hit-search"],
            "contentMarkdown": "normal content", "status": "published"
        }),
        json!({
            "title": "Content Search Case", "slug": "search-content-hit", "date": "2026-04-01",
            "summary": "content hit", "tags": ["search-content"],
            "contentMarkdown": "这里有正文关键字 星尘 计划", "status": "published"
        }),
    ];
    for payload in cases {
        create_post(&router, &token, payload).await;
    }

    let (status, body) = send(
        &router,
        "GET",
        "/api/search?q=%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98%E5%91%BD%E4%B8%AD%E6%B5%8B%E8%AF%95",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["slug"] == "search-title-hit"));

    let (status, body) = send(&router, "GET", "/api/search?q=tag-hit-search", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["slug"] == "search-tag-hit"));

    let (status, body) = send(
        &router,
        "GET",
        "/api/search?q=%E6%98%9F%E5%B0%98",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["slug"] == "search-content-hit"));
}

#[tokio::test]
async fn admin_list_posts_supports_q_status_tag_filters_and_pagination() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    create_post(
        &router,
        &token,
        post_payload("Alpha Draft", "alpha-draft", "draft", &["alpha"]),
    )
    .await;
    create_post(
        &router,
        &token,
        post_payload("Beta Published", "beta-published", "published", &["beta"]),
    )
    .await;
    create_post(
        &router,
        &token,
        post_payload("Gamma Published", "gamma-published", "published", &["beta"]),
    )
    .await;

    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/posts?q=Gamma",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(items.iter().any(|i| i["slug"] == "gamma-published"));
    assert!(body["total"].as_i64().unwrap() >= 1);
    assert_eq!(body["page"], 1);

    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/posts?status=draft",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(!items.is_empty());
    assert!(items.iter().all(|i| i["status"] == "draft"));

    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/posts?tag=beta",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(items.iter().any(|i| i["slug"] == "beta-published"));
    assert!(items.iter().any(|i| i["slug"] == "gamma-published"));

    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/posts?status=published&page=1&pageSize=1",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().unwrap().len(), 1);
    assert_eq!(body["page"], 1);
    assert_eq!(body["pageSize"], 1);
    assert!(body["total"].as_i64().unwrap() >= 2);
}

#[tokio::test]
async fn reject_duplicated_slug_when_creating_posts() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    let payload = json!({
        "title": "Unique Slug Base",
        "slug": "duplicate-slug-case",
        "date": "2026-04-01",
        "summary": "slug unique test",
        "tags": ["slug"],
        "contentMarkdown": "first",
        "status": "published"
    });

    let (status, _) = send(
        &router,
        "POST",
        "/api/admin/posts",
        Some(payload.clone()),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let mut second = payload;
    second["title"] = json!("Duplicate Slug Second");
    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/posts",
        Some(second),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "slug 已存在");
}

#[tokio::test]
async fn upload_rejects_unsupported_mime_type() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    let (status, body) = upload(
        &router,
        &token,
        "hello.txt",
        "text/plain",
        b"hello".to_vec(),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "仅支持 png/jpeg/webp/gif/svg 图片");
}

#[tokio::test]
async fn upload_rejects_oversized_image() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    let oversized = vec![0u8; 5 * 1024 * 1024 + 1];
    let (status, body) = upload(&router, &token, "large.png", "image/png", oversized).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "图片大小不能超过 5MB");
}

#[tokio::test]
async fn upload_image_returns_public_url() {
    let _guard = lock_db().await;
    let (router, uploads_root) = setup().await;
    let token = login(&router).await;

    let tiny_png: Vec<u8> = vec![137, 80, 78, 71, 13, 10, 26, 10];
    let (status, body) = upload(&router, &token, "tiny.png", "image/png", tiny_png).await;
    assert_eq!(status, StatusCode::OK, "上传失败: {body}");
    let item = &body["item"];
    assert!(item["url"]
        .as_str()
        .unwrap()
        .starts_with("/uploads/images/"));
    assert!(item["fileName"].as_str().unwrap().ends_with(".png"));

    // 清理上传文件
    let file_name = item["fileName"].as_str().unwrap();
    let _ = tokio::fs::remove_file(uploads_root.join("images").join(file_name)).await;
}

#[tokio::test]
async fn upload_requires_file_field() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    // 无 file 字段的 multipart
    let boundary = "----shino-blog-test-boundary";
    let body = format!("--{boundary}\r\nContent-Disposition: form-data; name=\"other\"\r\n\r\nx\r\n--{boundary}--\r\n");
    let req = Request::builder()
        .method("POST")
        .uri("http://localhost/api/admin/uploads/image")
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::from(body))
        .unwrap();
    let resp = router.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

// ---------- 冒烟：管理端全端点 ----------

#[tokio::test]
async fn smoke_admin_post_lifecycle() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    // 非法 slug → 400
    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/posts",
        Some(json!({
            "title": "Bad", "slug": "Bad Slug!", "date": "2026-04-01", "summary": "s",
            "tags": ["t"], "contentMarkdown": "m", "status": "draft"
        })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "slug 必须是 lower-kebab-case");

    let created = create_post(
        &router,
        &token,
        post_payload("Lifecycle", "lifecycle-post", "draft", &["lc"]),
    )
    .await;
    let post_id = created["item"]["id"].as_i64().unwrap();

    // GET /posts/:id
    let (status, body) = send(
        &router,
        "GET",
        &format!("/api/admin/posts/{post_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["item"]["slug"], "lifecycle-post");
    assert_eq!(body["item"]["status"], "draft");
    assert!(body["item"]["contentHtml"]
        .as_str()
        .unwrap()
        .contains("<p>"));

    // GET 不存在 → 404
    let (status, _) = send(
        &router,
        "GET",
        "/api/admin/posts/999999",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // PATCH 更新
    let (status, body) = send(
        &router,
        "PATCH",
        &format!("/api/admin/posts/{post_id}"),
        Some(json!({ "title": "Lifecycle Updated" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["item"]["title"], "Lifecycle Updated");

    // publish → 公开可见 + 可搜索
    let (status, body) = send(
        &router,
        "POST",
        &format!("/api/admin/posts/{post_id}/publish"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["item"]["status"], "published");
    assert!(body["item"]["publishedAt"].is_string());

    let (status, body) = send(&router, "GET", "/api/posts/lifecycle-post", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "published");

    // unpublish → 公开不可见
    let (status, body) = send(
        &router,
        "POST",
        &format!("/api/admin/posts/{post_id}/unpublish"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["item"]["status"], "draft");

    let (status, _) = send(&router, "GET", "/api/posts/lifecycle-post", None, None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // 重复 slug（PATCH 撞他人 slug）→ 400
    create_post(
        &router,
        &token,
        post_payload("Other", "other-post", "draft", &["o"]),
    )
    .await;
    let (status, body) = send(
        &router,
        "PATCH",
        &format!("/api/admin/posts/{post_id}"),
        Some(json!({ "slug": "other-post" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "slug 已存在");

    // DELETE
    let (status, body) = send(
        &router,
        "DELETE",
        &format!("/api/admin/posts/{post_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ok"], true);

    let (status, _) = send(
        &router,
        "GET",
        &format!("/api/admin/posts/{post_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // publish 不存在的文章 → 404
    let (status, _) = send(
        &router,
        "POST",
        "/api/admin/posts/999999/publish",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn smoke_rebuild_search_index() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    create_post(
        &router,
        &token,
        post_payload("Rebuild Me", "rebuild-me", "published", &["rb"]),
    )
    .await;

    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/posts/rebuild-search-index",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ok"], true);

    let (status, body) = send(&router, "GET", "/api/search?q=rebuild-me", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["slug"] == "rebuild-me"));
}

#[tokio::test]
async fn smoke_media_list_and_delete() {
    let _guard = lock_db().await;
    let (router, uploads_root) = setup().await;
    let token = login(&router).await;

    let tiny_png: Vec<u8> = vec![137, 80, 78, 71, 13, 10, 26, 10];
    let (status, body) = upload(&router, &token, "media.png", "image/png", tiny_png).await;
    assert_eq!(status, StatusCode::OK);
    let url = body["item"]["url"].as_str().unwrap().to_string();
    let media_id = {
        let (_, list) = send(&router, "GET", "/api/admin/media", None, Some(&token)).await;
        list["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|i| i["url"] == url)
            .expect("媒体列表应包含上传项")["id"]
            .as_i64()
            .unwrap()
    };

    // 无引用 → orphaned
    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/media?filter=orphaned",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["items"]
        .as_array()
        .unwrap()
        .iter()
        .any(|i| i["url"] == url));
    assert_eq!(body["stats"]["orphanedCount"], 1);

    // 引用后 → referenced
    create_post(
        &router,
        &token,
        json!({
            "title": "Uses Image", "slug": "uses-image", "date": "2026-04-01",
            "summary": "s", "tags": ["img"], "contentMarkdown": "![pic]({url})",
            "coverImageUrl": url, "status": "published"
        }),
    )
    .await;
    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/media?filter=referenced",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let item = body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|i| i["url"] == url)
        .expect("referenced 应包含");
    assert_eq!(item["isOrphaned"], false);
    assert!(!item["references"].as_array().unwrap().is_empty());

    // 排序参数
    let (status, _) = send(
        &router,
        "GET",
        "/api/admin/media?sort=size&order=asc&page=1&pageSize=10",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // DELETE → ok；重复删除 → 400
    let (status, body) = send(
        &router,
        "DELETE",
        &format!("/api/admin/media/{media_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ok"], true);
    let (status, body) = send(
        &router,
        "DELETE",
        &format!("/api/admin/media/{media_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "文件记录不存在");

    // 非法 id → 400
    let (status, _) = send(
        &router,
        "DELETE",
        "/api/admin/media/abc",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    let _ = uploads_root;
}

#[tokio::test]
async fn smoke_friend_links_crud() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    // 列表空
    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/friend-links",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().unwrap().len(), 0);

    // 非法 URL → 400
    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/friend-links",
        Some(json!({
            "name": "A", "description": "d", "avatar": "ftp://bad", "url": "https://a.example"
        })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["error"],
        "友链头像 URL 格式不正确，必须以 http:// 或 https:// 开头"
    );

    // 创建
    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/friend-links",
        Some(json!({
            "name": "Friend A", "description": "desc", "avatar": "https://a.example/a.png",
            "url": "https://a.example", "displayOrder": 2
        })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "创建友链失败: {body}");
    let friend_id = body["item"]["id"].as_i64().unwrap();
    assert_eq!(body["item"]["enabled"], true);
    assert_eq!(body["item"]["displayOrder"], 2);

    // 缺字段 → 400
    let (status, body) = send(
        &router,
        "POST",
        "/api/admin/friend-links",
        Some(json!({ "name": "", "description": "d", "avatar": "https://a.example/a.png", "url": "https://a.example" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "name 不能为空");

    // PATCH
    let (status, body) = send(
        &router,
        "PATCH",
        &format!("/api/admin/friend-links/{friend_id}"),
        Some(json!({ "enabled": false })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["item"]["enabled"], false);

    // 公开列表不含 disabled
    let (status, body) = send(&router, "GET", "/api/friend-links", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["items"].as_array().unwrap().len(), 0);

    // DELETE
    let (status, body) = send(
        &router,
        "DELETE",
        &format!("/api/admin/friend-links/{friend_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ok"], true);
    let (status, _) = send(
        &router,
        "DELETE",
        &format!("/api/admin/friend-links/{friend_id}"),
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    // 非法 id → 400
    let (status, _) = send(
        &router,
        "DELETE",
        "/api/admin/friend-links/xyz",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn smoke_about_profile_site_config() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;
    let token = login(&router).await;

    // about GET（默认空）
    let (status, body) = send(&router, "GET", "/api/admin/about", None, Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["heroTitle"], "");
    assert_eq!(body["introParagraphs"].as_array().unwrap().len(), 0);

    // about PATCH hero 为空 → 400
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/about",
        Some(json!({ "heroTitle": "  " })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "Hero 标题不能为空");

    // about PATCH 成功（timelineLabel 默认 'Milestones'）
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/about",
        Some(json!({
            "heroTitle": "Hi", "heroSubtitle": "sub",
            "introParagraphs": ["p1"], "narrativeSections": [],
            "timelineTitle": "Timeline", "timelineEvents": [{"id": "1", "date": "2026", "detail": "d"}]
        })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "about PATCH 失败: {body}");
    assert_eq!(body["heroTitle"], "Hi");
    assert_eq!(body["timelineLabel"], "Milestones");
    assert_eq!(body["introParagraphs"][0], "p1");

    // 公开 about 同步（timelineLabel == timelineTitle 的旧 bug 兼容）
    let (status, body) = send(&router, "GET", "/api/about", None, None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["timelineLabel"], "Timeline");
    assert_eq!(body["heroTitle"], "Hi");

    // profile-card GET（默认）
    let (status, body) = send(
        &router,
        "GET",
        "/api/admin/profile-card",
        None,
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], "Shino");

    // profile-card PATCH 空 body → 400（路由层 ?? '' 合并）
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/profile-card",
        Some(json!({})),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "name/bio/avatar 不能为空");

    // profile-card PATCH 成功（contacts 过滤空项 + displayOrder 默认序号）
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/profile-card",
        Some(json!({
            "name": "Naga", "bio": "bio", "avatar": "https://a.example/a.png",
            "contacts": [
                { "platform": "github", "label": "GH", "href": "https://github.com/x" },
                { "platform": " ", "label": "x", "href": "" }
            ]
        })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "profile PATCH 失败: {body}");
    assert_eq!(body["name"], "Naga");
    let contacts = body["contacts"].as_array().unwrap();
    assert_eq!(contacts.len(), 1);
    assert_eq!(contacts[0]["displayOrder"], 0);

    // site-config GET（默认含 slogan）
    let (status, body) = send(&router, "GET", "/api/admin/site-config", None, Some(&token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["siteTitle"], "ShinoLog");
    assert_eq!(body["slogan"], "");

    // site-config PATCH slogan
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/site-config",
        Some(json!({ "slogan": "Shino's Bolg" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["slogan"], "Shino's Bolg");
    assert_eq!(body["siteTitle"], "ShinoLog"); // 未改字段保留

    // site-config PATCH 空标题 → 400
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/site-config",
        Some(json!({ "siteTitle": "" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "站点标题不能为空");

    // site-config PATCH 非法 ICP URL → 400
    let (status, body) = send(
        &router,
        "PATCH",
        "/api/admin/site-config",
        Some(json!({ "icpRecordUrl": "javascript:alert(1)" })),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(
        body["error"],
        "ICP 备案 URL 格式不正确，必须以 http:// 或 https:// 开头"
    );
}

#[tokio::test]
async fn smoke_static_uploads_serving() {
    let _guard = lock_db().await;
    let (router, uploads_root) = setup().await;
    let token = login(&router).await;

    let tiny_png: Vec<u8> = vec![137, 80, 78, 71, 13, 10, 26, 10];
    let (status, body) = upload(&router, &token, "serve.png", "image/png", tiny_png.clone()).await;
    assert_eq!(status, StatusCode::OK);
    let file_name = body["item"]["fileName"].as_str().unwrap().to_string();

    // 存在 → 200 + content-type
    let resp = router
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("http://localhost/uploads/images/{file_name}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers().get(header::CONTENT_TYPE).unwrap(),
        "image/png"
    );
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(bytes.as_ref(), tiny_png.as_slice());

    // 不存在 → 404 { error }
    let (status, body) = send(
        &router,
        "GET",
        "/uploads/images/nonexistent.png",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "文件不存在");

    // 非法文件名 → 400
    let (status, body) = send(
        &router,
        "GET",
        "/uploads/images/..%2F..%2Fetc%2Fpasswd",
        None,
        None,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "非法文件名");

    let _ = uploads_root;
}

#[tokio::test]
async fn smoke_admin_endpoints_require_auth() {
    let _guard = lock_db().await;
    let (router, _) = setup().await;

    let paths = [
        "/api/admin/posts",
        "/api/admin/friend-links",
        "/api/admin/about",
        "/api/admin/profile-card",
        "/api/admin/site-config",
        "/api/admin/media",
        "/api/admin/posts/rebuild-search-index",
    ];
    for path in paths {
        let method = if path.ends_with("rebuild-search-index") {
            "POST"
        } else {
            "GET"
        };
        let (status, body) = send(&router, method, path, None, None).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{path} 应 401");
        assert_eq!(body["error"], "Unauthorized", "{path} 错误体");
    }

    let (status, body) = send(&router, "POST", "/api/admin/uploads/image", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Unauthorized");
}
