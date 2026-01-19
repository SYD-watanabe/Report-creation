-- サンプルユーザー（デモ用）
-- パスワード: demo123456
INSERT INTO users (email, password_hash, name, current_plan, templates_created) VALUES
('demo@example.com', '$2b$10$XQK0kCl7DkqH1HqNbJ1VNuH8yJPvE4qZ0ggXxF.vGQmLQK1xC0yXW', 'デモユーザー', 'free', 0);

-- サブスクリプション
INSERT INTO user_subscriptions (user_id, plan_type, template_limit, start_date, payment_status) VALUES
(1, 'free', 1, date('now'), 'active');
