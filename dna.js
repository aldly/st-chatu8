/**
 * 角色DNA记录器 · 已融合进 st-chatu8（由融合入口 index.js 引入本文件）
 * ---------------------------------------------------------------
 * 本文件是原扩展的构建产物（原 st-chatu8-dna/index.js）。
 * 字段规则已经内联在下方，不需要再跑构建脚本。
 *
 * v2.9.7：LLM 配置 / 上下文预设四块可折叠（状态记住）；预设条目与档案字段的编辑改成悬浮窗；
 *         智绘姬头像改名为 chatu8-avatar.png（中文文件名打包后容易变成乱码导致头像 404）
 * v2.9.6：LLM 配置与上下文预设拆成「档案库 / 手动生成」两套（各选各的，互不影响）；
 *         正则 & 测试工具搬进档案库最下面；手动生成新增自己的测试工具（组装/试跑，不写档案）
 * v2.9.5：上下文预设支持导出 / 改名；内置默认预设「昆仑DNA档案记录版 · 九字段」首次安装自动装入
 * v2.9.4：手动生成拆成两条独立的线——只勾世界书能生成、只勾角色也能生成
 * v2.9.3：新增「手动生成 DNA」；预设条目可编辑；档案字段可编辑；LLM 配置独立
 * v2.9.2：界面重做，与智绘姬本体同一套主题变量与组件规范；预设条目改为框内一行一条、可下拉
 * v2.9.1：预设条目可逐条开关；附加配置卡片只留两个开关
 * v2.9.0：新增「上下文预设」卡片——可导入智绘姬格式的上下文预设，DNA 记录按预设条目组装 messages
 * v2.8.0：手机版界面 + 自动认设备；双开关独立；扩展声明依赖智绘姬
 * v2.7.0：发送数据（智绘姬跑 LLM 时把 DNA 塞进它的请求）
 * v2.6.0：只收 AI 输出楼层；附加配置改为读智绘姬 LLM 配置，不再硬编码
 * v2.5.0：接上智绘姬正则，新增测试工具
 * v2.2.0：API 配置直接复用智绘姬 LLM 页签那份，不再单独存一份
 */

import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';

const MODULE = 'st-chatu8-dna';
const CHATU8 = 'st-chatu8';
const SHARED = '__shared__';
const NO_CARD = '__no_card__';

/* ------------------------------ 默认设置 ------------------------------ */
const DEFAULTS = {
    enabled: true,
    followChar: true,          // 档案跟随角色卡：每张卡一个独立档案库
    updateExisting: true,      // AI自动更新档案库：同名角色按当前剧情更新
    scanDepth: 3,              // 每次扫最近 N 层
    autoScan: true,            // 自动记录
    autoEvery: 3,              // 每 N 层 AI 回复触发一次
    notify: true,
    useRegex: true,            // 发送给 AI 之前先过一遍智绘姬的正则
    libWorldbook: true,        // 扫描时按正文里出现的人名回世界书找设定，命中的条目整条带上
    /* 界面：auto = 手机用手机版、电脑用电脑版；也可以手动锁定 */
    uiMode: 'auto',
    /* 附加配置：这两项在插件里有自己的开关，和智绘姬 LLM 页签那边的开关互不影响 */
    breakTool: true,           // 用智绘姬「自定义 Tool 工具配置」
    breakTail: true,           // 用智绘姬「末尾多 Role 消息」
    /* 发送数据：智绘姬跑 LLM（出 Tag / Tag 修改…）时，把对应角色的 DNA 一起发过去 */
    sendEnabled: true,
    sendTargets: ['image_gen', 'tag_modify'],
    sendMode: 'mentioned',     // mentioned = 只发正文里提到的角色；all = 发本库全部
    retryCount: 0,             // 请求失败时自动重试几次；0 = 不重试
    /* 上下文预设：导入一份智绘姬格式的上下文预设，DNA 记录时按它的条目组装 messages。
       不导入或关掉时，还是用下面 batchPrompt 那套内置提示词。 */
    presetEnabled: false,      // 用预设组装提示词
    presetName: '',            // 当前选中的预设名
    presetMergeSystem: false,  // 把 system 消息合并到最前面一条（默认关：保持预设原本的穿插顺序）
    presets: {},               // 档案库（自动记录）的上下文预设：{ 预设名: { entries, importedAt, source } }
    presetsGen: {},            // 手动生成自己的上下文预设库（和档案库完全分开）
    genPresetName: '',         // 手动生成当前选中的预设名
    genPresetEnabled: false,   // 手动生成用不用预设组装
    genPresetMergeSystem: false, // 手动生成把 system 合并到开头一条
    genPresetSeeded: false,    // 是否已做过「把档案库预设复制一份给手动生成」的一次性迁移
    seedPreset: '',            // 内置默认预设（档案库那份）装过没有（存文件名，装过就不再自动装）
    seedGenPreset: '',         // 内置默认预设（手动生成那份）装过没有
    /* 折叠状态：{ libLLM, libPreset, genLLM, genPreset } → true = 收起 */
    folds: {},
    /* LLM 配置：DNA 自己记一份选中的配置名。只读智绘姬那份配置列表，
       不写回智绘姬的 current_llm_profile，两边各选各的。 */
    llmProfile: '',            // 档案库（自动记录）用哪份 LLM 配置
    llmProfileGen: '',         // 手动生成用哪份 LLM 配置（和档案库分开选）
    /* 手动生成：勾世界书条目 + 勾角色 → 生成 DNA */
    genSource: 'st',           // st = 酒馆世界书（书 + 条目）；chatu8 = 智绘姬世界书（条目列表）
    genBook: '',               // 选中的酒馆世界书名
    genBookFollowCard: true,   // 进入角色卡时把世界书自动切到这张卡的主世界书（手动选书会关掉它）
    genEntries: [],            // 勾选的条目：st 存 '书::uid'，chatu8 存条目名
    genChars: [],              // 勾选的智绘姬「角色管理」角色预设名
    genExtraChars: [],         // 手动补进去的角色名
    genInstruction: '',        // 额外要求（可留空）
    records: {}                // 内置存储：{ 卡片key: { card, entries: { 角色名: 档案 } } }
};

/* 旧版本里插件自己存过一份 API 配置，现在统一用智绘姬那份，这些键直接丢掉 */
const LEGACY_KEYS = ['worldbookName', 'useChatu8LLM', 'apiFormat', 'apiUrl', 'apiKey', 'model', 'modelCache', 'temperature', 'maxTokens'];

let S = loadSettings();
/* 老版本导入的预设末尾停在闭合标签（</task> 之类），模型会认为文档已结束，直接不输出。
   这里给这种预设补一条「开始任务」触发语，补过就打标记，只补一次。 */
const START_TRIGGER = `开始任务。

[system@linux-kernel ~]$ dna-engine --extract --strict --json
# 现在开始输出：先 <director_thinking>，再 <dna_archives>，不要复述规则。`;
function patchPresetStart() {
    let changed = false;
    for (const n of Object.keys(S.presets || {})) {
        const p = S.presets[n];
        if (!p || p.startPatched) continue;
        const list = Array.isArray(p.entries) ? p.entries : null;
        if (!list || !list.length) continue;
        const hasStart = list.some((e) => String((e && e.name) || '').indexOf('开始任务') >= 0);
        const lastOn = [...list].reverse().find((e) => e && e.enabled !== false);
        const tail = String((lastOn && lastOn.content) || '').trim();
        /* 末尾只剩闭合标签 → 缺开工指令 */
        const closedOnly = /^<\/(task|DNA记录|dna_archives|payload_tag)>/i.test(tail)
            || /<\/(task|DNA记录|dna_archives)>$/i.test(tail);
        if (hasStart || !closedOnly) continue;
        list.push({
            id: 'dna_start', name: '开始任务', role: 'user', content: START_TRIGGER,
            enabled: true, triggerMode: 'always', triggerWords: '', andTriggerWords: ''
        });
        p.entries = list;
        p.startPatched = true;
        changed = true;
    }
    return changed;
}
try {
    if (patchPresetStart()) saveSettingsDebounced();
} catch (e) { /* 忽略 */ }
/* 老版本留在设置里的 API 配置字段（apiUrl/apiKey/model/apiFormat/modelCache…）立刻落盘清掉，
   免得 settings.json 里一直躺着一份用不到的配置 */
try {
    extension_settings[MODULE] = S;
    saveSettingsDebounced();
} catch (e) { /* 忽略：扩展加载早期可能还没就绪 */ }
let scanning = false;
let lastAutoFloor = 0;
let selected = null;           // 当前在详情区查看的角色名
/* 编辑一律走悬浮窗（openEditModal），不再记录「哪一行在展开编辑」 */
const LOG = [];

/* ------------------------------ 设置读写 ------------------------------ */
function loadSettings() {
    const saved = (extension_settings && extension_settings[MODULE]) || {};
    const out = {};
    for (const k in DEFAULTS) out[k] = (saved[k] === undefined || saved[k] === null) ? DEFAULTS[k] : saved[k];
    /* 老版本遗留字段，直接丢掉 */
    for (const k of LEGACY_KEYS) delete out[k];
    if (!out.records || typeof out.records !== 'object' || Array.isArray(out.records)) out.records = {};
    if (!Array.isArray(out.sendTargets)) out.sendTargets = DEFAULTS.sendTargets.slice();
    /* 发送数据的上限单位从「字」改成「token」，老字段丢掉直接用新默认 */
    delete out.sendMaxChars;
    delete out.sendMaxTokens;   // 请求长度不再设上限，老字段清掉
    out.retryCount = clampInt(out.retryCount, 0, 5, 0);
    if (!out.sendMode) out.sendMode = DEFAULTS.sendMode;
    if (!out.presets || typeof out.presets !== 'object' || Array.isArray(out.presets)) out.presets = {};
    if (!out.folds || typeof out.folds !== 'object' || Array.isArray(out.folds)) out.folds = {};
    if (!out.presetsGen || typeof out.presetsGen !== 'object' || Array.isArray(out.presetsGen)) out.presetsGen = {};
    if (typeof out.genPresetName !== 'string') out.genPresetName = '';
    if (typeof out.genPresetEnabled !== 'boolean') out.genPresetEnabled = false;
    if (typeof out.genPresetMergeSystem !== 'boolean') out.genPresetMergeSystem = false;
    if (typeof out.genPresetSeeded !== 'boolean') out.genPresetSeeded = false;
    if (typeof out.presetName !== 'string') out.presetName = '';
    if (typeof out.seedPreset !== 'string') out.seedPreset = '';
    if (typeof out.seedGenPreset !== 'string') out.seedGenPreset = '';
    if (!['auto', 'desktop', 'mobile'].includes(out.uiMode)) out.uiMode = 'auto';
    if (typeof out.libWorldbook !== 'boolean') out.libWorldbook = true;
    /* v2.9.3 新增：LLM 配置独立 + 手动生成的选择 */
    if (typeof out.llmProfile !== 'string') out.llmProfile = '';
    if (typeof out.llmProfileGen !== 'string') out.llmProfileGen = '';
    if (out.genSource !== 'chatu8') out.genSource = 'st';
    if (typeof out.genBook !== 'string') out.genBook = '';
    if (typeof out.genBookFollowCard !== 'boolean') out.genBookFollowCard = true;
    if (typeof out.genInstruction !== 'string') out.genInstruction = '';
    for (const k of ['genEntries', 'genChars', 'genExtraChars']) {
        if (!Array.isArray(out[k])) out[k] = [];
        else out[k] = out[k].filter((x) => typeof x === 'string' && x.trim());
    }
    return out;
}

function saveSettings(silent) {
    extension_settings[MODULE] = S;
    saveSettingsDebounced();
    if (!silent) toast('设置已保存');
}

/* ------------------------------ 小工具 ------------------------------ */
function esc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toast(msg, type) {
    try {
        const t = globalThis.toastr;
        if (t) { (type === 'error' ? t.error : t.success)(msg, '角色DNA记录器', { timeOut: 3200 }); return; }
    } catch (e) { /* ignore */ }
    console.log('[DNA]', msg);
}

function log(msg, level) {
    const line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    LOG.push(line);
    if (LOG.length > 300) LOG.splice(0, LOG.length - 300);
    if (level === 'error') console.error('[DNA]', msg); else console.log('[DNA]', msg);
    renderLog();
}

function renderLog() {
    const box = document.querySelector('#dna-tab [data-dna="log"]');
    if (!box) return;
    box.innerHTML = LOG.slice(-160).map((l) => '<div class="dna-log-line">' + esc(l) + '</div>').join('');
    box.scrollTop = box.scrollHeight;
}

function numOr(v, dflt) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : dflt;
}

function clampInt(v, min, max, dflt) {
    let n = parseInt(v, 10);
    if (!Number.isFinite(n)) n = dflt;
    return Math.min(max, Math.max(min, n));
}

function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ------------------------------ 角色卡上下文 ------------------------------ */
function currentCard() {
    const ctx = getContext();
    const ch = (ctx.characters || [])[ctx.characterId];
    if (ch) return ch;
    if (ctx.groupId) {
        const g = (ctx.groups || []).find((x) => x.id === ctx.groupId);
        if (g) return { name: g.name, isGroup: true, avatar: 'group:' + g.id };
    }
    return null;
}

function cardKey() {
    if (!S.followChar) return SHARED;
    const ctx = getContext();
    if (ctx.groupId) {
        const g = (ctx.groups || []).find((x) => x.id === ctx.groupId);
        return 'group:' + (g ? g.name : ctx.groupId);
    }
    const ch = (ctx.characters || [])[ctx.characterId];
    if (ch && ch.avatar) return ch.avatar;
    if (ch && ch.name) return 'char:' + ch.name;
    return NO_CARD;
}

function cardLabel() {
    if (!S.followChar) return '共用档案库';
    const ctx = getContext();
    if (ctx.groupId) {
        const g = (ctx.groups || []).find((x) => x.id === ctx.groupId);
        return '群聊：' + (g ? g.name : '未命名');
    }
    const ch = (ctx.characters || [])[ctx.characterId];
    if (ch && ch.name) return ch.name;
    return '未选择角色卡';
}

/* 角色卡自身的设定，作为人物底子交给模型（不读世界书） */
function cardOrigins() {
    const ch = currentCard();
    if (!ch || ch.isGroup) return [];
    const parts = [];
    if (ch.description) parts.push('【角色设定】\n' + ch.description);
    if (ch.personality) parts.push('【性格】\n' + ch.personality);
    if (ch.scenario) parts.push('【场景】\n' + ch.scenario);
    if (!parts.length) return [];
    let content = parts.join('\n\n');
    if (content.length > 6000) content = content.slice(0, 6000) + '\n……（已截断）';
    return [{ name: ch.name || '当前角色', content }];
}

/* ------------------------------ 内置存储 ------------------------------ */
function bucket(key, create) {
    const k = key || cardKey();
    let b = S.records[k];
    if (!b && create) {
        b = { card: cardLabel(), entries: {}, updated: 0 };
        S.records[k] = b;
    }
    if (!b) return null;
    if (!b.entries || typeof b.entries !== 'object') b.entries = {};
    return b;
}

function currentEntries() {
    const b = bucket(cardKey(), false);
    return (b && b.entries) || {};
}

function countAll() {
    let n = 0;
    for (const k in S.records) {
        const e = S.records[k] && S.records[k].entries;
        if (e) n += Object.keys(e).length;
    }
    return n;
}

/* 写入 / 更新一个角色 */
function saveRecord(profile, floor) {
    const name = String(profile['姓名'] || '').trim();
    if (!name) return 'skipped';
    const b = bucket(cardKey(), true);
    const fi = formInfo(name);
    /* 形态档案：同一角色同一形态只留一条。标记变了（[当前] ↔ [非当前]）也算同一条，
       以这次的新内容为准，旧名字那条退场，避免同一个形态在库里出现两份。 */
    let sameName = '';
    if (fi.isForm && fi.form) {
        const key = fi.base + '·' + fi.form;
        sameName = Object.keys(b.entries).find((k) => {
            if (k === name) return false;
            const o = formInfo(k);
            return o.isForm && o.form && (o.base + '·' + o.form) === key;
        }) || '';
    }
    const old = b.entries[name] || (sameName ? b.entries[sameName] : null);
    /* 锁定的档案：AI 一律不许改（自动记录 / 手动生成都会走到这里被挡住） */
    if (old && old._locked) return 'locked';
    if (old && !S.updateExisting) return 'skipped';
    /* 按 DNA_FIELDS 的顺序落盘，字段集与「重要角色表」的列一致 */
    const rec = { '姓名': name };
    for (const k of DNA_FIELDS) {
        if (k === '姓名') continue;
        rec[k] = profile[k] || '';
    }
    rec._updated = Date.now();
    rec._floor = floor || '';
    if (sameName && b.entries[sameName]) delete b.entries[sameName];
    b.entries[name] = rec;
    b.card = cardLabel();
    b.updated = Date.now();
    /* 新的这条是 [当前] → 同组其它 [当前] 自动让位 */
    if (fi.isForm && fi.isCurrent) enforceOneCurrent(fi.base, name);
    return old ? 'updated' : 'created';
}

/* ------------------------------ 档案锁 ------------------------------ */
/* 锁住 = AI 不许改这条档案：自动记录和手动生成都会跳过它，正文里的增量更新也不会动它。
   只约束 AI；你自己在详情里编辑之前会先让你解锁（点小锁即可）。 */
function isLocked(name) {
    const rec = currentEntries()[name];
    return !!(rec && rec._locked);
}

function setLock(name, on) {
    const rec = currentEntries()[name];
    if (!rec) return false;
    if (on) rec._locked = true; else delete rec._locked;
    saveSettings(true);
    return true;
}

function toggleLock(name) {
    if (!name) return false;
    const next = !isLocked(name);
    if (!setLock(name, next)) return false;
    log(next ? ('已锁定「' + name + '」，AI 不会再改它') : ('已解锁「' + name + '」，AI 可以继续更新'));
    toast(next ? ('已锁定「' + name + '」') : ('已解锁「' + name + '」'));
    renderList();
    return true;
}

function setAllLocks(on) {
    const entries = currentEntries();
    const names = Object.keys(entries);
    if (!names.length) { toast('本库还是空的'); return; }
    let n = 0;
    for (const nm of names) {
        const rec = entries[nm];
        if (!rec) continue;
        if (on) { if (!rec._locked) { rec._locked = true; n++; } }
        else if (rec._locked) { delete rec._locked; n++; }
    }
    saveSettings(true);
    log((on ? '全部锁定 ' : '全部解锁 ') + n + ' 份档案');
    toast((on ? '已锁定 ' : '已解锁 ') + n + ' 份');
    renderList();
}

function lockedCount() {
    const entries = currentEntries();
    let n = 0;
    for (const k in entries) if (entries[k] && entries[k]._locked) n++;
    return n;
}

function deleteRecord(name) {
    const b = bucket(cardKey(), false);
    if (!b || !b.entries[name]) return false;
    delete b.entries[name];
    b.updated = Date.now();
    saveSettings(true);
    return true;
}

/* 正文里出现的人名 → 回世界书里找对应条目。
   匹配方式：拿世界书条目自己的关键词（key）去正文里找，命中就带上这条的内容。
   世界书取的是「这张角色卡绑定的主世界书」，和手动生成里的「跟随角色卡」同一个来源。 */
let libWbCache = { book: '', at: 0, list: [] };
let libWbState = '';

async function libWorldbookEntries(book) {
    const now = Date.now();
    if (libWbCache.book === book && libWbCache.list.length && (now - libWbCache.at) < 60000) return libWbCache.list;
    try {
        const list = await stWorldEntries(book);
        libWbCache = { book, at: now, list };
        return list;
    } catch (e) {
        log('读世界书「' + book + '」失败：' + (e && e.message ? e.message : e), 'error');
        return [];
    }
}

async function collectLibWorldbook(text) {
    libWbState = '';
    if (!S.libWorldbook || !text) return [];
    const book = cardWorldBook();
    if (!book) { libWbState = 'nobook'; return []; }
    const list = await libWorldbookEntries(book);
    if (!list.length) { libWbState = 'empty'; return []; }
    const low = String(text).toLowerCase();
    const out = [];
    for (const e of list) {
        if (!e || e.disabled) continue;
        const keys = String(e.keywords || '')
            .split(/[、,，\s]+/)
            .map((k) => k.trim().toLowerCase())
            .filter((k) => k.length >= 2);
        if (!keys.length) continue;
        let hit = false;
        for (const k of keys) { if (low.indexOf(k) >= 0) { hit = true; break; } }
        if (!hit) continue;
        const content = String(e.content || '').trim();
        if (!content) continue;
        /* 命中的条目整条带上 */
        out.push({ name: e.title || keys[0], content });
    }
    libWbState = out.length ? ('hit:' + book) : ('miss:' + book);
    return out;
}

/* 正文里提到的、已经记录过的角色 → 交给模型做增量更新 */
function pickOldRecords(text, limit) {
    const out = [];
    const entries = currentEntries();
    const t = String(text || '');
    let used = 0;
    /* 一条档案的正文，超预算就截断 */
    const push = (name) => {
        const rec = entries[name];
        if (!rec || rec._locked) return;
        const content = buildContent(rec);
        if (!content) return;
        const room = limit - used;
        if (room <= 0) return;
        out.push({ name, content: content.length > room ? content.slice(0, room) + '……' : content });
        used += Math.min(content.length, room);
    };
    /* 按「本名」分组找：正文写「爱丽丝」也算命中「爱丽丝·魔法少女[当前]」 */
    for (const [base, list] of formGroups()) {
        if (base.length < 2) continue;
        if (t.indexOf(base) < 0) continue;
        /* 多形态角色只提交一个形态的全文：正文点名了哪个就发哪个，否则发 [当前]。
           其它形态只报名字，不占字数——让 AI 知道它们存在，别重复新建。 */
        const hits = list.filter((x) => x.info.form && !x.info.isSealed && t.indexOf(x.info.form) >= 0);
        const target = hits.length
            ? hits[hits.length - 1]
            : (list.find((x) => x.info.isCurrent) || list.find((x) => !x.info.form) || list[0]);
        push(target.name);
        const others = list.filter((x) => x.name !== target.name);
        if (others.length) {
            const room = limit - used;
            if (room > 0) {
                const names = others.map((x) => {
                    const rec = entries[x.name];
                    return (x.info.form || x.info.base)
                        + (x.info.isSealed ? '（永久封印）' : '')
                        + (rec && rec._locked ? '（已锁定，不要改）' : '');
                }).join('、');
                const content = '（这些形态已经有档案了，不要重复新建；要更新就按姓名精确对应）：' + names;
                out.push({ name: base + ' 的其它形态', content });
                used += Math.min(content.length, room);
            }
        }
    }
    return out;
}

/* ------------------------------ 正文采集 ------------------------------ */

/* 借用智绘姬的正则管道：把文本丢给它的正则页签处理，拿回处理后的结果。
   智绘姬会依次套用它「正则设置」里当前配置的全部条目 + 前后正则 + 文字正则。
   拿不到就原样返回（不能让正则挂了就记不了档）。 */
let regexBroken = false;   // 一旦确认调不通就不再每条都等超时

function regexClean(text) {
    return new Promise((resolve) => {
        const raw = String(text || '');
        if (!raw) { resolve(raw); return; }
        if (!S.useRegex || regexBroken) { resolve(raw); return; }
        let es = null;
        try { es = getContext().eventSource; } catch (e) { es = null; }
        if (!es || typeof es.emit !== 'function') { regexBroken = true; resolve(raw); return; }

        const REQ = 'regex-st-chatu8-test-message';
        const RES = 'regex-st-chatu8-result-message';
        const rid = 'dna-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        let done = false;
        const finish = (v, timedOut) => {
            if (done) return;
            done = true;
            try { es.removeListener(RES, onResult); } catch (e) { /* 忽略 */ }
            clearTimeout(timer);
            if (timedOut) {
                if (!regexBroken) {
                    regexBroken = true;
                    log('智绘姬正则没有响应，本轮改用原文（检查智绘姬正则页签是否正常）', 'error');
                }
                resolve(raw);
                return;
            }
            resolve(typeof v === 'string' ? v : raw);
        };
        const onResult = (d) => { if (d && d.id === rid) finish(d.message, false); };
        const timer = setTimeout(() => finish(raw, true), 8000);
        try {
            es.on(RES, onResult);
            es.emit(REQ, { message: raw, id: rid });
        } catch (e) { finish(raw, true); }
    });
}

/* 只跑正则、不干别的（测试工具用） */
async function regexOnly(text) {
    const raw = String(text || '');
    if (!raw) return '';
    let es = null;
    try { es = getContext().eventSource; } catch (e) { es = null; }
    if (!es || typeof es.emit !== 'function') throw new Error('拿不到酒馆的事件总线，没法调用智绘姬正则');
    return await new Promise((resolve, reject) => {
        const REQ = 'regex-st-chatu8-test-message';
        const RES = 'regex-st-chatu8-result-message';
        const rid = 'dna-t-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        let done = false;
        const finish = (ok, v) => {
            if (done) return;
            done = true;
            try { es.removeListener(RES, onResult); } catch (e) { /* 忽略 */ }
            clearTimeout(timer);
            ok ? resolve(v) : reject(new Error(v));
        };
        const onResult = (d) => { if (d && d.id === rid) finish(true, String(d.message)); };
        const timer = setTimeout(() => finish(false, '智绘姬正则处理超时（8 秒）'), 8000);
        try {
            es.on(RES, onResult);
            es.emit(REQ, { message: raw, id: rid });
        } catch (e) { finish(false, '调用正则失败：' + (e && e.message ? e.message : e)); }
    });
}

/* 正则当前用的是哪份配置 */
function regexProfileName() {
    try {
        const ch = extension_settings[CHATU8];
        return (ch && ch.current_regex_profile) || '';
    } catch (e) { return ''; }
}

function regexEntriesCount() {
    try {
        const ch = extension_settings[CHATU8];
        const name = ch && ch.current_regex_profile;
        const prof = name && ch.regex_profiles && ch.regex_profiles[name];
        if (!prof || !Array.isArray(prof.regexEntries)) return 0;
        return prof.regexEntries.filter((e) => e && !e.disabled).length;
    } catch (e) { return 0; }
}

function cleanText(s) {
    let t = String(s || '');
    t = t.replace(/<[^>]{0,300}>/g, ' ');
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    return t.trim();
}

async function collectChatText(depth) {
    const ctx = getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    if (!chat.length) return { text: '', count: 0, from: 0, to: 0, before: 0, after: 0, skipped: 0 };
    const want = clampInt(depth, 1, 300, 3);

    /* 只要 AI 输出的楼层，玩家输入一律不进正文。
       所以「最近 N 层」按 N 条 AI 回复来数：从最后一层往前找，
       找满 N 条 AI 回复就停，中间夹着的玩家楼层直接跳过。 */
    const picked = [];
    let skipped = 0;
    for (let i = chat.length - 1; i >= 0 && picked.length < want; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        if (m.is_user) { skipped++; continue; }
        if (!String(m.mes || m.message || '').trim()) continue;
        picked.push({ idx: i, mes: m });
    }
    picked.reverse();

    const parts = [];
    let beforeLen = 0, afterLen = 0;
    /* 智绘姬跑正则时会顺手 clearLog() 并往它自己的测试框里写内容，
       我们只是借它的管道，不该把用户那边的现场弄乱，所以前后存一份再还原 */
    const scene = S.useRegex && !regexBroken ? snapshotChatu8RegexUI() : null;
    try {
        /* 一条一条过正则：智绘姬的正则是把文本灌进它自己的页签里跑的，
           并发调用会互相踩，所以这里必须串行 */
        for (const item of picked) {
            const raw = String(item.mes.mes || item.mes.message || '');
            let cleaned = raw;
            if (S.useRegex) {
                beforeLen += raw.length;
                cleaned = await regexClean(raw);
                afterLen += String(cleaned || '').length;
            }
            const body = cleanText(cleaned);
            if (!body) continue;
            parts.push('【第' + item.idx + '层·AI】\n' + body);
        }
    } finally {
        if (scene) restoreChatu8RegexUI(scene);
    }
    let text = parts.join('\n\n');
    const LIMIT = 30000;
    if (text.length > LIMIT) text = text.slice(0, LIMIT) + '\n……（正文过长，已截断）';
    const from = picked.length ? picked[0].idx : 0;
    const to = picked.length ? picked[picked.length - 1].idx : 0;
    return { text, count: parts.length, from, to, before: beforeLen, after: afterLen, skipped };
}

