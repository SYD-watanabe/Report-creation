-- ユーザーテーブル
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    current_plan TEXT DEFAULT 'free' CHECK (current_plan IN ('free', 'premium')),
    templates_created INTEGER DEFAULT 0 CHECK (templates_created >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ユーザーサブスクリプションテーブル
CREATE TABLE user_subscriptions (
    subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'premium')),
    template_limit INTEGER NOT NULL DEFAULT 1, -- -1 = 無制限
    start_date TEXT NOT NULL,
    expiry_date TEXT,
    payment_status TEXT DEFAULT 'active' CHECK (payment_status IN ('active', 'canceled', 'expired')),
    stripe_subscription_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- テンプレートテーブル
CREATE TABLE templates (
    template_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    template_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'xls', 'pdf')),
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    quotes_created INTEGER DEFAULT 0 CHECK (quotes_created >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- テンプレート項目テーブル
CREATE TABLE template_fields (
    field_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK (field_type IN ('input', 'calc', 'fixed')),
    data_type TEXT DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'date')),
    cell_position TEXT,
    calculation_formula TEXT,
    fixed_value TEXT,
    is_required INTEGER DEFAULT 0 CHECK (is_required IN (0, 1)),
    display_order INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
);

-- フォームテーブル
CREATE TABLE forms (
    form_id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    form_url TEXT UNIQUE NOT NULL,
    form_title TEXT NOT NULL,
    form_description TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    access_count INTEGER DEFAULT 0 CHECK (access_count >= 0),
    submission_count INTEGER DEFAULT 0 CHECK (submission_count >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 見積書テーブル
CREATE TABLE quotes (
    quote_id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    input_data TEXT NOT NULL, -- JSON形式
    calculated_data TEXT, -- JSON形式
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_templates_user_id ON templates(user_id);
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);
CREATE INDEX idx_fields_template_id ON template_fields(template_id);
CREATE INDEX idx_fields_display_order ON template_fields(template_id, display_order);
CREATE INDEX idx_forms_url ON forms(form_url);
CREATE INDEX idx_forms_template_id ON forms(template_id);
CREATE INDEX idx_forms_user_id ON forms(user_id);
CREATE INDEX idx_forms_is_active ON forms(is_active);
CREATE INDEX idx_quotes_form_id ON quotes(form_id);
CREATE INDEX idx_quotes_template_id ON quotes(template_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
