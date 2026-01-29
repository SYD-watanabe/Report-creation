#!/bin/bash
echo "========================================="
echo "ユーザーデータ確認スクリプト"
echo "========================================="
echo ""

echo "📊 ユーザー情報:"
npx wrangler d1 execute webapp-production --remote --command="SELECT user_id, email, name, templates_created FROM users"
echo ""

echo "📊 サブスクリプション情報:"
npx wrangler d1 execute webapp-production --remote --command="SELECT user_id, plan_type, template_limit, form_submission_limit, quote_storage_limit FROM user_subscriptions"
echo ""

echo "📊 テンプレート数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM templates"
echo ""

echo "📊 フォーム数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM forms"
echo ""

echo "📊 見積書数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM quotes"
echo ""

echo "========================================="
echo "✅ データ確認完了"
echo "========================================="