/* 借管道前，把智绘姬正则页签的现场存一份 */
function snapshotChatu8RegexUI() {
    try {
        const ch = extension_settings[CHATU8];
        return {
            log: ch ? ch.log : undefined,
            orig: (document.querySelector('#ch-regex-test-original-text') || {}).value,
            res: (document.querySelector('#ch-regex-test-result-text') || {}).value
        };
    } catch (e) { return null; }
}

function restoreChatu8RegexUI(scene) {
    if (!scene) return;
    try {
        const ch = extension_settings[CHATU8];
        if (ch && scene.log !== undefined) ch.log = scene.log;
        const orig = document.querySelector('#ch-regex-test-original-text');
        if (orig && scene.orig !== undefined) orig.value = scene.orig;
        const res = document.querySelector('#ch-regex-test-result-text');
        if (res && scene.res !== undefined) res.value = scene.res;
    } catch (e) { /* 还原失败不影响记录 */ }
}

/* ------------------------------ 提示词 ------------------------------ */
/* 原来这里是一整段硬编码的附加提示词（漠然档案馆），现在整段删掉了。
   改成联动智绘姬「LLM」页签里的两项配置：
     · 自定义 Tool 工具配置（tool_call_config）
     · 发送前末尾自定义多 Role 消息（tail_messages_config）
   两样都从那边原样读，这里不再自己写一份。 */
/* 档案字段：与「重要角色表」的列一一对应（row_id 是表格行号，不进档案内容）。
   这个数组同时决定写入顺序、复制顺序和详情里的展示顺序。 */
const DNA_FIELDS = ['姓名', '性别/年龄', '外貌特征', '当前衣着/装扮', '核心DNA', '服装DNA', '本名', '外貌串', '服装串'];

const FIELD_RULES = [
    "只输出这 9 个字段：姓名 / 性别/年龄 / 外貌特征 / 当前衣着/装扮 / 核心DNA / 服装DNA / 本名 / 外貌串 / 服装串，",
    "一个都不许少，也不许自己增加别的字段（不要性格、身份、关系、能力、好感度这类）。",
    "",
    "【姓名】正文里的具体名字，原样照抄，不要改写成代称。",
    "多形态：同一角色的不同形态各占一条档案，姓名写成「原名·形态名」，并在末尾标注 [当前] / [非当前] / [永久封印]。",
    "只有正文明确发生形态转换、性别或种族变化、变身/觉醒、或达到条件的 Cosplay 才另立形态；",
    "普通理发、持久染发、临时假发、一次性美瞳都算原形态的更新，不另立形态。",
    "",
    "【性别/年龄】性别与年龄写成一段，例如「女/23」「男/40 上下」。",
    "正文没写年龄时，按人物的种族、身份与整体设计推定一个具体数字，不要写「未知」。",
    "",
    "【外貌特征】用中文自然语言记录固有外貌：发型、发色、身高、身材、肤色、五官。",
    "严禁神态描写（如「嘴角勾起冷笑」）、服装、姿势或临时状态。",
    "身高必须写；女性角色还要逐项写胸围、腰围、臀围、胸型，固定格式为：",
    "  身高：<数值> cm；胸围：<数值> cm；腰围：<数值> cm；臀围：<数值> cm；胸型：<稳定胸型描述>。",
    "尖括号要换成具体数值，不许只写「三围」或一串没标含义的数字；正文没给就按种族、年龄段、体型一次性合理补全，",
    "并在该项后注明「（设定补全）」，之后锁定。胸围是围度，不能用罩杯或胸部大小代替。",
    "这里写自然语言的概览即可；同一批信息在核心DNA里还要按结构化字段再写一遍，两边要一致：",
    "身高对应「身高/相对身高」，胸围对应「胸部」，腰围臀围对应「身材比例（肩/腰/胯/臀/腿）」，胸型对应「固定胸型」。",
    "",
    "【当前衣着/装扮】用中文自然语言完整列出当前全部衣物及每件的实际状态。",
    "禁止用「其余不变」「同前」「略」。正文明示没穿贴身层就写「无内衣/无内裤」，光脚写「赤脚」；",
    "正文省略的贴身衣物与鞋袜要依据人物、时代、场景、外层服装和整体配色一次性合理补全并锁定。",
    "状态措辞只用这几个词：正常穿着/敞开/部分敞开/解扣/卷袖/束入/掀起/半脱/暂时脱下/湿透/临时透明/破损/沾污/缺失。",
    "",
    "【核心DNA】固定 29 个字段 + 末尾「当前发型」快照，共 30 项，顺序不可调换、不可省略。",
    "格式为：中文字段名{英文内容}; 下一字段{……};",
    "⚠️ 硬性要求：花括号 { } 里只能出现英文单词、英文短语或英文标签，一个中文字符都不许有，也不许出现全角标点。",
    "   正确：发色{silver hair}; 前发/刘海{blunt bangs}; 当前发型{same as initial};",
    "   错误：发色{银发}; 前发/刘海{齐刘海}; 当前发型{同初始};",
    "   —— 中文字段名在花括号外面，花括号里面一律英文，这是固定写法。",
    "顺序：发色;发色细节;前发/刘海;主发型;发长;鬓发/侧发;顶部/后部特征;发质;发饰;瞳色;眼型;特殊瞳孔/巩膜;脸型;眉毛;睫毛;鼻型;唇型;面部印象;永久面部标记及位置;体型（含肌肉特征）;身材比例（肩/腰/胯/臀/腿）;胸部;固定胸型;肤色;年龄;身体标记及位置;身高/相对身高;非人部位（类型/数量/颜色/位置）;固定妆容/面部彩绘;当前发型",
    "规则：",
    "- {none} 只表示「已确认不存在或确实不适用」，不能因为正文没写就写 none。",
    "- 正文没写的外貌关键项，要依据人物种族、年龄段、身份、性格、时代、整体设计一次性合理补全并锁定。",
    "- 禁止出现 unknown、「未明确」「待定」「可能」这类占位。",
    "- 前发/刘海必须写明具体结构、分缝、方向、长度或遮眼关系，例如 blunt bangs、curtain bangs、swept bangs、hair pulled back、hair slicked back；禁止只写 bangs / fringe / no bangs。",
    "- 肌肉并入「体型（含肌肉特征）」；永久标记必须写位置。",
    "- 当前发型未变化就写：当前发型{same as initial};",
    "",
    "【服装DNA】按 17 个槽位顺序逐件记录，格式为：中文槽位名{英文内容};",
    "⚠️ 花括号里同样只能写英文，一个中文字符都不许有，六项的键名也用英文。",
    "   正确：上身外层{style:hoodie | color:black | length/structure:cropped | material:cotton | pattern/details:plain | default state:worn normally};",
    "   错误：上身外层{黑色卫衣}; 上身外层{款式/子型:卫衣 | 颜色:黑色};",
    "顺序：妆容;唇妆;内衣上身;内衣下身;上身内层;上身外层;下身主层;连体;腿部穿着;腿部可见状态;足部;头部;颈部;手腕手部;腰部;眼部;耳部",
    "规则：",
    "- 每件真实衣物写全六项（键名和值都用英文）：style:___ | color:___ | length/structure:___ | material:___ | pattern/details:___ | default state:___",
    "- 同一个槽位有多件衣物时写成 槽位名1、槽位名2，每件各占一个花括号；连衣裙、长袍等连体衣物只在「连体」记一次。",
    "- 只有经过完整穿搭判断后确认没有该物件，才写 {none}；正文没提的要在不影响设定时合理补全并锁定，不许写 unknown。",
    "- 妆容与唇妆写当前实际视觉，素颜写 no makeup、自然唇色写 natural lips。",
    "- 裸腿写：腿部穿着{none}; 腿部可见状态{bare legs};",
    "- 决定角色辨识度的配饰在槽位值末尾加【签名件】。",
    "",
    "【本名】非必填，按形态状态判定：",
    "- 无形态的普通角色（姓名里没有「·」也没有标记）：本名 = 姓名原文。",
    "- 姓名带 [当前] 的形态：本名 = 去掉形态名和标记后的原始姓名（「艾莉丝·暗堕态[当前]」→「艾莉丝」）。",
    "- 姓名带 [非当前] 或 [永久封印]：本名留空（输出空字符串）。",
    "- 同一个本名在整批输出里最多只出现在一条上。",
    "",
    "【外貌串】由核心DNA拼装好的完整外貌生图提示词，供生图逐字复制，禁止生图时重新拼装。",
    "固定前缀逐字为「这是生图的外貌提示词：」，冒号后紧跟拼装结果，前缀一个字都不许改。",
    "- 按核心DNA字段顺序拼装，只保留英文Tag与中文精确短语，逗号分隔，串首带性别前缀（girl / boy）；",
    "  {none} 的字段跳过；当前发型{同初始}不追加，临时发型把对应Tag追加在串末。",
    "- 瞳色写当前可见的瞳色：戴美瞳写美瞳颜色，不写被遮住的真实瞳色。",
    "- 禁止候选同义词并列、自造复合词、遗漏任何已记录的字段。",
    "",
    "【服装串】由服装DNA拼装好的完整服装生图提示词，同样逐字复制，禁止重新拼装。",
    "固定前缀逐字为「这是生图的服装提示词：」，冒号后紧跟拼装结果。",
    "- 17 个槽位逐件组装，每件取 款式/子型 + 颜色 + 长度/结构 + 材质 + 图案/标志细节，全部逐件列出，逗号分隔。",
    "- 不含内衣上身、内衣下身、腿部可见状态、眼部槽位；妆容/唇妆有实际值才写，素颜与自然唇色不写。",
    "- 不含任何临时状态（敞开/湿透等）；【签名件】标注不进入串。",
    "",
    "【两串与DNA的同步】core_dna 或 clothing_dna 有任何更新，必须同步完整重写对应串；两串与核心DNA、服装DNA逐项一致，缺一项视为作废。",
    "旧档案缺这两串时，按现有核心DNA、服装DNA一次性拼装补齐后锁定。"
];

function batchPrompt(text, pack) {
    const origins = (pack && pack.origins) || [];
    const olds = (pack && pack.olds) || [];
    const wb = (pack && pack.wb) || [];
    const lines = [];
    lines.push('你是人物档案生成器。下面给你一段剧情正文，请把正文里出现过的人物整理成固定格式的档案。');
    lines.push('');
    lines.push('【谁要收录】');
    lines.push('· 正文里出现了具体名字、或者有专指称谓的人物都要收录，一个都不要漏。');
    lines.push('· 没有名字的泛称不要收录：士兵、守卫、侍女、人群、路人甲、众人、老板、酒保、摊贩之类。');
    lines.push('· 只是被顺口提一句、并没有真正出场的人物不要收录。');
    lines.push('');
    lines.push('【输出格式】只输出 JSON 数组本身，不要 markdown 代码块，不要任何解释：');
    lines.push('[');
    lines.push('  {"姓名":"甲","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"甲","外貌串":"这是生图的外貌提示词：girl, …","服装串":"这是生图的服装提示词：…"},');
    lines.push('  {"姓名":"乙","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"乙","外貌串":"这是生图的外貌提示词：boy, …","服装串":"这是生图的服装提示词：…"}');
    lines.push(']');
    lines.push('');
    lines.push(...FIELD_RULES);
    if (wb.length) {
        lines.push('');
        lines.push('【世界书里的相关设定】');
        lines.push('下面这些是世界书里和正文人物相关的设定，写人物时以它为准，不要自己编造与设定冲突的内容：');
        for (const o of wb) {
            lines.push('');
            lines.push('—— ' + o.name + ' ——');
            lines.push(o.content);
        }
    }
    if (origins.length) {
        lines.push('');
        lines.push('【角色卡里的角色设定】');
        lines.push('下面这些角色在正文里出现了。写它们的时候必须以这里的设定为人物基础：');
        lines.push('种族、外貌底子（发色/瞳色/脸型/体型等）、身份、能力、关系、称谓都不许改，只按正文更新它当前的状态。');
        lines.push('如果正文情节与设定冲突，以正文的剧情进展为准，但人物底子保持不变。');
        for (const o of origins) {
            lines.push('');
            lines.push('—— ' + o.name + ' ——');
            lines.push(o.content);
        }
    }
    if (olds.length) {
        lines.push('');
        lines.push('【这些角色上次记录的档案】');
        lines.push('它们如果出现在正文里，请按当前剧情更新：没变化的部分原样保留，只改变化的部分。');
        for (const o of olds) {
            lines.push('');
            lines.push('—— ' + o.name + ' ——');
            lines.push(o.content);
        }
    }
    lines.push('');
    lines.push('【剧情正文】');
    lines.push(text);
    return lines.join('\n');
}

function buildContent(profile) {
    const lines = [];
    for (const k of DNA_FIELDS) {
        const v = String(profile[k] == null ? '' : profile[k]).trim();
        if (!v) continue;   /* 旧档案缺的新字段不占行 */
        lines.push(k + '：' + v);
    }
    return lines.join('\n');
}

/* ------------------------------ 上下文预设 ------------------------------ */
/* 导入的是智绘姬「LLM → 测试上下文预设」那种格式：
     { 预设名: { entries: [ {id, name, role, content, enabled, triggerMode, triggerWords, andTriggerWords} ] } }
   也认 { entries:[...] }、{ context_presets:{...} }、以及一个文件里放好几份预设。
   组装时按条目顺序取启用项，支持下面这些占位符；预设里没写占位符也能跑，缺的块会补在末尾。 */

const PRESET_ROLES = ['system', 'user', 'assistant'];

/* 占位符：中文名是主写法，英文别名也认 */
const PRESET_TOKENS = [
    { keys: ['{{正文}}', '{{剧情正文}}', '{{DNA_TEXT}}'], label: '剧情正文' },
    { keys: ['{{角色卡设定}}', '{{DNA_ORIGINS}}'], label: '角色卡设定' },
    { keys: ['{{旧档案}}', '{{DNA_OLDS}}'], label: '上次记录的档案' },
    { keys: ['{{收录规则}}', '{{DNA_RULES}}'], label: '收录规则' },
    { keys: ['{{字段规范}}', '{{DNA_FIELDS}}'], label: '九字段规范' },
    { keys: ['{{输出格式}}', '{{DNA_FORMAT}}'], label: '输出格式' }
];

/* 收录规则 / 输出格式的内置副本：预设里用 {{收录规则}} {{输出格式}} 引用时填这个 */
const COLLECT_RULES = [
    '· 正文里出现具体名字的人物，全部收录，一个都不许漏。',
    '· 只有专指称谓、但明确指向某个具体人物的，也收录，姓名写那个称谓。',
    '· 泛称、群体（士兵、守卫、侍女、人群、路人甲、众人、老板、酒保、摊贩）一律不收录。',
    '· 只被顺口提一句、并没有真正出场的人物不收录。'
].join('\n');

const JSON_TEMPLATE = [
    '[',
    '  {"姓名":"甲","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"甲","外貌串":"这是生图的外貌提示词：girl, …","服装串":"这是生图的服装提示词：…"},',
    '  {"姓名":"乙","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"乙","外貌串":"这是生图的外貌提示词：boy, …","服装串":"这是生图的服装提示词：…"}',
    ']'
].join('\n');

/* 和智绘姬一样：//* 注释行不进 messages */
function stripPresetComments(text) {
    if (!text || typeof text !== 'string') return text;
    return text
        .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
        .replace(/^[ \t]*\/\/\*.*?(?:\*+\/+|\*\/)?[ \t]*(?:\r?\n|$)/gm, '')
        .replace(/\/\/\*[\s\S]*?(?:\*+\/+|\*\/)/g, '')
        .replace(/[ \t]+\/\/\*.*?(?:\*+\/+|\*\/)?(?=$|\r?\n)/g, '')
        .replace(/(\r?\n){3,}/g, '$1$1')
        .trim();
}

function randToken(n) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    try {
        const arr = new Uint8Array(n);
        crypto.getRandomValues(arr);
        for (let i = 0; i < n; i++) s += chars[arr[i] % chars.length];
    } catch (e) {
        for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}

/* 变量：{@setvar::名::值@} 存下来，{@getvar::名@} 换成值。
   作用域 scope 由调用方传进来跨条目共用（配置中心里的 setvar 才能被后面的条目读到）。
   if 块本插件不判条件，只把标记去掉、内容保留；{{roll N}} 换成随机串。 */
function applyPresetVariables(text, scope) {
    const vars = scope || Object.create(null);
    let out = String(text).replace(/\{@setvar::([^:@]+)::([\s\S]*?)@\}/g, (m, k, v) => {
        vars[String(k).trim()] = String(v);
        return '';
    });
    out = out.replace(/\{@getvar::([^@]+)@\}/g, (m, k) => {
        const key = String(k).trim();
        return vars[key] === undefined ? '' : vars[key];
    });
    out = out.replace(/\{@if[^@]*@\}/g, '').replace(/\{@\/if@\}/g, '');
    out = out.replace(/\{\{roll\s+\d+\}\}/gi, () => randToken(10));
    return out;
}

/* 上下文预设分两套：lib = 档案库/自动记录，gen = 手动生成。两套互不影响。 */
function presetBag(scope) {
    return (scope === 'gen' ? S.presetsGen : S.presets) || {};
}

function presetNames(scope) {
    return Object.keys(presetBag(scope));
}

function activePresetName(scope) {
    const names = presetNames(scope);
    const cur = scope === 'gen' ? S.genPresetName : S.presetName;
    if (cur && presetBag(scope)[cur]) return cur;
    return names[0] || '';
}

function presetEntries(name, scope) {
    const p = presetBag(scope)[name || activePresetName(scope)];
    return p && Array.isArray(p.entries) ? p.entries : [];
}

function presetEnabledOf(scope) {
    return scope === 'gen' ? !!S.genPresetEnabled : !!S.presetEnabled;
}

function presetMergeOf(scope) {
    const v = scope === 'gen' ? S.genPresetMergeSystem : S.presetMergeSystem;
    return v !== false;
}

/* 每个占位符这次要填的内容 */
function presetBlocks(text, pack) {
    const origins = (pack && pack.origins) || [];
    const olds = (pack && pack.olds) || [];
    const wb = (pack && pack.wb) || [];
    const originText = origins.length
        ? origins.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n')
        : '（本轮没有角色卡设定可用）';
    const oldText = olds.length
        ? olds.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n')
        : '（本轮没有已记录的同名角色）';
    const wbText = wb.length
        ? wb.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n')
        : '（本轮没有命中世界书条目）';
    return {
        '{{正文}}': text,
        '{{角色卡设定}}': originText,
        '{{世界书设定}}': wbText,
        '{{旧档案}}': oldText,
        '{{收录规则}}': COLLECT_RULES,
        '{{字段规范}}': FIELD_RULES.join('\n'),
        '{{输出格式}}': JSON_TEMPLATE
    };
}

/* 同一个 role 的相邻条目合并（含【ToolCall引导】的不合并，和智绘姬的规则一致） */
function mergeSameRole(messages) {
    const out = [];
    const keepApart = (m) => String(m.content || '').indexOf('【ToolCall引导】') >= 0;
    for (const m of messages) {
        if (!m || !m.content) continue;
        const prev = out[out.length - 1];
        if (prev && prev.role === m.role && !keepApart(prev) && !keepApart(m)) {
            prev.content = prev.content + '\n\n' + m.content;
        } else {
            out.push({ role: m.role, content: m.content });
        }
    }
    return out;
}

/* 有的中转（尤其 Gemini 系）只认开头一条 system，中间夹 system 会直接吐空内容。
   默认把 system 全部合并到最前面一条，其余角色顺序不动。 */
function systemFirst(messages) {
    const sys = [];
    const rest = [];
    for (const m of messages) {
        if (m.role === 'system') sys.push(m.content);
        else rest.push(m);
    }
    if (!sys.length) return rest;
    return [{ role: 'system', content: sys.join('\n\n') }].concat(rest);
}

/* 把预设条目组装成 messages */
function assemblePresetMessages(text, pack, scope) {
    const list = presetEntries(undefined, scope);
    const vars = presetBlocks(text, pack);
    /* 预设里没写 {{世界书设定}} → 把命中的世界书内容并进「角色卡设定」那一块，免得白查一趟 */
    const wbHit = (pack && pack.wb) || [];
    if (wbHit.length && !list.some((en) => en && String(en.content || '').indexOf('{{世界书设定}}') >= 0)) {
        vars['{{角色卡设定}}'] = vars['{{角色卡设定}}'] + '\n\n【世界书里的相关设定】\n' + vars['{{世界书设定}}'];
    }
    const alias = {
        '{{剧情正文}}': '{{正文}}',
        '{{DNA_TEXT}}': '{{正文}}',
        '{{DNA_ORIGINS}}': '{{角色卡设定}}',
        '{{DNA_OLDS}}': '{{旧档案}}',
        '{{DNA_RULES}}': '{{收录规则}}',
        '{{DNA_FIELDS}}': '{{字段规范}}',
        '{{DNA_FORMAT}}': '{{输出格式}}'
    };
    const used = new Set();
    const varScope = Object.create(null);   // setvar/getvar 跨条目共用
    const msgs = [];
    for (const en of list) {
        if (!en || en.enabled === false) continue;
        let c = stripPresetComments(en.content || '');
        if (!c) continue;
        c = applyPresetVariables(c, varScope);
        /* 纯 setvar/注释的条目（比如配置中心）处理完就空了，不用发出去 */
        if (!c.trim()) continue;
        for (const k of Object.keys(alias)) {
            if (c.indexOf(k) >= 0) c = c.split(k).join(alias[k]);
        }
        for (const k of Object.keys(vars)) {
            if (c.indexOf(k) >= 0) { c = c.split(k).join(vars[k]); used.add(k); }
        }
        msgs.push({ role: PRESET_ROLES.includes(en.role) ? en.role : 'user', content: c });
    }
    /* 预设里没写 {{正文}} → 把正文（和缺的角色卡设定/旧档案）补在最后一条 user 消息里 */
    if (!used.has('{{正文}}')) {
        const tail = [];
        if (!used.has('{{角色卡设定}}') && pack && pack.origins && pack.origins.length) {
            tail.push('【角色卡里的角色设定】');
            tail.push(pack.origins.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n'));
        }
        if (!used.has('{{旧档案}}') && pack && pack.olds && pack.olds.length) {
            tail.push('【这些角色上次记录的档案】');
            tail.push(pack.olds.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n'));
        }
        tail.push('【剧情正文】');
        tail.push(text);
        msgs.push({ role: 'user', content: tail.join('\n\n') });
    }
    const merged = mergeSameRole(msgs);
    return presetMergeOf(scope) ? systemFirst(merged) : merged;
}

/* 统一入口：开了预设就用预设组装，否则用内置 batchPrompt。
   scope：lib = 档案库/自动记录（默认），gen = 手动生成 */
function buildRecordPrompt(text, pack, scope) {
    if (presetEnabledOf(scope) && presetEntries(undefined, scope).length) return assemblePresetMessages(text, pack, scope);
    return batchPrompt(text, pack);
}

function normalizeMessages(prompt) {
    if (Array.isArray(prompt)) {
        return prompt
            .filter((m) => m && m.content && String(m.content).trim())
            .map((m) => ({ role: PRESET_ROLES.includes(m.role) ? m.role : 'user', content: String(m.content) }));
    }
    return [{ role: 'user', content: String(prompt == null ? '' : prompt) }];
}

function promptChars(prompt) {
    return normalizeMessages(prompt).reduce((n, m) => n + m.content.length, 0);
}

/* 把导入文件拆成 { 预设名: entries[] } */
function normalizePresetEntries(arr) {
    if (!Array.isArray(arr)) return null;
    const out = [];
    for (const e of arr) {
        if (!e || typeof e !== 'object') continue;
        const content = typeof e.content === 'string' ? e.content : '';
        if (!content.trim()) continue;
        out.push({
            id: String(e.id || ('dna_imp_' + out.length + '_' + Date.now())),
            name: String(e.name || ('条目 ' + (out.length + 1))),
            role: PRESET_ROLES.includes(e.role) ? e.role : 'system',
            content,
            enabled: e.enabled !== false,
            triggerMode: e.triggerMode === 'trigger' ? 'trigger' : 'always',
            triggerWords: String(e.triggerWords || ''),
            andTriggerWords: String(e.andTriggerWords || '')
        });
    }
    return out.length ? out : null;
}

function pickPresetsFromFile(data) {
    const out = {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
    if (Array.isArray(data.entries)) {
        const list = normalizePresetEntries(data.entries);
        if (list) out[String(data.name || '').trim() || '导入的预设'] = list;
        return out;
    }
    if (data.context_presets && typeof data.context_presets === 'object') {
        for (const k of Object.keys(data.context_presets)) {
            const v = data.context_presets[k];
            const list = normalizePresetEntries(v && v.entries);
            if (list) out[k] = list;
        }
        if (Object.keys(out).length) return out;
    }
    for (const k of Object.keys(data)) {
        const v = data[k];
        if (!v || typeof v !== 'object') continue;
        const list = normalizePresetEntries(v.entries);
        if (list) out[k] = list;
    }
    return out;
}

/* 导入时顺手登记到智绘姬「LLM」页签的上下文预设列表，那边也能直接选到 */
function mirrorToChatu8(names, scope) {
    if (scope === 'gen') return false;   // 手动生成那套是 DNA 专用，不登记到智绘姬，免得两套互相覆盖
    try {
        const ch = extension_settings[CHATU8];
        if (!ch) return false;
        if (!ch.test_context_profiles || typeof ch.test_context_profiles !== 'object') ch.test_context_profiles = {};
        for (const n of names) {
            const src = S.presets[n];
            if (src) ch.test_context_profiles[n] = { entries: JSON.parse(JSON.stringify(src.entries)) };
        }
        saveSettingsDebounced();
        return true;
    } catch (e) {
        return false;
    }
}

function importPreset(ev, scope) {
    const input = ev.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const bag = presetBag(scope);
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || ''));
            const found = pickPresetsFromFile(data);
            const names = Object.keys(found);
            if (!names.length) throw new Error('文件里没找到 entries 条目（不是上下文预设格式？）');
            const now = Date.now();
            for (const n of names) {
                bag[n] = { entries: found[n], importedAt: now, source: file.name };
            }
            if (scope === 'gen') {
                S.genPresetName = names[0];
                S.genPresetEnabled = true;
            } else {
                S.presetName = names[0];
                S.presetEnabled = true;
            }
            saveSettings(true);
            const mirrored = mirrorToChatu8(names, scope);
            renderPresetCard(scope);
            log('已导入上下文预设：' + names.join('、') + '（' + found[names[0]].length + ' 条，已启用）');
            if (mirrored) log('已同步登记到智绘姬「LLM」页签的上下文预设列表');
            toast('已导入上下文预设：' + names[0] + '（' + found[names[0]].length + ' 条）');
        } catch (e) {
            log('导入上下文预设失败：' + (e && e.message ? e.message : e), 'error');
            toast('导入失败：' + (e && e.message ? e.message : e), 'error');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file, 'utf-8');
}

