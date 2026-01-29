#!/bin/bash
echo "========================================="
echo "ユーザーカウンターリセットスクリプト"
echo "========================================="
echo ""

echo "📊 リセット前のユーザー情報:"
npx wrangler d1 execute webapp-production --remote --command="SELECT user_id, email, templates_created FROM users"
echo ""

echo "🔄 templates_created を 0 にリセット中..."
npx wrangler d1 execute webapp-production --remote --command="UPDATE users SET templates_created = 0"
echo "✅ リセット完了"
echo ""

echo "📊 リセット後のユーザー情報:"
npx wrangler d1 execute webapp-production --remote --command="SELECT user_id, email, templates_created FROM users"
echo ""

echo "========================================="
echo "✅ カウンターリセット完了"
echo "========================================="
