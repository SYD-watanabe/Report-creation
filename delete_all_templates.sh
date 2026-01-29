#!/bin/bash
echo "========================================="
echo "全テンプレート削除スクリプト"
echo "========================================="
echo ""

echo "⚠️  警告: すべてのテンプレートとフォームを削除します"
echo ""

echo "📊 削除前のデータ:"
echo "テンプレート数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM templates"
echo ""
echo "フォーム数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM forms"
echo ""

read -p "削除を実行しますか？ (yes と入力): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 削除をキャンセルしました"
    exit 0
fi

echo ""
echo "🗑️  テンプレートを削除中..."
npx wrangler d1 execute webapp-production --remote --command="DELETE FROM templates"
echo "✅ テンプレート削除完了"
echo ""

echo "🔄 ユーザーカウンターをリセット中..."
npx wrangler d1 execute webapp-production --remote --command="UPDATE users SET templates_created = 0"
echo "✅ カウンターリセット完了"
echo ""

echo "📊 削除後のデータ:"
echo "テンプレート数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM templates"
echo ""
echo "フォーム数:"
npx wrangler d1 execute webapp-production --remote --command="SELECT COUNT(*) as count FROM forms"
echo ""

echo "========================================="
echo "✅ 全削除完了"
echo "========================================="