/* 导出一份预设（格式和智绘姬「LLM → 测试上下文」完全一致，能再导回去） */
function exportPreset(scope) {
    const n = activePresetName(scope);
    if (!n) { toast('还没有导入预设，没东西可导出'); return; }
    const list = presetEntries(n, scope);
    if (!list.length) { toast('这份预设是空的'); return; }
    const payload = {};
    payload[n] = {
        entries: list.map((e) => ({
            id: String(e.id || ''),
            name: String(e.name || ''),
            role: PRESET_ROLES.includes(e.role) ? e.role : 'system',
            content: String(e.content || ''),
            enabled: e.enabled !== false,
            triggerMode: e.triggerMode === 'trigger' ? 'trigger' : 'always',
            triggerWords: String(e.triggerWords || ''),
            andTriggerWords: String(e.andTriggerWords || '')
        }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(n).replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = '上下文预设_' + safe + '_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    log('已导出上下文预设「' + n + '」（' + list.length + ' 条）');
    toast('已导出「' + n + '」');
}

/* 改预设名字：DNA 这边改名，智绘姬那份副本也跟着改 */
function renamePreset(scope) {
    const bag = presetBag(scope);
    const old = activePresetName(scope);
    if (!old) { toast('还没有导入预设'); return; }
    const input = prompt('给预设改个新名字：', old);
    if (input === null) return;                       // 点了取消
    const next = String(input).trim();
    if (!next) { toast('名字不能为空', 'error'); return; }
    if (next === old) return;
    if (bag[next]) { toast('已经有同名预设了，换一个名字', 'error'); return; }

    bag[next] = bag[old];
    delete bag[old];
    if (scope === 'gen') S.genPresetName = next; else S.presetName = next;
    saveSettings(true);
    if (scope === 'gen') {
        renderPresetCard(scope);
        log('手动生成预设改名：' + old + ' → ' + next);
        toast('已改名为「' + next + '」');
        return;
    }

    /* 智绘姬「LLM」页签里那份副本同步改名（原来那键删掉，新键写上最新内容） */
    try {
        const ch = extension_settings[CHATU8];
        if (ch && ch.test_context_profiles && typeof ch.test_context_profiles === 'object') {
            delete ch.test_context_profiles[old];
            ch.test_context_profiles[next] = { entries: JSON.parse(JSON.stringify(S.presets[next].entries || [])) };
            /* 智绘姬自己正选中这份的话，指针也跟着挪，不然它那边会指向一个不存在的名字 */
            if (ch.current_test_context_profile === old) ch.current_test_context_profile = next;
            saveSettingsDebounced();
        }
    } catch (e) { /* 智绘姬没就绪就算了，DNA 这边已经改好 */ }

    renderPresetCard(scope);
    log('预设改名：' + old + ' → ' + next);
    toast('已改名为「' + next + '」');
}

/* 删掉当前这套里选中的预设 */
function removePreset(scope) {
    const n = activePresetName(scope);
    if (!n) { toast('还没有导入预设'); return; }
    if (!confirm('删除预设「' + n + '」？' + (scope === 'gen' ? '' : '\n（智绘姬「LLM」页签里那份不会被删）'))) return;
    delete presetBag(scope)[n];
    const rest = presetNames(scope)[0] || '';
    if (scope === 'gen') {
        S.genPresetName = rest;
        if (!presetNames(scope).length) S.genPresetEnabled = false;
    } else {
        S.presetName = rest;
        if (!presetNames(scope).length) S.presetEnabled = false;
    }
    saveSettings(true);
    renderPresetCard(scope);
    log((scope === 'gen' ? '已删除手动生成预设：' : '已删除上下文预设：') + n);
}

/* ------------------------- 内置默认预设 ------------------------- */
/* 档案库那份：读剧情正文检索人物生成 DNA（纯 ASCII 文件名，避免解压后中文名取不到） */
const DEFAULT_PRESET_FILE = 'presets/st_chatu8_lib_storytext_9fields_v3.json';
const DEFAULT_PRESET_NAME = '昆仑DNA档案记录版';
/* 上一版内置预设的名字：装新版时自动退场，免得库里堆两份 */
const LEGACY_PRESET_NAMES = ['昆仑DNA档案记录版 · 九字段'];
/* 手动生成那份：读世界书条目 / 角色管理设定，不读剧情正文 */
const DEFAULT_GEN_PRESET_FILE = 'presets/st_chatu8_gen_worldbook_chars_v3.json';   // 纯 ASCII 文件名，避免解压后中文名取不到
const DEFAULT_GEN_PRESET_NAME = '昆仑DNA建档版 · 世界书角色';

/* 装一次内置默认预设。装过就记住（seedPreset），以后就算删掉也不会每次刷新又冒出来 */
async function ensureDefaultPreset() {
    if (S.seedPreset === DEFAULT_PRESET_FILE) return false;
    try {
        const url = new URL(DEFAULT_PRESET_FILE, import.meta.url).toString();
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { log('内置默认预设读取失败：HTTP ' + res.status, 'error'); return false; }
        const data = await res.json();
        const found = pickPresetsFromFile(data);
        const names = Object.keys(found);
        if (!names.length) { log('内置默认预设里没找到条目', 'error'); return false; }
        const now = Date.now();
        for (const n of names) S.presets[n] = { entries: found[n], importedAt: now, source: '内置默认预设' };
        /* 上一版内置预设自动退场（只删我们自己装的，用户自己导入的不动） */
        for (const legacy of LEGACY_PRESET_NAMES) {
            if (names.indexOf(legacy) >= 0) continue;
            if (S.presets[legacy] && S.presets[legacy].source === '内置默认预设') {
                delete S.presets[legacy];
                log('已移除上一版内置预设「' + legacy + '」');
            }
        }
        /* 装内置默认预设这一次，顺手把它切成当前用的那份（只此一次，之后你手动选什么就是什么） */
        S.presetName = names[0];
        S.presetEnabled = true;
        S.seedPreset = DEFAULT_PRESET_FILE;
        patchPresetStart();
        saveSettings(true);
        try { mirrorToChatu8(names); } catch (e) { /* 智绘姬没就绪不影响 */ }
        log('已装好内置默认预设「' + names[0] + '」（' + found[names[0]].length + ' 条）');
        return true;
    } catch (e) {
        log('装内置默认预设失败：' + (e && e.message ? e.message : e), 'error');
        return false;
    }
}

/* 老用户迁移：以前手动生成借用的是档案库那份预设，升级后两套分开，
   所以把档案库那份复制一份给手动生成，行为不中断（只做一次，之后各管各的）。 */
function migrateGenPresets() {
    if (S.genPresetSeeded) return false;
    S.genPresetSeeded = true;
    if (Object.keys(S.presetsGen || {}).length) { saveSettings(true); return false; }
    const src = S.presets || {};
    const names = Object.keys(src);
    if (!names.length) { saveSettings(true); return false; }
    try {
        S.presetsGen = JSON.parse(JSON.stringify(src));
    } catch (e) {
        S.presetsGen = {};
        saveSettings(true);
        return false;
    }
    S.genPresetName = (S.presetName && S.presetsGen[S.presetName]) ? S.presetName : names[0];
    S.genPresetEnabled = !!S.presetEnabled;
    saveSettings(true);
    log('已把档案库的 ' + names.length + ' 份预设复制给手动生成（两套从此各管各的）');
    return true;
}

/* 装一次手动生成的内置预设（读世界书 / 角色管理那套）。装过就记住，删掉也不会自己冒回来 */
async function ensureDefaultGenPreset() {
    if (S.seedGenPreset === DEFAULT_GEN_PRESET_FILE) return false;
    try {
        const url = new URL(DEFAULT_GEN_PRESET_FILE, import.meta.url).toString();
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { log('内置手动生成预设读取失败：HTTP ' + res.status, 'error'); return false; }
        const data = await res.json();
        const found = pickPresetsFromFile(data);
        const names = Object.keys(found);
        if (!names.length) { log('内置手动生成预设里没找到条目', 'error'); return false; }
        const now = Date.now();
        for (const n of names) S.presetsGen[n] = { entries: found[n], importedAt: now, source: '内置默认预设' };
        /* 装这一次顺手切成当前用的那份，之后你手动选什么就是什么 */
        S.genPresetName = names[0];
        S.genPresetEnabled = true;
        S.seedGenPreset = DEFAULT_GEN_PRESET_FILE;
        saveSettings(true);
        log('已装好手动生成预设「' + names[0] + '」（' + found[names[0]].length + ' 条）');
        return true;
    } catch (e) {
        log('装手动生成预设失败：' + (e && e.message ? e.message : e), 'error');
        return false;
    }
}

function presetPlaceholderState(list) {
    const all = list.map((e) => String(e.content || '')).join('\n');
    const hit = [];
    for (const t of PRESET_TOKENS) {
        if (t.keys.some((k) => all.indexOf(k) >= 0)) hit.push(t.label);
    }
    return hit.length ? hit.join(' / ') : '无（正文会补在末尾）';
}

/* 同一套控件有两份（档案库 / 手动生成），gen 版键名统一加 gen 前缀 */
function dkey(scope, base) {
    return scope === 'gen' ? ('gen' + base.charAt(0).toUpperCase() + base.slice(1)) : base;
}

function renderPresetCard(scope) {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const q = (base) => tab.querySelector('[data-dna="' + dkey(scope, base) + '"]');
    const names = presetNames(scope);
    const name = activePresetName(scope);
    const list = presetEntries(name, scope);
    const on = presetEnabledOf(scope) && names.length > 0;

    const sel = q('presetSelect');
    if (sel) {
        sel.innerHTML = names.length
            ? names.map((n) => '<option value="' + esc(n) + '"' + (n === name ? ' selected' : '') + '>' + esc(n) + '</option>').join('')
            : '<option value="">（还没导入预设）</option>';
        sel.disabled = !names.length;
    }
    const badge = q('presetLabel');
    if (badge) badge.textContent = on ? '已启用' : (names.length ? '已导入 · 未启用' : '未导入');
    const hint = q('presetHint');
    if (hint) {
        let txt = on
            ? (scope === 'gen' ? '手动生成按「' : 'DNA 记录时按「') + name + '」的 ' + list.filter((e) => e.enabled !== false).length + ' 条条目组装 messages'
            : (names.length ? '关着的时候用插件内置提示词（batchPrompt）' : '导入后' + (scope === 'gen' ? '手动生成' : 'DNA 记录') + '就按预设的条目组装提示词');
        /* 档案输出长，max_tokens 太小会被截成空文本 */
        const p = chatu8Profile(scope);
        if (on && p && p.enable_max_tokens !== false) {
            const mt = numOr(p.max_tokens, 4000);
            if (mt > 0 && mt < 4000) {
                txt += ' · ⚠ 这份 LLM 配置的最大 tokens 只有 ' + mt + '，档案输出容易被截断，建议调到 8000 以上';
            }
        }
        hint.textContent = txt;
    }
    const info = q('presetInfo');
    if (info) {
        if (!names.length) {
            info.innerHTML = '';
        } else {
            const chars = list.reduce((n, e) => n + String(e.content || '').length, 0);
            const byRole = { system: 0, user: 0, assistant: 0 };
            list.forEach((e) => { byRole[e.role] = (byRole[e.role] || 0) + 1; });
            const rows = [
                ['预设', name],
                ['条目', list.length + ' 条（启用 ' + list.filter((e) => e.enabled !== false).length + '）'],
                ['角色分布', 'system ' + byRole.system + ' · user ' + byRole.user + ' · assistant ' + byRole.assistant],
                ['总字数', chars + ' 字'],
                ['占位符', presetPlaceholderState(list)]
            ];
            info.innerHTML = rows.map((r) =>
                '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
                '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
            ).join('');
        }
    }
    renderPresetEntries(scope);
}

/* 条目列表：一条一行，勾掉就不参与组装（和智绘姬 LLM 页签里那些条目的开关一个意思）
   每行右边有「编辑」按钮，点开就地改名称 / 角色 / 内容 */
function renderPresetEntries(scope) {
    const box = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'presetEntries') + '"]');
    if (!box) return;
    const list = presetEntries(undefined, scope);
    if (!list.length) {
        box.innerHTML = '<div class="dna-entries-empty">还没导入预设</div>';
        updatePresetMeta(scope);
        return;
    }
    /* 编辑改走悬浮窗，列表里不再内联展开 */
    try { box.classList.remove('dna-entries-editing'); } catch (e) { /* 忽略 */ }
    box.innerHTML = list.map((e, i) => {
        const on = e.enabled !== false;
        const role = PRESET_ROLES.includes(e.role) ? e.role : 'user';
        const tag = role === 'system' ? 'SYS' : role === 'assistant' ? 'AST' : 'USR';
        const len = String(e.content || '').length;
        const row = '<div class="dna-entry-line">'
            + '<label class="dna-entry' + (on ? '' : ' dna-entry-off') + '" data-idx="' + i + '" title="' + esc(e.name || '') + '">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + '>'
            + '<span class="dna-entry-role dna-entry-' + role + '">' + tag + '</span>'
            + '<span class="dna-entry-name">' + esc(e.name || ('条目 ' + (i + 1))) + '</span>'
            + '<span class="dna-entry-len">' + len + ' 字</span>'
            + '</label>'
            + '<button class="dna-entry-edit" data-edit="' + i + '" title="编辑这条（弹窗）">'
            + '<i class="fa-solid fa-pen"></i></button>'
            + '</div>';
        return '<div class="dna-entry-item" data-idx="' + i + '">' + row + '</div>';
    }).join('');
    updatePresetMeta(scope);
}

/* 保存某一条的修改，并同步到智绘姬那份预设副本 */
function savePresetEntry(idx, patch, scope) {
    const list = presetEntries(undefined, scope);
    const e = list[idx];
    if (!e) return false;
    if (typeof patch.name === 'string') e.name = patch.name.trim() || e.name;
    if (PRESET_ROLES.includes(patch.role)) e.role = patch.role;
    if (typeof patch.content === 'string') e.content = patch.content;
    saveSettings(true);
    if (scope !== 'gen') { try { mirrorToChatu8([activePresetName(scope)], scope); } catch (err) { /* 忽略 */ } }
    return true;
}

/* 只改计数文字，不重绘列表（免得滚动位置被重置） */
function updatePresetMeta(scope) {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const list = presetEntries(undefined, scope);
    const on = list.filter((e) => e.enabled !== false).length;
    const cnt = tab.querySelector('[data-dna="' + dkey(scope, 'presetEntryCount') + '"]');
    if (cnt) cnt.textContent = on + ' / ' + list.length;
    const kv = tab.querySelector('[data-dna="' + dkey(scope, 'presetInfo') + '"]');
    if (kv && list.length) {
        const row = kv.querySelector('.dna-kv-row:nth-child(2) .dna-kv-v');
        if (row) row.textContent = list.length + ' 条（启用 ' + on + '）';
    }
}

/* 全开 / 全关 */
function setAllPresetEntries(on, scope) {
    const list = presetEntries(undefined, scope);
    if (!list.length) return;
    list.forEach((e) => { e.enabled = on; });
    saveSettings(true);
    renderPresetEntries(scope);
    log('预设条目全部' + (on ? '打开' : '关掉') + '（' + list.length + ' 条）');
}

async function onPresetPreview(scope) {
    const box = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'presetPreviewBox') + '"]');
    if (!box) return;
    try {
        if (!presetEntries(undefined, scope).length) { box.value = '还没导入上下文预设。点收纳盒里的「导入」选一个 JSON。'; return; }
        const src = await testSourceText();
        const text = src.text || '（这里会放最近 N 层 AI 回复的正文）';
        const msgs = assemblePresetMessages(text, { origins: cardOrigins(), olds: pickOldRecords(text, 12000) }, scope);
        const lines = ['===== 组装结果：' + msgs.length + ' 条 messages（正文来源：' + src.from + '）====='];
        msgs.forEach((m, i) => {
            lines.push('');
            lines.push('--- [' + (i + 1) + '] role=' + m.role + ' · ' + m.content.length + ' 字 ---');
            lines.push(m.content.length > 1500 ? m.content.slice(0, 1500) + '\n…（预览截断，实际发送是全文）' : m.content);
        });
        box.value = lines.join('\n');
    } catch (e) {
        box.value = '预览失败：' + (e && e.message ? e.message : e);
    }
}

/* ------------------------------ JSON 解析（原样搬自原脚本） ------------------------------ */
function extractBracket(s, open, close) {
    const start = s.indexOf(open);
    if (start < 0) return null;
    let depth = 0, inStr = false, escNext = false;
    for (let i = start; i < s.length; i++) {
        const c = s.charAt(i);
        if (inStr) {
            if (escNext) { escNext = false; continue; }
            if (c === '\\') { escNext = true; continue; }
            if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') { inStr = true; continue; }
        if (c === open) depth++;
        else if (c === close) {
            depth--;
            if (depth === 0) return s.slice(start, i + 1);
        }
    }
    return null;
}

function stripFence(t) {
    const m = String(t || '').match(/```(?:json)?\s*([\s\S]*?)```/);
    return m ? m[1].trim() : String(t || '').trim();
}

function jsonTry(s) {
    try {
        const o = JSON.parse(s);
        return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null;
    } catch (e) { return null; }
}

function jsonRepair(s) {
    return String(s)
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
}

function asProfileArray(x) {
    if (!Array.isArray(x)) return null;
    const out = x.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    return out.length ? out : null;
}

function parseObjects(t) {
    const out = [];
    let pos = 0;
    while (pos < t.length) {
        const i = t.indexOf('{', pos);
        if (i < 0) break;
        const seg = extractBracket(t.slice(i), '{', '}');
        if (!seg) break;
        const o = jsonTry(seg) || jsonTry(jsonRepair(seg));
        if (o && !Array.isArray(o)) out.push(o);
        pos = i + seg.length;
    }
    return out.length ? out : null;
}

function parseProfileList(txt) {
    const t = stripFence(txt);
    let arr = asProfileArray(jsonTry(t));
    if (arr) return arr;
    const whole = jsonTry(t) || jsonTry(jsonRepair(t));
    if (whole && !Array.isArray(whole)) {
        for (const k in whole) {
            arr = asProfileArray(whole[k]);
            if (arr) return arr;
        }
    }
    const i = t.indexOf('['), j = t.lastIndexOf(']');
    if (i >= 0 && j > i) {
        const seg = t.slice(i, j + 1);
        arr = asProfileArray(jsonTry(seg)) || asProfileArray(jsonTry(jsonRepair(seg)));
        if (arr) return arr;
    }
    return parseObjects(t);
}

function normalizeProfile(raw, name) {
    if (!raw) return null;
    const norm = (s) => String(s).replace(/[\s_\-\/·、]/g, '').toLowerCase();
    const flat = {};
    for (const k in raw) {
        if (raw[k] !== undefined && raw[k] !== null) flat[norm(k)] = String(raw[k]).trim();
    }
    const pick = (...keys) => {
        for (const k of keys) {
            const v = flat[norm(k)];
            if (v) return v;
        }
        return '';
    };
    const out = {
        '姓名': pick('姓名', 'name', '名字', '角色名', '角色') || name,
        '性别/年龄': pick('性别/年龄', '性别年龄', '性别', '年龄', 'gender_age', 'gender', 'age'),
        '外貌特征': pick('外貌特征', '外貌', '外观', '外貌描述', 'appearance', 'looks'),
        '当前衣着/装扮': pick('当前衣着/装扮', '当前衣着', '当前装扮', '衣着', '装扮', '服装', 'current_outfit', 'outfit'),
        '核心DNA': pick('核心DNA', '核心dna', 'core_dna', 'DNA', '核心基因'),
        '服装DNA': pick('服装DNA', '服装dna', 'clothing_dna', '服饰DNA', '衣物DNA'),
        '本名': pick('本名', '原名', '原始姓名', 'original_name', 'realname'),
        '外貌串': pick('外貌串', '外貌提示词', '外貌prompt', 'appearance_prompt', 'appearanceprompt'),
        '服装串': pick('服装串', '服装提示词', '服装prompt', 'outfit_prompt', 'outfitprompt')
    };
    if (!out['核心DNA'] && !out['外貌特征'] && !out['当前衣着/装扮']) return null;
    return out;
}


/* ------------------------------ AI 调用 ------------------------------ */

/* 智绘姬 LLM 配置列表（全部） */
function allProfiles() {
    try {
        const ch = extension_settings[CHATU8];
        if (!ch || !ch.llm_profiles || typeof ch.llm_profiles !== 'object') return {};
        return ch.llm_profiles;
    } catch (e) { return {}; }
}

/* DNA 自己选的那份配置名；没选过就跟着智绘姬当前那份走（只读，不写回）。
   scope：lib = 档案库（默认），gen = 手动生成。手动生成没单独选过时沿用档案库那份。 */
function currentProfileName(scope) {
    const list = allProfiles();
    /* 手动生成：先看自己选的那份，没选/已失效就退到档案库那份，再退到智绘姬当前那份 */
    const tries = scope === 'gen' ? [S.llmProfileGen, S.llmProfile] : [S.llmProfile];
    for (const n of tries) { if (n && list[n]) return n; }
    try {
        const ch = extension_settings[CHATU8];
        const fallback = (ch && ch.current_llm_profile) || '';
        if (fallback && list[fallback]) return fallback;
    } catch (e) { /* 忽略 */ }
    return '';
}

/* 只改 DNA 自己的选择，绝不碰智绘姬的 current_llm_profile */
function switchProfile(name, scope) {
    if (!name) return false;
    if (!allProfiles()[name]) return false;
    if (scope === 'gen') S.llmProfileGen = name; else S.llmProfile = name;
    saveSettings(true);
    return true;
}

/* 把下拉框填成智绘姬那几份配置（scope：lib / gen 各一个下拉） */
function fillProfileSelect(scope) {
    const sel = document.querySelector('#dna-tab [data-dna="' + (scope === 'gen' ? 'genProfileSelect' : 'profileSelect') + '"]');
    if (!sel) return;
    const list = allProfiles();
    const names = Object.keys(list);
    const cur = currentProfileName(scope);
    if (!names.length) {
        sel.innerHTML = '<option value="">（智绘姬里还没有 LLM 配置）</option>';
        sel.value = '';
        return;
    }
    sel.innerHTML = names.map((n) => {
        const p = list[n] || {};
        const m = String(p.model || '未选模型');
        return '<option value="' + esc(n) + '">' + esc(n) + ' · ' + esc(m) + '</option>';
    }).join('');
    sel.value = list[cur] ? cur : names[0];
}

/* 把当前配置的全部字段摊开展示（scope：lib / gen 各一块） */
function renderConfigDetail(scope) {
    const box = document.querySelector('#dna-tab [data-dna="' + (scope === 'gen' ? 'genConfigDetail' : 'configDetail') + '"]');
    if (!box) return;
    const p = chatu8Profile(scope);
    if (!p) { box.innerHTML = ''; return; }
    const onOff = (v, d) => (v === undefined || v === null ? d : (v ? '开' : '关'));
    const rows = [
        ['API Base URL', p.api_url || '（空）'],
        ['API Key', p.api_key ? (String(p.api_key).slice(0, 6) + '••••••' + String(p.api_key).slice(-4)) : '（空）'],
        ['模型', p.model || '（未选）'],
        ['渠道', p.channel_type === 'vertex' ? 'Vertex' : 'OpenAI'],
        ['温度', (p.enable_temperature === false ? '（未启用）' : '') + (p.temperature ?? '—')],
        ['Top P', (p.enable_top_p === false ? '（未启用）' : '') + (p.top_p ?? '—')],
        ['最大 tokens', (p.enable_max_tokens === false ? '（未启用）' : '') + (p.max_tokens ?? '—')],
        ['流式输出', onOff(p.stream, '关')],
        ['绕过代理', onOff(p.bypass_proxy, '关')],
        ['合并 system/user', onOff(p.merge_system_user, '关')],
        ['发送图片', onOff(p.send_images, '关')],
        ['自定义请求头', p.enable_custom_headers ? (p.custom_headers || '（已启用但为空）') : '关'],
        ['自定义请求体', p.enable_custom_body_params ? (p.custom_body_params || '（已启用但为空）') : '关']
    ];
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

/* 当前选中的那份配置（填了地址和模型才算可用） */
function chatu8Profile(scope) {
    const name = currentProfileName(scope);
    if (!name) return null;
    const p = allProfiles()[name];
    return (p && typeof p === 'object') ? p : null;
}

function resolveApi(scope) {
    const p = chatu8Profile(scope);
    if (!p) throw new Error('智绘姬里还没有 LLM 配置：请到「LLM」页签新建一份并填好地址、Key、模型');
    if (String(p.channel_type || 'openai') === 'vertex') {
        throw new Error('智绘姬当前是 Vertex 渠道，角色DNA只支持 OpenAI 兼容渠道，请到 LLM 页签切回 OpenAI 渠道');
    }
    const url = String(p.api_url || '').trim();
    const model = String(p.model || '').trim();
    if (!url) throw new Error('智绘姬 LLM 页签还没填 API Base URL');
    if (!model) throw new Error('智绘姬 LLM 页签还没选模型');
    return {
        source: '智绘姬 LLM',
        format: 'openai',
        url,
        key: String(p.api_key || ''),
        model,
        temperature: p.enable_temperature === false ? 1 : numOr(p.temperature, 0.8),
        maxTokens: p.enable_max_tokens === false ? 0 : numOr(p.max_tokens, 4000),
        customHeaders: apiExtras(scope).headersObj
    };
}function openAiEndpoint(base, path) {
    const b = String(base || '').trim().replace(/\/+$/, '');
    if (!b) throw new Error('还没填 API 地址');
    if (/\/chat\/completions$/i.test(b)) return b;
    if (/\/messages$/i.test(b)) return b;
    if (/\/v\d+[a-z]*$/i.test(b)) return b + path;
    return b + '/v1' + path;
}

function isSafetyBlock(msg) {
    return /prohibited use policy|sensitive words|SAFETY|content policy|use-policy|content_filter|blockReason|PROHIBITED_CONTENT|返回内容为空/i.test(String(msg || ''));
}

function clipText(t, per) {
    return String(t || '').split('\n').map((l) => (l.length > per ? l.slice(0, per) + '……' : l)).join('\n');
}

/* 组装请求头：智绘姬里可以加自定义头（比如各种中转站要的字段） */
function apiHeaders(api, extra) {
    const h = { 'Content-Type': 'application/json' };
    if (api.key) h['Authorization'] = 'Bearer ' + api.key;
    if (api.customHeaders && typeof api.customHeaders === 'object') {
        for (const k in api.customHeaders) if (k) h[k] = String(api.customHeaders[k]);
    }
    return Object.assign(h, extra || {});
}

/* 从智绘姬配置里取出要用的附加项 */
function apiExtras(scope) {
    const p = chatu8Profile(scope) || {};
    let customHeaders = null;
    if (p.enable_custom_headers && p.custom_headers) {
        customHeaders = {};
        /* 智绘姬这里是 "Key: Value" 每行一条 */
        String(p.custom_headers).split('\n').forEach((line) => {
            const i = line.indexOf(':');
            if (i > 0) {
                const k = line.slice(0, i).trim();
                const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
                if (k) customHeaders[k] = v;
            }
        });
    }
    return {
        bypassProxy: !!p.bypass_proxy,
        customHeaders,
        headersObj: customHeaders
    };
}

async function callOpenAI(prompt, api, signal) {
    const url = openAiEndpoint(api.url, '/chat/completions');
    const plan = applyBreakthrough({}, normalizeMessages(prompt));
    const body = {
        model: api.model,
        messages: plan.messages,
        temperature: api.temperature
    };
    if (plan.tools) { body.tools = plan.tools; body.tool_choice = plan.toolChoice; }
    if (api.maxTokens > 0) body.max_tokens = api.maxTokens;
    const res = await fetch(url, {
        method: 'POST',
        headers: apiHeaders(api),
        body: JSON.stringify(body),
        signal
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const ch = data && data.choices && data.choices[0];
    const msg = ch ? ch.message : null;
    const finish = String((ch && ch.finish_reason) || (ch && ch.finishReason) || '');
    const usage = (data && data.usage) || {};
    /* 开了自定义 Tool 时，正文在 tool_calls 里 */
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        const decoded = decodeToolCall(msg, chatu8ToolConfig());
        if (decoded && String(decoded).trim()) return String(decoded);
    }
    let txt = msg ? msg.content : (ch ? ch.text : '');
    if (txt && String(txt).trim()) return String(txt);

    /* 空正文的几种常见情况，分别给能照着做的提示 */
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        const tc = msg.tool_calls[0];
        if (tc && tc.function && tc.function.arguments) return String(tc.function.arguments);
    }
    if (finish === 'length') {
        const rt = usage.completion_tokens_details && usage.completion_tokens_details.reasoning_tokens;
        throw new Error('输出被截断（finish_reason=length）：max_tokens 用完了，正文一个字都没出来'
            + (rt ? '（其中思考占了 ' + rt + ' tokens）' : '')
            + '。请到智绘姬「LLM」页签把这份配置的「最大 tokens」调大（建议 8000 以上），'
            + '或把「每次扫描最近 N 层」调小再试。');
    }
    /* 有的推理模型把正文全塞进 reasoning_content */
    if (finish !== 'length' && msg) {
        const rc = msg.reasoning_content || msg.reasoning || msg.thinking;
        if (rc && String(rc).trim()) return String(rc);
    }
    throw new Error('返回内容为空（finish_reason=' + (finish || '未知')
        + '，usage=' + JSON.stringify(usage) + '）：' + raw.slice(0, 300));
}

async function callAnthropic(prompt, api, signal) {
    const url = openAiEndpoint(api.url, '/messages');
    const mt = api.maxTokens > 0 ? api.maxTokens : 4000;
    /* Anthropic 不收 messages 里的 system，单独提到 system 字段 */
    const all = normalizeMessages(prompt);
    const sys = all.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = all.filter((m) => m.role !== 'system');
    const body = {
        model: api.model,
        max_tokens: mt,
        temperature: api.temperature,
        messages: rest.length ? rest : [{ role: 'user', content: '（无正文）' }]
    };
    if (sys) body.system = sys;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': api.key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body),
        signal
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const out = ((data && data.content) || []).map((b) => (b && b.text ? b.text : '')).join('');
    if (!out.trim()) {
        const stop = String((data && data.stop_reason) || '未知');
        throw new Error('返回内容为空（stop_reason=' + stop + '）'
            + (stop === 'max_tokens' ? '：max_tokens 用完了，请把「最大 tokens」调大（建议 8000 以上）' : '')
            + '：' + raw.slice(0, 300));
    }
    return out;
}

async function callGemini(prompt, api, signal) {
    const base = String(api.url || '').trim().replace(/\/+$/, '');
    let url;
    if (/:(generateContent|streamGenerateContent)$/i.test(base)) {
        url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(api.key);
    } else {
        url = base + (/\/v\d+[a-z]*$/i.test(base) ? '' : '/v1beta') +
            '/models/' + encodeURIComponent(api.model) + ':generateContent?key=' + encodeURIComponent(api.key);
    }
    const gen = { temperature: api.temperature };
    if (api.maxTokens > 0) gen.maxOutputTokens = api.maxTokens;
    /* Gemini 的 system 走 systemInstruction，其余按 user/model 轮次发 */
    const all = normalizeMessages(prompt);
    const sys = all.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = all.filter((m) => m.role !== 'system');
    const body = {
        contents: (rest.length ? rest : [{ role: 'user', content: '（无正文）' }]).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        })),
        generationConfig: gen
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const cand = data && data.candidates && data.candidates[0];
    const out = cand && cand.content && cand.content.parts
        ? cand.content.parts.map((p) => (p && p.text ? p.text : '')).join('')
        : '';
    if (!out.trim()) {
        const fr = String((cand && (cand.finishReason || cand.finish_reason)) || '未知');
        const block = data && data.promptFeedback && data.promptFeedback.blockReason;
        throw new Error('返回内容为空（finishReason=' + fr + (block ? ' / blockReason=' + block : '') + '）'
            + (fr === 'MAX_TOKENS' ? '：max_tokens 用完了，请把「最大 tokens」调大（建议 8000 以上）' : '')
            + '：' + raw.slice(0, 300));
    }
    return out;
}

