-- プラン制限のカラムを追加
-- user_subscriptions テーブルに新しい制限カラムを追加

ALTER TABLE user_subscriptions ADD COLUMN form_submission_limit INTEGER DEFAULT 10; -- フォーム送信回数制限（-1 = 無制限）
ALTER TABLE user_subscriptions ADD COLUMN quote_storage_limit INTEGER DEFAULT 1; -- 見積書保存件数制限（-1 = 無制限）

-- 既存のサブスクリプションに制限を設定
-- 無料プラン: フォーム送信10回、見積書保存1件
UPDATE user_subscriptions 
SET form_submission_limit = 10, quote_storage_limit = 1 
WHERE plan_type = 'free';

-- プレミアムプラン: すべて無制限
UPDATE user_subscriptions 
SET form_submission_limit = -1, quote_storage_limit = -1 
WHERE plan_type = 'premium';
