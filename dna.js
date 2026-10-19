/**
 * 角色DNA记录器 · 已融合进 st-chatu8（由融合入口 index.js 引入本文件）
 * ---------------------------------------------------------------
 * 本文件是原扩展的构建产物（原 st-chatu8-dna/index.js）。
 * 字段规则已经内联在下方，不需要再跑构建脚本。
 *
 * v2.8.0：手机版界面 + 自动认设备；破限双开关独立；扩展声明依赖智绘姬
 * v2.7.0：发送数据（智绘姬跑 LLM 时把 DNA 塞进它的请求）
 * v2.6.0：只收 AI 输出楼层；破限改为读智绘姬 LLM 配置，不再硬编码
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
    updateExisting: true,      // 已有同名角色就按当前剧情更新
    scanDepth: 3,              // 每次扫最近 N 层
    autoScan: true,            // 自动记录
    autoEvery: 3,              // 每 N 层 AI 回复触发一次
    notify: true,
    useRegex: true,            // 发送给 AI 之前先过一遍智绘姬的正则
    /* 界面：auto = 手机用手机版、电脑用电脑版；也可以手动锁定 */
    uiMode: 'auto',
    /* 破限：这两项在插件里有自己的开关，和智绘姬 LLM 页签那边的开关互不影响 */
    breakTool: true,           // 用智绘姬「自定义 Tool 工具配置」
    breakTail: true,           // 用智绘姬「末尾多 Role 消息」
    /* 发送数据：智绘姬跑 LLM（出 Tag / Tag 修改…）时，把对应角色的 DNA 一起发过去 */
    sendEnabled: true,
    sendTargets: ['image_gen', 'tag_modify'],
    sendMode: 'mentioned',     // mentioned = 只发正文里提到的角色；all = 发本库全部
    sendMaxChars: 6000,
    records: {}                // 内置存储：{ 卡片key: { card, entries: { 角色名: 档案 } } }
};

/* 旧版本里插件自己存过一份 API 配置，现在统一用智绘姬那份，这些键直接丢掉 */
const LEGACY_KEYS = ['worldbookName', 'useChatu8LLM', 'apiFormat', 'apiUrl', 'apiKey', 'model', 'modelCache', 'temperature', 'maxTokens'];

let S = loadSettings();
/* 老版本留在设置里的 API 配置字段（apiUrl/apiKey/model/apiFormat/modelCache…）立刻落盘清掉，
   免得 settings.json 里一直躺着一份用不到的配置 */
try {
    extension_settings[MODULE] = S;
    saveSettingsDebounced();
} catch (e) { /* 忽略：扩展加载早期可能还没就绪 */ }
let scanning = false;
let lastAutoFloor = 0;
let selected = null;           // 当前在详情区查看的角色名
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
    if (!out.sendMode) out.sendMode = DEFAULTS.sendMode;
    if (!['auto', 'desktop', 'mobile'].includes(out.uiMode)) out.uiMode = 'auto';
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
    const old = b.entries[name];
    if (old && !S.updateExisting) return 'skipped';
    b.entries[name] = {
        '姓名': name,
        '性别/年龄': profile['性别/年龄'] || '',
        '外貌特征': profile['外貌特征'] || '',
        '当前衣着/装扮': profile['当前衣着/装扮'] || '',
        '核心DNA': profile['核心DNA'] || '',
        '服装DNA': profile['服装DNA'] || '',
        _updated: Date.now(),
        _floor: floor || ''
    };
    b.card = cardLabel();
    b.updated = Date.now();
    return old ? 'updated' : 'created';
}

function deleteRecord(name) {
    const b = bucket(cardKey(), false);
    if (!b || !b.entries[name]) return false;
    delete b.entries[name];
    b.updated = Date.now();
    saveSettings(true);
    return true;
}