async function callAI(prompt, scope) {
    const api = resolveApi(scope);
    if (!api.url) throw new Error('智绘姬 LLM 页签里还没填 API 地址');
    if (!api.model) throw new Error('智绘姬 LLM 页签里还没选模型');
    const signal = abortSignal();
    if (api.format === 'anthropic') return callAnthropic(prompt, api, signal);
    if (api.format === 'gemini') return callGemini(prompt, api, signal);
    return callOpenAI(prompt, api, signal);
}

/* ------------------------------ 中断请求 ------------------------------ */
/* 一次任务（扫描 / 手动生成 / 测试）共用一个 AbortController；
   按钮只在这期间可用，任务结束自动失效。 */
let abortCtl = null;
const ABORT_KEYS = ['abortScan', 'genAbortWorld', 'genAbortChars'];

function abortSignal() {
    if (typeof AbortController !== 'function') return undefined;
    if (!abortCtl) abortCtl = new AbortController();
    return abortCtl.signal;
}

function abortedNow() {
    return !!(abortCtl && abortCtl.signal && abortCtl.signal.aborted);
}

function syncAbortBtns() {
    const on = !!(abortCtl && abortCtl.signal && !abortCtl.signal.aborted);
    for (const k of ABORT_KEYS) {
        const b = document.querySelector('#dna-tab [data-dna="' + k + '"]');
        if (!b) continue;
        b.disabled = !on;
        b.classList.toggle('dna-btn-abort-on', on);
    }
}

function clearAbort() {
    abortCtl = null;
    syncAbortBtns();
}

function doAbort() {
    if (!abortCtl || !abortCtl.signal || abortCtl.signal.aborted) {
        toast('现在没有正在进行的请求');
        return;
    }
    abortCtl.abort();
    log('已中断请求，正在断开连接…');
    toast('已中断');
    syncAbortBtns();
}

/* 自动重试次数：0 = 不重试（默认）。只在「内容过滤 / 返回空」这类错误上重试，
   网络断了、key 错了、模型名错了都不重试——重试也不会变好，只是白花钱。 */
function retryTimes() {
    const n = Number(S.retryCount);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, Math.floor(n))) : 0;
}

async function callSafe(prompt, softPrompt, scope, altPrompt) {
    abortSignal();          /* 本轮任务的中断控制器，按钮在这一刻才可用 */
    syncAbortBtns();
    try {
        try {
            return await callAI(prompt, scope);
        } catch (e) {
            if (abortedNow()) throw new Error('已手动中断');
            const max = retryTimes();
            const msg = String((e && e.message) || e);
            if (max <= 0) {
                if (isSafetyBlock(msg)) log('请求没走通（' + msg.slice(0, 140) + '）；自动重试是关闭的（0 次），不再试', 'error');
                throw e;
            }
            if (!isSafetyBlock(msg)) throw e;   /* 这类错重试也没用 */
            let last = e;
            for (let i = 1; i <= max; i++) {
                if (abortedNow()) throw new Error('已手动中断');
                /* 第 1 次用精简正文，第 2 次换成内置提示词，之后原样再试 */
                let p = prompt;
                let what = '原样重试';
                if (i === 1 && softPrompt) { p = softPrompt; what = '精简正文'; }
                else if (i === 2 && altPrompt) { p = altPrompt; what = '换内置提示词'; }
                log('自动重试 ' + i + '/' + max + '（' + what + '）……上一次：' + String((last && last.message) || last).slice(0, 120), 'error');
                try {
                    return await callAI(p, scope);
                } catch (e2) {
                    if (abortedNow()) throw new Error('已手动中断');
                    last = e2;
                    if (!isSafetyBlock(String((e2 && e2.message) || e2))) throw e2;
                }
            }
            log('自动重试 ' + max + ' 次都没成功，放弃', 'error');
            throw last;
        }
    } finally {
        clearAbort();       /* 任务收尾：按钮回到不可用 */
    }
}

/* ------------------------------ 附加配置：智绘姬的自定义 Tool + 末尾多 Role 消息 ------------------------------ */

/* 读智绘姬那份配置（都是全局的，和 LLM 页签里看到的是同一份） */
function chatu8ToolConfig() {
    try {
        const ch = extension_settings[CHATU8];
        return (ch && ch.tool_call_config) || null;
    } catch (e) { return null; }
}

function chatu8TailConfig() {
    try {
        const ch = extension_settings[CHATU8];
        return (ch && ch.tail_messages_config) || null;
    } catch (e) { return null; }
}

/* 插件自己那两个开关才是决定权：智绘姬 LLM 页签那边的 enabled 只管它自己，不干涉这里 */
function toolEnabled() {
    if (!S.breakTool) return false;
    const c = chatu8ToolConfig();
    return !!(c && Array.isArray(c.fields) && c.fields.length);
}

function tailEnabled() {
    if (!S.breakTail) return false;
    const c = chatu8TailConfig();
    return !!(c && Array.isArray(c.messages) && c.messages.length);
}

/* 智绘姬那边的原始开关状态，只用来在面板上说明，不参与判断 */
function chatu8ToolSwitch() {
    const c = chatu8ToolConfig();
    return !!(c && c.enabled !== false);
}

function chatu8TailSwitch() {
    const c = chatu8TailConfig();
    return !!(c && c.enabled !== false);
}

/* 和智绘姬一样：动态随机名（防缓存），或固定名 */
function makeToolName() {
    const c = chatu8ToolConfig() || {};
    if ((c.nameMode || 'dynamic') === 'fixed' && String(c.fixedName || '').trim()) {
        return String(c.fixedName).trim();
    }
    const prefix = c.prefix || 'agw_emit_';
    let nonce = '';
    try {
        const arr = new Uint8Array(8);
        crypto.getRandomValues(arr);
        nonce = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        nonce = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    }
    return prefix + nonce;
}

/* 照智绘姬 buildSyntheticToolSchema 的规则拼工具定义 */
function buildToolSchema(name, cfg) {
    const properties = {};
    const required = [];
    for (const f of (cfg.fields || [])) {
        if (!f || !String(f.name || '').trim()) continue;
        const key = String(f.name).trim();
        properties[key] = { type: 'string', description: String(f.description || ('Field ' + key)) };
        if (f.required !== false) required.push(key);
    }
    if (!Object.keys(properties).length) {
        properties.thought_and_context = { type: 'string', description: '你的思考与正文' };
        required.push('thought_and_context');
    }
    return {
        type: 'function',
        function: {
            name,
            description: String(cfg.desc || 'must使用这个工具来进行内容思考和正文回复'),
            parameters: {
                type: 'object',
                properties,
                required: required.length ? required : Object.keys(properties).slice(0, 1)
            }
        }
    };
}

/* 把末尾多 Role 消息追加到 messages 末尾，%TOOL_NAME% 换成真实工具名（同智绘姬 injectTailMessages） */
function injectTail(messages, toolName) {
    const cfg = chatu8TailConfig();
    const out = Array.isArray(messages) ? messages.slice() : [];
    if (!cfg || !S.breakTail || !Array.isArray(cfg.messages)) return out;
    for (const item of cfg.messages) {
        if (!item || !item.role || !item.content) continue;
        const content = String(item.content)
            .replace(/%TOOL_NAME%/g, toolName)
            .replace(/TOOL_NAME%/g, toolName)
            .replace(/%s/g, toolName);
        out.push({ role: String(item.role), content });
    }
    return out;
}

/* 模型走 tool call 回来时，按智绘姬的字段顺序把内容还原成正文 */
function decodeToolCall(message, cfg) {
    const tc = message && Array.isArray(message.tool_calls) ? message.tool_calls[0] : null;
    if (!tc || !tc.function) return '';
    let args = tc.function.arguments;
    if (args && typeof args === 'object') args = JSON.stringify(args);
    let parsed = null;
    try { parsed = JSON.parse(String(args || '')); } catch (e) { parsed = null; }
    if (!parsed) return String(args || '');
    const fields = (cfg && Array.isArray(cfg.fields) && cfg.fields.length)
        ? cfg.fields
        : [{ name: 'thought_and_context', wrapTag: '' }];
    let out = '';
    for (const f of fields) {
        const key = String(f.name || '').trim();
        if (!key) continue;
        const v = parsed[key];
        if (v === undefined || v === null) continue;
        const sv = typeof v === 'string' ? v : JSON.stringify(v);
        const tag = String(f.wrapTag || '').trim();
        if (tag) {
            const t = sv.trim();
            const already = t.startsWith('<' + tag + '>') || (tag === 'thinking' && t.startsWith('<think'));
            out += already ? (out ? '\n\n' : '') + t : '<' + tag + '>' + sv + '</' + tag + '>\n\n';
        } else {
            out += (out ? '\n\n' : '') + sv;
        }
    }
    /* 模型用了配置里没有的字段名 → 按原顺序把所有值拼出来，别把内容丢了 */
    if (!out.trim()) {
        const vals = Object.keys(parsed)
            .map((k) => parsed[k])
            .filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
        out = vals.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n\n');
    }
    return out;
}

/* 请求体里加上工具和末尾消息；两项互相独立，各自看插件里的开关。
   %TOOL_NAME% 一定要换成真实名字：预设里留着占位符，模型看到一个空名字会直接不输出。 */
function applyBreakthrough(body, messages) {
    const out = { messages };
    const tc = chatu8ToolConfig();
    const wantTool = toolEnabled();
    const wantTail = tailEnabled();
    /* 工具关着也给它一个稳定名字，让预设里的 %TOOL_NAME% 读起来是通的 */
    const name = (wantTool || wantTail) ? makeToolName() : 'emit_payload';
    out.messages = (Array.isArray(out.messages) ? out.messages : []).map((m) => {
        if (!m || typeof m.content !== 'string' || m.content.indexOf('TOOL_NAME%') < 0) return m;
        return Object.assign({}, m, {
            content: m.content.replace(/%TOOL_NAME%/g, name).replace(/TOOL_NAME%/g, name)
        });
    });
    if (wantTool || wantTail) {
        out.toolName = name;
        if (wantTool) {
            out.tools = [buildToolSchema(name, tc)];
            out.toolChoice = 'auto';
        }
        if (wantTail) {
            out.messages = injectTail(out.messages, name);
        }
    }
    return out;
}

/* 测试工具里展示「真正发出去的东西」：messages + tool 定义 */
function previewPayload(prompt) {
    const plan = applyBreakthrough({}, normalizeMessages(prompt));
    const lines = [];
    lines.push('===== messages（共 ' + plan.messages.length + ' 条）=====');
    plan.messages.forEach((m, i) => {
        lines.push('');
        lines.push('--- [' + (i + 1) + '] role=' + m.role + ' ---');
        lines.push(m.content);
    });
    if (plan.tools) {
        lines.push('');
        lines.push('===== tools（1 个，tool_choice=' + plan.toolChoice + '）=====');
        lines.push(JSON.stringify(plan.tools[0], null, 2));
    } else {
        lines.push('');
        lines.push('===== tools：未启用（「Tool 与末尾消息」卡片里没开自定义 Tool）=====');
    }
    return lines.join('\n');
}

/* ------------------------------ 正则 & 测试工具 ------------------------------ */
function renderRegexInfo() {
    const box = document.querySelector('#dna-tab [data-dna="regexInfo"]');
    if (!box) return;
    const name = regexProfileName();
    const n = regexEntriesCount();
    const rows = [
        ['正则配置', name || '（智绘姬里没选）'],
        ['启用的条目', n + ' 条'],
        ['正文是否过正则', S.useRegex ? '是' : '否（已关闭）'],
        ['收哪些楼层', '只收 AI 输出的楼层，玩家输入不进来']
    ];
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

/* 这两项读的是智绘姬 LLM 页签那两份配置 */

/* ------------------------------ 手机 / 电脑界面自适应 ------------------------------ */
/* 自动检测优先用酒馆自己的 isMobile()，拿不到就退回屏宽判断。
   检测出来的结果只影响外观（给 #dna-tab 挂 dna-mobile / dna-desktop），不动任何功能。 */

const UI_MODES = { auto: '自动检测', desktop: '电脑版', mobile: '手机版' };

/* 酒馆自己的 isMobile() 是认 UA 的（手机/平板），最准，优先用它 */
function stIsMobile() {
    try {
        const ctx = getContext();
        if (ctx && typeof ctx.isMobile === 'function') return !!ctx.isMobile();
    } catch (e) { /* 拿不到就自己认 UA */ }
    try {
        return /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(String(navigator.userAgent || ''));
    } catch (e) { return false; }
}

/* 面板实际能用的宽度：窄到这个程度就按手机排版，免得挤成一团 */
function panelNarrow() {
    try {
        const tab = document.querySelector('#dna-tab');
        const w = (tab && tab.getBoundingClientRect().width) || window.innerWidth || 0;
        return w > 0 && w < 560;
    } catch (e) { return false; }
}

function useMobileUI() {
    if (S.uiMode === 'mobile') return true;
    if (S.uiMode === 'desktop') return false;
    return stIsMobile() || panelNarrow();
}

let uiModeTimer = null;
let uiWatched = false;

function applyUiMode() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const mob = useMobileUI();
    tab.classList.toggle('dna-mobile', mob);
    tab.classList.toggle('dna-desktop', !mob);
    const el = tab.querySelector('[data-dna="uiState"]');
    if (el) {
        const why = S.uiMode === 'auto' ? (stIsMobile() ? '认出来是手机' : (panelNarrow() ? '面板太窄' : '认出来是电脑')) : '手动锁定';
        el.textContent = '界面：' + (UI_MODES[S.uiMode] || '自动检测') +
            ' · 当前' + (mob ? '手机版' : '电脑版') + '（' + why + '）';
    }
}

function watchViewport() {
    if (uiWatched) return;
    uiWatched = true;
    const onResize = () => {
        if (S.uiMode !== 'auto') return;
        clearTimeout(uiModeTimer);
        uiModeTimer = setTimeout(applyUiMode, 150);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
}

/* 发送数据 */
/* 智绘姬跑 LLM（正文出 Tag、Tag 修改…）之前，把正文里出场角色的 DNA 档案
   一起塞进它的 messages。用 makeFirst 把自己的监听器排到智绘姬前面，
   这样我们改的是它即将发出去的那份 prompt。 */

const SEND_EVENTS = {
    image_gen: 'ch-llm-image-gen-request',
    tag_modify: 'ch-llm-tag-modify-request',
    char_display: 'ch-llm-char-display-request',
    char_modify: 'ch-llm-char-modify-request',
    visual_mat_prep: 'ch-llm-visual-mat-prep-request'
};
const SEND_LABELS = {
    image_gen: '正文出 Tag',
    tag_modify: 'Tag 修改',
    char_display: '角色展示',
    char_modify: '角色修改',
    visual_mat_prep: '视材准备'
};

function sendTargets() {
    const arr = Array.isArray(S.sendTargets) ? S.sendTargets : [];
    return arr.filter((k) => SEND_EVENTS[k]);
}

/* 一次请求里已经塞过就不再塞（重试 / 同一条 prompt 被重复 emit） */
const sendStamp = new WeakSet();

function promptTextOf(prompt) {
    if (!Array.isArray(prompt)) return '';
    const out = [];
    for (const m of prompt) {
        if (!m) continue;
        if (typeof m.content === 'string') out.push(m.content);
        else if (Array.isArray(m.content)) {
            for (const p of m.content) if (p && p.type === 'text' && p.text) out.push(p.text);
        }
    }
    return out.join('\n');
}

/* 正文里提到了哪些已记录的角色（按名字命中，长的名字优先，避免「漠」抢了「漠然」） */
/* 粗估 token：汉字与全角标点按 1 字 1 token，英文/数字按 4 字符 1 token（宁可估多不估少） */
function estimateTokens(text) {
    const str = String(text || '');
    let cjk = 0, other = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if ((c >= 0x2e80 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f)) cjk++;
        else other++;
    }
    return cjk + Math.ceil(other / 4);
}

/* ------------------------------ 人物形态 ------------------------------ */
/* 同一角色的多个形态在档案库里是「多条档案」，姓名格式由预设规定：
     爱丽丝              ← 没有形态差异的普通角色
     爱丽丝·魔法少女[当前]   ← 当前正在用的形态
     爱丽丝·魔法少女[非当前] ← 别的形态，留着不删
   下面这个函数把这些名字拆成「本名 + 形态名 + 标记」，发送和列表都靠它归组。 */
function formInfo(name) {
    const raw = String(name == null ? '' : name).trim();
    let tag = '';
    let body = raw;
    const m = raw.match(/\[(当前|非当前|永久封印)\]\s*$/);
    if (m) {
        tag = m[1];
        body = raw.slice(0, raw.length - m[0].length).trim();
    }
    const parts = body.split('·');
    const base = (parts[0] || '').trim() || raw;
    const form = parts.slice(1).join('·').trim();
    return {
        raw,
        base,                       /* 本名：爱丽丝 */
        form,                       /* 形态名：魔法少女（没有形态时为空） */
        tag,                        /* 当前 / 非当前 / 永久封印 / 空 */
        isForm: parts.length > 1 || !!tag,
        isCurrent: tag === '当前',
        isSealed: tag === '永久封印'
    };
}

/* 把档案名按本名分组：爱丽丝 → 它的全部形态（当前形态排最前） */
function formGroups() {
    const entries = currentEntries();
    const map = new Map();
    for (const name of Object.keys(entries)) {
        const info = formInfo(name);
        if (!map.has(info.base)) map.set(info.base, []);
        map.get(info.base).push({ name, info });
    }
    for (const list of map.values()) {
        list.sort((a, b) => {
            if (a.info.isCurrent !== b.info.isCurrent) return a.info.isCurrent ? -1 : 1;
            if (!!a.info.form !== !!b.info.form) return a.info.form ? 1 : -1;
            return String(a.name).localeCompare(String(b.name), 'zh');
        });
    }
    return map;
}

/* 改姓名末尾的形态标记：爱丽丝·日常[非当前] → 爱丽丝·日常[当前] */
function retagName(name, tag) {
    const body = String(name || '').replace(/\s*\[(当前|非当前|永久封印)\]\s*$/, '').trim();
    return body + (tag ? '[' + tag + ']' : '');
}

/* 把某个形态设为 [当前]：目标打 [当前] 并填本名，同组其它改 [非当前] 并清空本名。
   锁定的档案一律不动（锁就是「AI 别碰这条」）。返回改动列表。 */
function setCurrentForm(base, targetName) {
    const entries = currentEntries();
    const list = formGroups().get(base) || [];
    if (!list.some((x) => x.name === targetName)) return [];
    /* 目标这条锁着 → 整个切换都不做。只改别人的话，会变成「一个 [当前] 都没有」。 */
    if (!entries[targetName] || entries[targetName]._locked) return [];
    const changed = [];
    for (const x of list) {
        const rec = entries[x.name];
        if (!rec) continue;
        if (rec._locked) continue;
        const isTarget = (x.name === targetName);
        if (!isTarget && x.info.isSealed) continue;   /* 永久封印保持原样 */
        const tag = isTarget ? '当前' : '非当前';
        const nn = retagName(x.name, tag);
        if (nn !== x.name) {
            delete entries[x.name];
            if (entries[nn]) {
                /* 目标名上已经有一条（AI 刚写的新版）→ 旧这条退场，别覆盖新版 */
                entries[nn]['本名'] = isTarget ? base : '';
            } else {
                entries[nn] = rec;
                rec['本名'] = isTarget ? base : '';
            }
        } else {
            rec['本名'] = isTarget ? base : '';
        }
        changed.push({ from: x.name, to: nn, form: x.info.form });
    }
    return changed;
}

/* 正文里点名了某个形态 → 把 [当前] 移过去。
   同时出现多个形态名时，取正文里最后提到的那个（剧情往后走的方向）。 */
function autoSwitchForms(text) {
    const t = String(text || '');
    if (!t) return [];
    const out = [];
    for (const [base, list] of formGroups()) {
        if (list.length < 2) continue;
        if (t.indexOf(base) < 0) continue;
        const hits = list
            .filter((x) => x.info.form && !x.info.isSealed && t.indexOf(x.info.form) >= 0)
            .sort((a, b) => t.lastIndexOf(b.info.form) - t.lastIndexOf(a.info.form));
        const target = hits[0];
        if (!target || target.info.isCurrent) continue;
        const changed = setCurrentForm(base, target.name);
        if (changed.length) out.push({ base, form: target.info.form, changed });
    }
    return out;
}

/* 同一角色只能有一个 [当前]：以 keepName 为准，同组其它 [当前] 自动改 [非当前] 并清空本名 */
function enforceOneCurrent(base, keepName) {
    const entries = currentEntries();
    /* [当前] 形态的本名必须是原名：AI 偶尔漏填，这里补上 */
    const keep = entries[keepName];
    if (keep && !keep._locked && !String(keep['本名'] || '').trim()) keep['本名'] = base;
    const list = formGroups().get(base) || [];
    const others = list.filter((x) => x.info.isCurrent && x.name !== keepName);
    for (const x of others) {
        const rec = entries[x.name];
        if (!rec || rec._locked) continue;
        const nn = retagName(x.name, '非当前');
        delete entries[x.name];
        if (entries[nn]) {
            entries[nn]['本名'] = '';
        } else {
            entries[nn] = rec;
            rec['本名'] = '';
        }
    }
}

function pickSendRecords(text) {
    const entries = currentEntries();
    const all = S.sendMode === 'all';
    const t = String(text || '');
    const groups = formGroups();
    const out = [];
    /* 按「本名」分组判断，正文提到本名就算这个角色出场，
       然后只发一个形态：正文点名了某个形态就发那个，否则发 [当前] 那个。
       这样「日常黑发洋装」和「变身后粉发战斗服」不会同时塞给 AI 打架。 */
    for (const [base, list] of groups) {
        if (base.length < 2) continue;
        const mentioned = all || t.indexOf(base) >= 0;
        const formHits = list.filter((x) => x.info.form && !x.info.isSealed && t.indexOf(x.info.form) >= 0);
        if (!mentioned && !formHits.length) continue;
        let pick;
        if (formHits.length) {
            pick = formHits;                                   /* 正文点名了形态 */
        } else {
            const cur = list.find((x) => x.info.isCurrent);     /* 当前形态 */
            if (cur) pick = [cur];
            else {
                const plain = list.find((x) => !x.info.form);   /* 没有形态标记的老档案 */
                pick = plain ? [plain] : list.slice(0, 1);
            }
        }
        for (const x of pick) {
            const content = buildContent(entries[x.name]);
            if (content) out.push({ name: x.name, content, form: x.info.form });
        }
    }
    return out;
}

function buildSendBlock(recs) {
    if (!recs.length) return '';
    return '【以下角色已登记 DNA 档案，写这一段时必须严格照此设定，不得改写】\n\n' +
        recs.map((r) => '▍' + r.name + '\n' + r.content).join('\n\n') +
        '\n\n【DNA 档案到此为止】';
}

/* 追加到末尾那条 user 消息里；没有 user 消息就新加一条 */
function appendToPrompt(prompt, block) {
    if (!block) return false;
    for (let i = prompt.length - 1; i >= 0; i--) {
        const m = prompt[i];
        if (!m || m.role !== 'user') continue;
        if (typeof m.content === 'string') m.content = m.content + '\n\n' + block;
        else if (Array.isArray(m.content)) m.content = m.content.concat([{ type: 'text', text: block }]);
        else m.content = block;
        return true;
    }
    prompt.push({ role: 'user', content: block });
    return true;
}

let sendLast = null;   // 最近一次发送数据的结果，给面板显示

