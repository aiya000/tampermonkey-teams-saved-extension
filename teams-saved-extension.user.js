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

;(function () {
  'use strict'

  const storageKey = 'tse_v1'

  /**
   * @typedef {{ id: string, sender: string, channel: string, timestamp: string, text: string }} SavedItem
   * @typedef {{ done: SavedItem[], archived: SavedItem[] }} StoreData
   */

  const store = {
    /**
     * @returns {StoreData}
     */
    load: () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '{"done":[],"archived":[]}')
        if (!Array.isArray(parsed.done)) {
          parsed.done = []
        }
        if (!Array.isArray(parsed.archived)) {
          parsed.archived = []
        }
        return parsed
      } catch {
        return { done: [], archived: [] }
      }
    },
    /**
     * @param {StoreData} data
     */
    save: (data) => {
      localStorage.setItem(storageKey, JSON.stringify(data))
    }
  }

  /**
   * cyrb53 hash — used as fallback message ID when the card's DOM id is unavailable.
   * @param {string} str
   * @returns {string}
   */
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

  /**
   * Extracts a stable message ID from a card element.
   * Prefers the `id` attribute (e.g. "SavedSliceCardItem|1234"),
   * falling back to a cyrb53 hash of sender + text.
   * @param {Element} el - A card element (.fui-MessageSliceCard) or its descendant
   * @returns {string}
   */
  function getMessageId(el) {
    const card = el.matches('[id^="message-slice-card-saved-"]')
      ? el
      : el.closest('[id^="message-slice-card-saved-"]')
    if (card !== null && card.id !== '') {
      // "message-slice-card-saved-SavedSliceCardItem|1774938888651"
      // → "SavedSliceCardItem|1774938888651"
      const match = card.id.match(/message-slice-card-saved-(.+)/)
      if (match !== null) {
        return match[1]
      }
    }
    const sender = extractSender(el)
    const text = el.textContent.trim().slice(0, 120)
    return 'hash:' + cyrb53(sender + '\0' + text)
  }

  /**
   * @param {Element} el
   * @returns {string}
   */
  function extractSender(el) {
    return (
      el.querySelector('[data-tid="message-slice-card-title"]')?.textContent ?? ''
    ).trim()
  }

  /**
   * Extracts the channel name from a saved message card.
   * The location cell contains an avatar span (with id^="avatar-") followed by
   * a plain span (no id) whose text is the channel name.
   * @param {Element} el
   * @returns {string}
   */
  function extractChannel(el) {
    const location = el.querySelector('[data-tid="message-slice-card-saved-location"]')
    if (location === null) {
      return ''
    }
    const nameSpan = location.querySelector('span[role="presentation"]:not([id])')
    return nameSpan?.textContent?.trim() ?? ''
  }

  /**
   * @param {Element} el
   * @returns {string}
   */
  function extractText(el) {
    return (
      el.querySelector('[data-tid="message-slice-card-preview"]')?.textContent?.trim() ??
      el.textContent.trim()
    ).slice(0, 500)
  }

  /**
   * @param {Element} el
   * @returns {string}
   */
  function extractTimestamp(el) {
    return el.querySelector('[data-tid="message-slice-card-timestamp"]')?.textContent?.trim() ?? ''
  }

  function injectStyles() {
    if (document.getElementById('tse-styles') !== null) {
      return
    }
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

  /**
   * Finds the Teams "Saved" content panel (div.fui-MessageSlice).
   * Multiple views (e.g. "フォロー中のスレッド") share the same class, so we
   * identify the correct panel by checking that its closest
   * [data-tid="slot-measurer"] ancestor starts with the heading "保存済み".
   * @returns {HTMLElement | null}
   */
  function findSavedPanel() {
    const panels = Array.from(document.querySelectorAll('.fui-MessageSlice')).filter(
      el => el instanceof HTMLElement
    )
    return panels.find(panel => {
      const container = panel.closest('[data-tid="slot-measurer"]')
      if (!(container instanceof HTMLElement)) {
        return false
      }
      return container.innerText.trimStart().startsWith('保存済み')
    }) ?? null
  }

  /**
   * Finds saved message cards within a root element.
   * Prefers elements with id^="message-slice-card-saved-",
   * falling back to .fui-MessageSliceCard.
   * @param {Element} root
   * @returns {HTMLElement[]}
   */
  function findCards(root) {
    const byId = root.querySelectorAll('[id^="message-slice-card-saved-"]')
    if (byId.length > 0) {
      return Array.from(byId).filter(el => el instanceof HTMLElement)
    }
    return Array.from(root.querySelectorAll('.fui-MessageSliceCard')).filter(
      el => el instanceof HTMLElement
    )
  }

  /**
   * @typedef {object} GState
   * @property {'saved' | 'done' | 'archived'} tab - Active tab identifier
   * @property {HTMLElement | null} panel - The injected panel element
   * @property {HTMLElement | null} tabBar - The tab bar element
   * @property {HTMLElement | null} nativeRoot - Wraps Teams' native message list for show/hide on tab switch
   */

  /** @type {GState} */
  const gState = {
    tab: 'saved',
    panel: null,
    tabBar: null,
    nativeRoot: null
  }

  /**
   * @param {'saved' | 'done' | 'archived'} tab
   */
  function switchTab(tab) {
    gState.tab = tab

    if (gState.tabBar !== null) {
      gState.tabBar.querySelectorAll('.tse-tab').forEach(b => {
        if (!(b instanceof HTMLElement)) {
          return
        }
        b.dataset.active = String(b.dataset.tab === tab)
      })
    }

    document.getElementById('tse-custom-panel')?.remove()
    document.getElementById('tse-toolbar')?.remove()

    if (tab === 'saved') {
      if (gState.nativeRoot !== null) {
        gState.nativeRoot.style.display = ''
      }
      decorateCards(gState.nativeRoot)
    } else {
      if (gState.nativeRoot !== null) {
        gState.nativeRoot.style.display = 'none'
      }
      const panel = gState.panel
      if (panel === null) {
        return
      }
      panel.appendChild(buildCustomPanel(tab))
      panel.appendChild(buildToolbar())
    }
  }

  /**
   * Clears a container and shows the empty-state message.
   * @param {HTMLElement} container
   * @param {string} emptyMsg
   */
  function showEmpty(container, emptyMsg) {
    while (container.firstChild !== null) {
      container.removeChild(container.firstChild)
    }
    const empty = document.createElement('div')
    empty.className = 'tse-empty'
    empty.textContent = emptyMsg
    container.appendChild(empty)
  }

  /**
   * @param {SavedItem} item
   * @returns {HTMLElement}
   */
  function buildCardHeader(item) {
    const header = document.createElement('div')
    header.className = 'tse-card-header'
    const senderEl = document.createElement('span')
    senderEl.className = 'tse-card-sender'
    senderEl.textContent = item.channel
      ? `${item.sender || '(不明)'} / ${item.channel}`
      : (item.sender || '(不明)')
    const dateEl = document.createElement('span')
    dateEl.className = 'tse-card-date'
    dateEl.textContent = item.timestamp
    header.appendChild(senderEl)
    header.appendChild(dateEl)
    return header
  }

  /**
   * @param {SavedItem} item
   * @param {'done' | 'archived'} tab
   * @param {HTMLElement} card
   * @param {HTMLElement} listRoot
   * @param {string} emptyMsg
   * @returns {HTMLButtonElement}
   */
  function buildRestoreButton(item, tab, card, listRoot, emptyMsg) {
    const btn = document.createElement('button')
    btn.className = 'tse-btn tse-btn-restore'
    btn.textContent = '保存に戻す'
    btn.title = 'このリストから削除します。Teams 側の「保存済み」にはそのまま残ります。'
    btn.onclick = () => {
      removeFromStore(item.id, tab)
      card.remove()
      if (listRoot.querySelector('.tse-card') === null) {
        showEmpty(listRoot, emptyMsg)
      }
      if (gState.nativeRoot !== null) {
        findCards(gState.nativeRoot)
          .filter(c => getMessageId(c) === item.id)
          .forEach(c => {
            c.style.display = ''
            c.querySelector('.tse-actions')?.remove()
          })
        decorateCards(gState.nativeRoot)
      }
    }
    return btn
  }

  /**
   * @param {SavedItem} item
   * @param {'done' | 'archived'} tab
   * @param {HTMLElement} card
   * @param {HTMLElement} listRoot
   * @param {string} emptyMsg
   * @returns {HTMLButtonElement}
   */
  function buildDeleteButton(item, tab, card, listRoot, emptyMsg) {
    const btn = document.createElement('button')
    btn.className = 'tse-btn tse-btn-delete'
    btn.textContent = '完全削除'
    btn.title =
      'このリストから完全に削除します。Teams 側の「保存済み」も手動で取り消してください。'
    btn.onclick = () => {
      if (!window.confirm('このメッセージを完全に削除しますか？\nTeams 側の「保存済み」も手動で取り消してください。')) {
        return
      }
      removeFromStore(item.id, tab)
      card.remove()
      if (listRoot.querySelector('.tse-card') === null) {
        showEmpty(listRoot, emptyMsg)
      }
    }
    return btn
  }

  /**
   * Builds a single card element for the done/archived list.
   * Clicking the card body (outside action buttons) navigates to the original message
   * by finding the hidden native card in nativeRoot and clicking it.
   * @param {SavedItem} item
   * @param {'done' | 'archived'} tab
   * @param {HTMLElement} listRoot - The panel root element (used to show empty state)
   * @param {string} emptyMsg - Message to display when the list becomes empty
   * @returns {HTMLElement}
   */
  function buildCard(item, tab, listRoot, emptyMsg) {
    const card = document.createElement('div')
    card.className = 'tse-card'
    card.style.cursor = 'pointer'
    card.onclick = e => {
      if (!(e.target instanceof HTMLElement)) {
        return
      }
      if (e.target.closest('.tse-actions') !== null) {
        return
      }
      if (gState.nativeRoot === null) {
        return
      }
      const nativeCard = findCards(gState.nativeRoot).find(c => getMessageId(c) === item.id)
      if (nativeCard === undefined) {
        return
      }
      nativeCard.style.display = ''
      nativeCard.click()
    }

    const textEl = document.createElement('div')
    textEl.className = 'tse-card-text'
    textEl.textContent = item.text || ''

    const actions = document.createElement('div')
    actions.className = 'tse-actions'

    card.appendChild(buildCardHeader(item))
    card.appendChild(textEl)
    card.appendChild(actions)
    actions.appendChild(buildRestoreButton(item, tab, card, listRoot, emptyMsg))
    actions.appendChild(buildDeleteButton(item, tab, card, listRoot, emptyMsg))
    return card
  }

  /**
   * Builds the custom panel for the done / archived list.
   * @param {'done' | 'archived'} tab
   * @returns {HTMLElement}
   */
  function buildCustomPanel(tab) {
    const data = store.load()
    const items = tab === 'done' ? data.done : data.archived
    const emptyMsg =
      tab === 'done' ? '完了済みのメッセージはありません。' : 'アーカイブ済みのメッセージはありません。'

    const root = document.createElement('div')
    root.id = 'tse-custom-panel'

    if (items.length === 0) {
      showEmpty(root, emptyMsg)
      return root
    }

    items.forEach(item => {
      root.appendChild(buildCard(item, tab, root, emptyMsg))
    })

    return root
  }

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

  /**
   * @param {string} msgId - Message ID: "SavedSliceCardItem|{number}" or "hash:{hash}"
   * @param {string} sender - Sender display name
   * @param {string} channel - Channel name
   * @param {string} timestamp - Post timestamp as displayed by Teams (e.g. "16:59")
   * @param {string} text - Message text (first 500 chars)
   * @param {'done' | 'archived'} status
   */
  function markAs(msgId, sender, channel, timestamp, text, status) {
    const data = store.load()
    const entry = { id: msgId, sender, channel, timestamp, text }
    if (status === 'done') {
      data.done = data.done.filter(i => i.id !== msgId)
      data.done.unshift(entry)
    } else {
      data.archived = data.archived.filter(i => i.id !== msgId)
      data.archived.unshift(entry)
    }
    store.save(data)
  }

  /**
   * @param {string} id - Message ID
   * @param {'done' | 'archived'} type
   */
  function removeFromStore(id, type) {
    const data = store.load()
    if (type === 'done') {
      data.done = data.done.filter(i => i.id !== id)
    } else {
      data.archived = data.archived.filter(i => i.id !== id)
    }
    store.save(data)
  }

  /**
   * @param {string} msgId - Message ID to check
   * @returns {boolean}
   */
  function isCategorized(msgId) {
    const data = store.load()
    return data.done.some(i => i.id === msgId) || data.archived.some(i => i.id === msgId)
  }

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
      if (!(e.target instanceof HTMLInputElement)) {
        return
      }
      const file = e.target.files?.[0]
      if (file === undefined) {
        return
      }
      const reader = new FileReader()
      reader.onload = ev => {
        try {
          if (!(ev.target instanceof FileReader)) {
            return
          }
          if (typeof ev.target.result !== 'string') {
            return
          }
          const imp = JSON.parse(ev.target.result)
          if (!Array.isArray(imp.done) || !Array.isArray(imp.archived)) {
            throw new Error()
          }
          const cur = store.load()
          const merge = (
            /** @type {SavedItem[]} */ existing,
            /** @type {SavedItem[]} */ incoming
          ) => {
            const map = new Map(existing.map(i => [i.id, i]))
            incoming.forEach(i => {
              if (!map.has(i.id)) {
                map.set(i.id, i)
              }
            })
            return [...map.values()]
          }
          store.save({
            done: merge(cur.done, imp.done),
            archived: merge(cur.archived, imp.archived)
          })
          alert('インポートが完了しました。')
          switchTab(gState.tab)
        } catch {
          alert('インポートに失敗しました。\nJSON ファイルの形式を確認してください。')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  /**
   * Decorates saved message cards with "Done" and "Archive" action buttons.
   * @param {HTMLElement | null} root
   */
  function decorateCards(root) {
    if (root === null) {
      return
    }
    findCards(root).forEach(decorateCard)
  }

  /**
   * Injects "完了にする" and "アーカイブにする" buttons into a single saved message card.
   * Steps:
   *   1. Skip non-saved cards (followed threads, etc.)
   *   2. If already categorized (done/archived), hide the card
   *   3. If buttons already injected, skip
   *   4. Append action buttons to the card
   *      (The card is a fui-TreeGridRow CSS Grid; CSS sets grid-column: 1 / -1 for full-width)
   * @param {HTMLElement} card
   */
  function decorateCard(card) {
    if (
      !card.matches('[id^="message-slice-card-saved-"]') &&
      !card.closest('[id^="message-slice-card-saved-"]')
    ) {
      return
    }

    const msgId = getMessageId(card)

    if (isCategorized(msgId)) {
      card.style.display = 'none'
      return
    }

    if (card.querySelector('.tse-actions') !== null) {
      return
    }

    const sender = extractSender(card)
    const channel = extractChannel(card)
    const timestamp = extractTimestamp(card)
    const text = extractText(card)

    const actions = document.createElement('div')
    actions.className = 'tse-actions'

    const doneBtn = document.createElement('button')
    doneBtn.className = 'tse-btn tse-btn-done'
    doneBtn.textContent = '完了にする'
    doneBtn.onclick = e => {
      e.stopPropagation()
      markAs(msgId, sender, channel, timestamp, text, 'done')
      card.style.display = 'none'
    }

    const archBtn = document.createElement('button')
    archBtn.className = 'tse-btn tse-btn-arch'
    archBtn.textContent = 'アーカイブにする'
    archBtn.onclick = e => {
      e.stopPropagation()
      markAs(msgId, sender, channel, timestamp, text, 'archived')
      card.style.display = 'none'
    }

    actions.appendChild(doneBtn)
    actions.appendChild(archBtn)
    card.appendChild(actions)
  }

  /**
   * Injects the TSE UI into the detected panel (first call or after DOM replacement by Teams).
   * Sets up:
   *   - Tab bar (保存中 / 完了 / アーカイブ)
   *   - Wraps existing panel children in nativeRoot for show/hide on tab switch
   *   - Decorates existing cards with action buttons
   * @param {HTMLElement} panel
   */
  function initPanel(panel) {
    injectStyles()
    gState.panel = panel

    if (panel.querySelector('#tse-tabs') !== null) {
      return
    }

    const tabBar = document.createElement('div')
    tabBar.id = 'tse-tabs'
    gState.tabBar = tabBar

    /** @type {Array<{id: 'saved' | 'done' | 'archived', label: string}>} */
    const tabDefs = [
      { id: 'saved', label: '保存中' },
      { id: 'done', label: '完了' },
      { id: 'archived', label: 'アーカイブ' }
    ]
    tabDefs.forEach(({ id, label }) => {
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

    switchTab(gState.tab)
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let throttle = null

  const observer = new MutationObserver(() => {
    if (throttle !== null) {
      return
    }
    throttle = setTimeout(() => {
      throttle = null
      const panel = findSavedPanel()
      if (panel === null) {
        return
      }

      if (panel !== gState.panel || panel.querySelector('#tse-tabs') === null) {
        gState.panel = null
        initPanel(panel)
      } else if (gState.tab === 'saved' && gState.nativeRoot !== null) {
        decorateCards(gState.nativeRoot)
      }
    }, 250)
  })

  observer.observe(document.body, { childList: true, subtree: true })

  const initialPanel = findSavedPanel()
  if (initialPanel !== null) {
    initPanel(initialPanel)
  }

  let autoNavDone = false

  /**
   * Attempts to navigate to the Teams tab on startup.
   * Uses three strategies in order:
   *   1. `data-tid="app-bar-teams"` attribute
   *   2. `aria-label` starting with "チーム" or "Teams"
   *   3. Text content "チーム" within `[role="listitem"]`, `[role="tab"]`, or `nav li`
   * TODO: Add a settings UI to toggle this (default: on)
   *       → Issue #1: https://github.com/aiya000/tampermonkey-teams-saved-extension/issues/1
   * @returns {boolean}
   */
  function tryNavigateToTeams() {
    const byTid = document.querySelector('[data-tid="app-bar-teams"]')
    if (byTid instanceof HTMLElement) {
      byTid.click()
      autoNavDone = true
      return true
    }

    const byLabel = Array.from(document.querySelectorAll('[aria-label]')).find(el => {
      const label = el.getAttribute('aria-label') ?? ''
      return (
        label === 'チーム' ||
        label.startsWith('チーム') ||
        label === 'Teams' ||
        label.startsWith('Teams')
      )
    })
    if (byLabel instanceof HTMLElement) {
      byLabel.click()
      autoNavDone = true
      return true
    }

    const byText = Array.from(
      document.querySelectorAll('[role="listitem"], [role="tab"], nav li')
    ).find(el => el.textContent?.trim() === 'チーム')
    if (byText !== undefined) {
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
