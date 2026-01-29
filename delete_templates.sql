-- 既存のテンプレートデータを確認
SELECT COUNT(*) as template_count FROM templates;

-- テンプレートに紐づくデータも確認
SELECT COUNT(*) as form_count FROM forms;
SELECT COUNT(*) as quote_count FROM quotes;
SELECT COUNT(*) as field_count FROM template_fields;