function onSendData(kind, data) {
    try {
        if (!S.enabled || !S.sendEnabled) return;
        if (!data || !Array.isArray(data.prompt) || !data.prompt.length) return;
        if (sendStamp.has(data.prompt)) return;
        const baseText = promptTextOf(data.prompt);
        const baseTokens = estimateTokens(baseText);
        sendLast = { kind, at: Date.now(), n: 0, tokens: 0, base: baseTokens, names: [] };
        const recs = pickSendRecords(baseText);
        sendLast.n = recs.length;
        sendLast.names = recs.map((r) => r.name);
        if (!recs.length) {
            sendLast.note = '正文里没提到已记录的角色，这次不发';
            renderSendInfo();
            return;
        }
        const block = buildSendBlock(recs);
        if (!appendToPrompt(data.prompt, block)) return;
        sendStamp.add(data.prompt);
        sendLast.tokens = estimateTokens(block);
        sendLast.total = baseTokens + sendLast.tokens;
        log('发送数据 · ' + (SEND_LABELS[kind] || kind) + '：带上 ' +
            recs.length + ' 份 DNA（' + recs.map((r) => r.name).join('、') + '），'
            + sendLast.tokens + ' token；请求合计 ' + sendLast.total + ' token');
        renderSendInfo();
    } catch (e) {
        console.warn('[DNA] send data failed', e);
    }
}

const hooked = {};

function installSendHooks() {
    let es = null;
    try { es = SillyTavern.getContext().eventSource; } catch (e) { return; }
    if (!es || typeof es.on !== 'function') return;
    for (const kind in SEND_EVENTS) {
        const ev = SEND_EVENTS[kind];
        if (!hooked[ev]) {
            hooked[ev] = (data) => onSendData(kind, data);
            es.on(ev, hooked[ev]);
        }
        /* 必须排在智绘姬自己的处理函数前面，否则它已经把请求发出去了 */
        if (typeof es.makeFirst === 'function') es.makeFirst(ev, hooked[ev]);
    }
}

function renderSendInfo() {
    const box = document.querySelector('#dna-tab [data-dna="sendInfo"]');
    if (!box) return;
    const rows = [
        ['状态', S.sendEnabled ? '已启用' : '未启用'],
        ['发给', sendTargets().map((k) => SEND_LABELS[k] || k).join(' / ') || '（没选）'],
        ['范围', S.sendMode === 'all' ? '本库全部角色' : '只发正文里提到的角色'],
        ['最近一次', sendLast
            ? (fmtTime(sendLast.at) + ' · ' + (SEND_LABELS[sendLast.kind] || sendLast.kind) + ' · ' +
                (sendLast.n
                    ? (sendLast.n + ' 份 / DNA ' + sendLast.tokens + ' token'
                        + (sendLast.total ? (' · 请求合计 ' + sendLast.total + ' token') : ''))
                    : (sendLast.note || '没发')))
            : '还没发过']
    ];
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

async function onSendPreview() {
    const ta = document.querySelector('#dna-tab [data-dna="sendPreviewBox"]');
    if (!ta) return;
    try {
        const bag = await collectChatText(clampInt(S.scanDepth, 1, 300, 3));
        const recs = pickSendRecords(bag.text);
        if (!recs.length) {
            ta.value = '最近 ' + bag.count + ' 层 AI 回复里没提到任何已记录的角色，这次不会发。';
        } else {
            const block = buildSendBlock(recs);
            ta.value = block + '\n\n【说明】这段 DNA 约 ' + estimateTokens(block) + ' token，会追加到智绘姬那条请求的末尾。';
        }
    } catch (e) {
        ta.value = '预览失败：' + (e && e.message ? e.message : e);
    }
}

/* 取用于测试的原始正文：输入框有就用输入框，否则取最近 N 层 AI 回复 */async function testSourceText() {
    const ta = document.querySelector('#dna-tab [data-dna="testInput"]');
    const typed = ta ? String(ta.value || '').trim() : '';
    if (typed) return { text: typed, from: '输入框' };
    const bag = await collectChatText(clampInt(S.scanDepth, 1, 300, 3));
    return { text: bag.text, from: '最近 ' + bag.count + ' 层 AI 回复' };
}

function setTestField(key, value) {
    const el = document.querySelector('#dna-tab [data-dna="' + key + '"]');
    if (el) el.value = value;
}

function testHint(msg, isErr) {
    const el = document.querySelector('#dna-tab [data-dna="testHint"]');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? '#e06c75' : '';
}

async function onTestRegex() {
    regexBroken = false;   // 手动测试时重新给一次机会
    const btn = document.querySelector('#dna-tab [data-dna="testRegex"]');
    const old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '正则处理中…'; }
    setTestField('testPrompt', '');
    setTestField('testResult', '');
    const scene = snapshotChatu8RegexUI();
    try {
        const src = await testSourceText();
        if (!src.text) { testHint('没有可测试的正文', true); return; }
        const cleaned = await regexOnly(src.text);
        setTestField('testCleaned', cleaned);
        testHint('正则处理完成：' + src.from + ' · ' + src.text.length + ' 字 → ' + cleaned.length + ' 字');
        log('正则预览：' + src.text.length + ' 字 → ' + cleaned.length + ' 字');
    } catch (e) {
        testHint('正则处理失败：' + (e && e.message ? e.message : e), true);
        log('正则预览失败：' + (e && e.message ? e.message : e), 'error');
    } finally {
        restoreChatu8RegexUI(scene);
        if (btn) { btn.disabled = false; btn.textContent = old; }
    }
}

async function onTestLLM() {
    regexBroken = false;
    const btn = document.querySelector('#dna-tab [data-dna="testLLM"]');
    const old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '请求中…'; }
    setTestField('testResult', '正在请求……');
    const scene = snapshotChatu8RegexUI();
    try {
        const src = await testSourceText();
        if (!src.text) { testHint('没有可测试的正文', true); setTestField('testResult', ''); return; }
        const cleaned = S.useRegex ? await regexOnly(src.text) : src.text;
        setTestField('testCleaned', cleaned);
        const origins = cardOrigins();
        const olds = pickOldRecords(cleaned, 12000);
        const wb = await collectLibWorldbook(cleaned);
        if (wb.length) testHint('世界书命中 ' + wb.length + ' 条设定（' + wb.reduce((n, o) => n + o.content.length, 0) + ' 字）');
        const prompt = buildRecordPrompt(cleaned, { origins, olds, wb });
        setTestField('testPrompt', previewPayload(prompt));
        const api = resolveApi();
        testHint('正在用 ' + api.source + ' · ' + api.model + ' 请求…');
        const reply = await callSafe(prompt, buildRecordPrompt(clipText(cleaned, 400), { origins, olds, wb }));
        setTestField('testResult', reply);
        const nChars = promptChars(prompt);
        testHint('完成：正文 ' + src.text.length + ' → ' + cleaned.length + ' 字，prompt ' + nChars + ' 字，回复 ' + reply.length + ' 字');
        log('测试请求完成：' + api.model + ' · prompt ' + nChars + ' 字 → 回复 ' + reply.length + ' 字');
        logBreakthrough();
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        setTestField('testResult', '失败：' + msg);
        testHint('测试请求失败：' + msg, true);
        log('测试请求失败：' + msg, 'error');
    } finally {
        restoreChatu8RegexUI(scene);
        if (btn) { btn.disabled = false; btn.textContent = old; }
    }
}

/* 日志里说清楚这轮带没带附加配置（tool / 末尾消息） */
function logBreakthrough() {
    const t = toolEnabled();
    const tl = tailEnabled();
    if (!t && !tl) { log('附加配置：都没开（只有预设 / 内置提示词）'); return; }
    const bits = [];
    if (t) {
        const c = chatu8ToolConfig() || {};
        bits.push('自定义 Tool（' + (c.fields || []).length + ' 个字段）');
    }
    if (tl) {
        const c = chatu8TailConfig() || {};
        bits.push('末尾 ' + (c.messages || []).length + ' 条多 Role 消息');
    }
    log('附加配置：已带上 · ' + bits.join(' + '));
}

/* ------------------------------ 扫描主流程 ------------------------------ */
function setBusy(busy, label) {
    scanning = busy;
    const btn = document.querySelector('#dna-tab [data-dna="scanNow"]');
    if (btn) btn.disabled = busy;
    /* 按钮里有图标，只能换文字节点，不能整个 textContent 覆盖 */
    const lb = document.querySelector('#dna-tab [data-dna="scanLabel"]');
    if (lb) lb.textContent = busy ? (label || '记录中…') : '立即记录';
    const dot = document.querySelector('#dna-tab [data-dna="status"]');
    if (dot) dot.textContent = busy ? '运行中' : '空闲';
    const d = document.querySelector('#dna-tab .dna-dot');
    if (d) {
        d.classList.toggle('dna-dot-busy', !!busy);
        d.classList.toggle('dna-dot-on', !busy && !!S.enabled);
    }
    if (!busy) syncAbortBtns();
}

async function runScan(opts) {
    opts = opts || {};
    if (scanning) { log('上一轮还在跑，跳过本次'); return; }
    if (!S.enabled) { log('插件已停用，跳过'); return; }

    const depth = clampInt(opts.depth || S.scanDepth, 1, 300, 3);
    setBusy(true);

    try {
        const bag = await collectChatText(depth);
        if (!bag.count) { log('最近 ' + depth + ' 层里没有 AI 输出的正文可扫'); return; }
        log('扫描第 ' + bag.from + '-' + bag.to + ' 层，取到 ' + bag.count + ' 层 AI 回复 / ' + bag.text.length + ' 字');
        if (bag.skipped) log('跳过 ' + bag.skipped + ' 层玩家输入（只收 AI 楼层）');
        if (S.useRegex) {
            log('已过智绘姬正则「' + (regexProfileName() || '未选') + '」：' + bag.before + ' 字 → ' + bag.after + ' 字');
        } else {
            log('正则处理已关闭，直接发原文');
        }
        log('档案库：' + cardLabel());

        const origins = cardOrigins();
        if (origins.length) log('带上角色卡设定作为人物底子（' + origins[0].content.length + ' 字）');

        const olds = pickOldRecords(bag.text, 12000);
        if (olds.length) log('已记录过 ' + olds.length + ' 个出场角色，会一起提交做增量更新');

        const wb = await collectLibWorldbook(bag.text);
        if (!S.libWorldbook) {
            log('世界书检索已关闭，只按正文建档');
        } else if (wb.length) {
            log('世界书「' + String(libWbState).replace(/^hit:/, '') + '」命中 ' + wb.length + ' 条相关设定（'
                + wb.reduce((n, o) => n + o.content.length, 0) + ' 字）：' + wb.map((o) => o.name).join('、'));
        } else if (libWbState === 'nobook') {
            log('这张角色卡没绑定世界书，跳过世界书检索');
        } else if (libWbState === 'empty') {
            log('绑定的世界书里没有可用条目');
        } else {
            log('正文里没命中世界书条目的关键词');
        }

        const usePreset = S.presetEnabled && presetEntries().length > 0;
        log('提示词：' + (usePreset ? '上下文预设「' + activePresetName() + '」' : '插件内置 batchPrompt'));
        log('提交 AI（本轮只调用一次）……');
        const api = resolveApi();
        log('使用 ' + api.source + ' · ' + api.model);
        logBreakthrough();
        const prompt = buildRecordPrompt(bag.text, { origins, olds, wb });
        log('提示词共 ' + promptChars(prompt) + ' 字 / 约 ' + estimateTokens(promptTextOf(prompt)) + ' token / '
            + normalizeMessages(prompt).length + ' 条');
        /* 重试由「自动重试次数」统一管：第 1 次用精简正文，第 2 次换成内置提示词 */
        const raw = await callSafe(
            prompt,
            buildRecordPrompt(clipText(bag.text, 400), { origins, olds, wb }),
            undefined,
            usePreset ? batchPrompt(bag.text, { origins, olds, wb }) : undefined
        );

        const list = parseProfileList(raw);
        if (!list) {
            log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error');
            return;
        }
        log('AI 返回 ' + list.length + ' 份档案');

        let created = 0, updated = 0, skipped = 0, locked = 0, failed = 0;
        const done = Object.create(null);
        const floorTag = bag.from + '-' + bag.to;
        for (const item of list) {
            const prof = normalizeProfile(item, item && item['姓名']);
            if (!prof || !String(prof['姓名'] || '').trim()) { failed++; continue; }
            const nm = String(prof['姓名']).trim();
            if (done[nm]) continue;
            done[nm] = 1;
            try {
                const r = saveRecord(prof, floorTag);
                if (r === 'created') { created++; log('新建「' + nm + '」'); }
                else if (r === 'updated') { updated++; log('更新「' + nm + '」'); }
                else if (r === 'locked') { locked++; log('「' + nm + '」已锁定，AI 不改它'); }
                else { skipped++; log('「' + nm + '」已存在，按设置跳过'); }
            } catch (e) {
                failed++;
                log('「' + nm + '」保存失败：' + (e && e.message ? e.message : e), 'error');
            }
        }
        if (created || updated) saveSettings(true);

        /* 形态自动切换：正文里点名了哪个形态，就把 [当前] 移过去 */
        try {
            const sw = autoSwitchForms(bag.text);
            if (sw.length) {
                saveSettings(true);
                log('形态自动切换：' + sw.map((x) => x.base + ' → ' + x.form + '（[当前] 已移过去）').join('；'));
                if (selected && !currentEntries()[selected]) selected = null;
            }
        } catch (e) { /* 切换失败不影响本轮记录 */ }
        /* 形态统计：让用户知道哪些角色有多形态档案，便于核对 [当前] 标记 */
        const fg = formGroups();
        const multi = [...fg.entries()].filter(([, list]) => list.some((x) => x.info.form));
        if (multi.length) {
            log('多形态角色 ' + multi.length + ' 个：' + multi.map(([b, list]) =>
                b + '（' + list.map((x) => (x.info.form || '本体') + (x.info.isCurrent ? '·当前' : '')).join(' / ') + '）'
            ).join('；'));
        }
        log('本轮结束：新建 ' + created + '，更新 ' + updated + '，跳过 ' + skipped
            + (locked ? ('，锁定跳过 ' + locked) : '') + '，失败 ' + failed);
        if ((created || updated) && S.notify) {
            toast('DNA 已记录：新建 ' + created + '，更新 ' + updated + (locked ? ('，锁定跳过 ' + locked) : ''));
        }
        renderList();
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (/已手动中断/.test(msg)) {
            log('本轮已手动中断，没写任何档案');
            if (!opts.auto) toast('已中断这一轮');
        } else {
            log('扫描中断：' + msg, 'error');
            if (!opts.auto) toast('扫描失败：' + msg, 'error');
        }
    } finally {
        setBusy(false);
        syncAbortBtns();
    }
}

/* ------------------------------ 面板 UI ------------------------------ */
const PANEL_HTML = `
<div id="dna-tab" class="dna-wrap">

  <!-- 状态条 -->
  <div class="st-chatu8-settings-section dna-status-section">
    <div class="dna-sec-head">
      <h3><i class="fa-solid fa-dna"></i> 角色 DNA 记录器</h3>
      <div class="dna-sec-actions">
        <button class="st-chatu8-btn" data-dna="scanNow"><i class="fa-solid fa-bolt"></i><span data-dna="scanLabel">立即记录</span></button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="abortScan" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
      </div>
    </div>
    <div class="dna-status-row">
      <span class="dna-dot"></span>
      <span data-dna="status">空闲</span>
      <span class="dna-sep">·</span>
      <span data-dna="autoState">自动记录已开启</span>
      <span class="dna-sep">·</span>
      <span class="dna-hint dna-hint-inline">自动扫描剧情，每个角色存一份档案在插件自己的库里，不写世界书</span>
    </div>
  </div>

  <!-- 子板块 -->
  <div class="st-chatu8-sub-nav dna-sub-nav" data-dna="subtabs">
    <a href="#" class="st-chatu8-sub-nav-link active" data-dna-tab="lib"><i class="fa-solid fa-box-archive"></i> 档案库</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="gen"><i class="fa-solid fa-wand-magic-sparkles"></i> 手动生成</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="tools"><i class="fa-solid fa-paper-plane"></i> 发送 &amp; 日志</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="settings"><i class="fa-solid fa-sliders"></i> 设置</a>
  </div>

  <!-- ============ 档案库 ============ -->
  <div class="dna-panel active" data-dna-panel="lib">

    <div class="st-chatu8-settings-section dna-fold" data-fold="libLLM">
      <div class="dna-sec-head dna-fold-head">
        <h3><i class="fa-solid fa-microchip"></i> LLM 配置</h3>
        <div class="dna-sec-actions">
          <button type="button" class="dna-fold-btn" data-fold-btn="libLLM" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
        </div>
      </div>
      <div class="dna-fold-body">
      <div class="dna-hint">档案库（自动记录 + 这里的测试工具）用这份。地址 / Key / 模型全部从智绘姬「LLM」页签读取，DNA 只记「用哪一份」，换这里<b>不会</b>改动智绘姬当前的选择。</div>
      <div class="st-chatu8-field">
        <label>使用哪份配置</label>
        <select class="st-chatu8-select" data-dna="profileSelect"></select>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="gotoLLM"><i class="fa-solid fa-arrow-right-to-bracket"></i>去 LLM 页签编辑</button>
      </div>
      <div class="dna-kv" data-dna="configDetail"></div>
      <div class="dna-hint" data-dna="modelHint"></div>
      </div>
    </div>

    <div class="st-chatu8-settings-section dna-fold" data-fold="libPreset">
      <div class="dna-sec-head dna-fold-head">
        <h3><i class="fa-solid fa-layer-group"></i> 上下文预设</h3>
        <div class="dna-sec-actions">
          <button type="button" class="dna-fold-btn" data-fold-btn="libPreset" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
        </div>
      </div>
      <div class="dna-fold-body">
      <div class="dna-hint">
        档案库自己的预设，和「手动生成」那份<b>完全分开</b>。导入一份智绘姬格式的上下文预设，自动记录时就按它的条目组装 messages。
        条目可以逐条开关，勾掉的不会发出去。预设里能写 <code>{{正文}}</code>、<code>{{角色卡设定}}</code>、<code>{{旧档案}}</code>、
        <code>{{收录规则}}</code>、<code>{{字段规范}}</code>、<code>{{输出格式}}</code> 这些占位符，没写的部分会自动补在末尾。
      </div>
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="presetLabel">未导入</span>
        <span class="dna-hint dna-hint-inline" data-dna="presetHint"></span>
      </div>
      <div class="st-chatu8-field">
        <label>用这份预设组装提示词</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="presetEnabled"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>把 system 消息合并到开头一条</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="presetMergeSystem"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>当前预设</label>
        <div class="st-chatu8-profile-controls">
          <select class="st-chatu8-select" data-dna="presetSelect"></select>
          <div class="st-chatu8-preset-box-wrapper">
            <button type="button" class="st-chatu8-icon-btn st-chatu8-preset-box-btn" title="预设操作收纳盒"><i class="fa-solid fa-table-cells"></i></button>
            <div class="st-chatu8-preset-box-dropdown">
              <div class="st-chatu8-preset-box-header">
                <span class="st-chatu8-preset-box-title"><i class="fa-solid fa-box-archive"></i> 档案库预设操作</span>
                <button type="button" class="st-chatu8-preset-box-close" title="关闭">&times;</button>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">导入与导出</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="presetImport" title="导入预设文件"><i class="fa-solid fa-file-import"></i><span>导入</span></button>
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="presetExport" title="导出当前预设"><i class="fa-solid fa-file-export"></i><span>导出</span></button>
                </div>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">管理</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="presetRename" title="重命名预设"><i class="fa-solid fa-pen"></i><span>改名</span></button>
                </div>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">危险操作</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item danger" data-dna="presetRemove" title="删除预设"><i class="fa-solid fa-trash"></i><span>删除</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input type="file" accept=".json,application/json" data-dna="presetFile" style="display:none">
      <div class="dna-kv" data-dna="presetInfo"></div>

      <div class="dna-entry-head">
        <span class="dna-entry-head-t">预设条目 <span class="dna-count" data-dna="presetEntryCount">0 / 0</span></span>
        <span class="dna-entry-tools">
          <button class="st-chatu8-btn dna-btn-sm" data-dna="presetAllOn">全开</button>
          <button class="st-chatu8-btn dna-btn-sm" data-dna="presetAllOff">全关</button>
        </span>
      </div>
      <div class="dna-entries" data-dna="presetEntries"></div>

      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="presetPreview"><i class="fa-solid fa-eye"></i>预览组装结果</button>
        <button class="st-chatu8-btn" data-dna="presetClear">清空预览</button>
      </div>
      <div class="st-chatu8-field-col">
        <label>预览结果</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="presetPreviewBox" rows="6" readonly placeholder="点「预览组装结果」看真正发出去的 messages"></textarea>
      </div>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <div class="dna-sec-head">
        <h3><i class="fa-solid fa-box-archive"></i> 档案库 <span class="dna-count" data-dna="count">0</span></h3>
        <div class="dna-sec-actions">
          <button class="st-chatu8-btn" data-dna="lockAll" title="把本库所有档案锁上，AI 一条都改不了"><i class="fa-solid fa-lock"></i>全部锁定</button>
          <button class="st-chatu8-btn" data-dna="unlockAll" title="把本库所有锁解开"><i class="fa-solid fa-lock-open"></i>全部解锁</button>
          <button class="st-chatu8-btn" data-dna="export"><i class="fa-solid fa-file-export"></i>导出 JSON</button>
          <button class="st-chatu8-btn" data-dna="import"><i class="fa-solid fa-file-import"></i>导入 JSON</button>
          <button class="st-chatu8-btn danger" data-dna="clearAll"><i class="fa-solid fa-trash"></i>清空本库</button>
        </div>
      </div>
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="cardLabel">—</span>
        <span class="dna-badge" data-dna="lockCount">未锁定</span>
        <span class="dna-hint dna-hint-inline" data-dna="storeHint"></span>
      </div>
      <div class="dna-hint dna-hint-inline">每行右边的小锁：锁住之后 AI（自动记录 / 手动生成）都不会再改这条档案，正文里的增量更新也不会动它；你自己要改的话先点小锁解锁。</div>
      <div class="dna-split dna-split-solo">
        <div class="dna-list" data-dna="list"></div>
        <div class="dna-detail" data-dna="detail" style="display:none"></div>
      </div>
      <input type="file" accept=".json,application/json" data-dna="file" style="display:none">
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-scissors"></i> 正则 &amp; 测试工具</h3>
      <div class="dna-hint">
        自动记录前，正文会先过一遍智绘姬「正则」页签当前那份配置（条目 + 前后正则 + 文字正则）。
        下面可以直接试：看正则把这段正文剪成了什么样，以及模型到底收到了什么、回了什么。
      </div>
      <div class="dna-kv" data-dna="regexInfo"></div>
      <div class="st-chatu8-field-col">
        <label>原始正文（粘一段想试的文本，留空则取最近 N 层 AI 回复）</label>
        <textarea class="st-chatu8-textarea" data-dna="testInput" rows="4" placeholder="留空 = 用最近 N 层 AI 回复的正文（不含玩家输入）"></textarea>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="testRegex"><i class="fa-solid fa-scissors"></i>① 只跑正则</button>
        <button class="st-chatu8-btn" data-dna="testLLM"><i class="fa-solid fa-paper-plane"></i>② 跑正则 + 发测试请求</button>
        <button class="st-chatu8-btn" data-dna="clearTest">清空</button>
      </div>
      <div class="st-chatu8-field-col">
        <label>正则后正文（这就是要发给 AI 的东西）</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="testCleaned" rows="5" readonly></textarea>
      </div>
      <div class="st-chatu8-field-col">
        <label>组合提示词（真正发出去的 messages + tools）</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="testPrompt" rows="5" readonly></textarea>
      </div>
      <div class="st-chatu8-field-col">
        <label>AI 回复</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="testResult" rows="6" readonly></textarea>
      </div>
      <div class="dna-hint" data-dna="testHint"></div>
    </div>
  </div>

  <!-- ============ 手动生成 ============ -->
  <div class="dna-panel" data-dna-panel="gen">

    <div class="st-chatu8-settings-section dna-fold" data-fold="genLLM">
      <div class="dna-sec-head dna-fold-head">
        <h3><i class="fa-solid fa-microchip"></i> LLM 配置</h3>
        <div class="dna-sec-actions">
          <button type="button" class="dna-fold-btn" data-fold-btn="genLLM" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
        </div>
      </div>
      <div class="dna-fold-body">
      <div class="dna-hint">手动生成（含下面那个测试工具）用这份，和档案库那份<b>各选各的</b>。没单独选过就沿用档案库那份。</div>
      <div class="st-chatu8-field">
        <label>使用哪份配置</label>
        <select class="st-chatu8-select" data-dna="genProfileSelect"></select>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genGotoLLM"><i class="fa-solid fa-arrow-right-to-bracket"></i>去 LLM 页签编辑</button>
      </div>
      <div class="dna-kv" data-dna="genConfigDetail"></div>
      <div class="dna-hint" data-dna="genModelHint"></div>
      </div>
    </div>

    <div class="st-chatu8-settings-section dna-fold" data-fold="genPreset">
      <div class="dna-sec-head dna-fold-head">
        <h3><i class="fa-solid fa-layer-group"></i> 上下文预设</h3>
        <div class="dna-sec-actions">
          <button type="button" class="dna-fold-btn" data-fold-btn="genPreset" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
        </div>
      </div>
      <div class="dna-fold-body">
      <div class="dna-hint">
        手动生成自己的预设，和「档案库」那份<b>完全分开</b>，导入/开关都互不影响。
        条目可以逐条开关，勾掉的不会发出去。
      </div>
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="genPresetLabel">未导入</span>
        <span class="dna-hint dna-hint-inline" data-dna="genPresetHint"></span>
      </div>
      <div class="st-chatu8-field">
        <label>用这份预设组装提示词</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="genPresetEnabled"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>把 system 消息合并到开头一条</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="genPresetMergeSystem"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>当前预设</label>
        <div class="st-chatu8-profile-controls">
          <select class="st-chatu8-select" data-dna="genPresetSelect"></select>
          <div class="st-chatu8-preset-box-wrapper">
            <button type="button" class="st-chatu8-icon-btn st-chatu8-preset-box-btn" title="预设操作收纳盒"><i class="fa-solid fa-table-cells"></i></button>
            <div class="st-chatu8-preset-box-dropdown">
              <div class="st-chatu8-preset-box-header">
                <span class="st-chatu8-preset-box-title"><i class="fa-solid fa-box-archive"></i> 手动生成预设操作</span>
                <button type="button" class="st-chatu8-preset-box-close" title="关闭">&times;</button>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">导入与导出</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="genPresetImport" title="导入预设文件"><i class="fa-solid fa-file-import"></i><span>导入</span></button>
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="genPresetExport" title="导出当前预设"><i class="fa-solid fa-file-export"></i><span>导出</span></button>
                </div>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">管理</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="genPresetRename" title="重命名预设"><i class="fa-solid fa-pen"></i><span>改名</span></button>
                </div>
              </div>
              <div class="st-chatu8-preset-box-group">
                <span class="st-chatu8-preset-box-group-label">危险操作</span>
                <div class="st-chatu8-preset-box-grid">
                  <button type="button" class="st-chatu8-preset-box-item danger" data-dna="genPresetRemove" title="删除预设"><i class="fa-solid fa-trash"></i><span>删除</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <input type="file" accept=".json,application/json" data-dna="genPresetFile" style="display:none">
      <div class="dna-kv" data-dna="genPresetInfo"></div>

      <div class="dna-entry-head">
        <span class="dna-entry-head-t">预设条目 <span class="dna-count" data-dna="genPresetEntryCount">0 / 0</span></span>
        <span class="dna-entry-tools">
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genPresetAllOn">全开</button>
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genPresetAllOff">全关</button>
        </span>
      </div>
      <div class="dna-entries" data-dna="genPresetEntries"></div>

      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genPresetPreview"><i class="fa-solid fa-eye"></i>预览组装结果</button>
        <button class="st-chatu8-btn" data-dna="genPresetClear">清空预览</button>
      </div>
      <div class="st-chatu8-field-col">
        <label>预览结果</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="genPresetPreviewBox" rows="6" readonly placeholder="点「预览组装结果」看真正发出去的 messages"></textarea>
      </div>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-wand-magic-sparkles"></i> 手动生成 DNA</h3>
      <div class="dna-hint">
        世界书和角色是<b>两条独立的线</b>：各自勾、各自生成，谁都不用等谁。
        生成结果都直接写进「档案库」；组装用上面那份「手动生成预设」（没开就用内置提示词）。
        世界书和角色都<b>只读</b>，不会改动原数据。
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-book-open"></i> ① 按世界书条目生成</h3>
      <div class="st-chatu8-field">
        <label>世界书来源</label>
        <select class="st-chatu8-select" data-dna="genSource">
          <option value="st">酒馆世界书（书 + 条目）</option>
          <option value="chatu8">智绘姬世界书（条目列表）</option>
        </select>
      </div>
      <div class="st-chatu8-field" data-dna="genBookToolsRow">
        <label>跟随角色卡的主世界书</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="genBookFollowCard"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="dna-inline-row" data-dna="genBookRow">
        <select class="st-chatu8-select" data-dna="genBook"></select>
        <button class="st-chatu8-btn" data-dna="genReload"><i class="fa-solid fa-rotate"></i>重新读取</button>
      </div>
      <div class="dna-hint dna-hint-inline" data-dna="genBookHint"></div>
      <div class="dna-entry-head">
        <span class="dna-entry-head-t">世界书条目 <span class="dna-count" data-dna="genEntryCount">0 / 0</span></span>
        <span class="dna-entry-tools">
          <input type="text" class="st-chatu8-text-input dna-search" data-dna="genEntrySearch" placeholder="搜条目…">
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genEntryAll">全选</button>
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genEntryNone">全不选</button>
        </span>
      </div>
      <div class="dna-entries" data-dna="genEntryList"></div>
      <div class="dna-hint dna-hint-inline">勾好条目就能直接生成，不用勾角色——勾到的条目里出现的每个具体人物都会建档，不会自己筛。</div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunWorld"><i class="fa-solid fa-wand-magic-sparkles"></i>按世界书生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortWorld" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
        <button class="st-chatu8-btn" data-dna="genPreviewWorld"><i class="fa-solid fa-eye"></i>预览</button>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-user-pen"></i> ② 按角色生成</h3>
      <div class="dna-entry-head">
        <span class="dna-entry-head-t">角色（智绘姬「角色管理」）<span class="dna-count" data-dna="genCharCount">0 / 0</span></span>
        <span class="dna-entry-tools">
          <input type="text" class="st-chatu8-text-input dna-search" data-dna="genCharSearch" placeholder="搜角色…">
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genCharAll">全选</button>
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genCharNone">全不选</button>
        </span>
      </div>
      <div class="dna-entries dna-entries-sm" data-dna="genCharList"></div>
      <div class="dna-inline-row">
        <input type="text" class="st-chatu8-text-input" data-dna="genExtraName" placeholder="角色管理里没有的角色，可以在这里手动加名字">
        <button class="st-chatu8-btn" data-dna="genExtraAdd"><i class="fa-solid fa-plus"></i>加入</button>
      </div>
      <div class="dna-chips" data-dna="genExtraList"></div>
      <div class="dna-hint dna-hint-inline">勾好角色就能直接生成，不用勾世界书——只按角色管理里的设定建档。</div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunChars"><i class="fa-solid fa-wand-magic-sparkles"></i>按角色生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortChars" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
        <button class="st-chatu8-btn" data-dna="genPreviewChars"><i class="fa-solid fa-eye"></i>预览</button>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-comment-dots"></i> 额外要求与预览</h3>
      <div class="st-chatu8-field-col">
        <label>额外要求（两条线共用，可留空）</label>
        <textarea class="st-chatu8-textarea" data-dna="genInstruction" rows="3" placeholder="例如：只写主要角色，配角不要；或者重点写服装"></textarea>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn danger" data-dna="genClear">清空全部选择</button>
      </div>
      <div class="dna-kv" data-dna="genInfo"></div>
      <div class="st-chatu8-field-col">
        <label>预览结果</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="genPreviewBox" rows="6" readonly placeholder="点上面的「预览」看这次要发什么（不发请求、不花钱）"></textarea>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-flask"></i> 测试工具</h3>
      <div class="dna-hint">
        用当前勾好的世界书条目 / 角色组装一份请求，先看内容再试跑。<b>结果只显示，不写进档案库</b>。
        用的是上面那份「手动生成 LLM 配置」和「手动生成预设」。
      </div>
      <div class="st-chatu8-field">
        <label>测试哪条线</label>
        <select class="st-chatu8-select" data-dna="genTestMode">
          <option value="world">① 按世界书条目生成</option>
          <option value="chars">② 按角色生成</option>
        </select>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genTestPreview"><i class="fa-solid fa-eye"></i>① 只组装（不请求）</button>
        <button class="st-chatu8-btn" data-dna="genTestLLM"><i class="fa-solid fa-paper-plane"></i>② 组装 + 发测试请求</button>
        <button class="st-chatu8-btn" data-dna="genClearTest">清空</button>
      </div>
      <div class="st-chatu8-field-col">
        <label>组合提示词（真正发出去的 messages + tools）</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="genTestPrompt" rows="8" readonly></textarea>
      </div>
      <div class="st-chatu8-field-col">
        <label>AI 回复</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="genTestResult" rows="8" readonly></textarea>
      </div>
      <div class="dna-hint" data-dna="genTestHint"></div>
    </div>
  </div>

  <!-- ============ 发送 & 日志 ============ -->
  <div class="dna-panel" data-dna-panel="tools">
    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-paper-plane"></i> 发送数据</h3>
      <div class="dna-hint">
        智绘姬每次跑 LLM（正文出 Tag、Tag 修改……）之前，插件会先把正文里出场角色的 DNA 档案塞进它的请求里，
        让模型照着档案写发色/瞳色/服装，不会把角色画跑偏。只读智绘姬的请求，不改它的配置。
      </div>
      <div class="st-chatu8-field">
        <label>发送 DNA</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="sendEnabled"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field-col">
        <label>发给哪几种请求</label>
        <div class="dna-chips" data-dna="sendTargets"></div>
      </div>
      <div class="st-chatu8-field">
        <label>发送范围</label>
        <select class="st-chatu8-select" data-dna="sendMode"><option value="mentioned">只发正文里提到的角色</option><option value="all">发本库全部角色</option></select>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="sendPreview"><i class="fa-solid fa-eye"></i>预览这次会发什么</button>
        <button class="st-chatu8-btn" data-dna="sendClear">清空预览</button>
      </div>
      <div class="dna-kv" data-dna="sendInfo"></div>
      <div class="st-chatu8-field-col">
        <label>预览结果</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="sendPreviewBox" rows="6" readonly></textarea>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <div class="dna-sec-head">
        <h3><i class="fa-solid fa-clipboard-list"></i> 日志</h3>
        <div class="dna-sec-actions">
          <button class="st-chatu8-btn" data-dna="clearLog"><i class="fa-solid fa-eraser"></i>清空日志</button>
        </div>
      </div>
      <div class="dna-log" data-dna="log"></div>
    </div>
  </div>

  <!-- ============ 设置 ============ -->
  <div class="dna-panel" data-dna-panel="settings">
    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-gear"></i> 运行</h3>
      <div class="st-chatu8-field">
        <label>启用插件</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="enabled"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>自动记录</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="autoScan"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>档案跟随角色卡</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="followChar"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>AI自动更新档案库</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="updateExisting"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="dna-hint">开着时，正文里出现已建档的角色，AI 会拿新剧情把它的档案更新一遍；关掉就只给新角色建档，已有的一律不动。锁定的档案两种情况都不会改。</div>
      <div class="st-chatu8-field">
        <label>完成后弹提示</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="notify"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>自动重试次数（0 = 不重试）</label>
        <input type="number" min="0" max="5" step="1" class="st-chatu8-text-input" data-dna="retryCount">
      </div>
      <div class="dna-hint">请求失败时自动再试几次。只在「内容过滤 / 返回空」这类错误上重试，网络、key、模型名错了不重试（重试也没用）。填 0 就是完全不重试。</div>
      <div class="st-chatu8-field">
        <label>正文先过智绘姬正则</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="useRegex"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>扫描时带上世界书设定</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="libWorldbook"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="dna-hint">打开后，扫描正文时会拿世界书条目自己的关键词去正文里找，命中的条目整条一起发给 AI，人物底子就不会靠猜。用的是这张角色卡绑定的主世界书。</div>
      <div class="st-chatu8-field">
        <label>每次扫描最近 N 层 AI 回复</label>
        <input type="number" min="1" max="300" class="st-chatu8-text-input" data-dna="scanDepth">
      </div>
      <div class="st-chatu8-field">
        <label>自动记录间隔（每 N 层）</label>
        <input type="number" min="1" max="50" class="st-chatu8-text-input" data-dna="autoEvery">
      </div>
      <div class="st-chatu8-field">
        <label>界面</label>
        <select class="st-chatu8-select" data-dna="uiMode"><option value="auto">自动检测</option><option value="desktop">一直用电脑版</option><option value="mobile">一直用手机版</option></select>
      </div>
      <div class="dna-hint" data-dna="uiState"></div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-wrench"></i> Tool 与末尾消息</h3>
      <div class="dna-hint">这两项决定请求里带不带智绘姬「LLM」页签里的自定义 Tool 和末尾多 Role 消息。智绘姬那边自己的开关不管这里。</div>
      <div class="st-chatu8-field">
        <label>启用自定义 Tool</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="breakTool"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>启用末尾多 Role 消息</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="breakTail"><span class="st-chatu8-slider"></span></div>
      </div>
    </div>
  </div>

</div>
`;

