// scripts/migrate.mjs
// 施設名正規化 + 訪問登録番号割り振りスクリプト
// 実行方法: node scripts/migrate.mjs

import { readFileSync } from 'fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore'

// .env ファイルから環境変数を手動で読み込む（dotenv を使わずシンプルに）
function loadEnv() {
  const envPath = new URL('../.env', import.meta.url).pathname
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    env[key] = val
  }
  return env
}

const env = loadEnv()

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// ─── 施設名の正規化 ───────────────────────────────────────
/**
 * 施設名を正規化（グループ化キーとして使用）
 * 全角数字・括弧・スペースを半角に変換し、前後トリム
 */
function normalizeFacilityName(name) {
  if (!name) return ''
  return name
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/　/g, ' ')
    .trim()
    .toLowerCase()
}

// ─── メイン処理 ────────────────────────────────────────────
async function main() {
  console.log('=== 患者データ移行スクリプト ===\n')

  // 全患者取得
  const snap = await getDocs(collection(db, 'patients'))
  const patients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`患者数: ${patients.length} 件\n`)

  if (patients.length === 0) {
    console.log('患者データがありません。終了します。')
    process.exit(0)
  }

  // ─── 1. 施設名の表記ゆれ修正 ─────────────────────────────
  console.log('【1】施設名の表記ゆれを修正中...')

  // 施設患者のみ対象（isFacility=true かつ facilityName がある）
  const facilityPatients = patients.filter(p => p.isFacility && p.facilityName)

  // 正規化名でグループ化し、各表記の出現数をカウント
  const facilityGroups = new Map() // normalizedName → Map<rawName, count>
  for (const p of facilityPatients) {
    const key = normalizeFacilityName(p.facilityName)
    if (!facilityGroups.has(key)) facilityGroups.set(key, new Map())
    const counts = facilityGroups.get(key)
    counts.set(p.facilityName, (counts.get(p.facilityName) ?? 0) + 1)
  }

  // 多数派を決定し、修正が必要な患者をリストアップ
  const facilityFixes = new Map() // patientId → correct facilityName
  let fixGroupCount = 0
  for (const [normalizedKey, counts] of facilityGroups) {
    if (counts.size <= 1) continue // 表記が1種類なら修正不要

    // 出現数が最多の表記を多数派とする（同数の場合は辞書順で先のものを選択）
    let majority = ''
    let maxCount = 0
    for (const [name, count] of counts) {
      if (count > maxCount || (count === maxCount && name < majority)) {
        majority = name
        maxCount = count
      }
    }

    fixGroupCount++
    console.log(`\n  グループ: "${normalizedKey}"`)
    console.log(`  多数派 → "${majority}" (${maxCount}件) ← この表記に統一`)
    for (const [name, count] of counts) {
      if (name !== majority) {
        console.log(`  少数派 → "${name}" (${count}件) を修正`)
        for (const p of facilityPatients) {
          if (p.facilityName === name) {
            facilityFixes.set(p.id, majority)
          }
        }
      }
    }
  }

  if (fixGroupCount === 0) {
    console.log('  表記ゆれなし（修正不要）')
  } else {
    console.log(`\n  修正対象患者: ${facilityFixes.size} 件`)
  }
  console.log()

  // ─── 2. 訪問登録番号の割り振り ───────────────────────────
  console.log('【2】訪問登録番号を割り振り中...')

  // firstVisitDate があるものを先（昇順）、ないものを後（chartNumber 数値昇順）でソート
  const sorted = [...patients].sort((a, b) => {
    const hasFVA = !!a.firstVisitDate
    const hasFVB = !!b.firstVisitDate
    if (hasFVA && hasFVB) {
      // 両方ある → firstVisitDate 昇順
      return a.firstVisitDate.localeCompare(b.firstVisitDate)
    }
    if (hasFVA && !hasFVB) return -1 // a が先
    if (!hasFVA && hasFVB) return 1  // b が先
    // 両方ない → chartNumber を数値として昇順
    const na = parseInt(a.chartNumber, 10)
    const nb = parseInt(b.chartNumber, 10)
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
    if (!isNaN(na) && isNaN(nb)) return -1
    if (isNaN(na) && !isNaN(nb)) return 1
    // 同じなら名前昇順
    return (a.name ?? '').localeCompare(b.name ?? '', 'ja')
  })

  const visitNumberUpdates = new Map() // patientId → visitNumber
  sorted.forEach((p, idx) => {
    visitNumberUpdates.set(p.id, idx + 1)
  })

  console.log('  割り当て結果（全件）:')
  sorted.forEach((p, idx) => {
    const note = p.firstVisitDate
      ? `初診日:${p.firstVisitDate}`
      : `カルテNo:${p.chartNumber || '（未設定）'}`
    console.log(`  No.${String(idx + 1).padStart(3, ' ')}  ${(p.name ?? '').padEnd(15, '　')}  [${note}]`)
  })
  console.log()

  // ─── 3. Firestore に書き込み ─────────────────────────────
  console.log('【3】Firestore に書き込み中...')

  // 各患者の更新内容をマージ（visitNumber は全員更新、facilityName は修正対象のみ）
  const allUpdates = new Map()
  for (const [patientId, visitNumber] of visitNumberUpdates) {
    allUpdates.set(patientId, { visitNumber })
  }
  for (const [patientId, facilityName] of facilityFixes) {
    const existing = allUpdates.get(patientId) ?? {}
    allUpdates.set(patientId, { ...existing, facilityName })
  }

  // writeBatch は 500 件制限があるので 400 件ずつ分割
  const BATCH_SIZE = 400
  let batchCount = 0
  let updateCount = 0

  const entries = [...allUpdates.entries()]
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = entries.slice(i, i + BATCH_SIZE)
    for (const [patientId, updates] of chunk) {
      batch.update(doc(db, 'patients', patientId), updates)
      updateCount++
    }
    await batch.commit()
    batchCount++
    console.log(`  バッチ ${batchCount} 完了 (${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} 件)`)
  }

  console.log(`\n  完了: ${updateCount} 件更新, ${batchCount} バッチ\n`)
  console.log('=== 移行完了 ===')
  process.exit(0)
}

main().catch(err => {
  console.error('エラー:', err)
  process.exit(1)
})
