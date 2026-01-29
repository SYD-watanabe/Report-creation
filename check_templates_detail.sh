#!/bin/bash
echo "========================================="
echo "テンプレート詳細確認スクリプト"
echo "========================================="
echo ""

echo "📊 テンプレート一覧（全件）:"
npx wrangler d1 execute webapp-production --remote --command="SELECT template_id, template_name, user_id, created_at FROM templates"
echo ""

echo "📊 ユーザー別テンプレート数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT user_id, COUNT(*) as template_count FROM templates GROUP BY user_id"
echo ""

echo "📊 フォーム一覧（全件）:"
npx wrangler d1 execute webapp-production --remote --command="SELECT form_id, form_title, template_id, user_id FROM forms"
echo ""

echo "========================================="
echo "✅ 詳細確認完了"
echo "========================================="