/* ============================ 手动生成：世界书 + 角色 → DNA ============================ */
/* 世界书支持两种来源：
   ① 酒馆世界书（书 → 条目），走 ST 自己的 /api/worldinfo/get，只读不改
   ② 智绘姬世界书（worldBookList，一条一段文本）                                    */

let genEntriesCache = [];   // 当前来源下能选的全部条目
let genCharsCache = [];     // 智绘姬「角色管理」里的角色预设

/* 酒馆世界书名列表（只读，不动任何数据） */
async function stWorldNames() {
    /* 首选 ST 自己的世界书列表接口 */
    try {
        const res = await fetch('/api/worldinfo/list', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
            cache: 'no-cache'
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length) {
                const names = data.map((x) => String((x && (x.file_id || x.name)) || '').trim()).filter(Boolean);
                if (names.length) return names;
            }
        }
    } catch (e) { /* 落到下面的兜底 */ }
    /* 兜底：直接问 ST 的 world-info 模块 */
    try {
        const mod = await import('../../../../scripts/world-info.js');
        if (mod && Array.isArray(mod.world_names)) return mod.world_names.slice();
    } catch (e) { /* 老版本路径不同就算了，界面会提示换来源 */ }
    return [];
}

/* 读一本酒馆世界书的全部条目 */
async function stWorldEntries(book) {
    const res = await fetch('/api/worldinfo/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: book }),
        cache: 'no-cache'
    });
    if (!res.ok) throw new Error('读取世界书失败：HTTP ' + res.status);
    const data = await res.json();
    const entries = (data && data.entries) || {};
    return Object.keys(entries).map((uid) => {
        const e = entries[uid] || {};
        const keys = Array.isArray(e.key) ? e.key.join('、') : String(e.key || '');
        const title = String(e.comment || keys || ('条目 ' + uid)).trim() || ('条目 ' + uid);
        return {
            key: book + '::' + uid,
            title,
            keywords: keys,
            content: String(e.content || ''),
            disabled: !!e.disable
        };
    }).filter((e) => e.content.trim());
}

/* 智绘姬世界书：{ 条目名: { content } } */
function chatu8WorldEntries() {
    let ch = null;
    try { ch = extension_settings[CHATU8]; } catch (e) { ch = null; }
    const list = (ch && ch.worldBookList && typeof ch.worldBookList === 'object') ? ch.worldBookList : {};
    return Object.keys(list).map((name) => ({
        key: name,
        title: name,
        keywords: '',
        content: String((list[name] && list[name].content) || '')
    })).filter((e) => e.content.trim());
}

/* 智绘姬「角色管理」里的角色预设 */
function chatu8CharPresets() {
    let ch = null;
    try { ch = extension_settings[CHATU8]; } catch (e) { ch = null; }
    const p = (ch && ch.characterPresets && typeof ch.characterPresets === 'object') ? ch.characterPresets : {};
    return Object.keys(p).map((key) => {
        const v = (p[key] && typeof p[key] === 'object') ? p[key] : {};
        const nm = String(v.nameCN || v.nameEN || key).trim() || key;
        return { key, name: nm, preset: v };
    });
}

/* 角色预设字段的中文名（不认识的字段就不带标签直接列） */
const CHAR_FIELD_LABELS = {
    nameCN: '中文名', nameEN: '英文名',
    characterTraits: '角色特征', facialFeatures: '五官特征', facialFeaturesBack: '五官特征（背面）',
    upperBodySFW: '上半身', upperBodySFWBack: '上半身（背面）',
    fullBodySFW: '全身', fullBodySFWBack: '全身（背面）',
    upperBodyNSFW: '上半身（露骨）', upperBodyNSFWBack: '上半身（露骨·背面）',
    fullBodyNSFW: '全身（露骨）', fullBodyNSFWBack: '全身（露骨·背面）',
    negative: '负面词'
};
const CHAR_FIELD_SKIP = /token|prompt|photo|audio|media|schema|preview|thumb|url|path/i;

/* 把一个角色预设压成一段给模型看的设定摘要 */
function charBrief(v) {
    const lines = [];
    for (const k of Object.keys(CHAR_FIELD_LABELS)) {
        const t = String(v[k] || '').trim();
        if (t && k !== 'nameCN' && k !== 'nameEN') lines.push(CHAR_FIELD_LABELS[k] + '：' + t);
    }
    /* 服装预设：结构不确定，能认出来就带上 */
    const outfits = v.outfits || v.outfitPresets || null;
    if (outfits && typeof outfits === 'object') {
        const names = Object.keys(outfits).filter((n) => {
            const o = outfits[n];
            return o && (typeof o === 'string' || (typeof o === 'object' && Object.keys(o).length));
        });
        if (names.length) lines.push('已有服装：' + names.join('、'));
    }
    return lines.join('\n');
}

/* ---------- 渲染：条目列表 ---------- */
function renderGenEntries() {
    const box = document.querySelector('#dna-tab [data-dna="genEntryList"]');
    if (!box) return;
    const picked = new Set(S.genEntries || []);
    const sEl = document.querySelector('#dna-tab [data-dna="genEntrySearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genEntriesCache.filter((e) => !q || (e.title + ' ' + e.keywords).toLowerCase().indexOf(q) >= 0);
    if (!list.length) {
        box.innerHTML = '<div class="dna-entries-empty">' +
            (genEntriesCache.length ? '没有匹配的条目' : '这里没有可选的条目') + '</div>';
        renderGenInfo();
        return;
    }
    box.innerHTML = list.map((e) => {
        const on = picked.has(e.key);
        return '<div class="dna-entry-item"><div class="dna-entry-line">'
            + '<label class="dna-entry' + (on ? '' : ' dna-entry-off') + '" data-genentry="' + esc(e.key) + '" title="' + esc(e.keywords || e.title) + '">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + '>'
            + '<span class="dna-entry-name">' + esc(e.title) + '</span>'
            + '<span class="dna-entry-len">' + e.content.length + ' 字</span>'
            + '</label></div></div>';
    }).join('');
    renderGenInfo();
}

/* ---------- 渲染：角色列表 ---------- */
function renderGenChars() {
    const box = document.querySelector('#dna-tab [data-dna="genCharList"]');
    if (!box) return;
    const picked = new Set(S.genChars || []);
    const sEl = document.querySelector('#dna-tab [data-dna="genCharSearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genCharsCache.filter((c) => !q || (c.name + ' ' + c.key).toLowerCase().indexOf(q) >= 0);
    if (!list.length) {
        box.innerHTML = '<div class="dna-entries-empty">' +
            (genCharsCache.length ? '没有匹配的角色' : '智绘姬「角色管理」里还没有角色预设') + '</div>';
        renderGenExtra();
        renderGenInfo();
        return;
    }
    box.innerHTML = list.map((c) => {
        const on = picked.has(c.key);
        const brief = charBrief(c.preset);
        return '<div class="dna-entry-item"><div class="dna-entry-line">'
            + '<label class="dna-entry' + (on ? '' : ' dna-entry-off') + '" data-genchar="' + esc(c.key) + '" title="' + esc(brief.slice(0, 400)) + '">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + '>'
            + '<span class="dna-entry-name">' + esc(c.name) + (c.key !== c.name ? '（' + esc(c.key) + '）' : '') + '</span>'
            + '<span class="dna-entry-len">' + (brief.length ? brief.length + ' 字设定' : '无设定') + '</span>'
            + '</label></div></div>';
    }).join('');
    renderGenExtra();
    renderGenInfo();
}

/* ---------- 渲染：手动加的角色 ---------- */
function renderGenExtra() {
    const box = document.querySelector('#dna-tab [data-dna="genExtraList"]');
    if (!box) return;
    const list = S.genExtraChars || [];
    box.innerHTML = list.length
        ? list.map((n) => '<span class="dna-tag">' + esc(n) +
            '<button class="dna-tag-x" data-genextra="' + esc(n) + '" title="移除">×</button></span>').join('')
        : '<span class="dna-hint dna-hint-inline">（没有手动加的角色）</span>';
}

/* ---------- 汇总：勾到了什么 ---------- */
function pickedGenEntries() {
    const picked = new Set(S.genEntries || []);
    return genEntriesCache.filter((e) => picked.has(e.key));
}

function pickedGenChars() {
    const picked = new Set(S.genChars || []);
    const out = genCharsCache.filter((c) => picked.has(c.key)).map((c) => ({ name: c.name, brief: charBrief(c.preset) }));
    for (const n of (S.genExtraChars || [])) {
        const nm = String(n || '').trim();
        if (!nm) continue;
        if (out.some((c) => c.name === nm)) continue;
        out.push({ name: nm, brief: '' });
    }
    return out;
}

function renderGenInfo() {
    const box = document.querySelector('#dna-tab [data-dna="genInfo"]');
    if (!box) return;
    const entries = pickedGenEntries();
    const chars = pickedGenChars();
    const eCnt = document.querySelector('#dna-tab [data-dna="genEntryCount"]');
    if (eCnt) eCnt.textContent = entries.length + ' / ' + genEntriesCache.length;
    const cCnt = document.querySelector('#dna-tab [data-dna="genCharCount"]');
    if (cCnt) cCnt.textContent = chars.length + ' / ' + (genCharsCache.length + (S.genExtraChars || []).length);
    const chars2 = entries.reduce((n, e) => n + e.content.length, 0);
    const rows = [
        ['① 世界书', (S.genSource === 'chatu8' ? '智绘姬世界书' : ('酒馆世界书 · ' + (S.genBook || '未选')))
            + ' → ' + (entries.length ? ('已勾 ' + entries.length + ' 条 / ' + chars2 + ' 字') : '（还没勾）')],
        ['② 角色', chars.length ? ('已勾 ' + chars.length + ' 个：' + chars.map((c) => c.name).join('、')) : '（还没勾）'],
        ['组装方式', (presetEnabledOf('gen') && presetEntries(undefined, 'gen').length) ? ('手动生成预设「' + activePresetName('gen') + '」') : '插件内置提示词'],
        ['LLM 配置', currentProfileName('gen') || '（没选）']
    ];
    if (chars2 > 40000) rows.push(['提醒', '世界书勾了 ' + chars2 + ' 字（超过 4 万），容易超出模型上下文，建议少勾几条']);
    /* 真正决定成败的是发出去的总量（含预设）。这里只做字符级粗估，不组装提示词，免得勾一下就卡。 */
    const presetTxt = (presetEnabledOf('gen') && presetEntries(undefined, 'gen').length)
        ? presetEntries(undefined, 'gen').map((e) => String(e.content || '')).join('\n') : '';
    const estTok = estimateTokens(presetTxt) + estimateTokens(entries.map((e) => e.content).join('\n')) + 2000;
    rows.push(['请求规模', '约 ' + estTok + ' token（含预设）' + (estTok > 30000 ? ' · 偏大，可能超出模型上下文' : '')]);
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

/* ---------- 组装「正文」：两条线各说各的 ---------- */
function buildGenText(mode, entries, chars) {
    const parts = [];
    if (mode === 'chars') {
        parts.push('【要建档的角色】');
        for (const c of chars) parts.push('· ' + c.name + (c.brief ? '（设定见「角色卡设定」）' : ''));
        parts.push('',
            '请为上面列出的每个角色各出一份 DNA 档案，依据「角色卡设定」里的资料写。',
            '设定里没写到的字段，按角色的气质和身份合理补全，不要留空、不要写“未知”。');
    } else {
        parts.push('【世界书资料】');
        for (const e of entries) parts.push('—— ' + e.title + ' ——\n' + e.content);
        parts.push('',
            '请为上面这些条目里出现的每一个具体人物各出一份 DNA 档案，一个都不许漏（泛称群体、地名、组织名不算人物）。',
            '资料里没写到的字段，按这个世界观合理补全，不要留空、不要写“未知”。',
            '不要因为戏份少或只是配角就跳过某个具体人物，也不要额外编造条目里没有的人物——收录范围由用户勾选决定。');
    }
    const extra = String(S.genInstruction || '').trim();
    if (extra) parts.push('', '【额外要求】', extra);
    return parts.join('\n');
}

/* mode: 'world' = 只用勾到的世界书条目；'chars' = 只用勾到的角色 */
function buildGenPrompt(mode) {
    const m = (mode === 'chars') ? 'chars' : 'world';
    const entries = (m === 'world') ? pickedGenEntries() : [];
    const chars = (m === 'chars') ? pickedGenChars() : [];
    const text = buildGenText(m, entries, chars);
    const origins = chars.filter((c) => c.brief).map((c) => ({ name: c.name, content: c.brief }));
    const olds = S.updateExisting
        ? pickOldRecords(m === 'chars' ? chars.map((c) => c.name).join(' ') : text, 12000)
        : [];
    return { mode: m, entries, chars, text, origins, olds, prompt: buildRecordPrompt(text, { origins, olds }, 'gen') };
}

/* ---------- 预览 ---------- */
function onGenPreview(mode) {
    const m = (mode === 'chars') ? 'chars' : 'world';
    const ta = document.querySelector('#dna-tab [data-dna="genPreviewBox"]');
    if (!ta) return;
    const g = buildGenPrompt(m);
    if (m === 'world' && !g.entries.length) { ta.value = '先勾至少一条世界书条目，再预览。'; return; }
    if (m === 'chars' && !g.chars.length) { ta.value = '先勾至少一个角色，再预览。'; return; }
    const msgs = normalizeMessages(g.prompt);
    ta.value = '【' + (m === 'world' ? '按世界书生成' : '按角色生成') + '】\n\n'
        + msgs.map((x, i) => '【' + (i + 1) + ' · ' + x.role + '】\n' + x.content).join('\n\n');
    log('预览手动生成提示词（' + (m === 'world' ? '世界书' : '角色') + '）：' + msgs.length + ' 条 / ' + promptChars(g.prompt) + ' 字');
}

/* ---------- 手动生成的测试工具 ---------- */
/* 用当前勾选的世界书条目 / 角色组装一份请求，预览或试跑；结果只显示，不写档案 */
function genTestMode() {
    const sel = document.querySelector('#dna-tab [data-dna="genTestMode"]');
    return (sel && sel.value === 'chars') ? 'chars' : 'world';
}

function genTestHint(text) {
    const h = document.querySelector('#dna-tab [data-dna="genTestHint"]');
    if (h) h.textContent = text || '';
}

function genTestFill(m, g) {
    const ta = document.querySelector('#dna-tab [data-dna="genTestPrompt"]');
    if (!ta) return;
    const msgs = normalizeMessages(g.prompt);
    ta.value = '【' + (m === 'world' ? '按世界书生成' : '按角色生成') + '】\n\n'
        + msgs.map((x, i) => '【' + (i + 1) + ' · ' + x.role + '】\n' + x.content).join('\n\n');
}

function onGenTestPreview() {
    const m = genTestMode();
    const ta = document.querySelector('#dna-tab [data-dna="genTestPrompt"]');
    if (!ta) return;
    try {
        const g = buildGenPrompt(m);
        if (m === 'world' && !g.entries.length) { ta.value = '先在「① 按世界书条目生成」里勾至少一条条目。'; genTestHint(''); return; }
        if (m === 'chars' && !g.chars.length) { ta.value = '先在「② 按角色生成」里勾至少一个角色。'; genTestHint(''); return; }
        genTestFill(m, g);
        const msgs = normalizeMessages(g.prompt);
        genTestHint('组装完成：' + msgs.length + ' 条 / ' + promptChars(g.prompt) + ' 字（没发请求、不花钱）');
    } catch (e) {
        ta.value = '组装失败：' + (e && e.message ? e.message : e);
    }
}

async function onGenTestLLM() {
    const m = genTestMode();
    const btn = document.querySelector('#dna-tab [data-dna="genTestLLM"]');
    const res = document.querySelector('#dna-tab [data-dna="genTestResult"]');
    if (scanning) { toast('上一轮还在跑，等它跑完'); return; }
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = '请求中…'; }
    if (res) res.value = '正在请求……';
    try {
        const g = buildGenPrompt(m);
        if (m === 'world' && !g.entries.length) { if (res) res.value = ''; genTestHint('先在「① 按世界书条目生成」里勾至少一条条目。'); return; }
        if (m === 'chars' && !g.chars.length) { if (res) res.value = ''; genTestHint('先在「② 按角色生成」里勾至少一个角色。'); return; }
        genTestFill(m, g);
        const api = resolveApi('gen');
        genTestHint('正在用 ' + api.source + ' · ' + api.model + ' 请求…（结果只显示，不写档案）');
        const reply = await callSafe(g.prompt, buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'gen'), 'gen');
        if (res) res.value = reply;
        const n = promptChars(g.prompt);
        genTestHint('完成：prompt ' + n + ' 字 → 回复 ' + reply.length + ' 字（没写进档案库）');
        log('手动生成测试请求完成：' + api.model + ' · prompt ' + n + ' 字 → 回复 ' + reply.length + ' 字');
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (res) res.value = '失败：' + msg;
        genTestHint('测试请求失败：' + msg);
        log('手动生成测试请求失败：' + msg, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
}

/* ---------- 生成 ---------- */
async function onGenDna(mode) {
    const m = (mode === 'chars') ? 'chars' : 'world';
    if (scanning) { toast('上一轮还在跑，等它跑完'); return; }
    if (!S.enabled) { toast('插件已停用，先打开「运行」里的启用插件'); return; }
    const g = buildGenPrompt(m);
    if (m === 'chars') {
        if (!g.chars.length) { toast('先在「按角色生成」里勾至少一个角色', 'error'); return; }
    } else {
        if (!g.entries.length) { toast('先在「按世界书条目生成」里勾至少一条条目', 'error'); return; }
    }
    /* 两条线统一按「真正发出去的量」估算：一次请求要装下全部勾选内容，
       装不下就会被截断，白花一次请求。这里只提醒，不硬拦。 */
    {
        const ptok = estimateTokens(promptTextOf(g.prompt));
        if (ptok > 30000 && !confirm('这次提示词约 ' + ptok + ' token（' + promptChars(g.prompt) + ' 字），'
            + '接近或超过常见模型的上下文长度。\n\n建议先少勾几条，确定要继续吗？')) return;
    }

    setBusy(true, '生成中…');
    try {
        log('手动生成（' + (m === 'world' ? '按世界书' : '按角色') + '）：'
            + (m === 'world'
                ? (g.entries.length + ' 条世界书条目 / ' + g.entries.reduce((n, e) => n + e.content.length, 0) + ' 字')
                : (g.chars.length + ' 个角色（' + g.chars.map((c) => c.name).join('、') + '）')));
        const api = resolveApi('gen');
        log('使用 ' + api.source + ' · ' + api.model + '（手动生成）');
        logBreakthrough();
        const usePreset = presetEnabledOf('gen') && presetEntries(undefined, 'gen').length > 0;
        log('提示词：' + (usePreset ? '手动生成预设「' + activePresetName('gen') + '」' : '插件内置 batchPrompt')
            + ' · ' + promptChars(g.prompt) + ' 字 / ' + normalizeMessages(g.prompt).length + ' 条');
        /* 重试由「自动重试次数」统一管：第 1 次用精简正文，第 2 次换成内置提示词 */
        const raw = await callSafe(
            g.prompt,
            buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'gen'),
            'gen',
            usePreset ? batchPrompt(g.text, { origins: g.origins, olds: g.olds }) : undefined
        );
        const list = parseProfileList(raw);
        if (!list) { log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error'); toast('返回解析不了，看日志', 'error'); return; }
        log('AI 返回 ' + list.length + ' 份档案');

        let created = 0, updated = 0, skipped = 0, locked = 0, failed = 0;
        const done = Object.create(null);
        const floorTag = '手动生成';
        for (const item of list) {
            const prof = normalizeProfile(item, item && item['姓名']);
            if (!prof || !String(prof['姓名'] || '').trim()) { failed++; continue; }
            const nm = String(prof['姓名']).trim();
            if (done[nm]) continue;
            done[nm] = 1;
            try {
                const r = saveRecord(prof, floorTag);
                if (r === 'created') { created++; log('新建「' + nm + '」'); }
                else if (r === 'updated') { updated++; log('更新「' + nm + '」'); }
                else if (r === 'locked') { locked++; log('「' + nm + '」已锁定，AI 不改它'); }
                else { skipped++; log('跳过「' + nm + '」（已建档，且没开「AI自动更新档案库」）'); }
            } catch (e) {
                failed++;
                log('「' + nm + '」写入失败：' + (e && e.message ? e.message : e), 'error');
            }
        }
        log('手动生成完成：新建 ' + created + ' · 更新 ' + updated + ' · 跳过 ' + skipped
            + (locked ? (' · 锁定跳过 ' + locked) : '') + ' · 失败 ' + failed);
        toast('生成完成：新建 ' + created + ' / 更新 ' + updated + (locked ? (' / 锁定跳过 ' + locked) : ''));
        renderList();
        if (created + updated > 0) {
            const first = String((list[0] && list[0]['姓名']) || '').trim();
            if (first) { selected = first; renderList(); }
        }
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (/已手动中断/.test(msg)) {
            log('手动生成已中断，没写任何档案');
            toast('已中断这次生成');
        } else {
            log('手动生成失败：' + msg, 'error');
            toast('生成失败：' + msg, 'error');
        }
    } finally {
        setBusy(false);
        syncAbortBtns();
        renderGenInfo();
    }
}

/* ---------- 选择状态存取 ---------- */
function toggleGenEntry(key, on) {
    const set = new Set(S.genEntries || []);
    if (on) set.add(key); else set.delete(key);
    S.genEntries = [...set];
    saveSettings(true);
    renderGenInfo();
}

function toggleGenChar(key, on) {
    const set = new Set(S.genChars || []);
    if (on) set.add(key); else set.delete(key);
    S.genChars = [...set];
    saveSettings(true);
    renderGenInfo();
}

/* 一次勾上 / 勾掉当前筛选出来的全部 */
function setAllGenEntries(on) {
    const sEl = document.querySelector('#dna-tab [data-dna="genEntrySearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genEntriesCache.filter((e) => !q || (e.title + ' ' + e.keywords).toLowerCase().indexOf(q) >= 0);
    const set = new Set(S.genEntries || []);
    list.forEach((e) => { if (on) set.add(e.key); else set.delete(e.key); });
    S.genEntries = [...set];
    saveSettings(true);
    renderGenEntries();
}

function setAllGenChars(on) {
    const sEl = document.querySelector('#dna-tab [data-dna="genCharSearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genCharsCache.filter((c) => !q || (c.name + ' ' + c.key).toLowerCase().indexOf(q) >= 0);
    const set = new Set(S.genChars || []);
    list.forEach((c) => { if (on) set.add(c.key); else set.delete(c.key); });
    S.genChars = [...set];
    saveSettings(true);
    renderGenChars();
}

/* ---------- 角色卡的主世界书 ---------- */
/* 角色卡编辑页里那个「主要世界书」。聊天自己绑了世界书时酒馆实际用的是聊天那本，
   取不到角色卡的就退回它。都没有就返回空串（保持手动选择）。 */
let genBookMissing = false;   /* 角色卡绑定的世界书不在酒馆列表里 */

function cardWorldBook() {
    try {
        const ctx = getContext();
        const ch = ctx && ctx.characters && ctx.characters[ctx.characterId];
        const w = ch && ((ch.data && ch.data.extensions && ch.data.extensions.world)
            || (ch.data && ch.data.world)
            || ch.world);
        if (w) return String(w).trim();
        const chatW = ctx && ctx.chatMetadata && ctx.chatMetadata.world_info;
        return chatW ? String(chatW).trim() : '';
    } catch (e) { return ''; }
}

function renderGenBookHint() {
    const hint = document.querySelector('#dna-tab [data-dna="genBookHint"]');
    if (!hint) return;
    if (S.genSource === 'chatu8') { hint.textContent = ''; return; }
    const book = cardWorldBook();
    if (!S.genBookFollowCard) {
        hint.textContent = book
            ? '跟随已关闭，用上面手动选的那本（当前角色卡绑定的是「' + book + '」）。'
            : '跟随已关闭，用上面手动选的那本。';
        return;
    }
    if (!book) { hint.textContent = '当前角色卡没绑定主世界书，保持手动选择。'; return; }
    if (genBookMissing) {
        hint.textContent = '角色卡绑定的是「' + book + '」，它不在酒馆世界书列表里，现在用的是「' + (S.genBook || '无') + '」。';
        return;
    }
    hint.textContent = '已跟随角色卡的主世界书「' + book + '」。想用别的书，直接在下面手动选，跟随会自动关掉。';
}

/* 进入角色卡时把世界书切到卡绑定的那本；返回 true 表示书变了，需要重新读取条目 */
async function followCardWorldBook() {
    const book = cardWorldBook();
    renderGenBookHint();
    if (!S.genBookFollowCard || S.genSource === 'chatu8' || !book) return false;
    if (S.genBook === book) return false;
    S.genBook = book;
    S.genEntries = [];      // 换书后条目 key 全变了，旧勾选作废
    saveSettings(true);
    return true;
}

/* ---------- 初始化 / 换来源 ---------- */
async function loadGenSource() {
    const isSt = S.genSource !== 'chatu8';
    const row = document.querySelector('#dna-tab [data-dna="genBookRow"]');
    if (row) row.style.display = isSt ? '' : 'none';
    const tools = document.querySelector('#dna-tab [data-dna="genBookToolsRow"]');
    if (tools) tools.style.display = isSt ? '' : 'none';
    renderGenBookHint();
    const box = document.querySelector('#dna-tab [data-dna="genEntryList"]');
    if (box) box.innerHTML = '<div class="dna-entries-empty">读取中…</div>';
    try {
        if (S.genSource === 'chatu8') {
            genEntriesCache = chatu8WorldEntries();
        } else {
            const names = await stWorldNames();
            const sel = document.querySelector('#dna-tab [data-dna="genBook"]');
            if (sel) {
                sel.innerHTML = names.length
                    ? names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('')
                    : '<option value="">（酒馆里还没有世界书）</option>';
                const want = S.genBookFollowCard ? cardWorldBook() : '';
                genBookMissing = !!(want && names.indexOf(want) < 0);
                if (S.genBook && names.indexOf(S.genBook) >= 0) sel.value = S.genBook;
                else { S.genBook = names[0] || ''; if (S.genBook) sel.value = S.genBook; }
                renderGenBookHint();
            }
            genEntriesCache = S.genBook ? await stWorldEntries(S.genBook) : [];
        }
    } catch (e) {
        genEntriesCache = [];
        if (box) box.innerHTML = '<div class="dna-entries-empty">读取失败：' + esc(e && e.message ? e.message : e) + '</div>';
        renderGenInfo();
        return;
    }
    genCharsCache = chatu8CharPresets();
    renderGenEntries();
    renderGenChars();
    renderGenInfo();
}

function injectIntoChatu8() {
    const modal = document.querySelector('#ch-settings-modal');
    if (!modal) return false;
    const nav = modal.querySelector('.st-chatu8-nav');
    const content = modal.querySelector('.st-chatu8-content');
    if (!nav || !content) return false;
    /* 关键：必须等智绘姬把所有页签内容灌进 .st-chatu8-content（innerHTML 会覆盖），
       否则我们插进去的页签会被冲掉。以「主要设置」页签出现为准。 */
    if (!content.querySelector('#st-chatu8-tab-main')) return false;
    if (nav.querySelector('[data-tab="dna"]')) return true;

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'st-chatu8-nav-link';
    link.dataset.tab = 'dna';
    link.innerHTML = '<i class="fa-solid fa-dna" style="margin-right:6px"></i>角色DNA';
    const aboutLink = nav.querySelector('[data-tab="about"]');
    if (aboutLink) nav.insertBefore(link, aboutLink); else nav.appendChild(link);

    const tab = document.createElement('div');
    tab.id = 'st-chatu8-tab-dna';
    tab.className = 'st-chatu8-tab-content';
    tab.dataset.tabId = 'dna';
    tab.innerHTML = PANEL_HTML;
    content.appendChild(tab);

    link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        nav.querySelectorAll('.st-chatu8-nav-link').forEach((a) => a.classList.remove('active'));
        link.classList.add('active');
        content.querySelectorAll(':scope > .st-chatu8-tab-content').forEach((d) => d.classList.remove('active'));
        tab.classList.add('active');
        bindPanel();
        renderList();
    });

    bindPanel();
    renderList();
    log('已挂载到智绘姬设置面板（侧栏「角色DNA」）');
    return true;
}

/* 预设收纳盒：本体 setupPresetBoxes 只在设置面板初始化时跑一次，DNA 页签是后注入的，
   所以这里自己绑一份（类名与本体一致，样式直接复用 presetBox.css）。 */
function bindPresetBoxes(tab) {
    const closeAll = (except) => {
        tab.querySelectorAll('.st-chatu8-preset-box-dropdown.is-open').forEach((d) => {
            if (d !== except) d.classList.remove('is-open');
        });
        tab.querySelectorAll('.st-chatu8-preset-box-btn.is-active').forEach((b) => {
            if (!except || !except.parentElement.contains(b)) b.classList.remove('is-active');
        });
    };
    tab.querySelectorAll('.st-chatu8-preset-box-wrapper').forEach((wrap) => {
        const btn = wrap.querySelector('.st-chatu8-preset-box-btn');
        const dd = wrap.querySelector('.st-chatu8-preset-box-dropdown');
        const close = wrap.querySelector('.st-chatu8-preset-box-close');
        if (!btn || !dd) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open = dd.classList.contains('is-open');
            closeAll(dd);
            dd.classList.toggle('is-open', !open);
            btn.classList.toggle('is-active', !open);
        });
        if (close) close.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dd.classList.remove('is-open');
            btn.classList.remove('is-active');
        });
        dd.addEventListener('click', (e) => {
            if (!e.target.closest('.st-chatu8-preset-box-item')) return;
            setTimeout(() => {
                dd.classList.remove('is-open');
                btn.classList.remove('is-active');
            }, 120);
        });
    });
}

