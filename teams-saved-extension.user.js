// ==UserScript==
// @name         Teams Saved Extensions - Slack-style "Done" and "Archive"
// @namespace    https://github.com/aiya000/dotfiles
// @version      1.1.0
// @description  Adds Slack-style "Completed" and "Archived" tabs to the "Saved" section in Microsoft Teams. You can organize items saved in "Saved" by categorizing them into "Completed" or "Archived," or by deleting them. Data is stored in localStorage.
// @author       aiya000
// @match        https://teams.microsoft.com/*
// @match        https://teams.live.com/*
// @match        https://teams.cloud.microsoft/*
// @grant        none
// ==/UserScript==

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  設計メモ
//  ─────────────────────────────────────────
//  Teams の「保存済み」パネルを検出し、以下の UI を注入する：
//
//  [保存中] [完了] [アーカイブ]  ← タブ
//
//  「保存中」タブ：
//    Teams ネイティブのリストをそのまま表示。
//    各メッセージカードに「完了にする」「アーカイブにする」ボタンを追加。
//    ボタンを押すとカードを非表示にして localStorage に保存。
//    ※ Teams 側の「保存済み」状態はそのまま（取り消しは手動）。
//
//  「完了」「アーカイブ」タブ：
//    localStorage に記録したアイテムを一覧表示。
//    「保存に戻す」→ localStorage から削除（Teams 側には元々残っている）。
//    「完全削除」→ localStorage から削除（Teams 側も手動で取り消し）。
//
//  ─────────────────────────────────────────
//  DOM 調査結果（v1.1 で判明した実際のセレクタ）
//  ─────────────────────────────────────────
//  パネル : div.fui-MessageSlice  (class: "fui-TreeGrid fui-MessageSlice ...")
//  カード  : div.fui-MessageSliceCard  (class: "fui-TreeGridRow fui-MessageSliceCard ...")
//  カードID: id="message-slice-card-saved-SavedSliceCardItem|{msgId}"
//            → {msgId} 部分を安定した識別子として使用
//
//  localStorage スキーマ:
//    key: "tse_v1"
//    value: { done: SavedItem[], archived: SavedItem[] }
//
//    SavedItem {
//      id      : string  // "SavedSliceCardItem|{msgId}" または content hash
//      sender  : string
//      text    : string  // 最初の 500 文字
//      movedAt : string  // ISO 8601
//    }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

