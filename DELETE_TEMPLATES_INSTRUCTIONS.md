# テンプレートデータ削除手順

## ⚠️ 重要な注意事項

**この操作は取り消せません。実行前に以下を確認してください：**

1. **バックアップ**: 削除前に重要なデータのバックアップを取得してください
2. **影響範囲**: 以下のデータがすべて削除されます：
   - テンプレート（templates）
   - フォーム（forms）
   - 見積書（quotes）
   - テンプレートフィールド（template_fields）
3. **カスケード削除**: テンプレートを削除すると、関連するフォームと見積書も自動削除されます

---

## 📝 削除手順

### **方法1: 本番環境のデータを削除**

ローカルPC（`C:\Users\user\Report-creation`）で実行してください：

```bash
# 1. 最新のコードを取得
git pull origin main

# 2. 削除スクリプトを実行（本番環境）
bash delete_templates_prod.sh
```

**実行時の流れ:**
1. 現在のデータ件数を表示
2. 確認プロンプトが表示される（`yes` と入力して Enter）
3. テンプレートデータを削除
4. ユーザーのカウンターをリセット
5. 削除後のデータ件数を表示

---

### **方法2: ローカル開発環境のデータを削除**

ローカルPC（`C:\Users\user\Report-creation`）で実行してください：

```bash
# ローカル開発環境のデータを削除
bash delete_templates_local.sh
```

---

### **方法3: 手動でコマンド実行**

#### 本番環境（手動）:

```bash
# ステップ1: 現在のデータ件数を確認
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM templates"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM forms"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM quotes"

# ステップ2: テンプレートデータを削除
npx wrangler d1 execute webapp-production --command="DELETE FROM templates"

# ステップ3: ユーザーのテンプレート作成数をリセット
npx wrangler d1 execute webapp-production --command="UPDATE users SET templates_created = 0"

# ステップ4: 削除後のデータ件数を確認
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM templates"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM forms"
npx wrangler d1 execute webapp-production --command="SELECT COUNT(*) as count FROM quotes"
```

#### ローカル開発環境（手動）:

```bash
# ステップ1: 現在のデータ件数を確認
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM templates"
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM forms"
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM quotes"

# ステップ2: テンプレートデータを削除
npx wrangler d1 execute webapp-production --local --command="DELETE FROM templates"

# ステップ3: ユーザーのテンプレート作成数をリセット
npx wrangler d1 execute webapp-production --local --command="UPDATE users SET templates_created = 0"

# ステップ4: 削除後のデータ件数を確認
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM templates"
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM forms"
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) as count FROM quotes"
```

---

## ✅ 削除後の確認

削除が完了したら、以下を確認してください：

1. **データ件数の確認**:
   - テンプレート数: 0件
   - フォーム数: 0件
   - 見積書数: 0件

2. **ユーザーのカウンター**:
   ```bash
   npx wrangler d1 execute webapp-production --command="SELECT user_id, email, templates_created FROM users"
   ```
   - すべてのユーザーの `templates_created` が `0` になっていること

3. **アプリケーションの動作確認**:
   - ログインできること
   - 新規フォームを作成できること
   - エラーが表示されないこと

---

## 🔧 トラブルシューティング

### エラー: `database locked`

**原因**: 開発サーバーが起動中で、データベースがロックされている

**対処法**:
```bash
# PM2で起動しているサービスを停止
pm2 stop all
pm2 delete all

# 再度削除スクリプトを実行
bash delete_templates_prod.sh
```

### エラー: `FOREIGN KEY constraint failed`

**原因**: カスケード削除が正しく設定されていない（通常は発生しない）

**対処法**:
```bash
# 手動で順番に削除
npx wrangler d1 execute webapp-production --command="DELETE FROM quotes"
npx wrangler d1 execute webapp-production --command="DELETE FROM template_fields"
npx wrangler d1 execute webapp-production --command="DELETE FROM forms"
npx wrangler d1 execute webapp-production --command="DELETE FROM templates"
npx wrangler d1 execute webapp-production --command="UPDATE users SET templates_created = 0"
```

---

## 📌 参考情報

### データベーススキーマのカスケード削除設定

```sql
-- forms テーブル
FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE

-- quotes テーブル
FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE

-- template_fields テーブル
FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
```

これにより、`templates` を削除すると、関連する `forms`、`quotes`、`template_fields` も自動削除されます。

---

## 🎯 削除後の次のステップ

1. **新しいフォーム作成フローのテスト**:
   - ダッシュボードから「新しいフォームを作成」ボタンをクリック
   - Excelファイルをアップロード
   - フォームが正常に作成されること

2. **無料プラン制限のテスト**:
   - フォーム保存件数: 1件まで
   - フォーム送信回数: 10回まで
   - 見積書保存件数: 1件まで

3. **フォーム管理画面の確認**:
   - 統合フォーム管理ページ（/forms-management）が正常に表示されること
   - 新規作成したフォームが一覧に表示されること

---

## 🚀 最終確認

削除処理が完了したら、アプリケーションをデプロイして動作確認してください：

```bash
# ローカルでビルド＆デプロイ
npm run build
npx wrangler pages deploy dist --project-name webapp
```

これで、テンプレート概念のないシンプルなフォーム管理システムとして動作します！ 🎉