/* 跳到智绘姬「LLM」页签（两个 LLM 卡片上的按钮共用） */
function gotoLLMTab() {
    document.querySelectorAll('.st-chatu8-nav-link').forEach((l) => l.classList.remove('active'));
    document.querySelectorAll('.st-chatu8-tab-content').forEach((t) => t.classList.remove('active'));
    const link = document.querySelector('.st-chatu8-nav-link[data-tab="llm"]');
    const pane = document.querySelector('#st-chatu8-tab-llm');
    if (link) link.classList.add('active');
    if (pane) pane.classList.add('active');
    if (!link) toast('找不到 LLM 页签', 'error');
}

/* LLM 配置那一小块：档案库 / 手动生成各一份，scope 决定绑哪套控件、改哪个字段 */
function bindProfileSection(tab, scope) {
    const sel = tab.querySelector('[data-dna="' + dkey(scope, 'profileSelect') + '"]');
    if (!sel) return;
    sel.addEventListener('change', (e) => {
        const name = e.target.value;
        if (!name) return;
        if (!switchProfile(name, scope)) { toast('切换失败：这份配置不存在', 'error'); return; }
        renderConfigDetail(scope);
        updateModelHint(scope);
        log('已切换 LLM 配置：' + name + (scope === 'gen' ? '（手动生成）' : ''));
    });
    const go = tab.querySelector('[data-dna="' + dkey(scope, 'gotoLLM') + '"]');
    if (go) go.addEventListener('click', gotoLLMTab);
}

/* 上下文预设那一整套：档案库 / 手动生成各一套，互不影响 */
function bindPresetSection(tab, scope) {
    const q = (base) => tab.querySelector('[data-dna="' + dkey(scope, base) + '"]');
    const en = q('presetEnabled');
    if (!en) return;                     // 这套没渲染出来就跳过

    en.addEventListener('change', (e) => {
        if (scope === 'gen') S.genPresetEnabled = !!e.target.checked;
        else S.presetEnabled = !!e.target.checked;
        saveSettings(true);
        renderPresetCard(scope);
    });
    const merge = q('presetMergeSystem');
    if (merge) merge.addEventListener('change', (e) => {
        if (scope === 'gen') S.genPresetMergeSystem = !!e.target.checked;
        else S.presetMergeSystem = !!e.target.checked;
        saveSettings(true);
        renderPresetCard(scope);
        log('system 消息合并：' + (presetMergeOf(scope) ? '开' : '关') + (scope === 'gen' ? '（手动生成）' : ''));
    });
    const sel = q('presetSelect');
    if (sel) sel.addEventListener('change', (e) => {
        if (scope === 'gen') S.genPresetName = e.target.value || '';
        else S.presetName = e.target.value || '';
        saveSettings(true);
        renderPresetCard(scope);
    });
    const imp = q('presetImport');
    const file = q('presetFile');
    if (imp && file) {
        imp.addEventListener('click', () => file.click());
        file.addEventListener('change', (ev) => importPreset(ev, scope));
    }
    const exp = q('presetExport');
    if (exp) exp.addEventListener('click', () => exportPreset(scope));
    const ren = q('presetRename');
    if (ren) ren.addEventListener('click', () => renamePreset(scope));
    const rm = q('presetRemove');
    if (rm) rm.addEventListener('click', () => removePreset(scope));
    const pv = q('presetPreview');
    if (pv) pv.addEventListener('click', () => onPresetPreview(scope));
    const cl = q('presetClear');
    if (cl) cl.addEventListener('click', () => { const ta = q('presetPreviewBox'); if (ta) ta.value = ''; });
    const allOn = q('presetAllOn');
    if (allOn) allOn.addEventListener('click', () => setAllPresetEntries(true, scope));
    const allOff = q('presetAllOff');
    if (allOff) allOff.addEventListener('click', () => setAllPresetEntries(false, scope));

    const box = q('presetEntries');
    if (!box) return;
    box.addEventListener('change', (e) => {
        const cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        const row = cb.closest('.dna-entry');
        if (!row) return;
        const idx = Number(row.dataset.idx);
        const list = presetEntries(undefined, scope);
        if (!list[idx]) return;
        list[idx].enabled = !!cb.checked;
        row.classList.toggle('dna-entry-off', !cb.checked);
        saveSettings(true);
        updatePresetMeta(scope);
    });
    box.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit]');
        if (editBtn) {
            e.preventDefault();
            const idx = Number(editBtn.dataset.edit);
            const list = presetEntries(undefined, scope);
            const ent = list[idx];
            if (!ent) { toast('这条已经不在了', 'error'); return; }
            openEditModal({
                title: '编辑预设条目 · ' + (scope === 'gen' ? '手动生成' : '档案库'),
                fields: [
                    { key: 'name', label: '名称', type: 'text', value: ent.name || '' },
                    {
                        key: 'role', label: '角色', type: 'select',
                        value: PRESET_ROLES.includes(ent.role) ? ent.role : 'user',
                        options: PRESET_ROLES
                    },
                    {
                        key: 'content', type: 'textarea', mono: true, rows: 18,
                        label: '内容（支持 {{正文}} / {{角色卡设定}} / {{旧档案}} 等占位符）',
                        value: ent.content || ''
                    }
                ],
                onSave: (v) => {
                    if (!savePresetEntry(idx, v, scope)) { toast('保存失败：这条已经不存在了', 'error'); return; }
                    renderPresetCard(scope);
                    log('已修改预设条目 #' + (idx + 1) + '（' + (scope === 'gen' ? '手动生成' : '档案库') + '）');
                }
            });
            return;
        }
    });
}

/* 按设置里的记录，把该收起的板块收起来 */
function applyFolds() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const f = (S.folds && typeof S.folds === 'object') ? S.folds : {};
    tab.querySelectorAll('[data-fold]').forEach((sec) => {
        sec.classList.toggle('dna-folded', !!f[sec.dataset.fold]);
    });
}

/* ------------------------- 通用编辑悬浮窗 ------------------------- */
function onModalKey(e) {
    if (e.key === 'Escape') {
        e.stopPropagation();
        closeEditModal();
    }
}

function closeEditModal() {
    const m = document.getElementById('dna-edit-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', onModalKey, true);
}

/* cfg = { title, fields: [{ key, label, type: 'text'|'textarea'|'select', value, options, rows, mono }], onSave(values) } */
function openEditModal(cfg) {
    closeEditModal();
    const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
    const body = fields.map((f) => {
        const id = 'dna-ef-' + f.key;
        const lab = '<label class="dna-modal-lab" for="' + id + '">' + esc(f.label || f.key) + '</label>';
        let ctl = '';
        if (f.type === 'select') {
            ctl = '<select class="dna-modal-ctl" id="' + id + '" data-mf="' + esc(f.key) + '">'
                + (f.options || []).map((o) =>
                    '<option value="' + esc(o) + '"' + (o === f.value ? ' selected' : '') + '>' + esc(o) + '</option>'
                ).join('')
                + '</select>';
        } else if (f.type === 'textarea') {
            ctl = '<textarea class="dna-modal-ctl dna-modal-ta' + (f.mono ? ' dna-mono' : '') + '" id="' + id + '"'
                + ' data-mf="' + esc(f.key) + '" rows="' + (f.rows || 10) + '">' + esc(f.value || '') + '</textarea>';
        } else {
            ctl = '<input type="text" class="dna-modal-ctl" id="' + id + '" data-mf="' + esc(f.key) + '"'
                + ' value="' + esc(f.value || '') + '">';
        }
        return '<div class="dna-modal-field">' + lab + ctl + '</div>';
    }).join('');

    const wrap = document.createElement('div');
    wrap.id = 'dna-edit-modal';
    wrap.className = 'dna-modal';
    wrap.innerHTML =
        '<div class="dna-modal-mask"></div>'
        + '<div class="dna-modal-card" role="dialog" aria-modal="true">'
        + '<div class="dna-modal-head">'
        + '<span class="dna-modal-title">' + esc(cfg.title || '编辑') + '</span>'
        + '<button type="button" class="dna-modal-x" title="关闭（Esc）">&times;</button>'
        + '</div>'
        + '<div class="dna-modal-body">' + body + '</div>'
        + '<div class="dna-modal-foot">'
        + '<button type="button" class="dna-modal-btn primary dna-modal-save"><i class="fa-solid fa-check"></i> 保存</button>'
        + '<button type="button" class="dna-modal-btn dna-modal-cancel">取消</button>'
        + '</div>'
        + '</div>';
    document.body.appendChild(wrap);

    const collect = () => {
        const v = {};
        wrap.querySelectorAll('[data-mf]').forEach((el) => { v[el.dataset.mf] = el.value; });
        return v;
    };
    const save = () => {
        const v = collect();
        closeEditModal();
        try {
            if (cfg.onSave) cfg.onSave(v);
        } catch (e) {
            console.error('[DNA] 保存失败', e);
            toast('保存失败：' + (e && e.message ? e.message : e), 'error');
        }
    };

    wrap.querySelector('.dna-modal-x').addEventListener('click', closeEditModal);
    wrap.querySelector('.dna-modal-cancel').addEventListener('click', closeEditModal);
    wrap.querySelector('.dna-modal-mask').addEventListener('click', closeEditModal);
    wrap.querySelector('.dna-modal-save').addEventListener('click', save);
    wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    });
    document.addEventListener('keydown', onModalKey, true);
    const first = wrap.querySelector('[data-mf]');
    if (first) setTimeout(() => { try { first.focus(); } catch (e) { /* 忽略 */ } }, 40);
}

