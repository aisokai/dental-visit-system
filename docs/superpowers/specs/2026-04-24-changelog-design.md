# 変更ログ機能 設計書

**作成日:** 2026-04-24  
**対象プロジェクト:** dental-visit-system

---

## Goal

患者の個人情報が更新された際に、変更日時（サーバータイムスタンプ）・変更者・変更内容（旧値→新値）を自動記録する。患者一覧の各行にログ確認ボタンを設け、最新5件を閲覧できる。

---

## Architecture

Firestore のサブコレクション `patients/{patientId}/changelog` に追記専用で保存する。タイムスタンプは Firestore サーバー側で付与するため改竄不可。スタッフ名は変更操作のたびに入力する（複数スタッフが同一端末を使う前提）。

---

## Tech Stack

- React 19 + Tailwind CSS v4
- Firebase Firestore（`addDoc` + `serverTimestamp`、`getDocs` + `orderBy` + `limit`）
- 既存コンポーネント: `InlineEditCell`, `StatusChangeDialog`, `PatientForm`, `Patients`

---

## データ構造

```
patients/{patientId}/changelog/{autoId}
{
  changedAt:  Timestamp        // serverTimestamp() — クライアント改竄不可
  staffName:  string           // 変更者名（変更時に入力）
  changes: [
    {
      field:    string         // フィールドキー (例: "insuranceExpiryDate")
      label:    string         // 日本語ラベル (例: "介護保険期限")
      oldValue: string         // 変更前の値（文字列化）
      newValue: string         // 変更後の値（文字列化）
    }
  ]
}
```

- 1エントリ = 1回の保存操作
- PatientForm で複数フィールドを同時変更した場合は `changes` 配列に複数入る
- 追記のみ（既存エントリは編集しない）

---

## 追跡対象フィールド

| フィールドキー | 日本語ラベル |
|---|---|
| name | 氏名 |
| chartNumber | カルテ番号 |
| phone | 電話番号 |
| addressKarte | 住所（カルテ） |
| addressVisit | 住所（訪問先） |
| isFacility | 施設区分 |
| facilityName | 施設名 |
| hasLongTermCareInsurance | 介護保険 |
| careLevel | 介護度 |
| careLevelDate | 介護度認定日 |
| insuranceExpiryDate | 介護保険期限 |
| visitSchedule | 訪問スケジュール |
| doctorVisitCountPlan | 医師訪問回数（予定） |
| hygienistVisitCountPlan | 歯科衛生士訪問回数（予定） |
| hasCareManager | ケアマネあり |
| careManagerName | ケアマネ名 |
| careManagerFacility | ケアマネ施設 |
| careManagerPhone | ケアマネ電話 |
| careManagerFax | ケアマネFAX |
| collectionMethod | 回収方法 |
| status | ステータス |
| statusDate | ステータス変更日 |
| statusReason | ステータス変更理由 |
| notes | 備考 |
| firstVisitDate | 初診日 |
| visitNumber | 訪問登録番号 |

---

## コンポーネント構成

```
新規作成:
  src/utils/changelogUtils.js         # addChangelogEntry / getLatestChangelog / FIELD_LABELS
  src/components/ChangelogModal.jsx   # 最新5件表示モーダル

既存変更:
  src/components/datacheck/InlineEditCell.jsx   # 「変更者」入力欄を追加
  src/pages/PatientForm.jsx                     # 「変更者名」フィールド追加・旧値との差分検出
  src/components/StatusChangeDialog.jsx         # 「変更者名」フィールド追加
  src/pages/Patients.jsx                        # 各行にログ確認ボタン追加
```

---

## UI・操作フロー

### 変更ログ確認（患者一覧）

- 各行の右端「編集」リンクの隣に `History` アイコンボタンを追加
- クリックで `ChangelogModal` が開き、最新5件を新しい順に表示
- 表示形式:
  ```
  25/01/15 14:32  変更者: 田中衛生士
    • 介護保険期限  2025-04 → 2026-04
    • 介護度       要介護3 → 要介護4
  ```
- 取得: `getDocs(query(collection(db, 'patients', id, 'changelog'), orderBy('changedAt', 'desc'), limit(5)))`
- ログ0件の場合「変更履歴はありません」を表示

### スタッフ名入力

**InlineEditCell（月次準備チェック・データ品質チェック）:**
- 編集モードの入力欄・保存ボタンの下に「変更者名」テキスト入力を追加
- `staffName` が空のまま保存ボタンを押すとバリデーションエラー

**PatientForm（編集フォーム）:**
- 編集時のみ（`isEditing === true`）、保存ボタン直上に「変更者名」必須フィールドを表示
- 新規登録時は不要（初回登録は変更ログ対象外）
- 旧値は `useEffect` でデータ取得時に `originalForm` として別途保持し、submit時に差分を検出

**StatusChangeDialog:**
- 既存の「変更日・理由」欄の下に「変更者名」必須フィールドを追加

---

## changelogUtils.js の仕様

```js
// 追跡対象フィールドの日本語ラベル
export const FIELD_LABELS = { /* 上記テーブルのマッピング */ }

// 1エントリを changelog サブコレクションに追記
// changes: [{ field, label, oldValue, newValue }]
export async function addChangelogEntry(patientId, staffName, changes) { ... }

// 最新 N 件を取得（デフォルト5件）
export async function getLatestChangelog(patientId, limitCount = 5) { ... }
```

---

## タイムスタンプ表示フォーマット

- Firestore Timestamp → `format(ts.toDate(), 'yy/MM/dd HH:mm')` （date-fns使用）
- 例: `25/01/15 14:32`

---

## エラー・エッジケース

- changelog 書き込み失敗: メインの保存処理は成功させた上で、Toast で「変更ログの記録に失敗しました」を表示（保存自体はロールバックしない）
- changelog 読み込み失敗: モーダル内に「履歴の取得に失敗しました」を表示
- 変更なし（PatientForm で何も変えずに保存）: `changes` が空配列 → changelog に書き込まない
- ログ0件: 「変更履歴はありません」を表示

---

## スコープ外

- ログの削除・修正機能
- 6件以上の履歴閲覧（ページネーション）
- 変更者名のマスタ管理（都度入力で対応）
