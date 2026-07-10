MIGRATIONS = [
    # 000 — Drop old tables only if they have the wrong UUID schema
    """
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='users' AND column_name='id' AND data_type='uuid'
        ) THEN
            DROP TABLE IF EXISTS audit_logs CASCADE;
            DROP TABLE IF EXISTS generated_reports CASCADE;
            DROP TABLE IF EXISTS report_templates CASCADE;
            DROP TABLE IF EXISTS api_keys CASCADE;
            DROP TABLE IF EXISTS kv_store CASCADE;
            DROP TABLE IF EXISTS llm_configs CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS schema_version CASCADE;
        END IF;
    END $$;
    """,
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
    # 003 — Portfolio tables
    """
    CREATE TABLE IF NOT EXISTS portfolios (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(256) NOT NULL,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
        id          SERIAL PRIMARY KEY,
        portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        ticker      VARCHAR(16) NOT NULL,
        shares      NUMERIC(18, 6) NOT NULL,
        avg_cost    NUMERIC(15, 4) NOT NULL,
        notes       TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    # 004 — Fundamentals cache
    """
    CREATE TABLE IF NOT EXISTS fundamentals (
        ticker              VARCHAR(16) PRIMARY KEY,
        pe_ratio            NUMERIC(12, 4),
        pb_ratio            NUMERIC(12, 4),
        ev_ebitda           NUMERIC(15, 4),
        roe                 NUMERIC(8, 4),
        debt_to_equity      NUMERIC(12, 4),
        eps                 NUMERIC(12, 4),
        eps_growth_pct      NUMERIC(8, 2),
        dividend_yield      NUMERIC(8, 4),
        dividend_payout_ratio NUMERIC(8, 4),
        market_cap          NUMERIC(20, 2),
        sector              VARCHAR(128),
        industry            VARCHAR(128),
        updated_at          TIMESTAMP DEFAULT NOW()
    );
    """,
    # 005 — Price history for charting
    """
    CREATE TABLE IF NOT EXISTS price_history (
        id      SERIAL PRIMARY KEY,
        ticker  VARCHAR(16) NOT NULL,
        date    DATE NOT NULL,
        open    NUMERIC(12, 4),
        high    NUMERIC(12, 4),
        low     NUMERIC(12, 4),
        close   NUMERIC(12, 4),
        volume  BIGINT,
        UNIQUE (ticker, date)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_history_ticker_date ON price_history(ticker, date);
    """,
    # 006 — Watchlists
    """
    CREATE TABLE IF NOT EXISTS watchlists (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        VARCHAR(256) NOT NULL,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW(),
        updated_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlist_items (
        id          SERIAL PRIMARY KEY,
        watchlist_id INTEGER NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
        ticker      VARCHAR(16) NOT NULL,
        notes       TEXT,
        added_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE (watchlist_id, ticker)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS price_alerts (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker          VARCHAR(16) NOT NULL,
        alert_type      VARCHAR(8) NOT NULL CHECK (alert_type IN ('above', 'below')),
        threshold_price NUMERIC(15, 4) NOT NULL,
        is_triggered    BOOLEAN NOT NULL DEFAULT FALSE,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        delivery_method VARCHAR(16) NOT NULL DEFAULT 'db',
        triggered_at    TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW()
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active, ticker);
    """,
    # 007 — Uploaded documents
    """
    CREATE TABLE IF NOT EXISTS uploaded_docs (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename    VARCHAR(512) NOT NULL,
        file_type   VARCHAR(32) NOT NULL,
        content     TEXT NOT NULL,
        raw_tables  JSONB,
        word_count  INTEGER DEFAULT 0,
        metadata    JSONB,
        created_at  TIMESTAMP DEFAULT NOW()
    );
    """,
    # 008 — Multi-company: add ticker to monthly_reports
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='monthly_reports' AND column_name='ticker'
        ) THEN
            ALTER TABLE monthly_reports ADD COLUMN ticker VARCHAR(16) NOT NULL DEFAULT '3045.TW';
        END IF;
    END $$;
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_monthly_reports_ticker ON monthly_reports(ticker, year, month);
    """,
    # 009 — Earnings calendar
    """
    CREATE TABLE IF NOT EXISTS earnings (
        id              SERIAL PRIMARY KEY,
        ticker          VARCHAR(16) NOT NULL,
        fiscal_year     INTEGER NOT NULL,
        fiscal_quarter  INTEGER NOT NULL,
        eps_actual      NUMERIC(12, 4),
        eps_estimate    NUMERIC(12, 4),
        revenue_actual  NUMERIC(20, 2),
        revenue_estimate NUMERIC(20, 2),
        report_date     DATE,
        updated_at      TIMESTAMP DEFAULT NOW(),
        UNIQUE (ticker, fiscal_year, fiscal_quarter)
    );
    """,
    # 010 — Backtest results
    """
    CREATE TABLE IF NOT EXISTS backtest_results (
        id                  SERIAL PRIMARY KEY,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ticker              VARCHAR(16) NOT NULL,
        strategy            VARCHAR(64) NOT NULL,
        total_return_pct    NUMERIC(10, 4),
        annualized_return_pct NUMERIC(10, 4),
        max_drawdown_pct    NUMERIC(10, 4),
        sharpe_ratio        NUMERIC(10, 4),
        parameters          JSONB,
        created_at          TIMESTAMP DEFAULT NOW()
    );
    """,
]
