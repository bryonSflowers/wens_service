MIGRATIONS = [
    # 001 — Base tables (no foreign key dependencies)
    """
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(64) UNIQUE NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role        VARCHAR(32) NOT NULL DEFAULT 'viewer',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS llm_configs (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(128) NOT NULL,
        provider    VARCHAR(32) NOT NULL DEFAULT 'ollama',
        model       VARCHAR(128) NOT NULL,
        base_url    TEXT,
        api_key_encrypted TEXT,
        parameters  JSONB,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    # 002 — Tables referencing users / llm_configs
    """
    CREATE TABLE IF NOT EXISTS api_keys (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(128) NOT NULL,
        key_hash    TEXT NOT NULL,
        key_prefix  VARCHAR(8) NOT NULL,
        scopes      TEXT[] NOT NULL DEFAULT '{read}',
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at  TIMESTAMP,
        created_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS report_templates (
        id              SERIAL PRIMARY KEY,
        name            VARCHAR(256) NOT NULL,
        description     TEXT,
        query_text      TEXT NOT NULL,
        parameters_schema JSONB,
        is_public       BOOLEAN NOT NULL DEFAULT FALSE,
        created_by      INTEGER REFERENCES users(id),
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS generated_reports (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        template_id INTEGER REFERENCES report_templates(id),
        query       TEXT NOT NULL,
        report      TEXT NOT NULL,
        metadata    JSONB,
        model       VARCHAR(128),
        tokens_used INTEGER,
        llm_config_id INTEGER REFERENCES llm_configs(id),
        created_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS kv_store (
        id          SERIAL PRIMARY KEY,
        namespace   VARCHAR(128) NOT NULL,
        key         VARCHAR(256) NOT NULL,
        value       JSONB NOT NULL,
        tags        TEXT[],
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE (namespace, key)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_kv_store_namespace ON kv_store(namespace);
    CREATE INDEX IF NOT EXISTS idx_kv_store_tags ON kv_store USING GIN(tags);
    """,
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id),
        action      VARCHAR(64) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id VARCHAR(64),
        details     JSONB,
        ip_address  VARCHAR(45),
        created_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
    """,
]