/* 正文里提到的、已经记录过的角色 → 交给模型做增量更新 */
function pickOldRecords(text, limit) {
    const out = [];
    const entries = currentEntries();
    let used = 0;
    for (const name in entries) {
        if (name.length < 2 || text.indexOf(name) < 0) continue;
        const content = buildContent(entries[name]);
        const room = limit - used;
        if (room <= 0) break;
        out.push({ name, content: content.length > room ? content.slice(0, room) + '……' : content });
        used += Math.min(content.length, room);
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
/* 原来这里是一整段硬编码的破限词（漠然档案馆），现在整段删掉了。
   破限改成联动智绘姬「LLM」页签里的两项配置：
     · 自定义 Tool 工具配置（tool_call_config）
     · 发送前末尾自定义多 Role 消息（tail_messages_config）
   两样都从那边原样读，这里不再自己写一份。 */
const FIELD_RULES = [
    "只输出这 6 个字段：姓名 / 性别/年龄 / 外貌特征 / 当前衣着/装扮 / 核心DNA / 服装DNA，",
    "一个都不许少，也不许自己增加别的字段（不要性格、身份、关系、能力这类）。",
    "",
    "【姓名】正文里的具体名字，原样照抄，不要改写成代称。",
    "",
    "【性别/年龄】性别与年龄写成一段，例如「女/23」「男/40 上下」。",
    "正文没写年龄时，按人物的种族、身份与整体设计推定一个具体数字，不要写「未知」。",
    "",
    "【外貌特征】用中文自然语言记录固有外貌：发型、发色、身高、身材、肤色、五官。",
    "严禁神态描写（如「嘴角勾起冷笑」）、服装、姿势或临时状态。要写出身材数据（身高、体重、体态）。",
    "这里写自然语言的概览即可；同一批信息在核心DNA里还要按结构化字段再写一遍，两边要一致。",
    "",
    "【当前衣着/装扮】用中文自然语言完整列出当前全部衣物及每件的实际状态。",
    "禁止用「其余不变」「同前」「略」。正文明示没穿贴身层就写「无贴身内层衣物」，光脚写「赤脚」；",
    "正文省略的贴身衣物与鞋袜要依据人物、时代、场景、外层服装和整体配色一次性合理补全并锁定。",
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
    "顺序：妆容;唇妆;贴身内层上装;贴身内层下装;上身内层;上身外层;下身主层;连体;腿部穿着;腿部可见状态;足部;头部;颈部;手腕手部;腰部;眼部;耳部",
    "规则：",
    "- 每件真实衣物写全六项（键名和值都用英文）：style:___ | color:___ | length/structure:___ | material:___ | pattern/details:___ | default state:___",
    "- 同一个槽位有多件衣物时写成 槽位名1、槽位名2，每件各占一个花括号；连衣裙、长袍等连体衣物只在「连体」记一次。",
    "- 只有经过完整穿搭判断后确认没有该物件，才写 {none}；正文没提的要在不影响设定时合理补全并锁定，不许写 unknown。",
    "- 妆容与唇妆写当前实际视觉，素颜写 no makeup、natural lips。",
    "- 裸腿写：腿部穿着{none}; 腿部可见状态{bare legs};"
];

function batchPrompt(text, pack) {
    const origins = (pack && pack.origins) || [];
    const olds = (pack && pack.olds) || [];
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
    lines.push('  {"姓名":"甲","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…"},');
    lines.push('  {"姓名":"乙","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…"}');
    lines.push(']');
    lines.push('');
    lines.push(...FIELD_RULES);
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
    const name = String(profile['姓名'] || '').trim();
    return [
        '姓名：' + name,
        '性别/年龄：' + (profile['性别/年龄'] || ''),
        '外貌特征：' + (profile['外貌特征'] || ''),
        '当前衣着/装扮：' + (profile['当前衣着/装扮'] || ''),
        '核心DNA：' + (profile['核心DNA'] || ''),
        '服装DNA：' + (profile['服装DNA'] || '')
    ].join('\n');
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
        '服装DNA': pick('服装DNA', '服装dna', 'clothing_dna', '服饰DNA', '衣物DNA')
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

function currentProfileName() {
    try {
        const ch = extension_settings[CHATU8];
        return (ch && ch.current_llm_profile) || '';
    } catch (e) { return ''; }
}

/* 切换智绘姬当前使用的 LLM 配置 */
function switchProfile(name) {
    const ch = extension_settings[CHATU8];
    if (!ch || !name) return false;
    if (!ch.llm_profiles || !ch.llm_profiles[name]) return false;
    ch.current_llm_profile = name;
    saveSettingsDebounced();
    /* 顺手把智绘姬 LLM 页签里的下拉也切过去，两边界面保持一致 */
    try {
        const sel = document.querySelector('#ch-llm_profile_select');
        if (sel && sel.value !== name) {
            sel.value = name;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } catch (e) { /* 那边界面还没渲染好就算了，设置已经改对了 */ }
    return true;
}

/* 把下拉框填成智绘姬那几份配置 */
function fillProfileSelect() {
    const sel = document.querySelector('#dna-tab [data-dna="profileSelect"]');
    if (!sel) return;
    const list = allProfiles();
    const names = Object.keys(list);
    const cur = currentProfileName();
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

/* 把当前配置的全部字段摊开展示 */
function renderConfigDetail() {
    const box = document.querySelector('#dna-tab [data-dna="configDetail"]');
    if (!box) return;
    const p = chatu8Profile();
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
function chatu8Profile() {
    const ch = extension_settings[CHATU8];
    if (!ch) return null;
    const name = ch.current_llm_profile;
    if (!name || !ch.llm_profiles || !ch.llm_profiles[name]) return null;
    return ch.llm_profiles[name];
}

function resolveApi() {
    const p = chatu8Profile();
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
        customHeaders: apiExtras().headersObj
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
    return /prohibited use policy|sensitive words|SAFETY|content policy|use-policy/i.test(String(msg || ''));
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
function apiExtras() {
    const p = chatu8Profile() || {};
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

async function callOpenAI(prompt, api) {
    const url = openAiEndpoint(api.url, '/chat/completions');
    const plan = applyBreakthrough({}, [{ role: 'user', content: prompt }]);
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
        body: JSON.stringify(body)
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const ch = data && data.choices && data.choices[0];
    const msg = ch ? ch.message : null;
    /* 开了自定义 Tool 时，正文在 tool_calls 里 */
    if (msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        const decoded = decodeToolCall(msg, chatu8ToolConfig());
        if (decoded) return decoded;
    }
    const txt = msg ? msg.content : (ch ? ch.text : '');
    if (!txt) throw new Error('返回内容为空：' + raw.slice(0, 200));
    return String(txt);
}

async function callAnthropic(prompt, api) {
    const url = openAiEndpoint(api.url, '/messages');
    const mt = api.maxTokens > 0 ? api.maxTokens : 4000;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': api.key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: api.model,
            max_tokens: mt,
            temperature: api.temperature,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const out = ((data && data.content) || []).map((b) => (b && b.text ? b.text : '')).join('');
    if (!out) throw new Error('返回内容为空：' + raw.slice(0, 200));
    return out;
}

async function callGemini(prompt, api) {
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
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: gen })
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + '：' + raw.slice(0, 300));
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const cand = data && data.candidates && data.candidates[0];
    const out = cand && cand.content && cand.content.parts
        ? cand.content.parts.map((p) => (p && p.text ? p.text : '')).join('')
        : '';
    if (!out) throw new Error('返回内容为空：' + raw.slice(0, 200));
    return out;
}

async function callAI(prompt) {
    const api = resolveApi();
    if (!api.url) throw new Error('智绘姬 LLM 页签里还没填 API 地址');
    if (!api.model) throw new Error('智绘姬 LLM 页签里还没选模型');
    if (api.format === 'anthropic') return callAnthropic(prompt, api);
    if (api.format === 'gemini') return callGemini(prompt, api);
    return callOpenAI(prompt, api);
}

async function callSafe(prompt, softPrompt) {
    try {
        return await callAI(prompt);
    } catch (e) {
        if (!isSafetyBlock(e && e.message) || !softPrompt) throw e;
        log('请求被内容审核拦下，用精简正文重试一次……', 'error');
        return await callAI(softPrompt);
    }
}

/* ------------------------------ 破限：联动智绘姬的自定义 Tool + 末尾多 Role 消息 ------------------------------ */

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
    return out;
}

/* 请求体里加上工具和末尾消息；两项互相独立，各自看插件里的开关。
   %TOOL_NAME% 需要有个名字可替换，所以工具关着也照常生成一个（只是不发 tools）。 */
function applyBreakthrough(body, messages) {
    const out = { messages };
    const tc = chatu8ToolConfig();
    const wantTool = toolEnabled();
    const wantTail = tailEnabled();
    if (wantTool || wantTail) {
        const name = makeToolName();
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
    const plan = applyBreakthrough({}, [{ role: 'user', content: prompt }]);
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
        lines.push('===== tools：未启用（插件「破限」卡片里没开自定义 Tool）=====');
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

/* 破限联动状态：读的是智绘姬 LLM 页签那两项配置 */
function renderBreakInfo() {
    const box = document.querySelector('#dna-tab [data-dna="breakInfo"]');
    if (!box) return;
    const tc = chatu8ToolConfig();
    const tl = chatu8TailConfig();
    const tOn = toolEnabled();
    const lOn = tailEnabled();
    const rows = [
        ['自定义 Tool', tOn
            ? '已启用 · ' + (tc.fields || []).length + ' 个字段 · ' + ((tc.nameMode || 'dynamic') === 'fixed' ? '固定名 ' + (tc.fixedName || '(空)') : '动态随机名')
            : (!S.breakTool ? '插件里关着' : '未启用（智绘姬 LLM 页签里还没配字段）')],
        ['末尾多 Role 消息', lOn
            ? '已启用 · ' + (tl.messages || []).length + ' 条'
            : (!S.breakTail ? '插件里关着' : '未启用（智绘姬 LLM 页签里还没配消息）')],
        ['智绘姬那边', 'Tool ' + (chatu8ToolSwitch() ? '开' : '关') + ' · 末尾消息 ' + (chatu8TailSwitch() ? '开' : '关') + '（只管它自己，不影响这里）'],
        ['破限从哪来', tOn || lOn ? '读智绘姬「LLM」页签的配置，开关由插件这边决定' : '两项都关，等于不破限']
    ];
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

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
function pickSendRecords(text, maxChars) {
    const entries = currentEntries();
    const all = S.sendMode === 'all';
    const names = Object.keys(entries).sort((a, b) => b.length - a.length);
    const out = [];
    let used = 0;
    for (const name of names) {
        if (name.length < 2) continue;
        if (!all && String(text).indexOf(name) < 0) continue;
        const content = buildContent(entries[name]);
        const room = maxChars - used;
        if (room <= 0) break;
        out.push({ name, content: content.length > room ? content.slice(0, room) + '……' : content });
        used += Math.min(content.length, room);
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
        const maxChars = clampInt(S.sendMaxChars, 500, 60000, 6000);
        const recs = pickSendRecords(promptTextOf(data.prompt), maxChars);
        sendLast = { kind, at: Date.now(), n: recs.length, chars: 0, names: recs.map((r) => r.name) };
        if (!recs.length) {
            sendLast.note = '正文里没提到已记录的角色，这次不发';
            renderSendInfo();
            return;
        }
        const block = buildSendBlock(recs);
        if (!appendToPrompt(data.prompt, block)) return;
        sendStamp.add(data.prompt);
        sendLast.chars = block.length;
        log('发送数据 · ' + (SEND_LABELS[kind] || kind) + '：带上 ' +
            recs.length + ' 份 DNA（' + recs.map((r) => r.name).join('、') + '），' + block.length + ' 字');
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
                (sendLast.n ? sendLast.n + ' 份 / ' + sendLast.chars + ' 字' : (sendLast.note || '没发')))
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
        const recs = pickSendRecords(bag.text, clampInt(S.sendMaxChars, 500, 60000, 6000));
        ta.value = recs.length
            ? buildSendBlock(recs)
            : '最近 ' + bag.count + ' 层 AI 回复里没提到任何已记录的角色，这次不会发。';
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
        const prompt = batchPrompt(cleaned, { origins, olds });
        setTestField('testPrompt', previewPayload(prompt));
        const api = resolveApi();
        testHint('正在用 ' + api.source + ' · ' + api.model + ' 请求…');
        const reply = await callSafe(prompt, batchPrompt(clipText(cleaned, 400), { origins, olds }));
        setTestField('testResult', reply);
        testHint('完成：正文 ' + src.text.length + ' → ' + cleaned.length + ' 字，prompt ' + prompt.length + ' 字，回复 ' + reply.length + ' 字');
        log('测试请求完成：' + api.model + ' · prompt ' + prompt.length + ' 字 → 回复 ' + reply.length + ' 字');
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

/* 日志里说清楚这轮带没带破限（tool / 末尾消息） */
function logBreakthrough() {
    const t = toolEnabled();
    const tl = tailEnabled();
    if (!t && !tl) { log('破限：未启用（智绘姬 LLM 页签里两项都关着）'); return; }
    const bits = [];
    if (t) {
        const c = chatu8ToolConfig() || {};
        bits.push('自定义 Tool（' + (c.fields || []).length + ' 个字段）');
    }
    if (tl) {
        const c = chatu8TailConfig() || {};
        bits.push('末尾 ' + (c.messages || []).length + ' 条多 Role 消息');
    }
    log('破限：已联动智绘姬 · ' + bits.join(' + '));
}

/* ------------------------------ 扫描主流程 ------------------------------ */
function setBusy(busy, label) {
    scanning = busy;
    const btn = document.querySelector('#dna-tab [data-dna="scanNow"]');
    if (btn) { btn.disabled = busy; btn.textContent = busy ? (label || '记录中…') : '立即记录'; }
    const dot = document.querySelector('#dna-tab [data-dna="status"]');
    if (dot) dot.textContent = busy ? '运行中' : '空闲';
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

        log('提交 AI（本轮只调用一次）……');
        const api = resolveApi();
        log('使用 ' + api.source + ' · ' + api.model);
        logBreakthrough();
        const raw = await callSafe(
            batchPrompt(bag.text, { origins, olds }),
            batchPrompt(clipText(bag.text, 400), { origins, olds })
        );

        const list = parseProfileList(raw);
        if (!list) {
            log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error');
            return;
        }
        log('AI 返回 ' + list.length + ' 份档案');

        let created = 0, updated = 0, skipped = 0, failed = 0;
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
                else { skipped++; log('「' + nm + '」已存在，按设置跳过'); }
            } catch (e) {
                failed++;
                log('「' + nm + '」保存失败：' + (e && e.message ? e.message : e), 'error');
            }
        }
        if (created || updated) saveSettings(true);

        log('本轮结束：新建 ' + created + '，更新 ' + updated + '，跳过 ' + skipped + '，失败 ' + failed);
        if ((created || updated) && S.notify) toast('DNA 已记录：新建 ' + created + '，更新 ' + updated);
        renderList();
    } catch (e) {
        log('扫描中断：' + (e && e.message ? e.message : e), 'error');
        if (!opts.auto) toast('扫描失败：' + (e && e.message ? e.message : e), 'error');
    } finally {
        setBusy(false);
    }
}

/* ------------------------------ 面板 UI ------------------------------ */
const PANEL_HTML = `
<div id="dna-tab" class="dna-wrap">
  <div class="dna-hero">
    <div class="dna-hero-title">角色 DNA 记录器</div>
    <div class="dna-hero-sub">自动扫描剧情 → 每个角色一份档案 → 存在插件自己的档案库里，不写世界书</div>
    <div class="dna-hero-status">
      <span class="dna-dot"></span><span data-dna="status">空闲</span>
      <span class="dna-sep">·</span><span data-dna="autoState">自动记录已开启</span>
    </div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">运行</div>
    <div class="dna-row">
      <label class="dna-check"><input type="checkbox" data-dna="enabled"><span>启用插件</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="autoScan"><span>自动记录</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="followChar"><span>档案跟随角色卡</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="updateExisting"><span>已有角色重新生成</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="notify"><span>完成后弹提示</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="useRegex"><span>正文先过智绘姬正则</span></label>
    </div>
    <div class="dna-grid2">
      <div>
        <label class="dna-label">每次扫描最近 N 层 AI 回复（玩家楼层不算）</label>
        <input type="number" min="1" max="300" data-dna="scanDepth">
      </div>
      <div>
        <label class="dna-label">自动记录间隔（每 N 层 AI 回复）</label>
        <input type="number" min="1" max="50" data-dna="autoEvery">
      </div>
    </div>
    <label class="dna-label">界面（自动认设备：手机用手机版，电脑用电脑版）</label>
    <select class="dna-select" data-dna="uiMode">
      <option value="auto">自动检测</option>
      <option value="desktop">一直用电脑版</option>
      <option value="mobile">一直用手机版</option>
    </select>
    <div class="dna-hint" data-dna="uiState"></div>
    <div class="dna-actions">
      <button class="dna-btn dna-btn-primary" data-dna="scanNow">立即记录</button>
      <button class="dna-btn" data-dna="clearLog">清空日志</button>
    </div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">破限</div>
    <div class="dna-hint">
      这两项的内容还是从智绘姬「LLM」页签读（自定义 Tool 的字段、末尾多 Role 消息的每一条），
      但**开不开由这里决定**——关掉这里不影响智绘姬自己的设置，反之亦然。
    </div>
    <div class="dna-row">
      <label class="dna-check"><input type="checkbox" data-dna="breakTool"><span>启用自定义 Tool</span></label>
      <label class="dna-check"><input type="checkbox" data-dna="breakTail"><span>启用末尾多 Role 消息</span></label>
    </div>
    <div class="dna-kv" data-dna="breakInfo"></div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">档案库 <span class="dna-count" data-dna="count">0</span></div>
    <div class="dna-row dna-row-tight">
      <span class="dna-badge" data-dna="cardLabel">—</span>
      <span class="dna-hint dna-hint-inline" data-dna="storeHint"></span>
    </div>
    <div class="dna-actions">
      <button class="dna-btn" data-dna="export">导出 JSON</button>
      <button class="dna-btn" data-dna="import">导入 JSON</button>
      <button class="dna-btn" data-dna="clearAll">清空本库</button>
      <input type="file" accept=".json,application/json" data-dna="file" style="display:none">
    </div>
    <div class="dna-list" data-dna="list"></div>
    <div class="dna-detail" data-dna="detail" style="display:none"></div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">LLM 配置</div>
    <div class="dna-hint">和智绘姬「LLM」页签是同一份配置列表。在这里选一份，就等于在那边选它。</div>
    <label class="dna-label">选择配置</label>
    <div class="dna-model-row">
      <select class="dna-select" data-dna="profileSelect"></select>
      <button class="dna-btn" data-dna="gotoLLM">去 LLM 页签编辑</button>
    </div>
    <div class="dna-kv" data-dna="configDetail"></div>
    <div class="dna-hint" data-dna="modelHint"></div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">发送数据</div>
    <div class="dna-hint">
      智绘姬每次跑 LLM（正文出 Tag、Tag 修改……）之前，插件会先把正文里出场角色的 DNA 档案塞进它的请求里，
      让模型照着档案写发色/瞳色/服装，不会把角色画跑偏。只读智绘姬的请求，不改它的配置。
    </div>
    <div class="dna-row">
      <label class="dna-check"><input type="checkbox" data-dna="sendEnabled"><span>发送 DNA</span></label>
    </div>
    <label class="dna-label">发给哪几种请求</label>
    <div class="dna-row" data-dna="sendTargets"></div>
    <div class="dna-grid2">
      <div>
        <label class="dna-label">发送范围</label>
        <select class="dna-select" data-dna="sendMode">
          <option value="mentioned">只发正文里提到的角色</option>
          <option value="all">发本库全部角色</option>
        </select>
      </div>
      <div>
        <label class="dna-label">最多带多少字</label>
        <input type="number" min="500" max="60000" data-dna="sendMaxChars">
      </div>
    </div>
    <div class="dna-actions">
      <button class="dna-btn" data-dna="sendPreview">预览这次会发什么</button>
      <button class="dna-btn" data-dna="sendClear">清空预览</button>
    </div>
    <div class="dna-kv" data-dna="sendInfo"></div>
    <textarea class="dna-textarea dna-mono" data-dna="sendPreviewBox" rows="6" readonly></textarea>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">正则 &amp; 测试工具</div>
    <div class="dna-hint">
      发送给 AI 的正文会先过一遍智绘姬「正则」页签当前那份配置（条目 + 前后正则 + 文字正则）。
      下面可以直接试：看正则把这段正文剪成了什么样，以及模型到底收到了什么、回了什么。
    </div>
    <div class="dna-kv" data-dna="regexInfo"></div>
    <label class="dna-label">原始正文（粘一段想试的文本，留空则取最近 N 层 AI 回复）</label>
    <textarea class="dna-textarea" data-dna="testInput" rows="4" placeholder="留空 = 用最近 N 层 AI 回复的正文（不含玩家输入）"></textarea>
    <div class="dna-actions">
      <button class="dna-btn" data-dna="testRegex">① 只跑正则</button>
      <button class="dna-btn dna-btn-primary" data-dna="testLLM">② 跑正则 + 发测试请求</button>
      <button class="dna-btn" data-dna="clearTest">清空</button>
    </div>
    <label class="dna-label">正则后正文（这就是要发给 AI 的东西）</label>
    <textarea class="dna-textarea dna-mono" data-dna="testCleaned" rows="5" readonly></textarea>
    <label class="dna-label">组合提示词（真正发出去的 messages + tools）</label>
    <textarea class="dna-textarea dna-mono" data-dna="testPrompt" rows="5" readonly></textarea>
    <label class="dna-label">AI 回复</label>
    <textarea class="dna-textarea dna-mono" data-dna="testResult" rows="6" readonly></textarea>
    <div class="dna-hint" data-dna="testHint"></div>
  </div>

  <div class="dna-card">
    <div class="dna-card-h">日志</div>
    <div class="dna-log" data-dna="log"></div>
  </div>
</div>`;

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

function bindPanel() {
    const tab = document.querySelector('#dna-tab');
    if (!tab || tab.dataset.bound === '1') return;
    tab.dataset.bound = '1';

    const fill = () => {
        tab.querySelector('[data-dna="enabled"]').checked = !!S.enabled;
        tab.querySelector('[data-dna="autoScan"]').checked = !!S.autoScan;
        tab.querySelector('[data-dna="followChar"]').checked = !!S.followChar;
        tab.querySelector('[data-dna="updateExisting"]').checked = !!S.updateExisting;
        tab.querySelector('[data-dna="notify"]').checked = !!S.notify;
        tab.querySelector('[data-dna="useRegex"]').checked = !!S.useRegex;
        tab.querySelector('[data-dna="breakTool"]').checked = !!S.breakTool;
        tab.querySelector('[data-dna="breakTail"]').checked = !!S.breakTail;
        tab.querySelector('[data-dna="scanDepth"]').value = S.scanDepth;
        tab.querySelector('[data-dna="autoEvery"]').value = S.autoEvery;
        tab.querySelector('[data-dna="uiMode"]').value = S.uiMode || 'auto';
        tab.querySelector('[data-dna="sendEnabled"]').checked = !!S.sendEnabled;
        tab.querySelector('[data-dna="sendMode"]').value = S.sendMode === 'all' ? 'all' : 'mentioned';
        tab.querySelector('[data-dna="sendMaxChars"]').value = S.sendMaxChars;
        const tbox = tab.querySelector('[data-dna="sendTargets"]');
        if (tbox) {
            const on = new Set(sendTargets());
            tbox.innerHTML = Object.keys(SEND_EVENTS).map((k) =>
                '<label class="dna-check"><input type="checkbox" data-send-kind="' + k + '"' +
                (on.has(k) ? ' checked' : '') + '><span>' + esc(SEND_LABELS[k]) + '</span></label>'
            ).join('');
        }
        updateDerivedUI();
    };

    const onChange = (key, kind) => {
        const el = tab.querySelector('[data-dna="' + key + '"]');
        if (!el) return;
        const read = () => {
            if (kind === 'bool') return !!el.checked;
            if (kind === 'int') return clampInt(el.value, 1, 300, DEFAULTS[key]);
            if (kind === 'num') return numOr(el.value, DEFAULTS[key]);
            return el.value;
        };
        el.addEventListener('change', () => {
            S[key] = read();
            saveSettings(true);
            updateDerivedUI();
            if (key === 'followChar') { selected = null; renderList(); }
        });
        if (el.type === 'text' || el.type === 'password' || el.type === 'number') {
            el.addEventListener('input', () => { S[key] = read(); saveSettings(true); updateDerivedUI(); });
        }
    };

    ['enabled', 'autoScan', 'followChar', 'updateExisting', 'notify', 'useRegex', 'breakTool', 'breakTail'].forEach((k) => onChange(k, 'bool'));
    onChange('scanDepth', 'int');
    onChange('autoEvery', 'int');
    onChange('uiMode', 'str');

    tab.querySelector('[data-dna="scanNow"]').addEventListener('click', () => runScan({ depth: S.scanDepth }));
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
    tab.querySelector('[data-dna="sendMaxChars"]').addEventListener('change', (e) => {
        S.sendMaxChars = clampInt(e.target.value, 500, 60000, DEFAULTS.sendMaxChars);
        e.target.value = S.sendMaxChars;
        saveSettings(true);
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

    /* 正则 & 测试工具 */
    tab.querySelector('[data-dna="testRegex"]').addEventListener('click', onTestRegex);
    tab.querySelector('[data-dna="testLLM"]').addEventListener('click', onTestLLM);
    tab.querySelector('[data-dna="clearTest"]').addEventListener('click', () => {
        ['testInput', 'testCleaned', 'testPrompt', 'testResult'].forEach((k) => setTestField(k, ''));
        testHint('');
    });

    /* 模型配置全部在智绘姬 LLM 页签里，这里只做「选哪一份」+ 展示 + 跳转 */
    tab.querySelector('[data-dna="profileSelect"]').addEventListener('change', (e) => {
        const name = e.target.value;
        if (!name) return;
        if (!switchProfile(name)) { toast('切换失败：这份配置不存在', 'error'); return; }
        renderConfigDetail();
        updateModelHint();
        log('已切换 LLM 配置：' + name);
    });

    /* 智绘姬那边换配置时，这边跟着刷新 */
    try {
        const chSel = document.querySelector('#ch-llm_profile_select');
        if (chSel && chSel.dataset.dnaWatch !== '1') {
            chSel.dataset.dnaWatch = '1';
            chSel.addEventListener('change', () => setTimeout(() => { fillProfileSelect(); renderConfigDetail(); updateModelHint(); }, 80));
        }
    } catch (e) { /* 忽略 */ }

    tab.querySelector('[data-dna="gotoLLM"]').addEventListener('click', () => {
        document.querySelectorAll('.st-chatu8-nav-link').forEach((l) => l.classList.remove('active'));
        const jobs = document.querySelector('.st-chatu8-nav-link[data-tab="dna"]');
        if (jobs) jobs.classList.remove('active');
        document.querySelectorAll('.st-chatu8-tab-content').forEach((t) => t.classList.remove('active'));
        const link = document.querySelector('.st-chatu8-nav-link[data-tab="llm"]');
        const pane = document.querySelector('#st-chatu8-tab-llm');
        if (link) link.classList.add('active');
        if (pane) pane.classList.add('active');
        if (!link) toast('找不到 LLM 页签', 'error');
    });

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

function updateModelHint() {
    const hint = document.querySelector('#dna-tab [data-dna="modelHint"]');
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
    const p = chatu8Profile();
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
    renderBreakInfo();
    renderSendInfo();
    applyUiMode();
}

function refreshLLMCard() {
    fillProfileSelect();
    renderConfigDetail();
    updateModelHint();
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
    const names = Object.keys(entries).sort((a, b) => String(a).localeCompare(String(b), 'zh'));
    if (cnt) cnt.textContent = String(names.length);

    if (!names.length) {
        listBox.innerHTML = '<div class="dna-empty">这个档案库还是空的。点「立即记录」或等自动记录攒几条。</div>';
        if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
        return;
    }

    listBox.innerHTML = names.map((n) => {
        const rec = entries[n] || {};
        const active = (selected === n) ? ' dna-item-active' : '';
        return '<div class="dna-item' + active + '" data-name="' + esc(n) + '">' +
            '<span class="dna-item-name">' + esc(n) + '</span>' +
            '<span class="dna-item-time">' + esc(fmtTime(rec._updated)) + '</span>' +
            '<button class="dna-mini" data-act="copy" title="复制完整档案">复制</button>' +
            '<button class="dna-mini dna-mini-del" data-act="del" title="删除">×</button>' +
            '</div>';
    }).join('');

    if (!detail) return;
    if (!selected || !entries[selected]) { detail.style.display = 'none'; detail.innerHTML = ''; return; }

    const rec = entries[selected];
    const rows = [
        ['性别/年龄', rec['性别/年龄']],
        ['外貌特征', rec['外貌特征']],
        ['当前衣着/装扮', rec['当前衣着/装扮']],
        ['核心DNA', rec['核心DNA']],
        ['服装DNA', rec['服装DNA']]
    ];
    detail.style.display = '';
    detail.innerHTML =
        '<div class="dna-detail-h">' + esc(selected) +
        '<span class="dna-detail-time">' + esc(fmtTime(rec._updated)) + (rec._floor ? ' · 第' + esc(rec._floor) + '层' : '') + '</span>' +
        '<button class="dna-mini" data-copy="all">复制全部</button></div>' +
        rows.map(([k, v]) => '<div class="dna-field"><div class="dna-field-h">' + esc(k) +
            '<button class="dna-mini" data-copy="' + esc(k) + '">复制</button></div>' +
            '<div class="dna-field-v">' + (v ? esc(v) : '<span class="dna-empty-inline">（空）</span>') + '</div></div>').join('');
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
        version: 2,
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
        if (b.entries[nm]) replaced++; else added++;
        b.entries[nm] = Object.assign({}, rec, { '姓名': nm });
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

    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    /* 发送数据：必须在智绘姬注册监听之前排到最前面，所以尽早就装 */
    installSendHooks();
    setTimeout(installSendHooks, 5000);
    setTimeout(installSendHooks, 20000);
    log('角色DNA记录器已加载 v2.8.0 · 融合版（内置存储，不写世界书）');
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