;(function () {
  'use strict'

  // ──────────────────────────────────────────────────────────
  //  Storage
  // ──────────────────────────────────────────────────────────

  const STORAGE_KEY = 'tse_v1'

  /**
   * @typedef {{ id: string, sender: string, text: string, movedAt: string }} SavedItem
   * @typedef {{ done: SavedItem[], archived: SavedItem[] }} StoreData
   */

  const store = {
    /** @returns {StoreData} */
    load() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"done":[],"archived":[]}')
        if (!Array.isArray(parsed.done)) parsed.done = []
        if (!Array.isArray(parsed.archived)) parsed.archived = []
        return parsed
      } catch {
        return { done: [], archived: [] }
      }
    },
    /** @param {StoreData} data */
    save(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }

  // ──────────────────────────────────────────────────────────
  //  メッセージ識別子
  //  カードの id 属性から "SavedSliceCardItem|{数字}" を取り出す。
  //  取り出せなければ送信者 + テキストのハッシュで代替。
  // ──────────────────────────────────────────────────────────

  /** @param {string} str */
  function cyrb53(str) {
    let h1 = 0xdeadbeef
    let h2 = 0x41c6ce57
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i)
      h1 = Math.imul(h1 ^ c, 2654435761)
      h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
  }

  // el はカード要素（.fui-MessageSliceCard）またはその子孫
  /** @param {Element} el */
  function getMessageId(el) {
    // カード自身または祖先の id="message-slice-card-saved-*" を探す
    const card = el.matches('[id^="message-slice-card-saved-"]')
      ? el
      : el.closest('[id^="message-slice-card-saved-"]')
    if (card?.id) {
      // "message-slice-card-saved-SavedSliceCardItem|1774938888651"
      // → "SavedSliceCardItem|1774938888651"
      const match = card.id.match(/message-slice-card-saved-(.+)/)
      if (match) return match[1]
    }
    // フォールバック: コンテンツハッシュ
    const sender = extractSender(el)
    const text = el.textContent.trim().slice(0, 120)
    return 'hash:' + cyrb53(sender + '\0' + text)
  }

  /** @param {Element} el */
  function extractSender(el) {
    return (
      el.querySelector('[data-tid*="author"], [data-tid*="sender"], [class*="authorName"]')
        ?.textContent ??
      el.querySelector('[class*="author"], [class*="sender"]')?.textContent ??
      ''
    ).trim()
  }

  /** @param {Element} el */
  function extractText(el) {
    return el.textContent.trim().slice(0, 500)
  }

  // ──────────────────────────────────────────────────────────
  //  スタイル
  // ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('tse-styles')) return
    const s = document.createElement('style')
    s.id = 'tse-styles'
    s.textContent = `
      /* ── タブバー ── */
      #tse-tabs {
        display: flex;
        gap: 4px;
        padding: 8px 12px 0;
        flex-shrink: 0;
        background: inherit;
      }
      .tse-tab {
        padding: 5px 16px;
        border-radius: 6px 6px 0 0;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        border: 1px solid transparent;
        border-bottom: none;
        background: transparent;
        color: inherit;
        opacity: 0.6;
        transition: opacity .15s, background .15s;
        position: relative;
        bottom: -1px;
      }
      .tse-tab:hover { opacity: .85; background: rgba(255,255,255,0.07); }
      .tse-tab[data-active="true"] {
        opacity: 1;
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.18);
      }
      #tse-tab-divider {
        height: 1px;
        flex-shrink: 0;
        background: rgba(255,255,255,0.15);
        margin: 0 0 4px;
      }

      /* ── カードに追加するアクションボタン ── */
      /* カード（fui-MessageSliceCard）は CSS Grid。
         grid-column: 1 / -1 で全列をスパンさせて横幅いっぱいに表示する。 */
      .tse-actions {
        display: flex !important;
        grid-column: 1 / -1 !important;
        gap: 6px;
        padding: 6px 12px 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
        flex-wrap: wrap;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
      }
      /* グリッド行がボタン行を収容できるよう、暗黙行を auto にする */
      .fui-MessageSliceCard {
        grid-auto-rows: auto !important;
      }
      .tse-btn {
        padding: 3px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        border: 1px solid currentColor;
        background: transparent;
        transition: background .15s;
        line-height: 1.5;
      }
      .tse-btn:hover { background: rgba(255,255,255,0.1); }
      .tse-btn-done    { color: #6fcf97; }
      .tse-btn-arch    { color: #f2994a; }
      .tse-btn-restore { color: #56ccf2; }
      .tse-btn-delete  { color: #eb5757; }

      /* ── カスタムパネル（完了 / アーカイブ一覧） ── */
      #tse-custom-panel {
        overflow-y: auto;
        padding-bottom: 56px;
        flex: 1;
      }
      .tse-card {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .tse-card:hover { background: rgba(255,255,255,0.04); }
      .tse-card-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 4px;
        gap: 8px;
      }
      .tse-card-sender { font-size: 13px; font-weight: 600; flex-shrink: 0; }
      .tse-card-date   { font-size: 11px; opacity: 0.5; white-space: nowrap; }
      .tse-card-text   {
        font-size: 13px;
        opacity: 0.75;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.45;
        max-height: 72px;
        overflow: hidden;
      }
      .tse-empty {
        padding: 40px 16px;
        text-align: center;
        opacity: 0.45;
        font-size: 13px;
      }

      /* ── ツールバー（エクスポート / インポート） ── */
      #tse-toolbar {
        display: flex;
        gap: 8px;
        padding: 8px 12px;
        border-top: 1px solid rgba(255,255,255,0.1);
        flex-shrink: 0;
      }
      .tse-tool-btn {
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.05);
        color: inherit;
      }
      .tse-tool-btn:hover { background: rgba(255,255,255,0.12); }
    `
    document.head.appendChild(s)
  }

  // ──────────────────────────────────────────────────────────
  //  パネル・カード検出
  // ──────────────────────────────────────────────────────────

  // Teams PWA の「保存済み」コンテンツ領域
  // DOM 調査により class="fui-TreeGrid fui-MessageSlice ..." と判明
  /** @returns {HTMLElement|null} */
  function findSavedPanel() {
    return /** @type {HTMLElement|null} */ (document.querySelector('.fui-MessageSlice'))
  }

  // 保存済みメッセージのカード
  // id="message-slice-card-saved-*" が最も確実
  /** @param {Element} root @returns {HTMLElement[]} */
  function findCards(root) {
    const byId = root.querySelectorAll('[id^="message-slice-card-saved-"]')
    if (byId.length > 0) return /** @type {HTMLElement[]} */ (Array.from(byId))
    // フォールバック: クラス名
    return /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.fui-MessageSliceCard')))
  }

  // ──────────────────────────────────────────────────────────
  //  状態
  // ──────────────────────────────────────────────────────────

  /** @type {{ tab: string, panel: HTMLElement|null, tabBar: HTMLElement|null, nativeRoot: HTMLElement|null }} */
  const gState = {
    tab: 'saved', // 'saved' | 'done' | 'archived'
    panel: null, // 注入済みパネル要素
    tabBar: null,
    nativeRoot: null // Teams のネイティブリストをラップした div
  }

  // ──────────────────────────────────────────────────────────
  //  タブ切り替え
  // ──────────────────────────────────────────────────────────

  /** @param {string} tab */
  function switchTab(tab) {
    gState.tab = tab

    if (gState.tabBar) {
      gState.tabBar.querySelectorAll('.tse-tab').forEach(b => {
        const btn = /** @type {HTMLElement} */ (b)
        btn.dataset.active = String(btn.dataset.tab === tab)
      })
    }

    document.getElementById('tse-custom-panel')?.remove()
    document.getElementById('tse-toolbar')?.remove()

    if (tab === 'saved') {
      if (gState.nativeRoot) gState.nativeRoot.style.display = ''
      decorateCards(gState.nativeRoot)
    } else {
      if (gState.nativeRoot) gState.nativeRoot.style.display = 'none'
      const panel = /** @type {HTMLElement} */ (gState.panel)
      const customPanel = buildCustomPanel(tab)
      panel.appendChild(customPanel)
      panel.appendChild(buildToolbar())
    }
  }

  // ──────────────────────────────────────────────────────────
  //  カスタムパネル（完了 / アーカイブ一覧）
  // ──────────────────────────────────────────────────────────

  /** @param {string} tab */
  function buildCustomPanel(tab) {
    const data = store.load()
    const items = tab === 'done' ? data.done : data.archived
    const emptyMsg =
      tab === 'done' ? '完了済みのメッセージはないのです' : 'アーカイブ済みのメッセージはないのです'

    const root = document.createElement('div')
    root.id = 'tse-custom-panel'

    /** @param {HTMLElement} container */
    function showEmpty(container) {
      while (container.firstChild) container.removeChild(container.firstChild)
      const empty = document.createElement('div')
      empty.className = 'tse-empty'
      empty.textContent = emptyMsg
      container.appendChild(empty)
    }

    if (items.length === 0) {
      showEmpty(root)
      return root
    }

    items.forEach(item => {
      const card = document.createElement('div')
      card.className = 'tse-card'

      const header = document.createElement('div')
      header.className = 'tse-card-header'
      const senderEl = document.createElement('span')
      senderEl.className = 'tse-card-sender'
      senderEl.textContent = item.sender || '(不明)'
      const dateEl = document.createElement('span')
      dateEl.className = 'tse-card-date'
      dateEl.textContent = new Date(item.movedAt).toLocaleString('ja-JP')
      header.appendChild(senderEl)
      header.appendChild(dateEl)

      const textEl = document.createElement('div')
      textEl.className = 'tse-card-text'
      textEl.textContent = item.text || ''

      const actions = document.createElement('div')
      actions.className = 'tse-actions'

      card.appendChild(header)
      card.appendChild(textEl)
      card.appendChild(actions)

      const restoreBtn = document.createElement('button')
      restoreBtn.className = 'tse-btn tse-btn-restore'
      restoreBtn.textContent = '保存に戻す'
      restoreBtn.title =
        'このリストから削除します。Teams 側の「保存済み」にはそのまま残りますです。'
      restoreBtn.onclick = () => {
        removeFromStore(item.id, tab)
        card.remove()
        if (!root.querySelector('.tse-card')) {
          showEmpty(root)
        }
        // 「保存中」タブのカードを再表示させる（display:none を解除）
        if (gState.nativeRoot) {
          findCards(gState.nativeRoot)
            .filter(c => getMessageId(c) === item.id)
            .forEach(c => {
              c.style.display = ''
              c.querySelector('.tse-actions')?.remove()
            })
          decorateCards(gState.nativeRoot)
        }
      }

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'tse-btn tse-btn-delete'
      deleteBtn.textContent = '完全削除'
      deleteBtn.title =
        'このリストから完全に削除します。Teams 側の「保存済み」も手動で取り消してほしいのです。'
      deleteBtn.onclick = () => {
        removeFromStore(item.id, tab)
        card.remove()
        if (!root.querySelector('.tse-card')) {
          showEmpty(root)
        }
      }

      actions.appendChild(restoreBtn)
      actions.appendChild(deleteBtn)
      root.appendChild(card)
    })

    return root
  }

  // ──────────────────────────────────────────────────────────
  //  ツールバー（エクスポート / インポート）
  // ──────────────────────────────────────────────────────────

  function buildToolbar() {
    const el = document.createElement('div')
    el.id = 'tse-toolbar'

    const exportBtn = document.createElement('button')
    exportBtn.className = 'tse-tool-btn'
    exportBtn.textContent = 'エクスポート (.json)'
    exportBtn.onclick = doExport

    const importBtn = document.createElement('button')
    importBtn.className = 'tse-tool-btn'
    importBtn.textContent = 'インポート (.json)'
    importBtn.onclick = doImport

    el.appendChild(exportBtn)
    el.appendChild(importBtn)
    return el
  }

  // ──────────────────────────────────────────────────────────
  //  CRUD
  // ──────────────────────────────────────────────────────────

  /** @param {string} msgId @param {string} sender @param {string} text @param {string} status */
  function markAs(msgId, sender, text, status) {
    const data = store.load()
    const entry = { id: msgId, sender, text, movedAt: new Date().toISOString() }
    if (status === 'done') {
      data.done = data.done.filter(i => i.id !== msgId)
      data.done.unshift(entry)
    } else {
      data.archived = data.archived.filter(i => i.id !== msgId)
      data.archived.unshift(entry)
    }
    store.save(data)
  }

  /** @param {string} id @param {string} type */
  function removeFromStore(id, type) {
    const data = store.load()
    if (type === 'done') data.done = data.done.filter(i => i.id !== id)
    else data.archived = data.archived.filter(i => i.id !== id)
    store.save(data)
  }

  /** @param {string} msgId */
  function isCategorized(msgId) {
    const data = store.load()
    return data.done.some(i => i.id === msgId) || data.archived.some(i => i.id === msgId)
  }

  // ──────────────────────────────────────────────────────────
  //  エクスポート / インポート
  // ──────────────────────────────────────────────────────────

  function doExport() {
    const data = store.load()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teams-saved-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  function doImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = e => {
      const target = /** @type {HTMLInputElement} */ (e.target)
      const file = target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          const loadedReader = /** @type {FileReader} */ (ev.target)
          const imp = JSON.parse(/** @type {string} */ (loadedReader.result))
          if (!Array.isArray(imp.done) || !Array.isArray(imp.archived)) throw new Error()
          const cur = store.load()
          const merge = (
            /** @type {SavedItem[]} */ existing,
            /** @type {SavedItem[]} */ incoming
          ) => {
            const map = new Map(existing.map(i => [i.id, i]))
            incoming.forEach(i => {
              if (!map.has(i.id)) map.set(i.id, i)
            })
            return [...map.values()]
          }
          store.save({
            done: merge(cur.done, imp.done),
            archived: merge(cur.archived, imp.archived)
          })
          alert('インポート完了なのです♪')
          switchTab(gState.tab)
        } catch {
          alert('インポートに失敗しましたです…\nJSON ファイルの形式を確認してほしいのです。')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // ──────────────────────────────────────────────────────────
  //  カードへのボタン注入
  // ──────────────────────────────────────────────────────────

  /** @param {HTMLElement|null} root */
  function decorateCards(root) {
    if (!root) return
    findCards(root).forEach(decorateCard)
  }

  /** @param {HTMLElement} card */
  function decorateCard(card) {
    // 保存済みカード以外（フォロー中のスレッドなど）はスキップ
    if (
      !card.matches('[id^="message-slice-card-saved-"]') &&
      !card.closest('[id^="message-slice-card-saved-"]')
    )
      return

    const msgId = getMessageId(card)

    // 完了 / アーカイブ済みならカードを隠す
    if (isCategorized(msgId)) {
      card.style.display = 'none'
      return
    }

    // 既にボタン注入済みならスキップ
    if (card.querySelector('.tse-actions')) return

    const sender = extractSender(card)
    const text = extractText(card)

    const actions = document.createElement('div')
    actions.className = 'tse-actions'

    const doneBtn = document.createElement('button')
    doneBtn.className = 'tse-btn tse-btn-done'
    doneBtn.textContent = '完了にする'
    doneBtn.onclick = e => {
      e.stopPropagation()
      markAs(msgId, sender, text, 'done')
      card.style.display = 'none'
    }

    const archBtn = document.createElement('button')
    archBtn.className = 'tse-btn tse-btn-arch'
    archBtn.textContent = 'アーカイブにする'
    archBtn.onclick = e => {
      e.stopPropagation()
      markAs(msgId, sender, text, 'archived')
      card.style.display = 'none'
    }

    actions.appendChild(doneBtn)
    actions.appendChild(archBtn)

    // カードは fui-TreeGridRow（CSS Grid）。
    // grid-column: 1 / -1 （CSS で指定済み）で全列スパンさせるため、
    // カード自身に直接 append する。
    card.appendChild(actions)
  }

  // ──────────────────────────────────────────────────────────
  //  パネルへの UI 注入（初回 or DOM 差し替え時）
  // ──────────────────────────────────────────────────────────

  /** @param {HTMLElement} panel */
  function initPanel(panel) {
    injectStyles()
    gState.panel = panel

    // 既に注入済みならスキップ
    if (panel.querySelector('#tse-tabs')) return

    // ── タブバー ──
    const tabBar = document.createElement('div')
    tabBar.id = 'tse-tabs'
    gState.tabBar = tabBar

    ;[
      { id: 'saved', label: '保存中' },
      { id: 'done', label: '完了' },
      { id: 'archived', label: 'アーカイブ' }
    ].forEach(({ id, label }) => {
      const btn = document.createElement('button')
      btn.className = 'tse-tab'
      btn.dataset.tab = id
      btn.dataset.active = String(gState.tab === id)
      btn.textContent = label
      btn.onclick = () => switchTab(id)
      tabBar.appendChild(btn)
    })

    const divider = document.createElement('div')
    divider.id = 'tse-tab-divider'

    // ── Teams のネイティブコンテンツをラップ ──
    // panel の既存の子要素を nativeRoot に移動し、
    // タブ切り替え時に一括 display:none できるようにする
    const nativeRoot = document.createElement('div')
    nativeRoot.id = 'tse-native-root'
    nativeRoot.style.flex = '1'
    nativeRoot.style.overflow = 'auto'
    gState.nativeRoot = nativeRoot

    Array.from(panel.children).forEach(c => nativeRoot.appendChild(c))

    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.overflow = 'hidden'

    panel.appendChild(tabBar)
    panel.appendChild(divider)
    panel.appendChild(nativeRoot)

    // ── 既存カードにボタンを追加 ──
    decorateCards(nativeRoot)
  }

  // ──────────────────────────────────────────────────────────
  //  MutationObserver
  // ──────────────────────────────────────────────────────────

  /** @type {ReturnType<typeof setTimeout>|null} */
  let throttle = null

  const observer = new MutationObserver(() => {
    if (throttle) return
    throttle = setTimeout(() => {
      throttle = null
      const panel = findSavedPanel()
      if (!panel) return

      if (panel !== gState.panel || !panel.querySelector('#tse-tabs')) {
        gState.panel = null
        initPanel(panel)
      } else if (gState.tab === 'saved' && gState.nativeRoot) {
        decorateCards(gState.nativeRoot)
      }
    }, 250)
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // 起動時に既にパネルがあれば即注入
  const initialPanel = findSavedPanel()
  if (initialPanel) initPanel(initialPanel)

  // ──────────────────────────────────────────────────────────
  //  起動時「チーム」タブへの自動遷移
  //  TODO: 設定画面でオン/オフを切り替えられるようにする（デフォルト: オン）
  //        → Issue #1: https://github.com/aiya000/tampermonkey-teams-saved-extension/issues/1
  // ──────────────────────────────────────────────────────────

  let autoNavDone = false

  /** @returns {boolean} */
  function tryNavigateToTeams() {
    // 1. data-tid による検索
    const byTid = document.querySelector('[data-tid="app-bar-teams"]')
    if (byTid instanceof HTMLElement) {
      byTid.click()
      autoNavDone = true
      return true
    }

    // 2. aria-label による検索（前方一致：「チーム」「Teams」で始まるもの）
    const byLabel = Array.from(document.querySelectorAll('[aria-label]')).find(el => {
      const label = el.getAttribute('aria-label') ?? ''
      return label === 'チーム' || label.startsWith('チーム') || label === 'Teams' || label.startsWith('Teams')
    })
    if (byLabel instanceof HTMLElement) {
      byLabel.click()
      autoNavDone = true
      return true
    }

    // 3. テキストコンテンツによる検索（ナビゲーション要素内で「チーム」のもの）
    const byText = Array.from(document.querySelectorAll('[role="listitem"], [role="tab"], nav li')).find(
      el => el.textContent?.trim() === 'チーム'
    )
    if (byText) {
      const clickable = byText.querySelector('button, a') ?? byText
      if (clickable instanceof HTMLElement) {
        clickable.click()
        autoNavDone = true
        return true
      }
    }

    return false
  }

  let autoNavAttempts = 0
  const autoNavTimer = setInterval(() => {
    if (autoNavDone || tryNavigateToTeams() || ++autoNavAttempts >= 20) {
      clearInterval(autoNavTimer)
    }
  }, 500)
})()