function bindPanel() {
    const tab = document.querySelector('#dna-tab');
    if (!tab || tab.dataset.bound === '1') return;
    tab.dataset.bound = '1';

    /* 折叠：点小箭头或标题都能收/展开，状态记在设置里，下次打开还是这样 */
    tab.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fold-btn]');
        const head = e.target.closest('.dna-fold-head');
        if (!btn && !head) return;
        const sec = (btn || head).closest('[data-fold]');
        if (!sec) return;
        e.preventDefault();
        const k = sec.dataset.fold;
        if (!S.folds || typeof S.folds !== 'object') S.folds = {};
        S.folds[k] = !S.folds[k];
        sec.classList.toggle('dna-folded', !!S.folds[k]);
        saveSettings(true);
    });

    /* 子板块切换：档案库 / 手动生成 / 发送 & 工具 / 设置
       只切显示，不重建 DOM——所有 data-dna 控件都还在，事件绑定不受影响。 */
    const subTabs = Array.from(tab.querySelectorAll('.st-chatu8-sub-nav-link'));
    const subPanels = Array.from(tab.querySelectorAll('.dna-panel'));
    const showSub = (name) => {
        if (!name || !subPanels.some((p) => p.dataset.dnaPanel === name)) name = 'lib';
        subTabs.forEach((b) => b.classList.toggle('active', b.dataset.dnaTab === name));
        subPanels.forEach((p) => p.classList.toggle('active', p.dataset.dnaPanel === name));
        tab.dataset.sub = name;
    };
    subTabs.forEach((b) => {
        b.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSub(b.dataset.dnaTab);
        });
    });
    showSub(tab.dataset.sub || 'lib');
    bindPresetBoxes(tab);

    const fill = () => {
        applyFolds();
        tab.querySelector('[data-dna="enabled"]').checked = !!S.enabled;
        tab.querySelector('[data-dna="autoScan"]').checked = !!S.autoScan;
        tab.querySelector('[data-dna="followChar"]').checked = !!S.followChar;
        tab.querySelector('[data-dna="updateExisting"]').checked = !!S.updateExisting;
        tab.querySelector('[data-dna="notify"]').checked = !!S.notify;
        tab.querySelector('[data-dna="useRegex"]').checked = !!S.useRegex;
        const rtEl = tab.querySelector('[data-dna="retryCount"]');
        if (rtEl) rtEl.value = S.retryCount;
        const lwbEl = tab.querySelector('[data-dna="libWorldbook"]');
        if (lwbEl) lwbEl.checked = S.libWorldbook !== false;
        tab.querySelector('[data-dna="breakTool"]').checked = !!S.breakTool;
        tab.querySelector('[data-dna="breakTail"]').checked = !!S.breakTail;
        tab.querySelector('[data-dna="scanDepth"]').value = S.scanDepth;
        tab.querySelector('[data-dna="autoEvery"]').value = S.autoEvery;
        tab.querySelector('[data-dna="uiMode"]').value = S.uiMode || 'auto';
        tab.querySelector('[data-dna="sendEnabled"]').checked = !!S.sendEnabled;
        tab.querySelector('[data-dna="sendMode"]').value = S.sendMode === 'all' ? 'all' : 'mentioned';
        const pe = tab.querySelector('[data-dna="presetEnabled"]');
        if (pe) pe.checked = !!S.presetEnabled;
        const pm = tab.querySelector('[data-dna="presetMergeSystem"]');
        if (pm) pm.checked = S.presetMergeSystem !== false;
        const gpe = tab.querySelector('[data-dna="genPresetEnabled"]');
        if (gpe) gpe.checked = !!S.genPresetEnabled;
        const gpm = tab.querySelector('[data-dna="genPresetMergeSystem"]');
        if (gpm) gpm.checked = S.genPresetMergeSystem !== false;
        const tbox = tab.querySelector('[data-dna="sendTargets"]');
        if (tbox) {
            const on = new Set(sendTargets());
            tbox.innerHTML = Object.keys(SEND_EVENTS).map((k) =>
                '<label class="dna-check"><input type="checkbox" data-send-kind="' + k + '"' +
                (on.has(k) ? ' checked' : '') + '><span>' + esc(SEND_LABELS[k]) + '</span></label>'
            ).join('');
        }
        const gs = tab.querySelector('[data-dna="genSource"]');
        if (gs) gs.value = S.genSource === 'chatu8' ? 'chatu8' : 'st';
        const gfc = tab.querySelector('[data-dna="genBookFollowCard"]');
        if (gfc) gfc.checked = S.genBookFollowCard !== false;
        const gi = tab.querySelector('[data-dna="genInstruction"]');
        if (gi) gi.value = S.genInstruction || '';
        if (!genEntriesCache.length) loadGenSource();
        else { renderGenEntries(); renderGenChars(); renderGenInfo(); }
        updateDerivedUI();
        renderPresetCard('lib');
        renderPresetCard('gen');
    };

    const onChange = (key, kind) => {
        const el = tab.querySelector('[data-dna="' + key + '"]');
        if (!el) return;
        const read = () => {
            if (kind === 'bool') return !!el.checked;
            if (kind === 'int') {
                const lo = Number(el.min);
                const hi = Number(el.max);
                return clampInt(el.value, Number.isFinite(lo) ? lo : 1, Number.isFinite(hi) ? hi : 300, DEFAULTS[key]);
            }
            if (kind === 'num') return numOr(el.value, DEFAULTS[key]);
            return el.value;
        };
        el.addEventListener('change', () => {
            S[key] = read();
            saveSettings(true);
            updateDerivedUI();
            if (key === 'followChar') { selected = null; renderList(); }
            renderPresetCard('lib');
            renderPresetCard('gen');
        });
        if (el.type === 'text' || el.type === 'password' || el.type === 'number') {
            el.addEventListener('input', () => { S[key] = read(); saveSettings(true); updateDerivedUI(); });
        }
    };

    ['enabled', 'autoScan', 'followChar', 'updateExisting', 'notify', 'useRegex', 'breakTool', 'breakTail', 'libWorldbook'].forEach((k) => onChange(k, 'bool'));
    onChange('scanDepth', 'int');
    onChange('retryCount', 'int');
    onChange('autoEvery', 'int');
    onChange('uiMode', 'str');

    tab.querySelector('[data-dna="scanNow"]').addEventListener('click', () => runScan({ depth: S.scanDepth }));
    ABORT_KEYS.forEach((k) => {
        const b = tab.querySelector('[data-dna="' + k + '"]');
        if (b) b.addEventListener('click', () => doAbort());
    });
    tab.querySelector('[data-dna="clearLog"]').addEventListener('click', () => { LOG.length = 0; renderLog(); });

    /* 发送数据 */
    tab.querySelector('[data-dna="sendEnabled"]').addEventListener('change', (e) => {
        S.sendEnabled = !!e.target.checked;
        saveSettings(true);
        renderSendInfo();
    });
    tab.querySelector('[data-dna="sendMode"]').addEventListener('change', (e) => {
        S.sendMode = e.target.value === 'all' ? 'all' : 'mentioned';
        saveSettings(true);
        renderSendInfo();
    });
    tab.querySelector('[data-dna="sendTargets"]').addEventListener('change', (e) => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        const kind = cb.dataset.sendKind;
        const set = new Set(sendTargets());
        if (cb.checked) set.add(kind); else set.delete(kind);
        S.sendTargets = Array.from(set);
        saveSettings(true);
        renderSendInfo();
    });
    tab.querySelector('[data-dna="sendPreview"]').addEventListener('click', onSendPreview);
    tab.querySelector('[data-dna="sendClear"]').addEventListener('click', () => {
        const ta = tab.querySelector('[data-dna="sendPreviewBox"]');
        if (ta) ta.value = '';
    });

    bindPresetSection(tab, 'lib');
    bindPresetSection(tab, 'gen');

    /* ---------- 手动生成：世界书 + 角色 ---------- */
    tab.querySelector('[data-dna="genSource"]').addEventListener('change', (e) => {
        S.genSource = e.target.value === 'chatu8' ? 'chatu8' : 'st';
        S.genEntries = [];       // 两种来源的条目 key 不通用，换来源就清空勾选
        saveSettings(true);
        /* 从智绘姬世界书切回酒馆时，顺手对一次角色卡绑定的书 */
        followCardWorldBook().then(() => loadGenSource()).catch(() => loadGenSource());
    });
    tab.querySelector('[data-dna="genBook"]').addEventListener('change', (e) => {
        S.genBook = e.target.value || '';
        S.genEntries = [];
        /* 用户主动换书 → 关掉跟随，免得下次进角色卡又被改回去 */
        if (S.genBookFollowCard && S.genBook && S.genBook !== cardWorldBook()) {
            S.genBookFollowCard = false;
            const fb = tab.querySelector('[data-dna="genBookFollowCard"]');
            if (fb) fb.checked = false;
            log('手动选世界书「' + S.genBook + '」，已关闭跟随角色卡');
            toast('已手动选书，跟随角色卡世界书已关闭');
        }
        saveSettings(true);
        loadGenSource();
    });
    tab.querySelector('[data-dna="genBookFollowCard"]').addEventListener('change', async (e) => {
        S.genBookFollowCard = !!e.target.checked;
        saveSettings(true);
        const changed = await followCardWorldBook();
        if (changed) {
            log('世界书已跟随角色卡切到「' + S.genBook + '」');
            toast('已切到角色卡的主世界书「' + S.genBook + '」');
            loadGenSource();
        } else {
            renderGenBookHint();
            toast(S.genBookFollowCard ? '已开启：进入角色卡自动切到它的主世界书' : '已关闭：世界书完全手动选');
        }
    });
    tab.querySelector('[data-dna="genReload"]').addEventListener('click', () => loadGenSource());
    tab.querySelector('[data-dna="genEntrySearch"]').addEventListener('input', () => renderGenEntries());
    tab.querySelector('[data-dna="genEntryAll"]').addEventListener('click', () => setAllGenEntries(true));
    tab.querySelector('[data-dna="genEntryNone"]').addEventListener('click', () => setAllGenEntries(false));
    tab.querySelector('[data-dna="genEntryList"]').addEventListener('change', (e) => {
        const cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        const row = cb.closest('[data-genentry]');
        if (!row) return;
        row.classList.toggle('dna-entry-off', !cb.checked);
        toggleGenEntry(row.dataset.genentry, !!cb.checked);
    });
    tab.querySelector('[data-dna="genCharSearch"]').addEventListener('input', () => renderGenChars());
    tab.querySelector('[data-dna="genCharAll"]').addEventListener('click', () => setAllGenChars(true));
    tab.querySelector('[data-dna="genCharNone"]').addEventListener('click', () => setAllGenChars(false));
    tab.querySelector('[data-dna="genCharList"]').addEventListener('change', (e) => {
        const cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        const row = cb.closest('[data-genchar]');
        if (!row) return;
        row.classList.toggle('dna-entry-off', !cb.checked);
        toggleGenChar(row.dataset.genchar, !!cb.checked);
    });
    tab.querySelector('[data-dna="genExtraAdd"]').addEventListener('click', () => {
        const inp = tab.querySelector('[data-dna="genExtraName"]');
        const nm = String((inp && inp.value) || '').trim();
        if (!nm) return;
        const list = new Set(S.genExtraChars || []);
        list.add(nm);
        S.genExtraChars = [...list];
        if (inp) inp.value = '';
        saveSettings(true);
        renderGenExtra();
        renderGenInfo();
    });
    tab.querySelector('[data-dna="genExtraName"]').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); tab.querySelector('[data-dna="genExtraAdd"]').click(); }
    });
    tab.querySelector('[data-dna="genExtraList"]').addEventListener('click', (e) => {
        const x = e.target.closest('[data-genextra]');
        if (!x) return;
        S.genExtraChars = (S.genExtraChars || []).filter((n) => n !== x.dataset.genextra);
        saveSettings(true);
        renderGenExtra();
        renderGenInfo();
    });
    tab.querySelector('[data-dna="genInstruction"]').addEventListener('change', (e) => {
        S.genInstruction = e.target.value || '';
        saveSettings(true);
    });
    tab.querySelector('[data-dna="genRunWorld"]').addEventListener('click', () => onGenDna('world'));
    tab.querySelector('[data-dna="genPreviewWorld"]').addEventListener('click', () => onGenPreview('world'));
    tab.querySelector('[data-dna="genRunChars"]').addEventListener('click', () => onGenDna('chars'));
    tab.querySelector('[data-dna="genPreviewChars"]').addEventListener('click', () => onGenPreview('chars'));
    tab.querySelector('[data-dna="genClear"]').addEventListener('click', () => {
        S.genEntries = [];
        S.genChars = [];
        S.genExtraChars = [];
        saveSettings(true);
        renderGenEntries();
        renderGenChars();
        const ta = tab.querySelector('[data-dna="genPreviewBox"]');
        if (ta) ta.value = '';
        log('已清空手动生成的选择');
    });

    /* 正则 & 测试工具（档案库这套：正文过正则 → 组装 → 试跑） */
    tab.querySelector('[data-dna="testRegex"]').addEventListener('click', onTestRegex);
    tab.querySelector('[data-dna="testLLM"]').addEventListener('click', onTestLLM);
    tab.querySelector('[data-dna="clearTest"]').addEventListener('click', () => {
        ['testInput', 'testCleaned', 'testPrompt', 'testResult'].forEach((k) => setTestField(k, ''));
        testHint('');
    });

    /* 测试工具（手动生成这套：用当前勾选的条目/角色组装 → 预览或试跑，不写档案） */
    const genPrev = tab.querySelector('[data-dna="genTestPreview"]');
    if (genPrev) genPrev.addEventListener('click', onGenTestPreview);
    const genRun = tab.querySelector('[data-dna="genTestLLM"]');
    if (genRun) genRun.addEventListener('click', onGenTestLLM);
    const genClear = tab.querySelector('[data-dna="genClearTest"]');
    if (genClear) genClear.addEventListener('click', () => {
        ['genTestPrompt', 'genTestResult'].forEach((k) => {
            const ta = tab.querySelector('[data-dna="' + k + '"]');
            if (ta) ta.value = '';
        });
        const h = tab.querySelector('[data-dna="genTestHint"]');
        if (h) h.textContent = '';
    });

    bindProfileSection(tab, 'lib');
    bindProfileSection(tab, 'gen');

    /* 智绘姬那边换配置时，这边两套都跟着刷新 */
    try {
        const chSel = document.querySelector('#ch-llm_profile_select');
        if (chSel && chSel.dataset.dnaWatch !== '1') {
            chSel.dataset.dnaWatch = '1';
            chSel.addEventListener('change', () => setTimeout(() => {
                ['lib', 'gen'].forEach((sc) => { fillProfileSelect(sc); renderConfigDetail(sc); updateModelHint(sc); });
            }, 80));
        }
    } catch (e) { /* 忽略 */ }

    const lockAllBtn = tab.querySelector('[data-dna="lockAll"]');
    if (lockAllBtn) lockAllBtn.addEventListener('click', () => setAllLocks(true));
    const unlockAllBtn = tab.querySelector('[data-dna="unlockAll"]');
    if (unlockAllBtn) unlockAllBtn.addEventListener('click', () => setAllLocks(false));

    tab.querySelector('[data-dna="export"]').addEventListener('click', exportRecords);
    tab.querySelector('[data-dna="import"]').addEventListener('click', () => tab.querySelector('[data-dna="file"]').click());
    tab.querySelector('[data-dna="file"]').addEventListener('change', importRecords);
    tab.querySelector('[data-dna="clearAll"]').addEventListener('click', () => {
        const b = bucket(cardKey(), false);
        const n = b ? Object.keys(b.entries).length : 0;
        if (!n) { toast('本库还是空的'); return; }
        if (!confirm('确定清空「' + cardLabel() + '」的 ' + n + ' 份档案？此操作不可撤销。')) return;
        S.records[cardKey()] = { card: cardLabel(), entries: {}, updated: Date.now() };
        saveSettings(true);
        selected = null;
        renderList();
        log('已清空本库档案（' + n + ' 份）');
    });

    tab.querySelector('[data-dna="list"]').addEventListener('click', (e) => {
        const row = e.target.closest('.dna-item');
        if (!row) return;
        const name = row.dataset.name;
        if (e.target.closest('[data-act="lock"]')) {
            e.stopPropagation();
            toggleLock(name);
            return;
        }
        if (e.target.closest('[data-act="del"]')) {
            if (!confirm('删除「' + name + '」的档案？')) return;
            deleteRecord(name);
            if (selected === name) selected = null;
            renderList();
            log('已删除「' + name + '」');
            return;
        }
        if (e.target.closest('[data-act="copy"]')) {
            const rec = currentEntries()[name];
            if (rec) copyText(buildContent(rec), '已复制「' + name + '」的完整档案');
            return;
        }
        selected = (selected === name) ? null : name;
        renderList();
    });

    tab.querySelector('[data-dna="detail"]').addEventListener('click', (e) => {
        /* 详情里的锁按钮 */
        const lockBtn = e.target.closest('[data-lockdetail]');
        if (lockBtn && selected) {
            toggleLock(selected);
            return;
        }
        /* 手动把某个形态设为当前 */
        const curBtn = e.target.closest('[data-formcur]');
        if (curBtn && selected) {
            const base = curBtn.dataset.formcur;
            const nm = curBtn.dataset.formname;
            if (isLocked(nm)) { toast('「' + nm + '」已锁定，先解锁再切换', 'error'); return; }
            const changed = setCurrentForm(base, nm);
            if (!changed.length) { toast('没有可切换的形态'); return; }
            saveSettings(true);
            const nowCur = changed.filter((c) => c.to.indexOf('[当前]') >= 0)[0];
            selected = nowCur ? nowCur.to : selected;
            renderList();
            const fname = formInfo(nm).form || '本体';
            toast('「' + base + '」的当前形态已切到「' + fname + '」');
            log('手动切换形态：' + base + ' → ' + fname + '（[当前] 已移过去）');
            return;
        }
        /* 字段编辑：弹悬浮窗改 */
        const editBtn = e.target.closest('[data-editfield]');
        if (editBtn && selected) {
            if (isLocked(selected)) {
                toast('「' + selected + '」已锁定，先点小锁解锁再改', 'error');
                return;
            }
            const k = editBtn.dataset.editfield;
            const rec = currentEntries()[selected];
            if (!rec) return;
            openEditModal({
                title: '编辑「' + selected + '」· ' + k,
                fields: [{ key: 'v', label: k, type: 'textarea', value: String(rec[k] || ''), rows: 16, mono: true }],
                onSave: (v) => {
                    const now = currentEntries()[selected];
                    if (!now) { toast('这条档案已经不在了', 'error'); return; }
                    now[k] = v.v;
                    now._updated = Date.now();
                    saveSettings(true);
                    log('已修改「' + selected + '」的「' + k + '」');
                    renderList();
                }
            });
            return;
        }
        const act = e.target.closest('[data-copy]');
        if (!act || !selected) return;
        const rec = currentEntries()[selected];
        if (!rec) return;
        const what = act.dataset.copy;
        if (what === 'all') copyText(buildContent(rec), '已复制完整档案');
        else copyText(String(rec[what] || ''), '已复制「' + what + '」');
    });

    fill();
    renderLog();
}

function copyText(text, okMsg) {
    const done = () => toast(okMsg);
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
            return;
        }
    } catch (e) { /* ignore */ }
    fallbackCopy(text, done);
}

function fallbackCopy(text, done) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
    } catch (e) {
        toast('复制失败，请手动选中', 'error');
    }
}

function updateModelHint(scope) {
    const hint = document.querySelector('#dna-tab [data-dna="' + (scope === 'gen' ? 'genModelHint' : 'modelHint') + '"]');
    if (!hint) return;
    let ch = null;
    try { ch = extension_settings[CHATU8]; } catch (e) { ch = null; }
    const list = allProfiles();
    const names = Object.keys(list);
    if (!ch) {
        hint.textContent = '没找到智绘姬的配置，请确认智绘姬扩展已启用。';
        return;
    }
    if (!names.length) {
        hint.textContent = '智绘姬里还没有任何 LLM 配置。点「去 LLM 页签编辑」新建一份，填好地址、Key、模型即可。';
        return;
    }
    const p = chatu8Profile(scope);
    if (!p) {
        hint.textContent = '当前选中的配置不存在了，请在上面的下拉框里重新选一份。';
        return;
    }
    if (String(p.channel_type || 'openai') === 'vertex') {
        hint.textContent = '这份配置是 Vertex 渠道，角色DNA 只走 OpenAI 兼容接口，请到 LLM 页签切成 OpenAI 渠道。';
        return;
    }
    if (!String(p.api_url || '').trim()) { hint.textContent = '这份配置还没填 API Base URL，去 LLM 页签补上。'; return; }
    if (!String(p.model || '').trim()) { hint.textContent = '这份配置还没选模型，去 LLM 页签选一个。'; return; }
    hint.textContent = '记录时会用这份配置（共 ' + names.length + ' 份配置可选）。要改里面的内容，去 LLM 页签编辑。';
}

function updateDerivedUI() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const autoState = tab.querySelector('[data-dna="autoState"]');
    if (autoState) autoState.textContent = S.autoScan ? ('自动记录已开启 · 每 ' + S.autoEvery + ' 层') : '自动记录已关闭';
    const dot = tab.querySelector('.dna-dot');
    if (dot) {
        dot.classList.toggle('dna-dot-on', !!S.enabled && !scanning);
        dot.classList.toggle('dna-dot-busy', !!scanning);
    }
    const label = tab.querySelector('[data-dna="cardLabel"]');
    if (label) label.textContent = cardLabel();
    const hint = tab.querySelector('[data-dna="storeHint"]');
    if (hint) {
        hint.textContent = S.followChar
            ? '每张角色卡各存一份，切换角色卡自动切换档案库'
            : '所有角色卡共用同一份档案库';
    }
    refreshLLMCard();
    renderRegexInfo();
    renderSendInfo();
    applyUiMode();
}

function refreshLLMCard() {
    ['lib', 'gen'].forEach((sc) => {
        fillProfileSelect(sc);
        renderConfigDetail(sc);
        updateModelHint(sc);
    });
}

function renderList() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const listBox = tab.querySelector('[data-dna="list"]');
    const detail = tab.querySelector('[data-dna="detail"]');
    const cnt = tab.querySelector('[data-dna="count"]');
    if (!listBox) return;

    updateDerivedUI();
    const entries = currentEntries();
    /* 列表顺序按「本名」分组：同一角色的各个形态排在一起，[当前] 形态排最前 */
    const groups = formGroups();
    const ordered = [];
    for (const base of [...groups.keys()].sort((a, b) => String(a).localeCompare(String(b), 'zh'))) {
        for (const x of groups.get(base)) ordered.push(x);
    }
    const names = ordered.map((x) => x.name);
    if (cnt) cnt.textContent = String(names.length);
    const lkCnt = tab.querySelector('[data-dna="lockCount"]');
    if (lkCnt) {
        /* 一条都没锁的时候不显示这个标签——默认状态就是全解锁，界面上不占地方 */
        const nLk = names.filter((n) => entries[n] && entries[n]._locked).length;
        lkCnt.textContent = nLk ? ('已锁 ' + nLk + ' / ' + names.length) : '';
        lkCnt.style.display = nLk ? '' : 'none';
        lkCnt.classList.toggle('dna-badge-warn', nLk > 0);
    }

    if (!names.length) {
        listBox.innerHTML = '<div class="dna-empty">这个档案库还是空的。点「立即记录」或等自动记录攒几条。</div>';
        if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
        const sp0 = tab.querySelector('.dna-split');
        if (sp0) sp0.classList.add('dna-split-solo');
        return;
    }

    listBox.innerHTML = ordered.map((x) => {
        const n = x.name;
        const rec = entries[n] || {};
        const active = (selected === n) ? ' dna-item-active' : '';
        const lk = !!rec._locked;
        const fi = x.info;
        /* 形态档案：显示「本名 · 形态名」+ 状态徽标，一眼看出是同一个人的不同形态 */
        const nameHtml = fi.isForm
            ? ('<span class="dna-form-base">' + esc(fi.base) + '</span>' +
                (fi.form ? '<span class="dna-form-sep">·</span><span class="dna-form-name">' + esc(fi.form) + '</span>' : '') +
                (fi.tag ? '<span class="dna-form-tag' +
                    (fi.isCurrent ? ' is-cur' : (fi.isSealed ? ' is-seal' : '')) + '">' + esc(fi.tag) + '</span>' : ''))
            : esc(n);
        return '<div class="dna-item' + active + (lk ? ' dna-item-locked' : '') + (fi.isForm ? ' dna-item-form' : '') + '" data-name="' + esc(n) + '">' +
            '<span class="dna-item-name">' + (lk ? '<i class="fa-solid fa-lock dna-lock-ico"></i>' : '') + nameHtml + '</span>' +
            '<span class="dna-item-time">' + esc(fmtTime(rec._updated)) + '</span>' +
            '<button class="dna-mini dna-mini-lock' + (lk ? ' is-locked' : '') + '" data-act="lock" title="' +
            (lk ? '已锁定：AI 不会改这条（点一下解锁）' : '未锁定：点一下锁住，AI 就不会再改这条') + '">' +
            '<i class="fa-solid ' + (lk ? 'fa-lock' : 'fa-lock-open') + '"></i></button>' +
            '<button class="dna-mini" data-act="copy" title="复制完整档案">复制</button>' +
            '<button class="dna-mini dna-mini-del" data-act="del" title="删除">×</button>' +
            '</div>';
    }).join('');

    if (!detail) return;
    if (!selected || !entries[selected]) {
        detail.style.display = 'none'; detail.innerHTML = '';
        const sp1 = tab.querySelector('.dna-split');
        if (sp1) sp1.classList.add('dna-split-solo');
        return;
    }

    const rec = entries[selected];
    /* 详情按 DNA_FIELDS 的顺序展示（姓名在标题上，不重复） */
    const rows = DNA_FIELDS.filter((k) => k !== '姓名').map((k) => [k, rec[k]]);
    detail.style.display = '';
    const sp2 = tab.querySelector('.dna-split');
    if (sp2) sp2.classList.remove('dna-split-solo');
    const dInfo = formInfo(selected);
    const formLine = dInfo.isForm
        ? '<div class="dna-form-line">' +
            '<i class="fa-solid fa-masks-theater"></i> ' +
            '本名：<b>' + esc(dInfo.base) + '</b>' +
            (dInfo.form ? (' · 形态：<b>' + esc(dInfo.form) + '</b>') : '') +
            (dInfo.tag ? (' · <span class="dna-form-tag' + (dInfo.isCurrent ? ' is-cur' : (dInfo.isSealed ? ' is-seal' : '')) + '">' + esc(dInfo.tag) + '</span>') : '') +
            (dInfo.isCurrent
                ? '<span class="dna-form-tip">正文里出现这个角色时，发出去的就是这一形态</span>'
                : ('<span class="dna-form-tip">不是当前形态：正文点名这个形态时才会发它</span>' +
                    '<button class="dna-mini dna-mini-cur" data-formcur="' + esc(dInfo.base) + '" data-formname="' + esc(selected) + '"' +
                    (rec._locked ? ' disabled title="已锁定，先解锁"' : ' title="把 [当前] 标记移到这个形态"') + '>设为当前形态</button>')) +
          '</div>'
        : '';
    detail.innerHTML =
        '<div class="dna-detail-h">' + esc(selected) +
        '<span class="dna-detail-time">' + esc(fmtTime(rec._updated)) + (rec._floor ? ' · 第' + esc(rec._floor) + '层' : '') + '</span>' +
        '<button class="dna-mini dna-mini-lock' + (rec._locked ? ' is-locked' : '') + '" data-lockdetail="1" title="' +
        (rec._locked ? '已锁定：AI 不会改这条（点一下解锁）' : '未锁定：点一下锁住，AI 就不会再改这条') + '">' +
        '<i class="fa-solid ' + (rec._locked ? 'fa-lock' : 'fa-lock-open') + '"></i> ' +
        (rec._locked ? '已锁定' : '锁定') + '</button>' +
        '<button class="dna-mini" data-copy="all">复制全部</button></div>' + formLine +
        rows.map(([k, v]) => {
            const lked = !!rec._locked;
            const head = '<div class="dna-field-h">' + esc(k) +
                '<button class="dna-mini" data-copy="' + esc(k) + '">复制</button>' +
                '<button class="dna-mini' + (lked ? ' dna-mini-dis' : '') +
                '" data-editfield="' + esc(k) + '" title="' + (lked ? '已锁定，先解锁再改' : '编辑这个字段（弹窗）') + '">' +
                '编辑</button></div>';
            return '<div class="dna-field">' + head +
                '<div class="dna-field-v">' + (v ? esc(v) : '<span class="dna-empty-inline">（空）</span>') + '</div></div>';
        }).join('');
}

/* ------------------------------ 导入 / 导出 ------------------------------ */
function exportRecords() {
    const key = cardKey();
    const b = bucket(key, false);
    const entries = (b && b.entries) || {};
    const n = Object.keys(entries).length;
    if (!n) { toast('本库还没有档案可导出'); return; }
    const payload = {
        type: 'st-chatu8-dna',
        version: 3,
        card: cardLabel(),
        cardKey: key,
        exportedAt: new Date().toISOString(),
        entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(cardLabel()).replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = '角色DNA_' + safe + '_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    log('已导出 ' + n + ' 份档案');
}

/* 把一批外来档案并进某个档案库（导入用），返回新增/覆盖数 */
function mergeEntries(b, src) {
    let added = 0, replaced = 0;
    for (const name in src) {
        const rec = src[name];
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
        const nm = String(rec['姓名'] || name).trim();
        if (!nm) continue;
        const prev = b.entries[nm];
        if (prev) replaced++; else added++;
        const merged = Object.assign({}, rec, { '姓名': nm });
        /* 锁是本地状态：导入覆盖时别把它冲掉（导入文件自己带 _locked 的话以文件为准） */
        if (prev && prev._locked && merged._locked === undefined) merged._locked = true;
        b.entries[nm] = merged;
    }
    b.card = cardLabel();
    b.updated = Date.now();
    return { added, replaced };
}

function importRecords(ev) {
    const input = ev.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || ''));
            let src = (data && data.entries) ? data.entries : null;
            if (!src && data && data.records) {
                const first = Object.keys(data.records)[0];
                src = first ? data.records[first].entries : null;
            }
            if (!src && data && typeof data === 'object' && !data.records) src = data;
            if (!src || typeof src !== 'object') throw new Error('文件里没找到档案数据');
            const b = bucket(cardKey(), true);
            const r = mergeEntries(b, src);
            saveSettings(true);
            renderList();
            log('导入完成：新增 ' + r.added + '，覆盖 ' + r.replaced);
            toast('导入完成：新增 ' + r.added + '，覆盖 ' + r.replaced);
        } catch (e) {
            log('导入失败：' + (e && e.message ? e.message : e), 'error');
            toast('导入失败：' + (e && e.message ? e.message : e), 'error');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file, 'utf-8');
}

/* ------------------------------ 自动记录 ------------------------------ */
function onMessageReceived() {
    if (!S.enabled || !S.autoScan) return;
    if (scanning) return;
    try {
        const ctx = getContext();
        const chat = ctx.chat || [];
        const aiCount = chat.filter((m) => m && !m.is_user && !m.is_system).length;
        if (aiCount - lastAutoFloor < Math.max(1, S.autoEvery)) return;
        lastAutoFloor = aiCount;
        log('自动记录触发（已累计 ' + aiCount + ' 层 AI 回复）');
        runScan({ depth: S.scanDepth, auto: true });
    } catch (e) {
        console.warn('[DNA] auto scan failed', e);
    }
}

function onChatChanged() {
    lastAutoFloor = 0;
    selected = null;
    renderList();
    /* 进入角色卡 / 换聊天：按开关把世界书切到这张卡的主世界书 */
    followCardWorldBook().then((changed) => {
        if (!changed) return;
        log('世界书已跟随角色卡切到「' + S.genBook + '」');
        loadGenSource();
        renderGenInfo();
    }).catch(() => { /* 取不到角色卡就保持原样 */ });
}

/* ------------------------------ 启动 ------------------------------ */
function boot() {
    /* 智绘姬是异步把设置面板插进 DOM 的，这里轮询等它建好再挂载 */
    let tries = 0;
    const timer = setInterval(() => {
        tries++;
        if (injectIntoChatu8()) {
            clearInterval(timer);
            startWatchdog();
            watchViewport();
            applyUiMode();
            return;
        }
        if (tries > 240) {
            clearInterval(timer);
            console.warn('[DNA] 没等到智绘姬的设置面板，角色DNA 页签未挂载（智绘姬没装或没启用？）');
        }
    }, 500);

    if (!extension_settings[MODULE]) saveSettings(true);

    /* 内置默认预设：第一次装（或之前从没装过这一份）就自动塞进上下文预设列表 */
    ensureDefaultPreset()
        .then(() => ensureDefaultGenPreset())
        .then(() => { try { migrateGenPresets(); } catch (e) { /* 迁移失败不影响使用 */ } })
        .then(() => {
            try { renderPresetCard('lib'); renderPresetCard('gen'); } catch (e) { /* 页签还没挂上就算了，fill() 会再渲染 */ }
        })
        .catch(() => { /* 内置预设装不上不影响手动导入 */ });

    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    /* 启动时先按当前角色卡对一次世界书 */
    followCardWorldBook().then((changed) => { if (changed) loadGenSource(); }).catch(() => { /* 忽略 */ });
    /* 发送数据：必须在智绘姬注册监听之前排到最前面，所以尽早就装 */
    installSendHooks();
    setTimeout(installSendHooks, 5000);
    setTimeout(installSendHooks, 20000);
    log('角色DNA记录器已加载 v2.9.7 · 融合版（内置存储 + 上下文预设）');
}

/* 智绘姬重载页签内容时会把我们的页签冲掉，这里兜底重新挂载 */
let watchdog = null;
function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(() => {
        const modal = document.querySelector('#ch-settings-modal');
        if (!modal) return;
        const nav = modal.querySelector('.st-chatu8-nav');
        if (!nav || nav.querySelector('[data-tab="dna"]')) return;
        if (injectIntoChatu8()) log('页签被重建，已重新挂载');
    }, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
