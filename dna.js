/**
 * 角色DNA记录器 · 已融合进 st-chatu8（由融合入口 index.js 引入本文件）
 * ---------------------------------------------------------------
 * 本文件是原扩展的构建产物（原 st-chatu8-dna/index.js）。
 * 字段规则已经内联在下方，不需要再跑构建脚本。
 *
 * v2.9.18：内置预设加版本号——presets/ 里的内置预设改版后，下次进酒馆自动重装（以前只在首次安装时装一次，
 *          改了文件用户库里那份永远不变，等于白改）；预设管理框新增「更新内置」按钮可手动强刷
 * v2.9.17：新增「别称」字段（小名 / 外号 / 昵称，多个用「、」隔开）——
 *          写档案时只增不减地并进老档案；正文用别称称呼也算这个角色出场（发送数据、形态切换都认）；
 *          档案列表在名字后面显示别称；三份内置上下文预设与内置字段规范同步加上别称规则
 * v2.9.16：档案详情里每个字段条目都带小锁头——锁住的字段 AI 不改写、手动也点不开编辑；
 *          锁按字段名存，所以模板里多加出来的字段（九段变十段十二段…）同样能单独锁
 * v2.9.15：档案模板瘦身——模板只管「有哪些字段」，字段规范 / 输出格式那些提示词交回上下文预设；
 *          模板新增「新建模板 / 编辑模板」悬浮窗编辑器（方便二创），面板与弹窗都提醒「改模板必须同步改预设」；
 *          「发送数据」里没用的「发给哪几种请求」勾选和预览 / 状态栏位删掉，只留「发送 DNA」一个总开关
 * v2.9.14：手动生成的收录规则改为「用户要求优先 + 判断轻重（轻的也照样建档，只影响详略）」；
 *         ① 按世界书条目生成里的条目列表可以折叠；智绘姬 LLM 页签的模型参数 / 上下文配置 / 上下文历史可折叠并记住状态
 * v2.9.13：服装线并入「组合生成」——①②③ 任意组合，服装不许单独生成。
 * v2.9.12：档案库新增「档案模板」——模板可导出 / 导入 / 切换 / 删除，默认模板内置不可删；
 *         模板决定 AI 输出哪些字段、字段规则、JSON 格式，自动记录与手动生成都跟它走；
 *         老档案换模板后详情里照旧显示多出来的字段。
 * v2.9.11：「发送数据」只留把 DNA 发给 LLM（去掉发送范围）；手动生成三条线整合——世界书 / 角色 / 服装
 *          可以单独生成，也可以「三条一起生成」；AI 回复（实时）加折叠按钮，默认收起，状态记在设置里
 *          （退出再进来还是上次那样）；手机版勾选列表字号缩小、条目名可换行
 * v2.9.10：设置最底部加「保存」；世界书条目加小眼睛（悬浮窗看原文 / 改 / 存回酒馆或智绘姬世界书）；
 *          导入文本支持按 token 分段（「分段生成tokens上限」），一段一次请求；
 *          子页签重排：档案库单独一栏，其余配置归入「自动生成」（扫描层数 / 记录间隔也搬进去了）
 * v2.9.9：折叠功能推倒重做（原来借用了智绘姬本体的折叠类，被本体在 document 上的委托点击又 toggle 一次，
 *         一次点击 toggle 两下 = 点了没反应；现在换成 DNA 自己的类名 + 自己的点击委托 + 自己记状态）
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
    followChar: true,          // 档案跟随当前存档：同一张角色卡的不同存档各一份档案库
    updateExisting: true,      // AI自动更新档案库：同名角色按当前剧情更新
    scanDepth: 3,              // 每次扫最近 N 层
    autoScan: true,            // 自动记录
    autoEvery: 3,              // 每 N 层 AI 回复触发一次
    autoMinChars: 0,           // 最新一层 AI 正文至少 N 字才自动记录；0 = 不限制
    notify: true,
    useRegex: true,            // 发送给 AI 之前先过一遍智绘姬的正则
    /* 界面：auto = 手机用手机版、电脑用电脑版；也可以手动锁定 */
    uiMode: 'auto',
    /* 附加配置：这两项在插件里有自己的开关，和智绘姬 LLM 页签那边的开关互不影响 */
    breakTool: true,           // 用智绘姬「自定义 Tool 工具配置」
    breakTail: true,           // 用智绘姬「末尾多 Role 消息」
    /* 发送数据：智绘姬跑 LLM（出 Tag / Tag 修改…）时，把对应角色的 DNA 一起发过去 */
    sendEnabled: true,
    /* 字段锁：{ 字段名: true }。锁住的字段 AI 不改写、手动也不能编辑。
       按字段名存（不按人物），所以模板里加了新字段也能单独锁。 */
    fieldLocks: {},
    replyMaxTokens: 10000,     // AI 回复的输出上限（token）；0 = 不设上限
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
    seedPresetVer: '',         // 已装的那份内置预设是哪个版本（内置预设改版后自动重装一次）
    seedGenPresetVer: '',
    /* 折叠状态：{ libAI, libLLM, libPreset, genAI, genLLM, genPreset } → true = 收起。
       DNA 自己记，不借智绘姬那套折叠状态（两边混用会互相打架）。 */
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
    genOutfits: [],            // 勾选的智绘姬「服装」服装预设名
    dnaTemplate: '',           // 当前用的档案模板名（'' = 内置默认模板）
    dnaTemplates: {},          // 导入的档案模板：{ 模板名: { fields, rules, format, importedAt } }
    genExtraChars: [],         // 手动补进去的角色名
    genInstruction: '',        // 额外要求（可留空）
    genTxtName: '',            // 导入的 txt 文件名（正文只在内存里，不落盘）
    genTxtChunk: 3000,         // 分段生成tokens上限：一条请求最多吃多少 token；0 = 不分段
    genTxtPart: 0,             // 0 = 全部段依次生成；1..N = 只生成第 N 段
    records: {},               // 内置存储：{ 卡片key: { card, entries: { 角色名: 档案 } } }
    /* 同人资料库：内置库是插件里的一份静态文件（1130 条，不塞进 settings），
       这里只存「用户改了什么」——编辑覆盖 / 新增 / 删除 / 勾选 / 额外要求。 */
    ranobe: null,              // 结构见 loadSettings 里的 normLib
    wbLib: null,               // 按世界书生成：同样一套（数据源是当前角色卡世界书）
    presetsRanobe: {},         // 同人库 / 世界书页签共用的上下文预设库
    ranobePresetName: '',      // 当前选中的同人预设名
    ranobePresetEnabled: false,// 用预设组装（否则用内置 batchPrompt）
    ranobePresetMergeSystem: false,
    seedRanobePreset: '',      // 内置同人预设装过没有
    seedRanobePresetVer: '',
    llmProfileRanobe: '',      // 同人库用哪份 LLM 配置（空 = 跟着手动生成）
};

/* 这几块默认收起（第一次进来看到的是收起状态）；没列在这里的块默认展开。
   状态本身存在 S.folds 里，退出再进来照旧——「上次是展开，下次还是展开」。 */
const FOLD_DEFAULT_FOLDED = { libAI: true, genAI: true, ranobeAI: true };

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
let searchTerm = '';           // 档案库搜索词（只存在内存里，不落盘）
let editingEntry = -1;         // 当前展开编辑的预设条目下标（-1 = 没开）
let editingField = '';         // 当前展开编辑的档案字段名
let editingScope = 'lib';      // 预设条目编辑框属于哪一套（lib / gen）
const LOG = [];

/* ------------------------------ 设置读写 ------------------------------ */
function loadSettings() {
    const saved = (extension_settings && extension_settings[MODULE]) || {};
    const out = {};
    for (const k in DEFAULTS) out[k] = (saved[k] === undefined || saved[k] === null) ? DEFAULTS[k] : saved[k];
    /* 老版本遗留字段，直接丢掉 */
    for (const k of LEGACY_KEYS) delete out[k];
    if (!out.records || typeof out.records !== 'object' || Array.isArray(out.records)) out.records = {};
    delete out.sendTargets;      // 发送范围设置已删掉（现在所有请求类型都发）
    if (!out.fieldLocks || typeof out.fieldLocks !== 'object' || Array.isArray(out.fieldLocks)) out.fieldLocks = {};
    /* 发送数据的上限单位从「字」改成「token」，老字段丢掉直接用新默认 */
    delete out.sendMaxChars;
    delete out.sendMaxTokens;   // 请求长度不再设上限，老字段清掉
    out.retryCount = clampInt(out.retryCount, 0, 5, 0);
    /* AI 回复上限：0 = 不设上限；老版本没这字段时给默认 10000 */
    out.replyMaxTokens = clampInt(out.replyMaxTokens, 0, 200000, 10000);
    /* 最新一层正文的字数门槛：0 = 不看字数，照旧按楼层数触发 */
    out.autoMinChars = clampInt(out.autoMinChars, 0, 100000, 0);
    /* 发送范围设置已删掉：只保留「把正文里出场角色的 DNA 发给 LLM」这一种行为 */
    delete out.sendMode;
    if (!out.presets || typeof out.presets !== 'object' || Array.isArray(out.presets)) out.presets = {};
    if (!out.presetsGen || typeof out.presetsGen !== 'object' || Array.isArray(out.presetsGen)) out.presetsGen = {};
    if (typeof out.genPresetName !== 'string') out.genPresetName = '';
    if (typeof out.genPresetEnabled !== 'boolean') out.genPresetEnabled = false;
    if (typeof out.genPresetMergeSystem !== 'boolean') out.genPresetMergeSystem = false;
    if (typeof out.genPresetSeeded !== 'boolean') out.genPresetSeeded = false;
    if (typeof out.presetName !== 'string') out.presetName = '';
    if (typeof out.seedPreset !== 'string') out.seedPreset = '';
    if (typeof out.seedGenPreset !== 'string') out.seedGenPreset = '';
    if (typeof out.seedPresetVer !== 'string') out.seedPresetVer = '';
    if (typeof out.seedGenPresetVer !== 'string') out.seedGenPresetVer = '';
    if (!out.folds || typeof out.folds !== 'object' || Array.isArray(out.folds)) out.folds = {};
    /* 默认收起的块显式写进设置：用户点开过（true→false）就一直记着是展开 */
    for (const fk of Object.keys(FOLD_DEFAULT_FOLDED)) {
        if (!(fk in out.folds)) out.folds[fk] = !!FOLD_DEFAULT_FOLDED[fk];
    }
    if (!Array.isArray(out.genOutfits)) out.genOutfits = [];
    if (typeof out.dnaTemplate !== 'string') out.dnaTemplate = '';
    if (!out.dnaTemplates || typeof out.dnaTemplates !== 'object' || Array.isArray(out.dnaTemplates)) out.dnaTemplates = {};
    /* 选中的模板被删掉 / 存坏了 → 退回内置默认模板 */
    if (out.dnaTemplate && !out.dnaTemplates[out.dnaTemplate]) out.dnaTemplate = '';
    if (!['auto', 'desktop', 'mobile'].includes(out.uiMode)) out.uiMode = 'auto';
    /* v2.9.3 新增：LLM 配置独立 + 手动生成的选择 */
    if (typeof out.llmProfile !== 'string') out.llmProfile = '';
    if (typeof out.llmProfileGen !== 'string') out.llmProfileGen = '';
    if (out.genSource !== 'chatu8') out.genSource = 'st';
    if (typeof out.genBook !== 'string') out.genBook = '';
    if (typeof out.genBookFollowCard !== 'boolean') out.genBookFollowCard = true;
    if (typeof out.genInstruction !== 'string') out.genInstruction = '';
    if (typeof out.genTxtName !== 'string') out.genTxtName = '';
    out.genTxtChunk = clampInt(out.genTxtChunk, 0, 200000, 3000);
    out.genTxtPart = clampInt(out.genTxtPart, 0, 9999, 0);
    for (const k of ['genEntries', 'genChars', 'genExtraChars']) {
        if (!Array.isArray(out[k])) out[k] = [];
        else out[k] = out[k].filter((x) => typeof x === 'string' && x.trim());
    }
    /* 同人资料库 / 按世界书生成：两套结构一样的用户层（内置本体是插件里的静态文件） */
    const normLib = (v, withVer) => {
        const o = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
        const strs = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === 'string' && y) : []);
        const rec = {
            edits: (o.edits && typeof o.edits === 'object' && !Array.isArray(o.edits)) ? Object.assign({}, o.edits) : {},
            added: (Array.isArray(o.added) ? o.added : []).filter((x) => x && typeof x === 'object').map((x) => Object.assign({}, x)),
            deleted: strs(o.deleted),
            sel: strs(o.sel),
            req: typeof o.req === 'string' ? o.req : '',
            q: typeof o.q === 'string' ? o.q : ''
        };
        if (withVer) rec.v = typeof o.v === 'string' ? o.v : '';
        return rec;
    };
    out.ranobe = normLib(out.ranobe, true);
    out.wbLib = normLib(out.wbLib, false);
    if (!out.presetsRanobe || typeof out.presetsRanobe !== 'object' || Array.isArray(out.presetsRanobe)) out.presetsRanobe = {};
    for (const k of ['ranobePresetName', 'seedRanobePreset', 'seedRanobePresetVer', 'llmProfileRanobe']) {
        if (typeof out[k] !== 'string') out[k] = '';
    }
    for (const k of ['ranobePresetEnabled', 'ranobePresetMergeSystem']) {
        if (typeof out[k] !== 'boolean') out[k] = false;
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

/* 当前聊天存档的标识：同一张角色卡开几个存档，就是几份独立的档案库。
   优先用酒馆给的 chatId（存档文件名），老版本没有就问角色对象上的 chat，
   再拿不到就退回「按角色卡分库」的老行为，绝不因此让档案库消失。 */
function chatStoreId() {
    try {
        const ctx = getContext() || {};
        if (typeof ctx.chatId === 'string' && ctx.chatId) return ctx.chatId;
        if (typeof ctx.getCurrentChatId === 'function') {
            const v = ctx.getCurrentChatId();
            if (v) return String(v);
        }
        if (ctx.groupId) {
            const g = (ctx.groups || []).find((x) => x.id === ctx.groupId);
            if (g && g.chat_id) return String(g.chat_id);
        }
        const ch = (ctx.characters || [])[ctx.characterId];
        if (ch && typeof ch.chat === 'string' && ch.chat) return ch.chat;
        if (ctx.chat_metadata && ctx.chat_metadata.chat_id) return String(ctx.chat_metadata.chat_id);
    } catch (e) { /* 取不到就按角色卡分库 */ }
    return '';
}

/* 存档名的尾巴：chatId 一般是「角色名 - 2024-1-1 @12h 30m」，显示时间那半截就够了 */
function shortChatName(id) {
    const t = String(id || '');
    const k = t.lastIndexOf(' - ');
    const tail = (k >= 0 ? t.slice(k + 3) : t).trim();
    return tail.length > 24 ? (tail.slice(0, 24) + '…') : tail;
}

/* 角色卡这一层（不含存档）的键 */
function cardBaseKey() {
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

/* 档案库的键 = 角色卡 + 当前存档；同一个存档反复进出始终是同一份库 */
function cardKey() {
    const base = cardBaseKey();
    if (!S.followChar || base === SHARED) return base;
    const chat = chatStoreId();
    return chat ? (base + '::' + chat) : base;
}

function cardLabel() {
    if (!S.followChar) return '共用档案库';
    const ctx = getContext();
    let name;
    if (ctx.groupId) {
        const g = (ctx.groups || []).find((x) => x.id === ctx.groupId);
        name = '群聊：' + (g ? g.name : '未命名');
    } else {
        const ch = (ctx.characters || [])[ctx.characterId];
        name = (ch && ch.name) ? ch.name : '未选择角色卡';
    }
    const chat = chatStoreId();
    const tail = chat ? shortChatName(chat) : '';
    return tail ? (name + ' · ' + tail) : name;
}

/* 老版本按角色卡共用一个库。改成按存档分库后，第一次进某个存档时把老库复制过来；
   老库本身原样留着，并打上 _claimed 标记——同一个老库只认领一次，其它存档拿到的是空库。 */
function adoptLegacyLibrary(k) {
    if (!S.followChar) return null;
    const key = String(k || '');
    const cut = key.indexOf('::');
    if (cut <= 0) return null;
    const base = key.slice(0, cut);
    const old = S.records[base];
    if (!old || !old.entries || typeof old.entries !== 'object') return null;
    if (old._claimed) return null;
    if (!Object.keys(old.entries).length) return null;
    const copy = JSON.parse(JSON.stringify(old));
    copy.card = cardLabel();
    copy.updated = Date.now();
    copy._fromLegacy = true;
    old._claimed = true;
    return copy;
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
    if (!b) {
        const legacy = adoptLegacyLibrary(k);
        if (legacy) {
            S.records[k] = legacy;
            b = legacy;
            log('老档案库已复制给当前存档：' + cardLabel() + '（老库原样保留）');
            saveSettings(true);
        }
    }
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

/* -------------------- 多形态兜底：一条档案里写了好几种外形 -------------------- */
/* AI 经常图省事，把「平时黑发洋装，变身后粉发战斗服」塞进同一条档案的同一字段里。
   这样档案库里就只有一条，出图时两种外形会打架。这里把它拆成多条。
   只在「明确写了两种外形」时才拆，判断不出就原样保留，不瞎猜。 */

/* 字段里出现这些词，说明这条档案在描述多个形态 */
const FORM_HINT_RE = /(变身后|变身时|战斗形态|常态|日常形态|另一种形态|化身|觉醒后|觉醒形态|黑化|暴走|第二形态|第三形态|人形态|兽形态|原形|伪装时|平时|日常| ordinarily|alternate form)/;

/* 从一段文字里按「；」/「。」/换行 切成小句 */
function splitClauses(v) {
    return String(v || '').split(/[；;\n]+/).map((x) => x.trim()).filter(Boolean);
}

/* 从一条档案里拆出多个形态。
   返回 null 表示「不是多形态，原样处理」；返回数组表示拆成多条。 */
function splitFormsFromRecord(profile) {
    const name = String(profile['姓名'] || '').trim();
    if (!name) return null;
    const fi = formInfo(name);
    /* 姓名里已经有形态名 → 本来就是分开的，不用拆 */
    if (fi.form) return null;

    /* 找「写了两种外形」的字段：同一字段被「；」分开，且两段都像外貌/服装描述 */
    const LOOK_KEYS = ['外貌特征', '当前衣着/装扮'];
    const found = [];
    for (const k of LOOK_KEYS) {
        const v = String(profile[k] || '');
        if (!v) continue;
        const clauses = splitClauses(v);
        if (clauses.length < 2) continue;
        /* 至少有 2 段各自像独立的外形描述 */
        const looks = clauses.filter((c) => wbHasLook(c).any);
        if (looks.length < 2) continue;
        found.push({ key: k, clauses });
    }
    if (!found.length) return null;

    /* 还要有「形态」的明确信号，否则可能只是罗列多件衣服 */
    const wholeText = Object.keys(profile).map((k) => String(profile[k] || '')).join(' ');
    const hasHint = FORM_HINT_RE.test(wholeText);
    if (!hasHint) return null;

    /* 拆：把每个字段的第 i 段归到第 i 个形态。
       段数不一致时，多出来的段并到最后一个形态，避免丢信息。 */
    const maxN = Math.max(...found.map((f) => f.clauses.length));
    if (maxN < 2 || maxN > 4) return null;   /* 超过 4 个形态明显是误判，不动 */

    const out = [];
    for (let i = 0; i < maxN; i++) {
        const p = { '姓名': '' };
        for (const k of Object.keys(profile)) {
            if (k === '姓名' || k === '本名') continue;
            p[k] = profile[k];
        }
        /* 被拆的字段取第 i 段 */
        for (const f of found) {
            const seg = f.clauses[Math.min(i, f.clauses.length - 1)];
            p[f.key] = seg;
        }
        out.push(p);
    }
    /* 把猜到的形态名一起带出去，saveProfile 起名时用 */
    out._names = out.map((p) => {
        for (const f of found) { const g = guessFormName(p[f.key]); if (g) return g; }
        return '';
    });
    return out;
}

/* 从一段外形描述里猜形态名：能猜到就用它，猜不到返回空串。
   例：「变身后粉发」→ 变身；「兽形态银白毛发」→ 兽化；「觉醒后金发竖瞳」→ 觉醒 */
const FORM_NAME_HINTS = [
    [/变身后|变身时/, '变身'],
    [/觉醒后|觉醒形态/, '觉醒'],
    [/兽形态|兽化|化身成兽/, '兽化'],
    [/人形态|人类形态/, '人形'],
    [/战斗形态|战斗服|战斗时/, '战斗'],
    [/黑化|暴走/, '黑化'],
    [/第二形态/, '第二形态'],
    [/第三形态/, '第三形态'],
    [/伪装/, '伪装'],
    [/日常形态|常态|平时|日常/, '日常']
];

function guessFormName(text) {
    const t = String(text || '');
    if (!t) return '';
    for (const pair of FORM_NAME_HINTS) { if (pair[0].test(t)) return pair[1]; }
    return '';
}

/* 写入一个角色：自动处理「一条档案里写了好几种外形」的情况。
   返回 { results: [{name, r}], created, updated, skipped, locked, failed, split } */
/* 把档案名规范成标准形态格式：
   爱丽丝（魔法少女形态）→ 爱丽丝·魔法少女[当前]
   爱丽丝·魔法少女 → 爱丽丝·魔法少女[当前]
   爱丽丝 → 爱丽丝（不动）
   已经有 [当前]/[非当前] 标记的原样保留。 */
function normalizeFormName(name, tagIfMissing) {
    const fi = formInfo(name);
    if (!fi.form) return String(name || '').trim();
    /* 已有标记就不动 */
    if (fi.tag) return String(name || '').trim();
    /* 没标记时：同批里已经有 [当前] 了，这条就当 [非当前]，避免两条抢同一个位置 */
    return fi.base + '·' + fi.form + '[' + (tagIfMissing || '当前') + ']';
}

function saveProfile(profile, floor) {
    const parts = splitFormsFromRecord(profile);
    const list = parts && parts.length > 1 ? parts : [profile];
    const out = { results: [], created: 0, updated: 0, skipped: 0, locked: 0, failed: 0, split: list.length > 1 };
    /* 同一角色的 [当前] 只能有一个。
       注意 saveProfile 是逐条调用的，同批信息拿不到，所以直接查档案库：
       这个本名已经有一条 [当前] 了，新的形态就只能当 [非当前]。 */
    const batchBase = formInfo(String(profile['姓名'] || '')).base;
    let curTaken = (formGroups().get(batchBase) || []).some((x) => x.info.isCurrent);
    for (let i = 0; i < list.length; i++) {
        const p = list[i];
        /* 拆出来的多条要给名字：优先用能看懂的形态名，猜不到才退回「原形/N」 */
        if (out.split) {
            const base = String(profile['姓名'] || '').trim();
            let fname = (parts && parts._names && parts._names[i]) || '';
            if (!fname) fname = (i === 0 ? '原形' : '形态' + (i + 1));
            p['姓名'] = base + '·' + fname + (i === 0 ? '[当前]' : '[非当前]');
            p['本名'] = i === 0 ? base : '';
        }
        /* 姓名规范成标准形态格式，档案库里看起来才整齐 */
        const fixed = normalizeFormName(p['姓名'], curTaken ? '非当前' : '当前');
        if (fixed && fixed !== String(p['姓名'] || '').trim()) {
            p['姓名'] = fixed;
            const nf = formInfo(fixed);
            if (nf.form && nf.isCurrent) {
                curTaken = true;
                if (!String(p['本名'] || '').trim()) p['本名'] = nf.base;
            }
        }
        const nm = String(p['姓名'] || '').trim();
        const r = saveRecord(p, floor);
        out.results.push({ name: nm, r });
        if (r === 'created') out.created++;
        else if (r === 'updated') out.updated++;
        else if (r === 'locked') out.locked++;
        else if (r === 'failed') out.failed++;
        else out.skipped++;
    }
    return out;
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
    /* 按当前模板的字段顺序落盘（默认模板＝姓名 + 10 个字段那套） */
    const rec = { '姓名': name };
    for (const k of tplFields()) {
        if (k === '姓名') continue;
        rec[k] = profile[k] || '';
        /* 别称只增不减：老档案里记下的小名，AI 这轮没提到也不能丢 */
        if (old && k === ALIAS_FIELD) rec[k] = aliasMerge(old[k], rec[k]);
        /* 这个字段被锁住 → 老档案里有值就照抄老值，AI 写什么都不认 */
        if (old && fieldLocked(k) && String(old[k] || '').trim()) rec[k] = old[k];
    }
    /* 强制发送是用户自己勾的，AI 更新档案时不能丢 */
    if (old && old._forceSend) rec._forceSend = true;
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

/* 强制发送：勾上以后，每次发送数据都会把这条档案一起带上，
   不看正文里有没有提到它（原来的规则是只发「这一轮出场的角色」）。 */
function isForceSend(name) {
    const rec = currentEntries()[name];
    return !!(rec && rec._forceSend);
}

function setForceSend(name, on) {
    const rec = currentEntries()[name];
    if (!rec) return false;
    if (on) rec._forceSend = true; else delete rec._forceSend;
    saveSettings(true);
    return true;
}

function toggleForceSend(name) {
    if (!name) return false;
    const next = !isForceSend(name);
    if (!setForceSend(name, next)) return false;
    log(next ? ('已开启「' + name + '」的强制发送：以后每次发送都会带上它')
        : ('已关闭「' + name + '」的强制发送'));
    toast(next ? ('「' + name + '」以后每次发送都会带上') : ('「' + name + '」不再强制发送'));
    renderList();
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

/* ------------------------------ 字段锁 ------------------------------ */
/* 锁住某个字段 = 这个字段 AI 不改写（saveProfile 会保留原值），你也点不开编辑框。
   按字段名保存，不跟人物走：模板里多加一个字段，它照样有自己的小锁。 */
function fieldLocked(k) {
    return !!(S.fieldLocks && S.fieldLocks[k]);
}

function setFieldLock(k, on) {
    if (!S.fieldLocks || typeof S.fieldLocks !== 'object' || Array.isArray(S.fieldLocks)) S.fieldLocks = {};
    if (on) S.fieldLocks[k] = true; else delete S.fieldLocks[k];
    saveSettings(true);
}

function lockedFieldNames() {
    return Object.keys(S.fieldLocks || {}).filter((k) => S.fieldLocks[k]);
}

function toggleFieldLock(k) {
    if (!k) return false;
    const next = !fieldLocked(k);
    setFieldLock(k, next);
    log(next ? ('已锁住字段「' + k + '」：AI 不会改写它，手动也不能编辑') : ('已解锁字段「' + k + '」'));
    toast(next ? ('已锁住字段「' + k + '」') : ('已解锁字段「' + k + '」'));
    renderList();
    return true;
}

function deleteRecord(name) {
    const b = bucket(cardKey(), false);
    if (!b || !b.entries[name]) return false;
    delete b.entries[name];
    b.updated = Date.now();
    saveSettings(true);
    return true;
}


/* ------------------------- 判断一段文字是不是在写长相 / 穿着 ------------------------- */
/* 给「一条档案里塞了多种形态」的拆分用：只有切开后每段都真的在描述外形，
   才认定它是多形态，避免把「白衬衫；百褶裙；乐福鞋」这种罗列误拆。 */

/* 外貌类：发色、瞳色、发型、脸、身材、肤色、体征…… */
const WB_LOOK_WORDS = [
    /* 发 */
    '发色', '发丝', '头发', '发型', '长发', '短发', '中长发', '卷发', '直发', '马尾', '双马尾',
    '单马尾', '辫子', '麻花辫', '刘海', '前发', '鬓发', '呆毛', '碎发', '盘发', '丸子头', '散发',
    '银发', '金发', '黑发', '白发', '红发', '棕发', '褐发', '粉发', '蓝发', '紫发', '绿发', '灰发',
    '亚麻', '挑染', '渐变发',
    /* 眼 / 脸 */
    '瞳色', '眼瞳', '眼眸', '双眼', '眼睛', '瞳孔', '红瞳', '蓝瞳', '金瞳', '绿瞳', '紫瞳',
    '异色瞳', '瞳孔', '眼型', '丹凤眼', '杏眼', '眼梢', '双眼皮',
    '脸型', '脸蛋', '面容', '五官', '长相', '相貌', '眉毛', '眉头', '睫毛', '酒窝', '下巴', '面部轮廓',
    /* 身体 */
    '身高', '体重', '体型', '身材', '三围', '胸围', '腰围', '臀围', '胸型', '罩杯',
    '肤色', '肌肤', '皮肤', '双腿', '长腿', '细腿', '手指', '手指纤细', '锁骨', '香肩', '肩膀轮廓',
    /* 非人特征（不用单字，避免「角落」「桌腿」误伤） */
    '兽耳', '猫耳', '狐耳', '精灵耳', '尖耳', '长耳', '犄角', '兽角', '头角',
    '尾巴', '狐尾', '猫尾', '翅膀', '羽翼', '鳞片', '纹身', '刺青', '纹路', '印记',
    /* 年龄性别体态 */
    '年龄', '外貌', '容貌', '稚气', '妩媚', '清秀', '英气', '娇小', '高挑', '纤细', '丰满',
    '黑长直', '金发', '竖瞳', '毛发', '长直', '短发', '卷曲',
    /* 英文（世界书里常混 Tag） */
    'hair', 'eye', 'eyes', 'pupil', 'skin', 'face', 'facial', 'body', 'figure', 'height',
    'blonde', 'brunette', 'silver hair', 'white hair', 'black hair', 'long hair', 'short hair',
    'silver-haired', 'pigtail', 'ponytail', 'twintail', 'braid', 'fringe', 'bangs'
];

/* 服装类：衣服、鞋袜、配饰、材质、颜色 */
const WB_OUTFIT_WORDS = [
    /* 上下装 */
    '衣', '衬衫', '衬衣', '上衣', '外套', '大衣', '风衣', '夹克', '西装', '马甲', '背心',
    '连衣裙', '裙子', '长裙', '短裙', '百褶裙', '半身裙', '裤', '长裤', '短裤', '牛仔裤',
    '裙装', '洋装', '礼服', '制服', '校服', '工作服', '女仆装', '战斗服', '和服', '旗袍',
    '袍', '斗篷', '披风', '长袍', '法袍',
    /* 鞋袜 */
    '鞋', '靴', '长靴', '短靴', '皮鞋', '乐福鞋', '高跟鞋', '凉鞋', '拖鞋',
    '袜', '丝袜', '过膝袜', '短袜', '长袜', '连裤袜', '袜套',
    /* 配饰 */
    '帽子', '帽', '头饰', '发饰', '发带', '发卡', '蝴蝶结', '眼镜', '耳环', '项链', '手链',
    '手镯', '戒指', '胸针', '腰带', '围巾', '手套', '披肩', '护腕', '肩章', '徽章',
    '装扮', '穿着', '着装', '打扮', '服饰', '衣物', '服装', '衣物',
    /* 材质与风格 */
    '蕾丝', '棉', '丝质', '皮革', '丝绒', '毛呢', '针织', '雪纺', '薄纱', '金属',
    '镶边', '褶皱', '荷叶边', '纽扣', '拉链', '系带', '开衩',
    /* 英文 */
    'dress', 'shirt', 'skirt', 'jacket', 'coat', 'uniform', 'outfit', 'clothes', 'clothing',
    'costume', 'armor', 'boots', 'shoes', 'socks', 'stocking', 'glove', 'gloves', 'hat', 'cap',
    'necklace', 'earring', 'ribbon', 'bow', 'glasses', 'cloak', 'cape', 'apron', 'vest',
    'sleeve', 'collar', 'lace', 'silk', 'leather'
];

/* 把词表编成正则，长词优先，避免「衣」先命中把「衬衫」吞掉 */
function lookRe(words) {
    const sorted = words.slice().sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(sorted.join('|'));
}
const WB_LOOK_RE = lookRe(WB_LOOK_WORDS);
const WB_OUTFIT_RE = lookRe(WB_OUTFIT_WORDS);

/* 这条世界书内容里有没有「长相」或「穿着」信息？
   有就带回 true（并告诉是哪一类），没有就不该发出去。 */
function wbHasLook(content) {
    const t = String(content || '');
    if (!t) return { look: false, outfit: false, any: false };
    const look = WB_LOOK_RE.test(t);
    const outfit = WB_OUTFIT_RE.test(t);
    return { look, outfit, any: look || outfit };
}



/* 正文里提到的、已经记录过的角色 → 交给模型做增量更新 */
/* 旧档案预算：一份真实档案约 4000～5000 字，留够 8～9 个角色的余量。
   预算不够时不是默默丢掉，而是把没发成的角色列给 AI 并明确禁止编造。 */
const OLD_RECORD_BUDGET = 40000;

function pickOldRecords(text, limit) {
    const out = [];
    const entries = currentEntries();
    const t = String(text || '');
    let used = 0;
    /* 因为预算不够、一个字都没发出去的角色 */
    const dropped = [];
    /* 一条档案的正文，超预算就截断 */
    const push = (name) => {
        const rec = entries[name];
        if (!rec || rec._locked) return;
        const content = buildContent(rec);
        if (!content) return;
        const room = limit - used;
        if (room <= 0) { dropped.push(name); return; }
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
    /* 预算不够的角色：报个名字，并明确要求不要凭空编造 */
    if (dropped.length) {
        out.push({
            name: '预算没装下的角色',
            dropped: dropped.slice(),
            content: '（下面这些角色已经有档案，但这次档案太长没一起发过来：' + dropped.join('、')
                + '。**不要凭印象补写它们的字段**：正文里明确写到的就按正文更新，没写到的字段留空或原样保留，不许编造。）'
        });
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

async function collectChatText(depth, onlyIdx) {
    const ctx = getContext();
    const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
    if (!chat.length) return { text: '', count: 0, from: 0, to: 0, before: 0, after: 0, skipped: 0 };
    const want = clampInt(depth, 1, 300, 3);

    /* 只要 AI 输出的楼层，玩家输入一律不进正文。
       所以「最近 N 层」按 N 条 AI 回复来数：从最后一层往前找，
       找满 N 条 AI 回复就停，中间夹着的玩家楼层直接跳过。 */
    const picked = [];
    let skipped = 0;
    /* 指定了楼层（连点正文 → 操作弹窗里的「档案生成」）：只收这一层，而且必须是 AI 楼层 */
    if (Number.isInteger(onlyIdx) && onlyIdx >= 0) {
        const one = chat[onlyIdx];
        if (one && !one.is_user && !one.is_system && String(one.mes || one.message || '').trim()) {
            picked.push({ idx: onlyIdx, mes: one });
        }
    } else {
        for (let i = chat.length - 1; i >= 0 && picked.length < want; i--) {
            const m = chat[i];
            if (!m || m.is_system) continue;
            if (m.is_user) { skipped++; continue; }
            if (!String(m.mes || m.message || '').trim()) continue;
            picked.push({ idx: i, mes: m });
        }
        picked.reverse();
    }

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
const DNA_FIELDS = ['姓名', '别称', '物种', '性别/年龄', '外貌特征', '当前衣着/装扮', '核心DNA', '服装DNA', '本名', '外貌串', '服装串'];

const FIELD_RULES = [
    "只输出这 11 个字段：姓名 / 别称 / 物种 / 性别/年龄 / 外貌特征 / 当前衣着/装扮 / 核心DNA / 服装DNA / 本名 / 外貌串 / 服装串，",
    "一个都不许少，也不许自己增加别的字段（不要性格、身份、关系、能力、好感度这类）。",
    "唯一允许留空的是「别称」：正文没提到小名外号就写空字符串，但这个键必须存在。",
    "",
    "【姓名】正文里的具体名字，原样照抄，不要改写成代称。",
    "多形态：同一角色的不同形态各占一条档案，姓名写成「原名·形态名」，并在末尾标注 [当前] / [非当前] / [永久封印]。",
    "只有正文明确发生形态转换、性别或种族变化、变身/觉醒、或达到条件的 Cosplay 才另立形态；",
    "普通理发、持久染发、临时假发、一次性美瞳都算原形态的更新，不另立形态。",
    "",
    "【别称】小名、外号、绰号、昵称、别人平时怎么称呼她 —— 有一个写一个，多个用「、」隔开（例：「明明、明哥」）。",
    "只写正文里真的这么称呼过的；没提到就写空字符串。别称不是姓名，也不代替姓名。",
    "这是追加栏：资料里给了上次档案、上次的别称已经写了，就原样带上，把新发现的补在后面，不许丢老的、不许改写老的。",
    "正文里用别称称呼人，也算这个角色出场。",
    "",
    "【物种】必填，不许留空、不许写「未知」「其他」。写物种名，必要时用括号补品种或分支：人类、精灵、矮人、狼人、吸血鬼、魔物娘、亚人（兽耳族）、马（温血马）、犬（边境牧羊犬）、树人、史莱姆、龙形。",
    "混血 / 半兽 / 化形按当前出场形态写主物种，括号里补分支：人类（狼人血统）、马（化形人形）。",
    "「性别/年龄」里不再重复物种；「外貌特征」首句写明的物种要与这一栏逐字一致。",
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
    const lines = [];
    lines.push('你是人物档案生成器。下面给你一段剧情正文，请把正文里出现过的人物整理成固定格式的档案。');
    lines.push('');
    lines.push('【谁要收录】');
    lines.push('· 正文里出现了具体名字、或者有专指称谓的人物都要收录，一个都不要漏。');
    lines.push('· 没有名字的泛称不要收录：士兵、守卫、侍女、人群、路人甲、众人、老板、酒保、摊贩之类。');
    lines.push('· 只是被顺口提一句、并没有真正出场的人物不要收录。');
    lines.push('');
    lines.push('【输出格式】只输出 JSON 数组本身，不要 markdown 代码块，不要任何解释：');
    lines.push(tplFormat());
    lines.push('');
    lines.push(...tplRuleLines());
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
    for (const k of tplFields()) {
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
    { keys: ['{{字段规范}}', '{{DNA_FIELDS}}'], label: '字段规范（跟当前档案模板走）' },
    { keys: ['{{输出格式}}', '{{DNA_FORMAT}}'], label: '输出格式' }
];

/* 收录规则 / 输出格式的内置副本：预设里用 {{收录规则}} {{输出格式}} 引用时填这个 */
const COLLECT_RULES = [
    '· 正文里出现具体名字的人物，全部收录，一个都不许漏。',
    '· 只有专指称谓、但明确指向某个具体人物的，也收录，姓名写那个称谓。',
    '· 泛称、群体（士兵、守卫、侍女、人群、路人甲、众人、老板、酒保、摊贩）一律不收录。',
    '· 只被顺口提一句、并没有真正出场的人物不收录。',
    '· 正文里用别称（小名、外号）称呼人，也算这个角色出场。',
    '· 发现别称就写进「别称」栏，多个用「、」隔开；上次档案里已有的别称要原样带上，只许追加不许删改。'
].join('\n');

const JSON_TEMPLATE = [
    '[',
    '  {"姓名":"甲","别称":"明明、明哥","物种":"人类","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"甲","外貌串":"这是生图的外貌提示词：girl, …","服装串":"这是生图的服装提示词：…"},',
    '  {"姓名":"乙","别称":"…","物种":"精灵","性别/年龄":"…","外貌特征":"…","当前衣着/装扮":"…","核心DNA":"…","服装DNA":"…","本名":"乙","外貌串":"这是生图的外貌提示词：boy, …","服装串":"这是生图的服装提示词：…"}',
    ']'
].join('\n');

/* ------------------------------ 档案模板 ------------------------------ */
/* v2.9.15 起：模板只管「这份档案有哪些字段」——决定落盘顺序、详情展示顺序、buildContent 输出什么。
   「每个字段怎么写 / JSON 长什么样」这类提示词不再存在模板里，统一由上下文预设提供；
   所以改了模板字段之后，必须同步改对应的上下文预设，否则模型输出对不上字段。
   内置默认模板就是那套十一段（姓名 + 别称 + 物种 + 8 个，改不了、删不掉）；导入/自建的模板存在 S.dnaTemplates 里按名切换。
   导出的 JSON 就是「可以改完再导回来」的样子：{ name, fields:[…] }。 */
function normalizeTemplate(raw, fallbackName) {
    const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const name = String(src.name || src['模板名'] || fallbackName || '').trim() || '未命名模板';
    let fields = src.fields || src['字段'] || src.columns;
    if (typeof fields === 'string') fields = fields.split(/[,\n、|]+/);
    fields = (Array.isArray(fields) ? fields : [])
        .map((f) => String(f && f.name !== undefined ? f.name : f).trim())
        .filter(Boolean);
    if (!fields.length) throw new Error('模板里没有字段列表（fields）');
    /* 姓名必须是第一个：档案以姓名为键 */
    fields = ['姓名'].concat(fields.filter((f) => f !== '姓名'));
    /* 旧模板文件里的 rules / format 直接忽略：模板不再保存提示词（v2.9.15） */
    return {
        name,
        fields,
        importedAt: src.importedAt || new Date().toISOString()
    };
}

/* 当前生效的模板：没选、或者选的那份没了 → 内置默认 */
function activeTemplate() {
    const bag = S.dnaTemplates || {};
    const t = S.dnaTemplate && bag[S.dnaTemplate];
    return t ? t : { name: '默认模板', fields: DNA_FIELDS };
}

function tplIsDefault() {
    return !(S.dnaTemplate && (S.dnaTemplates || {})[S.dnaTemplate]);
}

function tplFields() {
    const f = activeTemplate().fields;
    const arr = Array.isArray(f) ? f.filter(Boolean) : [];
    return arr.length ? arr : DNA_FIELDS;
}

/* 字段规范 / 输出格式：模板不提供，固定用内置这套。
   预设里写 {{字段规范}} / {{输出格式}} 占位符时填的就是这里；想让 AI 换写法就改预设条目。 */
function tplRules() {
    return FIELD_RULES.join('\n');
}

function tplRuleLines() {
    return FIELD_RULES.slice();
}

function tplFormat() {
    return JSON_TEMPLATE;
}

/* 详情用：模板字段在前，档案里多出来的旧字段跟在后（换模板后旧档案也不会「丢」内容） */
function tplDetailFields(rec) {
    const out = tplFields().filter((k) => k !== '姓名');
    const push = (k) => { if (k && k !== '姓名' && k.charAt(0) !== '_' && out.indexOf(k) < 0) out.push(k); };
    DNA_FIELDS.forEach(push);
    Object.keys(rec || {}).forEach(push);
    return out;
}

/* 导出用的对象（name 留空 = 当前模板） */
function templateExport(name) {
    const t = name ? ((S.dnaTemplates || {})[name] || null) : activeTemplate();
    if (!t) return null;
    return {
        type: 'st-chatu8-dna-template',
        version: 2,
        name: name || t.name || (tplIsDefault() ? '默认模板' : S.dnaTemplate),
        fields: Array.isArray(t.fields) ? t.fields : DNA_FIELDS,
        exportedAt: new Date().toISOString()
    };
}

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
    if (scope === 'gen') return S.presetsGen || {};
    if (scope === 'ranobe') return S.presetsRanobe || {};
    return S.presets || {};
}

function presetNames(scope) {
    return Object.keys(presetBag(scope));
}

function activePresetName(scope) {
    const names = presetNames(scope);
    const cur = scope === 'gen' ? S.genPresetName : (scope === 'ranobe' ? S.ranobePresetName : S.presetName);
    if (cur && presetBag(scope)[cur]) return cur;
    return names[0] || '';
}

function presetEntries(name, scope) {
    const p = presetBag(scope)[name || activePresetName(scope)];
    return p && Array.isArray(p.entries) ? p.entries : [];
}

function presetEnabledOf(scope) {
    if (scope === 'gen') return !!S.genPresetEnabled;
    if (scope === 'ranobe') return !!S.ranobePresetEnabled;
    return !!S.presetEnabled;
}

function presetMergeOf(scope) {
    const v = scope === 'gen' ? S.genPresetMergeSystem
        : (scope === 'ranobe' ? S.ranobePresetMergeSystem : S.presetMergeSystem);
    return v !== false;
}

/* 每个占位符这次要填的内容 */
function presetBlocks(text, pack) {
    const origins = (pack && pack.origins) || [];
    const olds = (pack && pack.olds) || [];
    const originText = origins.length
        ? origins.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n')
        : '（本轮没有角色卡设定可用）';
    const oldText = olds.length
        ? olds.map((o) => '—— ' + o.name + ' ——\n' + o.content).join('\n\n')
        : '（本轮没有已记录的同名角色）';
    return {
        '{{正文}}': text,
        '{{角色卡设定}}': originText,
        /* 世界书检索功能已移除，占位符保留但填空，避免旧预设里残留原样文字 */
        '{{世界书设定}}': '',
        '{{旧档案}}': oldText,
        '{{收录规则}}': COLLECT_RULES,
        '{{字段规范}}': tplRules(),
        '{{输出格式}}': tplFormat()
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
    if (scope === 'gen' || scope === 'ranobe') return false;   // 手动生成 / 同人库那两套是 DNA 专用，不登记到智绘姬，免得互相覆盖
    try {
        const ch = extension_settings[CHATU8];
        if (!ch) return false;
        if (!ch.test_context_profiles || typeof ch.test_context_profiles !== 'object') ch.test_context_profiles = {};
        for (const n of names) {
            const src = presetBag(scope)[n];
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
            S[presetKey(scope, 'Name')] = names[0];
            S[presetKey(scope, 'Enabled')] = true;
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
    S[presetKey(scope, 'Name')] = next;
    saveSettings(true);
    if (scope === 'gen' || scope === 'ranobe') {
        renderPresetCard(scope);
        log(presetScopeLabel(scope) + '预设改名：' + old + ' → ' + next);
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
    if (!confirm('删除预设「' + n + '」？' + ((scope === 'gen' || scope === 'ranobe') ? '' : '\n（智绘姬「LLM」页签里那份不会被删）'))) return;
    delete presetBag(scope)[n];
    const rest = presetNames(scope)[0] || '';
    S[presetKey(scope, 'Name')] = rest;
    if (!presetNames(scope).length) S[presetKey(scope, 'Enabled')] = false;
    saveSettings(true);
    renderPresetCard(scope);
    log('已删除' + presetScopeLabel(scope) + '预设：' + n);
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
/* 同人资料库 / 按世界书生成：这两页共用一份上下文预设（内置一份同人版） */
const DEFAULT_RANOBE_PRESET_FILE = 'presets/st_chatu8_ranobe_fanfic_v1.json';
const DEFAULT_RANOBE_PRESET_NAME = '昆仑DNA同人档案记录版';
const RANOBE_FILE = 'data/ranobe_corpus.json';   // 内置同人库本体（静态文件，只读进内存，不写 settings）

/* 内置预设的版本号：动了 presets/ 里那两个文件的内容，就把这里一起改掉。
   老用户下次进来自动重装内置预设（自己导入 / 新建的预设一律不动）。
   以前只看「装过没有」，所以插件升级后规则改了，用户库里那份永远不会变——这就是「改了没生效」。 */
const BUILTIN_PRESET_VER = 'v2.9.20';

/* 装一次内置默认预设。装过就记住（seedPreset），以后就算删掉也不会每次刷新又冒出来 */
async function ensureDefaultPreset(force) {
    /* 装过同一个版本就不再动；内置预设改版（BUILTIN_PRESET_VER 变了）自动重装一次 */
    if (!force && S.seedPreset === DEFAULT_PRESET_FILE && S.seedPresetVer === BUILTIN_PRESET_VER) return false;
    try {
        const url = new URL(DEFAULT_PRESET_FILE, import.meta.url).toString();
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { log('内置默认预设读取失败：HTTP ' + res.status, 'error'); return false; }
        const data = await res.json();
        const found = pickPresetsFromFile(data);
        const names = Object.keys(found);
        if (!names.length) { log('内置默认预设里没找到条目', 'error'); return false; }
        const now = Date.now();
        for (const n of names) S.presets[n] = { entries: found[n], importedAt: now, source: '内置默认预设', builtinVer: BUILTIN_PRESET_VER };
        /* 上一版内置预设自动退场（只删我们自己装的，用户自己导入的不动） */
        for (const legacy of LEGACY_PRESET_NAMES) {
            if (names.indexOf(legacy) >= 0) continue;
            if (S.presets[legacy] && S.presets[legacy].source === '内置默认预设') {
                delete S.presets[legacy];
                log('已移除上一版内置预设「' + legacy + '」');
            }
        }
        /* 装内置默认预设这一次，顺手把它切成当前用的那份（只此一次，之后你手动选什么就是什么） */
        S.presetName = (S.presetName && S.presets[S.presetName]) ? S.presetName : names[0];
        S.presetEnabled = true;
        S.seedPreset = DEFAULT_PRESET_FILE;
        S.seedPresetVer = BUILTIN_PRESET_VER;
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
async function ensureDefaultGenPreset(force) {
    if (!force && S.seedGenPreset === DEFAULT_GEN_PRESET_FILE && S.seedGenPresetVer === BUILTIN_PRESET_VER) return false;
    try {
        const url = new URL(DEFAULT_GEN_PRESET_FILE, import.meta.url).toString();
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { log('内置手动生成预设读取失败：HTTP ' + res.status, 'error'); return false; }
        const data = await res.json();
        const found = pickPresetsFromFile(data);
        const names = Object.keys(found);
        if (!names.length) { log('内置手动生成预设里没找到条目', 'error'); return false; }
        const now = Date.now();
        for (const n of names) S.presetsGen[n] = { entries: found[n], importedAt: now, source: '内置默认预设', builtinVer: BUILTIN_PRESET_VER };
        /* 装这一次顺手切成当前用的那份，之后你手动选什么就是什么 */
        S.genPresetName = (S.genPresetName && S.presetsGen[S.genPresetName]) ? S.genPresetName : names[0];
        S.genPresetEnabled = true;
        S.seedGenPreset = DEFAULT_GEN_PRESET_FILE;
        S.seedGenPresetVer = BUILTIN_PRESET_VER;
        saveSettings(true);
        log('已装好手动生成预设「' + names[0] + '」（' + found[names[0]].length + ' 条）');
        return true;
    } catch (e) {
        log('装手动生成预设失败：' + (e && e.message ? e.message : e), 'error');
        return false;
    }
}

/* 用户点「更新内置」时走这里：把那份内置预设强制刷成插件里的最新版本。
   只管内置那一份，自己导入 / 新建的预设一概不动。 */
/* 内置同人预设：装过一次就不再动，内置改版（BUILTIN_PRESET_VER 变了）自动重装 */
async function ensureDefaultRanobePreset(force) {
    if (!force && S.seedRanobePreset === DEFAULT_RANOBE_PRESET_FILE && S.seedRanobePresetVer === BUILTIN_PRESET_VER) return false;
    try {
        const url = new URL(DEFAULT_RANOBE_PRESET_FILE, import.meta.url).toString();
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) { log('内置同人预设读取失败：HTTP ' + res.status, 'error'); return false; }
        const data = await res.json();
        const found = pickPresetsFromFile(data);
        const names = Object.keys(found);
        if (!names.length) { log('内置同人预设里没找到条目', 'error'); return false; }
        const now = Date.now();
        for (const n of names) {
            S.presetsRanobe[n] = { entries: found[n], importedAt: now, source: '内置默认预设', builtinVer: BUILTIN_PRESET_VER };
        }
        S.ranobePresetName = (S.ranobePresetName && S.presetsRanobe[S.ranobePresetName]) ? S.ranobePresetName : names[0];
        S.ranobePresetEnabled = true;
        S.seedRanobePreset = DEFAULT_RANOBE_PRESET_FILE;
        S.seedRanobePresetVer = BUILTIN_PRESET_VER;
        patchPresetStart();
        saveSettings(true);
        log('已装好同人库预设「' + names[0] + '」（' + found[names[0]].length + ' 条）');
        return true;
    } catch (e) {
        log('装同人库预设失败：' + (e && e.message ? e.message : e), 'error');
        return false;
    }
}

/* ------------------------------ 同人资料库 / 按世界书：数据层 ------------------------------ */
/* 一条条目统一成 { k, n, a, c, w, t, p, d, x }：
   k 唯一键、n 名字、a 别名数组、c 全名标识、w 作品、t 角色tag、p 生图前缀、d 默认服装、x 完整记录文本。 */
function normLibEntry(raw, fallbackK) {
    const o = (raw && typeof raw === 'object') ? raw : {};
    const str = (v) => (v == null ? '' : String(v));
    const arr = Array.isArray(o.a)
        ? o.a.map(str).map((x) => x.trim()).filter(Boolean)
        : str(o.a).split(/[、,，]/).map((x) => x.trim()).filter(Boolean);
    return {
        k: str(o.k || fallbackK),
        n: str(o.n || o.name || o['姓名']).trim(),
        a: arr,
        c: str(o.c),
        w: str(o.w),
        t: str(o.t),
        p: str(o.p),
        d: str(o.d),
        x: str(o.x)
    };
}

function libState(scope) {
    return scope === 'wb' ? (S.wbLib || (S.wbLib = { edits: {}, added: [], deleted: [], sel: [], req: '', q: '' }))
        : (S.ranobe || (S.ranobe = { v: '', edits: {}, added: [], deleted: [], sel: [], req: '', q: '' }));
}

let RANOBE_BUILTIN = null;
let RANOBE_LOADING = null;

/* 内置同人库：一份静态文件（1000+ 条），只加载到内存 */
async function loadRanobeBuiltin(force) {
    if (RANOBE_BUILTIN && !force) return RANOBE_BUILTIN;
    if (RANOBE_LOADING && !force) return RANOBE_LOADING;
    RANOBE_LOADING = (async () => {
        try {
            const url = new URL(RANOBE_FILE, import.meta.url).toString();
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) { log('内置同人资料库读取失败：HTTP ' + res.status, 'error'); return null; }
            const data = await res.json();
            const chars = Array.isArray(data.chars) ? data.chars : (Array.isArray(data) ? data : []);
            RANOBE_BUILTIN = {
                name: String((data && data.name) || '内置同人资料库'),
                v: String((data && data.exportedAt) || ''),
                chars
            };
            log('内置同人资料库已载入：' + chars.length + ' 条（' + RANOBE_BUILTIN.name + '）');
            return RANOBE_BUILTIN;
        } catch (e) {
            log('内置同人资料库读取失败：' + (e && e.message ? e.message : e), 'error');
            return null;
        } finally {
            RANOBE_LOADING = null;
        }
    })();
    return RANOBE_LOADING;
}

/* 按世界书生成的数据源：当前角色卡绑定的主世界书（没绑定就用 gen 里选的那本） */
let WB_LIB_CACHE = [];
let WB_LIB_BOOK = '';

async function loadWbLibSource(force) {
    if (WB_LIB_CACHE.length && !force) return WB_LIB_CACHE;
    try {
        if (S.genSource === 'chatu8') {
            WB_LIB_BOOK = '智绘姬世界书';
            WB_LIB_CACHE = chatu8WorldEntries() || [];
            return WB_LIB_CACHE;
        }
        const book = cardWorldBook() || S.genBook || '';
        if (!book) { WB_LIB_CACHE = []; WB_LIB_BOOK = ''; return WB_LIB_CACHE; }
        const names = await stWorldNames();
        if (names.indexOf(book) < 0) { WB_LIB_CACHE = []; WB_LIB_BOOK = book + '（不在列表里）'; return WB_LIB_CACHE; }
        WB_LIB_BOOK = book;
        const list = await stWorldEntries(book);
        WB_LIB_CACHE = (list || []).map((e) => ({
            k: 'wb:' + e.key,
            n: e.title,
            a: [],
            c: e.title,
            w: book,
            t: '',
            p: '',
            d: '',
            x: e.content
        }));
        return WB_LIB_CACHE;
    } catch (e) {
        log('读当前角色卡世界书失败：' + (e && e.message ? e.message : e), 'error');
        WB_LIB_CACHE = [];
        return WB_LIB_CACHE;
    }
}

/* 合并：内置本体 - 删掉的 + 改过的 + 自己加的 */
function mergeLib(scope, base) {
    const st = libState(scope);
    const del = new Set(st.deleted || []);
    const out = [];
    const seen = new Set();
    for (const raw of (base || [])) {
        const e = normLibEntry(raw);
        if (!e.k || del.has(e.k) || seen.has(e.k)) continue;
        seen.add(e.k);
        const ed = st.edits && st.edits[e.k];
        out.push(ed ? normLibEntry(Object.assign({}, e, ed), e.k) : e);
    }
    for (const raw of (st.added || [])) {
        const e = normLibEntry(raw);
        if (!e.k) e.k = 'u:' + (e.n || '');
        if (del.has(e.k) || seen.has(e.k)) continue;
        seen.add(e.k);
        out.push(e);
    }
    return out;
}

async function libAll(scope) {
    if (scope === 'wb') return mergeLib('wb', await loadWbLibSource());
    const b = await loadRanobeBuiltin();
    return mergeLib('ranobe', b ? b.chars : []);
}

async function onPresetReseed(scope) {
    const isGen = scope === 'gen';
    const isRanobe = scope === 'ranobe';
    const name = isGen ? DEFAULT_GEN_PRESET_NAME : (isRanobe ? DEFAULT_RANOBE_PRESET_NAME : DEFAULT_PRESET_NAME);
    const label = presetScopeLabel(scope);
    const has = !!presetBag(scope)[name];
    const ok = confirm('把' + label + '的内置预设「' + name + '」刷新成插件里的最新版本？' +
        (has ? '\n\n你对这一份做过的改动会被覆盖（自己导入 / 新建的预设不受影响）。' : ''));
    if (!ok) return false;
    if (isGen) { S.seedGenPreset = ''; S.seedGenPresetVer = ''; await ensureDefaultGenPreset(true); }
    else if (isRanobe) { S.seedRanobePreset = ''; S.seedRanobePresetVer = ''; await ensureDefaultRanobePreset(true); }
    else { S.seedPreset = ''; S.seedPresetVer = ''; await ensureDefaultPreset(true); }
    saveSettings(true);
    renderPresetCard(scope);
    toast(label + '的内置预设已更新到最新版');
    return true;
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
    const up = (p) => p + base.charAt(0).toUpperCase() + base.slice(1);
    if (scope === 'gen') return up('gen');
    if (scope === 'ranobe') return up('ranobe');
    return base;
}

/* 三套上下文预设各存各的：档案库（lib）/ 手动生成（gen）/ 同人库与按世界书（ranobe）。
   kind：Enabled（总开关）/ MergeSystem（合并 system）/ Name（当前选中的预设名） */
function presetKey(scope, kind) {
    if (scope === 'gen') return 'genPreset' + kind;
    if (scope === 'ranobe') return 'ranobePreset' + kind;
    return 'preset' + kind;
}

/* 日志 / 提示里怎么称呼这一套预设 */
function presetScopeLabel(scope) {
    return scope === 'gen' ? '手动生成' : (scope === 'ranobe' ? '同人库' : '档案库');
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
        const who = presetScopeLabel(scope);
        let txt = on
            ? who + '按「' + name + '」的 ' + list.filter((e) => e.enabled !== false).length + ' 条条目组装 messages'
            : (names.length ? '关着的时候用插件内置提示词（batchPrompt）' : '导入后' + who + '就按预设的条目组装提示词');
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

/* ------------------------------ 可折叠区块 ------------------------------ */
/* LLM 配置 / 上下文预设这两块占地方，点标题或右边箭头就能收起来。

   为什么不借智绘姬本体那套 .st-chatu8-collapsible-section：
   本体在 document 上挂了一个委托点击，凡是点 .st-chatu8-section-header 它自己会 toggle 一次
   is-collapsed。DNA 这边要是也用同一个类名再挂一个监听，一次点击就被 toggle 两下——
   等于没点，这就是「折叠点了没反应」的根因。所以这里用自己的一套类名（dna-fold / dna-fold-head），
   本体的委托选择器压根匹配不到，两边井水不犯河水。

   收起的表现：.dna-folded 让 head 之外的所有子元素 display:none（见 dna.css），
   不用再包一层 body，静态 HTML 也不用跟着改结构。 */
/* 某块当前是不是收起的：设置里记过就用记的，没记过就看默认值 */
function foldOn(key, bag) {
    const f = bag || ((S.folds && typeof S.folds === 'object') ? S.folds : {});
    if (key in f) return !!f[key];
    return !!FOLD_DEFAULT_FOLDED[key];
}

function applyFolds() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const f = (S.folds && typeof S.folds === 'object') ? S.folds : {};
    tab.querySelectorAll('[data-fold]').forEach((sec) => {
        sec.classList.toggle('dna-folded', foldOn(sec.dataset.fold, f));
    });
}

/* 点箭头或点标题都能收/展开。挂在 #dna-tab 上一次就够：
   面板内容被外部重建也不影响，只要容器还在就有人接点击。 */
function bindFoldClicks(tab) {
    if (!tab || tab.dataset.foldBound === '1') return;
    tab.dataset.foldBound = '1';
    tab.addEventListener('click', (e) => {
        const t = e.target;
        const btn = t && t.closest ? t.closest('[data-fold-btn]') : null;
        const head = t && t.closest ? t.closest('.dna-fold-head') : null;
        if (!btn && !head) return;
        /* 标题行里塞了搜索框 / 全选按钮的折叠块：点这些控件只当操作用，不折叠 */
        if (!btn && t.closest('input, select, textarea, a, button')) return;
        const sec = (btn || head).closest('[data-fold]');
        if (!sec) return;
        e.preventDefault();
        const k = sec.dataset.fold;
        if (!S.folds || typeof S.folds !== 'object') S.folds = {};
        S.folds[k] = !foldOn(k, S.folds);
        sec.classList.toggle('dna-folded', !!S.folds[k]);
        saveSettings(true);
    });
}

/* ------------------------------ 悬浮窗 ------------------------------ */
/* 编辑字段 / 编辑预设条目都走这个：内容放在屏幕中央的弹窗里，不挤在面板里。
   挂在 body 上，所以面板滚动不影响它。 */
let dnaModalMask = null;
function dnaModalOpen(title, bodyHtml) {
    /* 立即清掉上一个（不等退场动画），否则会短暂同时存在两个 */
    dnaModalClose(true);
    const mask = document.createElement('div');
    /* 直接复用智绘姬本体的编辑弹窗组件（modals.css 里的 .st-chatu8-edit-*），
       遮罩、圆角、按钮、间距全都跟本体一模一样，不用自己造一套。 */
    mask.className = 'st-chatu8-edit-backdrop dna-modal-mask';
    mask.innerHTML =
        '<div class="st-chatu8-edit-dialog" role="dialog" aria-modal="true">' +
            '<div class="st-chatu8-edit-title dna-modal-title">' + esc(title) +
                '<button type="button" class="dna-modal-x" data-modal-close="1" title="关闭">&times;</button>' +
            '</div>' +
            '<div class="dna-modal-b">' + bodyHtml + '</div>' +
        '</div>';
    document.body.appendChild(mask);
    dnaModalMask = mask;
    /* 点遮罩空白处关闭，点弹窗内部不关 */
    mask.addEventListener('mousedown', (e) => {
        if (e.target === mask) dnaModalClose();
    });
    const xBtn = mask.querySelector('[data-modal-close]');
    if (xBtn) xBtn.addEventListener('click', () => dnaModalClose());
    const raf = (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 16);
    raf(() => {
        try { mask.classList.add('dna-modal-show'); } catch (e) { /* 忽略 */ }
    });
    return mask;
}
function dnaModalClose(instant) {
    const mask = dnaModalMask || document.querySelector('.dna-modal-mask');
    dnaModalMask = null;
    if (!mask) return;
    try { mask.classList.remove('dna-modal-show'); } catch (e) { /* 忽略 */ }
    if (instant) {
        try { if (mask.parentNode) mask.parentNode.removeChild(mask); } catch (e) { /* 忽略 */ }
        return;
    }
    /* 点关闭时留一点退场动画时间 */
    setTimeout(() => { try { if (mask.parentNode) mask.parentNode.removeChild(mask); } catch (e) { /* 忽略 */ } }, 180);
}
/* 弹窗里的保存/取消按钮：统一在这里接线 */
function dnaModalWire(onSave) {
    const mask = dnaModalMask;
    if (!mask) return;
    const save = mask.querySelector('[data-modal-save]');
    const cancel = mask.querySelector('[data-modal-cancel]');
    if (save) save.addEventListener('click', () => { if (onSave) onSave(mask); });
    if (cancel) cancel.addEventListener('click', () => dnaModalClose());
    const first = mask.querySelector('textarea, input[type="text"]');
    if (first) { try { first.focus(); } catch (e) { /* 忽略 */ } }
}

function renderPresetEntries(scope) {
    const box = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'presetEntries') + '"]');
    if (!box) return;
    const list = presetEntries(undefined, scope);
    if (!list.length) {
        box.innerHTML = '<div class="dna-entries-empty">还没导入预设</div>';
        updatePresetMeta(scope);
        return;
    }
    /* 编辑框只在它所属的那套里展开 */
    const editing = (editingEntry >= 0 && editingScope === scope) ? editingEntry : -1;
    /* 有编辑框展开时把列表放高一点，写长条目才不憋屈 */
    try { box.classList.toggle('dna-entries-editing', editing >= 0); } catch (e) { /* 忽略 */ }
    box.innerHTML = list.map((e, i) => {
        const on = e.enabled !== false;
        const role = PRESET_ROLES.includes(e.role) ? e.role : 'user';
        const tag = role === 'system' ? 'SYS' : role === 'assistant' ? 'AST' : 'USR';
        const len = String(e.content || '').length;
        const open = (editing === i);
        const row = '<div class="dna-entry-line">'
            + '<label class="dna-entry' + (on ? '' : ' dna-entry-off') + '" data-idx="' + i + '" title="' + esc(e.name || '') + '">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + '>'
            + '<span class="dna-entry-role dna-entry-' + role + '">' + tag + '</span>'
            + '<span class="dna-entry-name">' + esc(e.name || ('条目 ' + (i + 1))) + '</span>'
            + '<span class="dna-entry-len">' + len + ' 字</span>'
            + '</label>'
            + '<button class="dna-entry-edit' + (open ? ' is-open' : '') + '" data-edit="' + i + '" title="编辑这条">'
            + '<i class="fa-solid fa-pen"></i></button>'
            + '</div>';
        if (!open) return '<div class="dna-entry-item" data-idx="' + i + '">' + row + '</div>';
        const editor = '<div class="dna-entry-editor" data-editor="' + i + '">'
            + '<div class="dna-editor-row"><label>名称</label>'
            + '<input type="text" class="st-chatu8-text-input" data-ef="name" value="' + esc(e.name || '') + '"></div>'
            + '<div class="dna-editor-row"><label>角色</label>'
            + '<select class="st-chatu8-select" data-ef="role">'
            + PRESET_ROLES.map((r) => '<option value="' + r + '"' + (r === role ? ' selected' : '') + '>' + r + '</option>').join('')
            + '</select></div>'
            + '<div class="st-chatu8-field-col"><label>内容（支持 {{正文}} / {{角色卡设定}} / {{旧档案}} 等占位符）</label>'
            + '<textarea class="st-chatu8-textarea dna-mono" data-ef="content" rows="12">' + esc(e.content || '') + '</textarea></div>'
            + '<div class="dna-actions"><button class="st-chatu8-btn" data-eact="save"><i class="fa-solid fa-check"></i>保存这条</button>'
            + '<button class="st-chatu8-btn" data-eact="cancel">取消</button></div>'
            + '</div>';
        return '<div class="dna-entry-item" data-idx="' + i + '">' + row + editor + '</div>';
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
    /* 模板字段 → AI 可能用的别名（自定义字段没别名，就按字段名本身取） */
    const ALIAS = {
        '别称': ['别称', '别名', '小名', '外号', '绰号', '花名', '昵称', 'alias', 'aliases', 'nickname', 'nicknames'],
        '性别/年龄': ['性别/年龄', '性别年龄', '性别', '年龄', 'gender_age', 'gender', 'age'],
        '外貌特征': ['外貌特征', '外貌', '外观', '外貌描述', 'appearance', 'looks'],
        '当前衣着/装扮': ['当前衣着/装扮', '当前衣着', '当前装扮', '衣着', '装扮', '服装', 'current_outfit', 'outfit'],
        '核心DNA': ['核心DNA', '核心dna', 'core_dna', 'DNA', '核心基因'],
        '服装DNA': ['服装DNA', '服装dna', 'clothing_dna', '服饰DNA', '衣物DNA'],
        '本名': ['本名', '原名', '原始姓名', 'original_name', 'realname'],
        '外貌串': ['外貌串', '外貌提示词', '外貌prompt', 'appearance_prompt', 'appearanceprompt'],
        '服装串': ['服装串', '服装提示词', '服装prompt', 'outfit_prompt', 'outfitprompt']
    };
    const out = { '姓名': pick('姓名', 'name', '名字', '角色名', '角色') || name };
    let filled = 0;
    for (const f of tplFields()) {
        if (f === '姓名') continue;
        const keys = ALIAS[f] ? [f].concat(ALIAS[f]) : [f];
        const v = pick.apply(null, keys);
        out[f] = v;
        if (v) filled++;
    }
    if (!filled) return null;
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
    const tries = scope === 'gen' ? [S.llmProfileGen, S.llmProfile]
        : (scope === 'ranobe' ? [S.llmProfileRanobe, S.llmProfileGen, S.llmProfile] : [S.llmProfile]);
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
    if (scope === 'gen') S.llmProfileGen = name;
    else if (scope === 'ranobe') S.llmProfileRanobe = name;
    else S.llmProfile = name;
    saveSettings(true);
    return true;
}

/* 把下拉框填成智绘姬那几份配置（scope：lib / gen 各一个下拉） */
function fillProfileSelect(scope) {
    const sel = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'profileSelect') + '"]');
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
    const box = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'configDetail') + '"]');
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

/* 输出上限取哪个：「AI 回复上限」优先；填 0 = 不设上限（交给服务端默认）。
   只有完全没传（undefined）时才退回智绘姬 LLM 配置里的 max_tokens。 */
function replyPower(replyMax, profileMax) {
    if (typeof replyMax === 'number' && isFinite(replyMax)) {
        return replyMax > 0 ? Math.round(replyMax) : 0;
    }
    return profileMax > 0 ? profileMax : 0;
}

/* 读 SSE 流：边收边把累积文本回调出去。返回完整文本。
   只认 OpenAI 的 `data: {...}` 格式；拿到内容才算成功，否则抛错让上层回退。 */
async function readOpenAIStream(res, onDelta, signal) {
    const reader = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    let acc = '';
    let got = false;
    while (true) {
        if (signal && signal.aborted) throw new Error('已手动中断');
        const step = await reader.read();
        if (step.done) break;
        buf += dec.decode(step.value, { stream: true });
        /* SSE 一帧可能被拆成多个 chunk，按行切，最后一段留到下次 */
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
            const t = line.trim();
            if (!t || t.charAt(0) === ':') continue;
            if (t.indexOf('data:') !== 0) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            let j;
            try { j = JSON.parse(payload); } catch (e) { continue; }
            const ch = j && j.choices && j.choices[0];
            const d = (ch && (ch.delta || ch.message)) || {};
            let piece = d.content;
            /* 有些兼容层把 content 拆成数组 */
            if (Array.isArray(piece)) piece = piece.map((x) => (x && (x.text || x.content)) || '').join('');
            if (typeof piece !== 'string' || !piece) continue;
            got = true;
            acc += piece;
            if (onDelta) onDelta(acc, piece);
        }
    }
    if (!got) throw new Error('流式没有返回任何内容');
    return acc;
}

async function callOpenAI(prompt, api, signal, replyMax, onDelta) {
    const url = openAiEndpoint(api.url, '/chat/completions');
    const plan = applyBreakthrough({}, normalizeMessages(prompt));
    const body = {
        model: api.model,
        messages: plan.messages,
        temperature: api.temperature
    };
    if (plan.tools) { body.tools = plan.tools; body.tool_choice = plan.toolChoice; }
    const mtOut = replyPower(replyMax, api.maxTokens);
    if (mtOut > 0) body.max_tokens = mtOut;
    /* 要实时显示时才开流式。开了自定义 Tool 的不用流式：
       那种模式下正文在 tool_calls 里，流式分片拼起来很容易缺内容。 */
    const wantStream = !!onDelta && !plan.tools;
    if (wantStream) body.stream = true;
    const res = await fetch(url, {
        method: 'POST',
        headers: apiHeaders(api),
        body: JSON.stringify(body),
        signal
    });
    if (!res.ok) {
        const bad = await res.text();
        throw new Error('HTTP ' + res.status + '：' + bad.slice(0, 300));
    }
    /* 流式：能读就读，读不出内容就退回一次性读取（最多多发一次请求） */
    if (wantStream && res.body && typeof res.body.getReader === 'function') {
        try {
            const streamed = await readOpenAIStream(res, onDelta, signal);
            if (String(streamed).trim()) return streamed;
        } catch (e) {
            if (signal && signal.aborted) throw new Error('已手动中断');
            /* 流式失败：重新发一次非流式请求，保证功能不因为流式挂掉 */
            delete body.stream;
            const res2 = await fetch(url, {
                method: 'POST',
                headers: apiHeaders(api),
                body: JSON.stringify(body),
                signal
            });
            const raw2 = await res2.text();
            if (!res2.ok) throw new Error('HTTP ' + res2.status + '：' + raw2.slice(0, 300));
            return finishOpenAI(raw2);
        }
        return '';
    }
    const raw = await res.text();
    return finishOpenAI(raw);
}

/* 解析 OpenAI 格式的返回（非流式）。流式拿不到内容时也走这里。 */
function finishOpenAI(raw) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('返回不是 JSON：' + raw.slice(0, 200)); }
    const ch = data && data.choices && data.choices[0];
    const msg = ch ? ch.message : null;
    const finish = String((ch && ch.finish_reason) || (ch && ch.finishReason) || '');
    const usage = (data && data.usage) || {};
    /* 被输出上限截断：内容还会返回，但后面的档案会缺，提示一句 */
    if (finish === 'length') {
        log('⚠️ 输出被截断（用完 ' + (usage.completion_tokens || '?') + ' token 上限），'
            + '后面的档案可能没写完。把「AI 回复上限」调大，或分两批。', 'error');
    }
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
            + '。请到 DNA「设置 → 运行」把「AI 回复上限」调大（建议 10000 以上），'
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

async function callAnthropic(prompt, api, signal, replyMax) {
    const url = openAiEndpoint(api.url, '/messages');
    const mt = replyPower(replyMax, api.maxTokens) || 4000;
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
            + (stop === 'max_tokens' ? '：输出上限用完了，请到 DNA「设置 → 运行」把「AI 回复上限」调大（建议 10000 以上）' : '')
            + '：' + raw.slice(0, 300));
    }
    return out;
}

async function callGemini(prompt, api, signal, replyMax) {
    const base = String(api.url || '').trim().replace(/\/+$/, '');
    let url;
    if (/:(generateContent|streamGenerateContent)$/i.test(base)) {
        url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(api.key);
    } else {
        url = base + (/\/v\d+[a-z]*$/i.test(base) ? '' : '/v1beta') +
            '/models/' + encodeURIComponent(api.model) + ':generateContent?key=' + encodeURIComponent(api.key);
    }
    const gen = { temperature: api.temperature };
    const mtOut = replyPower(replyMax, api.maxTokens);
    if (mtOut > 0) gen.maxOutputTokens = mtOut;
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

async function callAI(prompt, scope, replyMax, onDelta) {
    const api = resolveApi(scope);
    if (!api.url) throw new Error('智绘姬 LLM 页签里还没填 API 地址');
    if (!api.model) throw new Error('智绘姬 LLM 页签里还没选模型');
    const signal = abortSignal();
    if (api.format === 'anthropic') return callAnthropic(prompt, api, signal, replyMax);
    if (api.format === 'gemini') return callGemini(prompt, api, signal, replyMax);
    return callOpenAI(prompt, api, signal, replyMax, onDelta);
}

/* ------------------------------ 中断请求 ------------------------------ */
/* 一次任务（扫描 / 手动生成 / 测试）共用一个 AbortController；
   按钮只在这期间可用，任务结束自动失效。 */
let abortCtl = null;
const ABORT_KEYS = ['abortScan', 'genAbortWorld', 'genAbortChars', 'genAbortMix', 'genAbortText', 'ranobeAbort', 'ranobewbAbort'];

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

async function callSafe(prompt, softPrompt, scope, altPrompt, replyMax, onDelta) {
    abortSignal();          /* 本轮任务的中断控制器，按钮在这一刻才可用 */
    syncAbortBtns();
    try {
        try {
            return await callAI(prompt, scope, replyMax, onDelta);
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
                    return await callAI(p, scope, replyMax, onDelta);
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
    let parts = body.split('·');
    let base = (parts[0] || '').trim() || raw;
    let form = parts.slice(1).join('·').trim();
    /* AI 常把形态写成括号：爱丽丝（魔法少女形态）/ 爱丽丝【兽化】/ 爱丽丝(变身)
       这种也要认成形态，否则会当成一个全新角色单独躺一条，两种外形就分不开了。 */
    if (!form) {
        const bm = body.match(/^(.+?)\s*[（(【\[]\s*(.+?)\s*[）)】\]]$/);
        if (bm) {
            const inner = String(bm[2] || '').trim();
            /* 括号里是「当前/非当前」这类标记就不算形态名 */
            if (inner && !/^(当前|非当前|永久封印)$/.test(inner)) {
                base = String(bm[1] || '').trim() || base;
                form = inner.replace(/形态$/, '').trim();
            }
        }
    }
    return {
        raw,
        base,                       /* 本名：爱丽丝 */
        form,                       /* 形态名：魔法少女（没有形态时为空） */
        tag,                        /* 当前 / 非当前 / 永久封印 / 空 */
        isForm: parts.length > 1 || !!form || !!tag,
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
        if (t.indexOf(base) < 0 && !aliasHit(t, list, currentEntries())) continue;
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

/* ------------------------------ 别称 ------------------------------ */
/* 别称一栏是小名 / 外号 / 昵称的集合，多个用「、」隔开。三处用途：
   ① 写档案时只增不减地并进老档案（AI 这轮没提也不能丢）；
   ② 正文里提到别称也算这个角色出场（发送数据、形态切换都用它判定）；
   ③ 发送 DNA 时别称跟着档案一起发出去，让模型知道「明明」就是「王明」。 */
const ALIAS_FIELD = '别称';
const ALIAS_SEP = '、';

function aliasSplit(v) {
    return String(v == null ? '' : v)
        .split(/[、,，;；\/|｜\n\r\t]+|\s{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
}

/* 老别称在前、新别称在后，去重后拼回一串 */
function aliasMerge(oldVal, newVal) {
    const out = [];
    const push = (a) => { if (a && out.indexOf(a) < 0) out.push(a); };
    aliasSplit(oldVal).forEach(push);
    aliasSplit(newVal).forEach(push);
    return out.join(ALIAS_SEP);
}

/* 正文里有没有提到这一组里某个档案的别称（单字别称太容易误伤，跳过） */
function aliasHit(text, list, entries) {
    const t = String(text || '');
    if (!t || !Array.isArray(list)) return false;
    for (const x of list) {
        const rec = (entries || {})[x.name];
        if (!rec) continue;
        for (const a of aliasSplit(rec[ALIAS_FIELD])) {
            if (a.length >= 2 && t.indexOf(a) >= 0) return true;
        }
    }
    return false;
}

function pickSendRecords(text) {
    const entries = currentEntries();
    const all = false;   /* 发送范围设置已删掉：固定只发正文里被提到的角色（外加勾了「强制发送」的） */
    const t = String(text || '');
    const groups = formGroups();
    const out = [];
    /* 按「本名」分组判断，正文提到本名就算这个角色出场，
       然后只发一个形态：正文点名了某个形态就发那个，否则发 [当前] 那个。
       这样「日常黑发洋装」和「变身后粉发战斗服」不会同时塞给 AI 打架。 */
    for (const [base, list] of groups) {
        /* 勾了强制发送的那几条：不看正文，每次都带上 */
        const forced = list.filter((x) => { const r = entries[x.name]; return !!(r && r._forceSend); });
        if (base.length < 2 && !forced.length) continue;
        const mentioned = all || t.indexOf(base) >= 0 || aliasHit(t, list, entries) || forced.length > 0;
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
        /* 强制发送的形态：就算不是 [当前] 形态、正文也没提到，也一起发出去 */
        for (const x of forced) { if (pick.indexOf(x) < 0) pick.push(x); }
        for (const x of pick) {
            const content = buildContent(entries[x.name]);
            if (content) out.push({ name: x.name, content, form: x.info.form });
        }
    }
    return out;
}

/* 连点正文 → 智绘姬的操作弹窗里点「档案生成」时走到这里：
   只把这一个楼层交给自动记录那套流程（提示词、预设、正则、形态切换全都不变）。
   楼层号拿不到就退回「只记录最近 1 层 AI 回复」。 */
window.__DNA_RECORD_FLOOR__ = function (floor) {
    if (!S.enabled) {
        toast('角色 DNA 已停用，先到「设置」里打开', 'error');
        return false;
    }
    const hasFloor = (typeof floor === 'number' && isFinite(floor) && floor >= 0);
    const run = hasFloor ? runScan({ floor: Math.round(floor) }) : runScan({ depth: 1 });
    Promise.resolve(run).catch((e) => {
        log('档案生成失败：' + ((e && e.message) || e), 'error');
    });
    return true;
};

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

function onSendData(kind, data) {
    try {
        if (!S.enabled || !S.sendEnabled) return;
        if (!data || !Array.isArray(data.prompt) || !data.prompt.length) return;
        if (sendStamp.has(data.prompt)) return;
        const baseText = promptTextOf(data.prompt);
        const baseTokens = estimateTokens(baseText);
        const recs = pickSendRecords(baseText);
        if (!recs.length) return;
        const block = buildSendBlock(recs);
        if (!appendToPrompt(data.prompt, block)) return;
        sendStamp.add(data.prompt);
        const tokens = estimateTokens(block);
        log('发送数据 · ' + (SEND_LABELS[kind] || kind) + '：带上 ' +
            recs.length + ' 份 DNA（' + recs.map((r) => r.name).join('、') + '），'
            + tokens + ' token；请求合计 ' + (baseTokens + tokens) + ' token');
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

/* 只组装（不请求）：正则 → 组装真正要发出去的 messages，摊开看清楚，不发请求不花钱 */
async function onTestAssemble() {
    regexBroken = false;
    const btn = document.querySelector('#dna-tab [data-dna="testAssemble"]');
    const old = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '组装中…'; }
    const scene = snapshotChatu8RegexUI();
    try {
        const src = await testSourceText();
        if (!src.text) { testHint('没有可测试的正文', true); return; }
        const cleaned = S.useRegex ? await regexOnly(src.text) : src.text;
        setTestField('testCleaned', cleaned);
        const origins = cardOrigins();
        const olds = pickOldRecords(cleaned, OLD_RECORD_BUDGET);
        const prompt = buildRecordPrompt(cleaned, { origins, olds });
        setTestField('testPrompt', previewPayload(prompt));
        const msgs = normalizeMessages(prompt);
        const usePreset = presetEnabledOf() && presetEntries().length > 0;
        const from = usePreset ? ('预设「' + activePresetName() + '」') : '插件内置 batchPrompt';
        testHint('组装完成：' + msgs.length + ' 条 / ' + promptChars(prompt) + ' 字（没发请求、不花钱）');
        log('只组装：正文 ' + src.text.length + ' → ' + cleaned.length + ' 字 · ' + from
            + ' · ' + msgs.length + ' 条 / ' + promptChars(prompt) + ' 字（没发请求）');
        openPromptPreview('只组装 · 档案库', prompt,
            '正文来源：' + src.from + ' · ' + from + ' · ' + msgs.length + ' 条消息 / '
            + promptChars(prompt) + ' 字（不发请求、不花钱）');
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        testHint('组装失败：' + msg, true);
        log('只组装失败：' + msg, 'error');
    } finally {
        restoreChatu8RegexUI(scene);
        if (btn) { btn.disabled = false; btn.textContent = old; }
    }
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
        const olds = pickOldRecords(cleaned, OLD_RECORD_BUDGET);
        const prompt = buildRecordPrompt(cleaned, { origins, olds });
        setTestField('testPrompt', previewPayload(prompt));
        const api = resolveApi();
        testHint('正在用 ' + api.source + ' · ' + api.model + ' 请求…');
        liveBegin('lib', '测试请求');
        let reply;
        try {
            reply = await callSafe(prompt, buildRecordPrompt(clipText(cleaned, 400), { origins, olds }),
                undefined, undefined, S.replyMaxTokens, (full) => liveDelta('lib', full));
            liveEnd('lib', reply);
        } catch (e) {
            liveEnd('lib', '', (e && e.message) || e);
            throw e;
        }
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

/* ------------------------------ AI 回复窗口 ------------------------------ */
/* 记录最近一次 AI 的原始返回，供人工核对。只在内存里，刷新页面就没了。 */
const LAST_REPLY = { lib: '', gen: '', ranobe: '' };

/* scope 到实时回复框的映射：lib / gen / ranobe → aiReplyLib / aiReplyGen / aiReplyRanobe */
function replyKey(scope) {
    return (scope === 'gen' || scope === 'ranobe') ? scope : 'lib';
}

function replyField(base, scope) {
    const k = replyKey(scope);
    return base + k.charAt(0).toUpperCase() + k.slice(1);
}

function aiReplyBox(scope) {
    const sel = '#dna-tab [data-dna="' + replyField('aiReply', scope) + '"]';
    const list = document.querySelectorAll(sel);
    if (list && list.length) return list[list.length - 1];
    return document.querySelector(sel);
}

/* 所有同名输入框都写一遍：设置弹窗重建过的话，可能同时存在多份 */
function aiReplyBoxAll(scope) {
    const sel = '#dna-tab [data-dna="' + replyField('aiReply', scope) + '"]';
    const list = document.querySelectorAll(sel);
    if (list && list.length) return Array.prototype.slice.call(list);
    const one = document.querySelector(sel);
    return one ? [one] : [];
}

/* 写内容 + 控制滚动位置。
   atTop=true 时滚回顶部：接收完要让人从第一条档案开始看，
   不能停在 JSON 的尾巴上。 */
function writeAiReply(scope, text, atTop) {
    const val = String(text == null ? '' : text);
    for (const ta of aiReplyBoxAll(scope)) {
        ta.value = val;
        if (atTop) ta.scrollTop = 0;
        else ta.scrollTop = ta.scrollHeight;
    }
}

function setAiReply(scope, text, atTop) {
    const k = replyKey(scope);
    LAST_REPLY[k] = String(text == null ? '' : text);
    writeAiReply(k, LAST_REPLY[k], atTop !== false);
}

/* 状态条：待命 / 请求中 / 接收中 / 完成 / 失败 */
/* 同人资料库和「按世界书生成」两页各放了一个实时框，所以这里取全部同名元素一起写 */
function aiReplyStateEl(scope) {
    return document.querySelectorAll('#dna-tab [data-dna="' + replyField('aiReply', scope) + 'State"]');
}
function aiReplyMetaEl(scope) {
    return document.querySelectorAll('#dna-tab [data-dna="' + replyField('aiReply', scope) + 'Meta"]');
}
function appendAiReplyMeta(scope, extra) {
    if (!extra) return;
    const list = aiReplyMetaEl(scope);
    for (let i = 0; i < list.length; i++) {
        const m = list[i];
        m.textContent = (m.textContent ? m.textContent + ' · ' : '') + extra;
    }
}
function setAiReplyState(scope, state, meta) {
    const list = aiReplyStateEl(scope);
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        b.textContent = state;
        b.classList.remove('dna-badge-live', 'dna-badge-ok', 'dna-badge-err');
        if (state === '请求中…' || state === '接收中…') b.classList.add('dna-badge-live');
        else if (state === '完成') b.classList.add('dna-badge-ok');
        else if (state === '失败') b.classList.add('dna-badge-err');
    }
    const metas = aiReplyMetaEl(scope);
    for (let i = 0; i < metas.length; i++) metas[i].textContent = meta || '';
}

/* 实时接收：一边收一边往 textarea 里写。
   每 80ms 最多刷一次 DOM，避免每个 token 都重排把页面卡死。 */
const LIVE_TICK = { lib: 0, gen: 0, ranobe: 0, timer: {} };
function pushAiReply(scope, fullText) {
    const k = replyKey(scope);
    LAST_REPLY[k] = String(fullText == null ? '' : fullText);
    const now = Date.now();
    const flush = () => {
        writeAiReply(k, LAST_REPLY[k], false);
        LIVE_TICK[k] = Date.now();
    };
    if (now - LIVE_TICK[k] > 80) { flush(); return; }
    if (!LIVE_TICK.timer[k]) {
        LIVE_TICK.timer[k] = setTimeout(() => { LIVE_TICK.timer[k] = 0; flush(); }, 80);
    }
}

/* ------------------------------ 悬浮字幕 ------------------------------ */
/* 挂在 document.body 上，position:fixed 贴在屏幕最上方。
   不受设置弹窗层级 / 裁剪影响，关掉弹窗也还在（酒馆是全屏 WebView）。 */
let dnaBannerEl = null;
let dnaBannerTimer = 0;
let dnaBannerKind = '';

function dnaBannerElEnsure() {
    if (!document.body) return null;
    let el = dnaBannerEl;
    /* 元素被外部清理掉了（面板关闭时有的框架会统一清 DOM），重新造一个 */
    if (!el || !el.parentNode) {
        el = document.querySelector('.dna-banner');
        if (!el || !el.parentNode) {
            el = document.createElement('div');
            el.className = 'dna-banner';
            el.innerHTML = '<i class="fa-solid fa-dna"></i><span class="dna-banner-text"></span>';
        }
        dnaBannerEl = el;
    }
    /* 始终挂在 body 最后一个子节点：这样它在 DOM 顺序上压在最上面，
       而且就算之前被挪到某个会被一起删掉的容器里，也会被拽回来。
       关掉智绘姬面板后 body 还在，字幕就还在。 */
    if (el.parentNode !== document.body) {
        try { document.body.appendChild(el); } catch (e) { /* 忽略 */ }
    }
    return el;
}

/* kind: run（建档中）/ ok（成功）/ err（失败） */
function dnaBanner(text, kind, holdMs) {
    const el = dnaBannerElEnsure();
    if (!el) return;
    dnaBannerKind = kind || 'run';
    const span = el.querySelector('.dna-banner-text');
    if (span) span.textContent = String(text || '');
    el.className = 'dna-banner dna-banner-' + dnaBannerKind + ' dna-banner-show';
    if (dnaBannerTimer) { clearTimeout(dnaBannerTimer); dnaBannerTimer = 0; }
    if (holdMs) {
        dnaBannerTimer = setTimeout(() => {
            dnaBannerTimer = 0;
            if (dnaBannerEl) dnaBannerEl.classList.remove('dna-banner-show');
            dnaBannerKind = '';
        }, holdMs);
    }
}

function dnaBannerHide() {
    if (dnaBannerTimer) { clearTimeout(dnaBannerTimer); dnaBannerTimer = 0; }
    if (dnaBannerEl) dnaBannerEl.classList.remove('dna-banner-show');
    dnaBannerKind = '';
}

/* 一次请求的实时状态机：开始时起表，流式回调推进，结束时收尾 */
const LIVE_RUN = { lib: null, gen: null, ranobe: null };
function liveBegin(scope, what) {
    const k = replyKey(scope);
    LIVE_RUN[k] = { t0: Date.now(), what: what || '', chars: 0 };
    setAiReply(scope, '');
    setAiReplyState(scope, '请求中…', (what ? what + ' · ' : '') + '等待 AI 响应…');
}
function liveDelta(scope, full) {
    const k = replyKey(scope);
    const r = LIVE_RUN[k];
    if (!r) return;
    r.chars = String(full || '').length;
    pushAiReply(scope, full);
    const sec = ((Date.now() - r.t0) / 1000).toFixed(1);
    setAiReplyState(scope, '接收中…', (r.what ? r.what + ' · ' : '') + r.chars + ' 字 · ' + sec + 's');
}
function liveEnd(scope, text, err) {
    const k = replyKey(scope);
    const r = LIVE_RUN[k];
    const sec = r ? ((Date.now() - r.t0) / 1000).toFixed(1) : '?';
    const what = r ? (r.what ? r.what + ' · ' : '') : '';
    LIVE_RUN[k] = null;
    if (LIVE_TICK.timer[k]) { clearTimeout(LIVE_TICK.timer[k]); LIVE_TICK.timer[k] = 0; }
    if (err) {
        /* 失败也别把已经收到的内容清掉：中途断了还能看到 AI 写了什么 */
        if (LAST_REPLY[k]) writeAiReply(k, LAST_REPLY[k], true);
        setAiReplyState(scope, '失败', what + String(err).slice(0, 80)
            + (LAST_REPLY[k] ? ' · 已收到 ' + LAST_REPLY[k].length + ' 字' : ''));
        return;
    }
    /* 接收完滚回顶部：从第一条档案开始看，而不是停在 JSON 尾巴 */
    setAiReply(scope, text, true);
    setAiReplyState(scope, '完成', what + String(text || '').length + ' 字 · 用时 ' + sec + 's');
}

function clearAiReply(scope) {
    const k = replyKey(scope);
    LIVE_RUN[k] = null;
    if (LIVE_TICK.timer[k]) { clearTimeout(LIVE_TICK.timer[k]); LIVE_TICK.timer[k] = 0; }
    setAiReply(scope, '');
    setAiReplyState(scope, '待命', '');
}

async function copyAiReply(scope) {
    const txt = LAST_REPLY[replyKey(scope)];
    if (!txt) { toast('还没有内容'); return; }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(txt);
        } else {
            const ta = aiReplyBox(scope);
            if (ta) { ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly', 'readonly'); }
        }
        toast('已复制 ' + txt.length + ' 字');
    } catch (e) {
        toast('复制失败，手动选中吧', 'error');
    }
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
    /* floor：只记录指定的那一层（连点正文 → 「档案生成」用），不传就还是扫最近 N 层 */
    const onlyFloor = Number.isInteger(opts.floor) ? opts.floor : null;
    setBusy(true);
    dnaBanner('DNA建档中', 'run');

    try {
        const bag = await collectChatText(depth, onlyFloor);
        if (!bag.count) {
            log(onlyFloor != null
                ? ('第 ' + onlyFloor + ' 层没有可用的 AI 正文（这一层可能是玩家输入或空的），换个楼层再试')
                : ('最近 ' + depth + ' 层里没有 AI 输出的正文可扫'));
            return;
        }
        if (onlyFloor != null) log('只记录第 ' + bag.from + ' 层（' + bag.text.length + ' 字）');
        else log('扫描第 ' + bag.from + '-' + bag.to + ' 层，取到 ' + bag.count + ' 层 AI 回复 / ' + bag.text.length + ' 字');
        if (bag.skipped) log('跳过 ' + bag.skipped + ' 层玩家输入（只收 AI 楼层）');
        if (S.useRegex) {
            log('已过智绘姬正则「' + (regexProfileName() || '未选') + '」：' + bag.before + ' 字 → ' + bag.after + ' 字');
        } else {
            log('正则处理已关闭，直接发原文');
        }
        log('档案库：' + cardLabel());

        const origins = cardOrigins();
        if (origins.length) log('带上角色卡设定作为人物底子（' + origins[0].content.length + ' 字）');

        /* 关掉「AI自动更新档案库」时不用带旧档案——反正也不会更新，白发几万字 */
        const olds = S.updateExisting ? pickOldRecords(bag.text, OLD_RECORD_BUDGET) : [];
        if (olds.length) {
            const full = olds.filter((o) => !o.dropped && !o.name.includes('其它形态'));
            const dropOne = olds.find((o) => o.dropped);
            log('已记录过 ' + full.length + ' 个出场角色，会一起提交做增量更新'
                + (dropOne ? ('；另有 ' + dropOne.dropped.length + ' 个档案太长没装下（已要求 AI 不要编造）') : ''));
        } else if (!S.updateExisting) {
            log('「AI自动更新档案库」是关的，这次不带旧档案');
        }

        const usePreset = S.presetEnabled && presetEntries().length > 0;
        log('提示词：' + (usePreset ? '上下文预设「' + activePresetName() + '」' : '插件内置 batchPrompt'));
        log('提交 AI（本轮只调用一次）……');
        const api = resolveApi();
        log('使用 ' + api.source + ' · ' + api.model);
        logBreakthrough();
        const prompt = buildRecordPrompt(bag.text, { origins, olds });
        log('提示词共 ' + promptChars(prompt) + ' 字 / 约 ' + estimateTokens(promptTextOf(prompt)) + ' token / '
            + normalizeMessages(prompt).length + ' 条');
        /* 重试由「自动重试次数」统一管：第 1 次用精简正文，第 2 次换成内置提示词 */
        liveBegin('lib', '自动记录');
        let raw;
        try {
            raw = await callSafe(
                prompt,
                buildRecordPrompt(clipText(bag.text, 400), { origins, olds }),
                undefined,
                usePreset ? batchPrompt(bag.text, { origins, olds }) : undefined,
                S.replyMaxTokens,
                (full) => liveDelta('lib', full)
            );
            liveEnd('lib', raw);
        } catch (e) {
            liveEnd('lib', '', (e && e.message) || e);
            throw e;
        }
        const list = parseProfileList(raw);
        if (!list) {
            appendAiReplyMeta('lib', '解析失败，看原文');
            log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error');
            log('原始返回已留在「AI 回复（实时）」窗口里', 'error');
            return;
        }
        appendAiReplyMeta('lib', list.length + ' 份档案');
        log('AI 返回 ' + list.length + ' 份档案');

        let created = 0, updated = 0, skipped = 0, locked = 0, failed = 0;
        const done = Object.create(null);
        const floorTag = (onlyFloor != null) ? String(bag.from) : (bag.from + '-' + bag.to);
        for (const item of list) {
            const prof = normalizeProfile(item, item && item['姓名']);
            if (!prof || !String(prof['姓名'] || '').trim()) { failed++; continue; }
            const nm = String(prof['姓名']).trim();
            if (done[nm]) continue;
            done[nm] = 1;
            try {
                const res = saveProfile(prof, floorTag);
                if (res.split) log('「' + nm + '」一条里写了多种形态，自动拆成 ' + res.results.length + ' 条档案');
                for (const one of res.results) {
                    if (one.r === 'created') { created++; log('新建「' + one.name + '」'); }
                    else if (one.r === 'updated') { updated++; log('更新「' + one.name + '」'); }
                    else if (one.r === 'locked') { locked++; log('「' + one.name + '」已锁定，AI 不改它'); }
                    else { skipped++; log('「' + one.name + '」已存在，按设置跳过'); }
                }
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
        dnaBanner('建档成功', 'ok', 2600);
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (/已手动中断/.test(msg)) {
            log('本轮已手动中断，没写任何档案');
            if (!opts.auto) toast('已中断这一轮');
            dnaBanner('已中断', 'err', 2400);
        } else {
            log('扫描中断：' + msg, 'error');
            if (!opts.auto) toast('扫描失败：' + msg, 'error');
            dnaBanner('建档失败', 'err', 3600);
        }
    } finally {
        setBusy(false);
        syncAbortBtns();
        /* 早退（没正文 / 上一轮还在跑）时没走成功也没走失败，把字幕收掉 */
        if (dnaBannerKind === 'run') dnaBannerHide();
    }
}

/* ------------------------------ 面板 UI ------------------------------ */
/* ------------------------------ 同人资料库 / 按世界书：界面与操作 ------------------------------ */
/* 两页共用一套逻辑，tag 只是外壳：'ranobe' = 内置同人库，'wblib' = 当前角色卡世界书。
   内置本体是静态文件（只进内存），用户改动（改名/新增/删除/勾选/额外要求）才进 settings。 */
const LIB_LABEL = { ranobe: '同人资料库', ranobewb: '世界书生成' };
const LIB_CACHE = { ranobe: [], wb: [] };   // 合并后的完整列表（渲染与生成共用）
const LIB_RENDER_MAX = 60;                  // 一次最多渲染多少行（1000+ 条全渲染手机会卡）

function libScopeOf(tag) {
    return (tag === 'wblib' || tag === 'ranobewb') ? 'wb' : 'ranobe';
}

function libEl(tag, base) {
    return document.querySelector('#dna-tab [data-dna="' + tag + base + '"]');
}

function libSetText(tag, base, text) {
    const el = libEl(tag, base);
    if (el) el.textContent = text;
}

function libSetVal(tag, base, v) {
    const el = libEl(tag, base);
    if (el) el.value = v;
}

function libGetVal(tag, base) {
    const el = libEl(tag, base);
    return el ? String(el.value == null ? '' : el.value) : '';
}

/* 搜索：名字 / 全名 / 作品 / 标签 / 生图前缀 / 别名 里任意一处命中即算 */
function libHit(e, q) {
    if (!q) return true;
    const bag = [e.n, e.c, e.w, e.t, e.p, e.d, (e.a || []).join(' '), String(e.x || '').slice(0, 160)];
    return bag.some((v) => String(v == null ? '' : v).toLowerCase().indexOf(q) >= 0);
}

async function renderLib(tag) {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const scope = libScopeOf(tag);
    const st = libState(scope);
    const listBox = libEl(tag, 'List');
    if (listBox && !LIB_CACHE[scope].length) listBox.innerHTML = '<div class="dna-empty">读取中…</div>';
    const all = await libAll(scope);
    LIB_CACHE[scope] = all;
    const q = String(st.q || '').trim().toLowerCase();
    const hit = q ? all.filter((e) => libHit(e, q)) : all;
    const sel = new Set(st.sel || []);
    libSetText(tag, 'Count', q ? (hit.length + ' / ' + all.length) : String(all.length));
    const picked = all.filter((e) => sel.has(e.k)).length;
    const mine = (st.added || []).length;
    libSetText(tag, 'Meta', '共 ' + all.length + ' 条 · 已勾选 ' + picked + (mine ? (' · 自己新增 ' + mine) : ''));
    if (scope === 'wb') {
        libSetText(tag, 'Source', '数据源：' + (WB_LIB_BOOK || '还没读到世界书'));
    }
    /* 世界书那两块共用同一份搜索词，渲染时把输入框同步过来 */
    const qEl = libEl(tag, 'Search');
    if (qEl && document.activeElement !== qEl) qEl.value = String(st.q || '');
    if (!listBox) return;
    if (!hit.length) {
        listBox.innerHTML = '<div class="dna-empty">' + (q ? '没有匹配的条目。' : '这里还没有条目。') + '</div>';
        return;
    }
    const shown = hit.slice(0, LIB_RENDER_MAX);
    listBox.innerHTML = shown.map((e) => {
        const on = sel.has(e.k);
        const alias = (e.a || []).slice(0, 4).join('、');
        const tagline = [e.w, e.t].filter(Boolean).join(' · ');
        return '<div class="dna-lib-row' + (on ? ' is-on' : '') + '">'
            + '<label class="dna-lib-check"><input type="checkbox" data-libsel="' + esc(e.k) + '"' + (on ? ' checked' : '') + '></label>'
            + '<div class="dna-lib-main">'
            + '<div class="dna-lib-name">' + esc(e.n || '（没名字）') + '</div>'
            + (alias ? '<div class="dna-lib-meta">' + esc(alias) + '</div>' : '')
            + (tagline ? '<div class="dna-lib-meta">' + esc(tagline) + '</div>' : '')
            + '</div>'
            + '<button class="dna-mini" data-libedit="' + esc(e.k) + '">编辑</button>'
            + '</div>';
    }).join('')
    + (hit.length > shown.length
        ? ('<div class="dna-empty">还有 ' + (hit.length - shown.length) + ' 条没显示，用上面的搜索缩小范围。</div>')
        : '');
}

function libPicked(tag) {
    const scope = libScopeOf(tag);
    const sel = new Set(libState(scope).sel || []);
    return (LIB_CACHE[scope] || []).filter((e) => sel.has(e.k));
}

function libSaveSel(tag, keys) {
    const st = libState(libScopeOf(tag));
    st.sel = keys.filter((k) => typeof k === 'string' && k);
    saveSettings(true);
    renderLib(tag);
}

/* 一条条目的编辑弹窗：内置条目改的是「覆盖层」，自己加的改 added 里那条 */
function openLibEntry(tag, k, isNew) {
    const scope = libScopeOf(tag);
    const st = libState(scope);
    const all = LIB_CACHE[scope] || [];
    const cur = isNew ? null : (all.find((e) => e.k === k) || null);
    if (!isNew && !cur) { toast('这条已经不在列表里了，刷新一下再试', 'error'); return; }
    const v = cur || { k: '', n: '', a: [], c: '', w: '', t: '', p: '', d: '', x: '' };
    const row = (label, field, ph, rows) => '<div class="st-chatu8-field-col"><label>' + label + '</label>'
        + (rows
            ? '<textarea class="st-chatu8-textarea" data-libf="' + field + '" rows="' + rows + '" placeholder="' + esc(ph) + '">' + esc(String(v[field] == null ? '' : (Array.isArray(v[field]) ? v[field].join('、') : v[field]))) + '</textarea>'
            : '<input type="text" class="st-chatu8-text-input" data-libf="' + field + '" placeholder="' + esc(ph) + '" value="' + esc(String(v[field] == null ? '' : v[field])) + '">')
        + '</div>';
    const body = row('名字（必填）', 'n', '例：来生泪', 0)
        + row('别名（多个用、隔开）', 'a', '例：来生淚、Rui Kisugi', 0)
        + row('全名 / 标识', 'c', '例：C001｜来生泪｜kisugi_rui', 0)
        + row('作品', 'w', '例：cats_eye', 0)
        + row('角色 tag', 't', '例：kisugi_rui', 0)
        + row('生图前缀', 'p', '例：kisugi_rui,cats_eye,long_hair', 0)
        + row('默认服装', 'd', '例：none', 0)
        + row('资料正文（生成 DNA 时喂给 AI 的内容，最重要）', 'x', '把这个人物的设定写在这里；也可以留空，只用上面的字段', 10)
        + '<div class="st-chatu8-edit-buttons dna-modal-foot">'
        + (isNew ? '' : '<button type="button" class="st-chatu8-edit-button cancel" data-libdel="' + esc(k) + '">删除这条</button>')
        + '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>'
        + '<button type="button" class="st-chatu8-edit-button send" data-libsav="1">保存</button>'
        + '</div>';
    dnaModalOpen(isNew ? ('新增' + LIB_LABEL[tag] + '条目') : ('编辑：' + (cur.n || k)), body);
    const mask = dnaModalMask;
    if (!mask) return;
    const cancelBtn = mask.querySelector('[data-modal-cancel]');
    if (cancelBtn) cancelBtn.addEventListener('click', () => dnaModalClose());
    const save = mask.querySelector('[data-libsav]');
    if (save) {
        save.addEventListener('click', () => {
            const get = (f) => {
                const el = mask.querySelector('[data-libf="' + f + '"]');
                return el ? String(el.value == null ? '' : el.value) : '';
            };
            const n = get('n').trim();
            if (!n) { toast('名字不能空', 'error'); return; }
            const aRaw = get('a').trim();
            const item = {
                k: isNew ? ('u:' + Date.now().toString(36)) : k,
                n,
                a: aRaw ? aRaw.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [],
                c: get('c').trim(),
                w: get('w').trim(),
                t: get('t').trim(),
                p: get('p').trim(),
                d: get('d').trim(),
                x: get('x')
            };
            const isCustom = String(item.k).indexOf('u:') === 0;
            if (isCustom) {
                const i = (st.added || []).findIndex((e) => e.k === item.k);
                if (i >= 0) st.added[i] = item; else st.added.push(item);
            } else {
                st.edits[item.k] = item;
            }
            if ((st.deleted || []).indexOf(item.k) >= 0) st.deleted = st.deleted.filter((x) => x !== item.k);
            st.sel = (st.sel || []).indexOf(item.k) >= 0 ? st.sel : (st.sel || []).concat([item.k]);
            saveSettings(true);
            dnaModalClose();
            log(LIB_LABEL[tag] + '：已保存条目「' + n + '」');
            toast('已保存「' + n + '」');
            renderLib(tag);
        });
    }
    const del = mask.querySelector('[data-libdel]');
    if (del) {
        del.addEventListener('click', () => {
            const which = del.getAttribute('data-libdel');
            if (!which) return;
            if (!confirm('删除「' + (cur.n || which) + '」？内置条目删掉后可以点「恢复内置」找回来。')) return;
            const isCustom = String(which).indexOf('u:') === 0;
            if (isCustom) st.added = (st.added || []).filter((e) => e.k !== which);
            else { delete st.edits[which]; st.deleted = (st.deleted || []).concat([which]); }
            st.sel = (st.sel || []).filter((x) => x !== which);
            saveSettings(true);
            dnaModalClose();
            log(LIB_LABEL[tag] + '：已删除条目「' + (cur.n || which) + '」');
            renderLib(tag);
        });
    }
}

function onLibExport(tag) {
    const scope = libScopeOf(tag);
    const all = LIB_CACHE[scope] || [];
    if (!all.length) { toast('还没有条目', 'error'); return; }
    const st = libState(scope);
    const data = {
        type: 'st-chatu8-dna-ranobe',
        name: LIB_LABEL[tag] + (tag === 'wblib' ? '（' + (WB_LIB_BOOK || '世界书') + '）' : ''),
        source: 'user',
        count: all.length,
        exportedAt: new Date().toISOString(),
        chars: all
    };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '同人资料库_' + (data.name || '').replace(/[\\/:*?"<>|]/g, '_') + '_' + all.length + '条.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    log(LIB_LABEL[tag] + '：已导出 ' + all.length + ' 条');
    toast('已导出 ' + all.length + ' 条');
}

async function onLibImportFile(tag, file) {
    if (!file) return;
    const scope = libScopeOf(tag);
    const st = libState(scope);
    try {
        const txt = await file.text();
        const data = JSON.parse(txt);
        const arr = Array.isArray(data) ? data : (Array.isArray(data.chars) ? data.chars : (Array.isArray(data.entries) ? data.entries : []));
        if (!arr.length) { toast('这个文件里没找到条目（要 chars 或数组）', 'error'); return; }
        const stamp = Date.now().toString(36);
        let n = 0;
        arr.forEach((raw, i) => {
            const e = normLibEntry(raw);
            if (!e.n) return;
            e.k = 'u:' + stamp + i;
            st.added.push(e);
            n++;
        });
        saveSettings(true);
        log(LIB_LABEL[tag] + '：导入 ' + n + ' 条（来自 ' + file.name + '）');
        toast('已导入 ' + n + ' 条');
        await renderLib(tag);
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        log(LIB_LABEL[tag] + '：导入失败 ' + msg, 'error');
        toast('导入失败：' + msg, 'error');
    }
}

async function onLibReset(tag) {
    const scope = libScopeOf(tag);
    const st = libState(scope);
    const mine = (st.added || []).length + Object.keys(st.edits || {}).length + (st.deleted || []).length;
    if (!confirm(mine
        ? ('把 ' + mine + ' 处改动全部清掉，回到' + (tag === 'wblib' ? '当前角色卡的世界书' : '插件自带的同人库') + '？')
        : ('重新载入' + (tag === 'wblib' ? '当前角色卡的世界书' : '插件自带的同人库') + '？'))) return;
    st.edits = {};
    st.added = [];
    st.deleted = [];
    st.sel = [];
    if (libScopeOf(tag) === 'wb') await loadWbLibSource(true);
    else await loadRanobeBuiltin(true);
    saveSettings(true);
    log(LIB_LABEL[tag] + '：已恢复内置');
    toast('已恢复内置');
    await renderLib(tag);
}

async function onLibReload(tag) {
    if (libScopeOf(tag) === 'wb') await loadWbLibSource(true);
    else await loadRanobeBuiltin(true);
    await renderLib(tag);
    toast('已重新读取');
}

/* 把勾选条目拼成给 AI 的资料正文 */
function buildLibText(tag) {
    const scope = libScopeOf(tag);
    const picked = libPicked(tag);
    if (!picked.length) return '';
    const parts = [];
    if (scope === 'wb') {
        parts.push('【世界书资料】');
        for (const e of picked) parts.push('—— ' + (e.n || '') + ' ——\n' + (e.x || ''));
        parts.push('',
            '请为上面这些条目里出现的每一个具体人物各出一份 DNA 档案，一个都不许漏（泛称群体、地名、组织名不算人物）。',
            '资料里没写到的字段，按这个世界观合理补全，不要留空、不要写“未知”。',
            '不要因为戏份少或只是配角就跳过某个具体人物，也不要额外编造条目里没有的人物——收录范围由用户勾选决定。');
    } else {
        parts.push('【同人资料库条目】');
        for (const e of picked) {
            const head = [
                e.n ? ('NAME=' + e.n) : '',
                (e.a && e.a.length) ? ('ALIASES=' + e.a.join(',')) : '',
                e.c ? ('FULL=' + e.c) : '',
                e.w ? ('WORK=' + e.w) : '',
                e.t ? ('TAG=' + e.t) : '',
                e.p ? ('PROMPT=' + e.p) : '',
                e.d ? ('WARDROBE=' + e.d) : ''
            ].filter(Boolean).join('\n');
            parts.push('—— 条目 ' + (e.k || '') + ' ——\n' + head + (e.x ? ('\n' + e.x) : ''));
        }
        parts.push('',
            '请为上面这些同人条目里提到的每一个具体人物各出一份 DNA 档案，一个都不许漏（泛称群体、作品名、组织名不算人物）。',
            '资料里没写到的字段，按角色在原作里的设定与气质合理补全，不要留空、不要写“未知”。',
            '不要额外编造资料里没有的人物——收录范围由用户勾选决定。');
    }
    const extra = String(libState(scope).req || '').trim();
    if (extra) parts.push('', '【额外要求】', extra);
    return parts.join('\n');
}

function buildLibPrompt(tag) {
    const scope = libScopeOf(tag);
    const picked = libPicked(tag);
    const text = buildLibText(tag);
    /* 同人库把条目的身份信息当「角色底子」一起给模型；世界书那页只靠条目正文 */
    const origins = scope === 'wb' ? [] : picked.map((e) => ({
        name: e.n,
        content: [e.c, e.w ? ('作品：' + e.w) : '', e.t ? ('角色 tag：' + e.t) : '', e.p ? ('生图前缀：' + e.p) : '', e.d ? ('默认服装：' + e.d) : '']
            .filter(Boolean).join('\n')
    })).filter((o) => o.content);
    const olds = S.updateExisting ? pickOldRecords(picked.map((e) => e.n).join(' '), OLD_RECORD_BUDGET) : [];
    return { picked, text, origins, olds, prompt: buildRecordPrompt(text, { origins, olds }, 'ranobe') };
}

/* 预览弹窗：把真正要发出去的 messages 一条条摊开 */
function openPromptPreview(title, prompt, info) {
    const msgs = normalizeMessages(prompt);
    const body = '<div class="dna-hint dna-hint-inline">' + esc(info || '') + '</div>'
        + msgs.map((m) => '<div class="st-chatu8-field-col"><label>'
            + esc(m.role) + ' · ' + m.content.length + ' 字</label>'
            + '<textarea class="st-chatu8-textarea dna-mono" rows="10" readonly>' + esc(m.content) + '</textarea></div>').join('')
        + '<div class="st-chatu8-edit-buttons dna-modal-foot">'
        + '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>关闭</button></div>';
    const mask = dnaModalOpen(title, body);
    const close = mask ? mask.querySelector('[data-modal-cancel]') : null;
    if (close) close.addEventListener('click', () => dnaModalClose());
}

/* 同人库 / 世界书：生成 DNA（写进档案库） */
async function onLibDna(tag) {
    const scope = libScopeOf(tag);
    const label = LIB_LABEL[tag];
    if (scanning) { toast('上一轮还在跑，等它跑完'); return; }
    if (!S.enabled) { toast('插件已停用，先打开「设置」里的启用插件'); return; }
    const picked = libPicked(tag);
    if (!picked.length) { toast('先在列表里勾至少一条', 'error'); return; }
    const g = buildLibPrompt(tag);
    const ptok = estimateTokens(promptTextOf(g.prompt));
    if (ptok > 30000 && !confirm('这次提示词约 ' + ptok + ' token，接近或超过常见模型的上下文长度。\n\n建议少勾几条再试。确定继续吗？')) return;
    setBusy(true, '生成中…');
    dnaBanner('DNA建档中', 'run');
    let created = 0, updated = 0, skipped = 0, locked = 0, failed = 0;
    let firstName = '';
    try {
        const api = resolveApi('ranobe');
        const usePreset = presetEnabledOf('ranobe') && presetEntries(undefined, 'ranobe').length > 0;
        log(label + '：勾选 ' + picked.length + ' 条 / 资料 ' + g.text.length + ' 字');
        log('使用 ' + api.source + ' · ' + api.model + '（' + label + '）');
        logBreakthrough();
        log('提示词：' + (usePreset ? '同人库预设「' + activePresetName('ranobe') + '」' : '插件内置 batchPrompt')
            + ' · ' + promptChars(g.prompt) + ' 字 / ' + normalizeMessages(g.prompt).length + ' 条');
        liveBegin('ranobe', label);
        let raw;
        try {
            raw = await callSafe(
                g.prompt,
                buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'ranobe'),
                'ranobe',
                usePreset ? batchPrompt(g.text, { origins: g.origins, olds: g.olds }) : undefined,
                S.replyMaxTokens,
                (full) => liveDelta('ranobe', full)
            );
            liveEnd('ranobe', raw);
        } catch (e) {
            liveEnd('ranobe', '', (e && e.message) || e);
            throw e;
        }
        const list = parseProfileList(raw);
        if (!list) {
            appendAiReplyMeta('ranobe', '解析失败，看原文');
            log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error');
            toast('返回解析不了，看「AI 回复（实时）」', 'error');
            return;
        }
        appendAiReplyMeta('ranobe', list.length + ' 份档案');
        log('AI 返回 ' + list.length + ' 份档案');
        const done = Object.create(null);
        for (const item of list) {
            const prof = normalizeProfile(item, item && item['姓名']);
            if (!prof || !String(prof['姓名'] || '').trim()) { failed++; continue; }
            const nm = String(prof['姓名']).trim();
            if (done[nm]) continue;
            done[nm] = 1;
            try {
                const res = saveProfile(prof, label);
                if (res.split) log('「' + nm + '」一条里写了多种形态，自动拆成 ' + res.results.length + ' 条档案');
                for (const one of res.results) {
                    if (one.r === 'created') { created++; log('新建「' + one.name + '」'); if (!firstName) firstName = one.name; }
                    else if (one.r === 'updated') { updated++; log('更新「' + one.name + '」'); if (!firstName) firstName = one.name; }
                    else if (one.r === 'locked') { locked++; log('「' + one.name + '」已锁定，AI 不改它'); }
                    else { skipped++; log('跳过「' + one.name + '」（已建档，且没开「AI自动更新档案库」）'); }
                }
            } catch (e) {
                failed++;
                log('「' + nm + '」写入失败：' + (e && e.message ? e.message : e), 'error');
            }
        }
        log(label + '完成：新建 ' + created + ' · 更新 ' + updated + ' · 跳过 ' + skipped
            + (locked ? (' · 锁定跳过 ' + locked) : '') + ' · 失败 ' + failed);
        toast('生成完成：新建 ' + created + ' / 更新 ' + updated + (locked ? (' / 锁定跳过 ' + locked) : ''));
        renderList();
        if (created + updated > 0 && firstName) { selected = firstName; renderList(); }
        if (created + updated > 0) dnaBanner('建档成功', 'ok', 2600);
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (/已手动中断/.test(msg)) {
            log(label + '已中断' + ((created + updated) ? ('：已经建档 ' + (created + updated) + ' 条，保留不动') : '，没写任何档案'));
            toast('已中断这次生成');
            dnaBanner('已中断', 'err', 2400);
        } else {
            log(label + '失败：' + msg, 'error');
            toast('生成失败：' + msg, 'error');
            dnaBanner('建档失败', 'err', 3600);
        }
    } finally {
        setBusy(false);
        syncAbortBtns();
        if (dnaBannerKind === 'run') dnaBannerHide();
    }
}

/* 同人资料库：把当前角色卡世界书里的条目挑进来，变成这份库的条目
   （挑进来之后就是普通条目：能搜索、能逐条编辑、能勾选生成） */
async function onRanobeFromWb() {
    const btn = libEl('ranobe', 'FromWb');
    if (btn) btn.disabled = true;
    try {
        const list = await loadWbLibSource(true);
        if (!list.length) {
            toast('读不到当前角色卡的世界书：先在「世界书生成」里确认能读到条目', 'error');
            return;
        }
        const st = libState('ranobe');
        const have = new Set((st.added || []).map((e) => String(e.n || '')));
        const rows = list.map((e) => {
            const already = have.has(String(e.n || ''));
            return '<label class="dna-wb-pick"><input type="checkbox" data-wbpick="' + esc(e.k) + '">'
                + '<span class="dna-wb-pick-main">'
                + '<span class="dna-wb-pick-name">' + esc(e.n) + (already ? ' <span class="dna-wb-pick-tag">已在库中</span>' : '') + '</span>'
                + '<span class="dna-wb-pick-meta">' + esc(String(e.x || '').replace(/\s+/g, ' ').slice(0, 60)) + '</span>'
                + '</span></label>';
        }).join('');
        const body = '<div class="dna-hint dna-hint-inline">世界书：' + esc(WB_LIB_BOOK || '未读到') + ' · 共 ' + list.length
            + ' 条。挑进来的条目会成为同人库的条目，之后可以再编辑、再勾选生成。</div>'
            + '<div class="st-chatu8-field"><label>搜索</label>'
            + '<input type="text" class="st-chatu8-text-input" data-wbq placeholder="标题 / 内容关键词"></div>'
            + '<div class="dna-wb-pick-list" data-wbpicklist>' + rows + '</div>'
            + '<div class="st-chatu8-edit-buttons dna-modal-foot">'
            + '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>'
            + '<button type="button" class="st-chatu8-edit-button send" data-wbok>加入到同人库</button>'
            + '</div>';
        dnaModalOpen('从当前角色卡世界书添加条目', body);
        const mask = dnaModalMask;
        if (!mask) return;
        const box = mask.querySelector('[data-wbpicklist]');
        const q0 = mask.querySelector('[data-wbq]');
        const filter = () => {
            const q = String((q0 && q0.value) || '').trim().toLowerCase();
            const rowsNow = Array.from(box.querySelectorAll('.dna-wb-pick'));
            for (let i = 0; i < rowsNow.length; i++) {
                const txt = String(rowsNow[i].textContent || '').toLowerCase();
                rowsNow[i].style.display = (!q || txt.indexOf(q) >= 0) ? '' : 'none';
            }
        };
        if (q0) q0.addEventListener('input', filter);
        const cancel = mask.querySelector('[data-modal-cancel]');
        if (cancel) cancel.addEventListener('click', () => dnaModalClose());
        const ok = mask.querySelector('[data-wbok]');
        if (ok) {
            ok.addEventListener('click', () => {
                const stamp = Date.now().toString(36);
                let added = 0;
                const picks = Array.from(box.querySelectorAll('[data-wbpick]')).filter((cb) => cb.checked);
                for (let i = 0; i < picks.length; i++) {
                    const key = picks[i].getAttribute('data-wbpick');
                    const src = list.find((e) => e.k === key);
                    if (!src) continue;
                    if ((st.added || []).some((x) => String(x.n || '') === String(src.n || ''))) continue;
                    st.added.push({
                        k: 'w:' + stamp + i,
                        n: src.n,
                        a: [],
                        c: src.n,
                        w: WB_LIB_BOOK || '',
                        t: '',
                        p: '',
                        d: '',
                        x: src.x
                    });
                    added++;
                }
                if (!added) { toast('没有新条目要加（选中的都已经在同人库里）'); dnaModalClose(); return; }
                saveSettings(true);
                log('同人资料库：从世界书加入 ' + added + ' 条');
                toast('已加入 ' + added + ' 条');
                dnaModalClose();
                renderLib('ranobe');
            });
        }
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        log('从世界书添加条目失败：' + msg, 'error');
        toast('读取世界书失败：' + msg, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* 测试工具：只组装（不请求）/ 组装 + 发一次测试请求（结果只显示，不写档案） */
function libPromptDump(prompt) {
    return normalizeMessages(prompt).map((m) => '==== ' + m.role + ' · ' + m.content.length + ' 字 ====\n' + m.content).join('\n\n');
}

async function onLibTest(tag, send) {
    const label = LIB_LABEL[tag];
    const out = libEl(tag, 'TestPrompt');
    const res = libEl(tag, 'TestResult');
    if (!libPicked(tag).length) { toast('先在列表里勾至少一条', 'error'); return; }
    if (!send) {
        const g = buildLibPrompt(tag);
        if (out) out.value = libPromptDump(g.prompt) + '\n\n==== 资料正文 · ' + g.text.length + ' 字 ====\n' + g.text;
        toast('已组装：' + normalizeMessages(g.prompt).length + ' 条消息，' + promptChars(g.prompt) + ' 字（没发请求）');
        return;
    }
    if (scanning) { toast('上一轮还在跑，等它跑完'); return; }
    const btn = libEl(tag, 'TestLLM');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = '请求中…'; }
    if (res) res.value = '正在请求……';
    try {
        const g = buildLibPrompt(tag);
        if (out) out.value = libPromptDump(g.prompt);
        const api = resolveApi('ranobe');
        log(label + '测试请求：' + api.model + ' · ' + promptChars(g.prompt) + ' 字');
        liveBegin('ranobe', label + ' · 测试');
        let reply;
        try {
            reply = await callSafe(g.prompt,
                buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'ranobe'),
                'ranobe', undefined, S.replyMaxTokens, (full) => liveDelta('ranobe', full));
            liveEnd('ranobe', reply);
        } catch (e) {
            liveEnd('ranobe', '', (e && e.message) || e);
            throw e;
        }
        if (res) res.value = reply;
        toast('测试完成：回复 ' + reply.length + ' 字（没写档案）');
        log(label + '测试完成：回复 ' + reply.length + ' 字（没写进档案库）');
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (res) res.value = '失败：' + msg;
        log(label + '测试失败：' + msg, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
}

/* 生成两个新页签的 HTML（同人资料库 / 按世界书生成），结构一样只有标题与数据源不同 */
/* LLM 配置 / 上下文预设这两个卡片：手动生成与同人库各一份，结构完全一样，只是控件前缀（scope）不同。
   档案库那一份是静态写在 PANEL_HTML 里的，这里生成的 gen / ranobe 版与它保持同一套类名与排版。 */
function profileCardHtml(scope) {
    const k = (b) => 'data-dna="' + dkey(scope, b) + '"';
    const fold = scope + 'LLM';
    return [
        '    <div class="st-chatu8-settings-section dna-fold" data-fold="' + fold + '">',
        '      <div class="dna-fold-head">',
        '        <h3><i class="fa-solid fa-microchip"></i> LLM 配置</h3>',
        '        <button type="button" class="dna-fold-btn" data-fold-btn="' + fold + '" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>',
        '      </div>',
        '      <div class="st-chatu8-field">',
        '        <label>使用哪份配置</label>',
        '        <select class="st-chatu8-select" ' + k('profileSelect') + '></select>',
        '      </div>',
        '      <div class="dna-actions">',
        '        <button class="st-chatu8-btn" ' + k('gotoLLM') + '><i class="fa-solid fa-arrow-right-to-bracket"></i>去 LLM 页签编辑</button>',
        '      </div>',
        '      <div class="dna-kv" ' + k('configDetail') + '></div>',
        '    </div>'
    ].join('\n');
}

function presetCardHtml(scope, cfg) {
    const C = cfg || {};
    const k = (b) => 'data-dna="' + dkey(scope, b) + '"';
    const fold = C.fold || (scope + 'Preset');
    const boxTitle = C.boxTitle || '预设操作';
    return [
        '    <div class="st-chatu8-settings-section dna-fold" data-fold="' + fold + '">',
        '      <div class="dna-fold-head">',
        '        <h3><i class="fa-solid fa-layer-group"></i> 上下文预设</h3>',
        '        <button type="button" class="dna-fold-btn" data-fold-btn="' + fold + '" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>',
        '      </div>',
        '      <div class="dna-status-row">',
        '        <span class="dna-badge" ' + k('presetLabel') + '>未导入</span>',
        '      </div>',
        '      <div class="st-chatu8-field">',
        '        <label>用这份预设组装提示词</label>',
        '        <div class="st-chatu8-toggle"><input type="checkbox" ' + k('presetEnabled') + '><span class="st-chatu8-slider"></span></div>',
        '      </div>',
        '      <div class="st-chatu8-field">',
        '        <label>把 system 消息合并到开头一条</label>',
        '        <div class="st-chatu8-toggle"><input type="checkbox" ' + k('presetMergeSystem') + '><span class="st-chatu8-slider"></span></div>',
        '      </div>',
        '      <div class="st-chatu8-field">',
        '        <label>当前预设</label>',
        '        <div class="st-chatu8-profile-controls">',
        '          <select class="st-chatu8-select" ' + k('presetSelect') + '></select>',
        '          <div class="st-chatu8-preset-box-wrapper">',
        '            <button type="button" class="st-chatu8-icon-btn st-chatu8-preset-box-btn" title="预设操作收纳盒"><i class="fa-solid fa-table-cells"></i></button>',
        '            <div class="st-chatu8-preset-box-dropdown">',
        '              <div class="st-chatu8-preset-box-header">',
        '                <span class="st-chatu8-preset-box-title"><i class="fa-solid fa-box-archive"></i> ' + boxTitle + '</span>',
        '                <button type="button" class="st-chatu8-preset-box-close" title="关闭">&times;</button>',
        '              </div>',
        '              <div class="st-chatu8-preset-box-group">',
        '                <span class="st-chatu8-preset-box-group-label">导入与导出</span>',
        '                <div class="st-chatu8-preset-box-grid">',
        '                  <button type="button" class="st-chatu8-preset-box-item" ' + k('presetImport') + ' title="导入预设文件"><i class="fa-solid fa-file-import"></i><span>导入</span></button>',
        '                  <button type="button" class="st-chatu8-preset-box-item" ' + k('presetExport') + ' title="导出当前预设"><i class="fa-solid fa-file-export"></i><span>导出</span></button>',
        '                </div>',
        '              </div>',
        '              <div class="st-chatu8-preset-box-group">',
        '                <span class="st-chatu8-preset-box-group-label">管理</span>',
        '                <div class="st-chatu8-preset-box-grid">',
        '                  <button type="button" class="st-chatu8-preset-box-item" ' + k('presetRename') + ' title="重命名预设"><i class="fa-solid fa-pen"></i><span>改名</span></button>',
        '                  <button type="button" class="st-chatu8-preset-box-item" ' + k('presetReseed') + ' title="把内置预设刷新成插件里的最新版本（自己导入 / 新建的预设不受影响）"><i class="fa-solid fa-rotate"></i><span>更新内置</span></button>',
        '                </div>',
        '              </div>',
        '              <div class="st-chatu8-preset-box-group">',
        '                <span class="st-chatu8-preset-box-group-label">危险操作</span>',
        '                <div class="st-chatu8-preset-box-grid">',
        '                  <button type="button" class="st-chatu8-preset-box-item danger" ' + k('presetRemove') + ' title="删除预设"><i class="fa-solid fa-trash"></i><span>删除</span></button>',
        '                </div>',
        '              </div>',
        '            </div>',
        '          </div>',
        '        </div>',
        '      </div>',
        '      <input type="file" accept=".json,application/json" ' + k('presetFile') + ' style="display:none">',
        '      <div class="dna-kv" ' + k('presetInfo') + '></div>',
        '      <div class="dna-entry-head">',
        '        <span class="dna-entry-head-t">预设条目 <span class="dna-count" ' + k('presetEntryCount') + '>0 / 0</span></span>',
        '        <span class="dna-entry-tools">',
        '          <button class="st-chatu8-btn dna-btn-sm" ' + k('presetAllOn') + '>全开</button>',
        '          <button class="st-chatu8-btn dna-btn-sm" ' + k('presetAllOff') + '>全关</button>',
        '        </span>',
        '      </div>',
        '      <div class="dna-entries" ' + k('presetEntries') + '></div>',
        '    </div>'
    ].join('\n');
}


function libPanelHtml(tag, cfg) {
    const d = (n) => 'data-dna="' + tag + n + '"';
    const C = cfg || {};
    const reply = '<div class="st-chatu8-settings-section dna-fold" data-fold="' + tag + 'AI">'
        + '<div class="dna-fold-head"><h3><i class="fa-solid fa-comments"></i> AI 回复（实时）</h3>'
        + '<button type="button" class="dna-fold-btn" data-fold-btn="' + tag + 'AI" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button></div>'
        + '<div class="dna-status-row"><span class="dna-badge" data-dna="aiReplyRanobeState">待命</span></div>'
        + '<div class="st-chatu8-field-col">'
        + '<textarea class="st-chatu8-textarea dna-mono" data-dna="aiReplyRanobe" rows="8" readonly placeholder="还没有内容。点一次「生成 DNA」，AI 正在写什么、写了多少，都会实时出现在这里。"></textarea>'
        + '<div class="dna-hint dna-hint-inline">'
        + '<button class="st-chatu8-btn dna-btn-sm" ' + d('Copy') + '><i class="fa-regular fa-copy"></i>复制</button>'
        + '<button class="st-chatu8-btn dna-btn-sm" ' + d('ClearReply') + '>清空</button>'
        + '</div></div></div>';
    const foldLib = tag + 'Lib';
    const head = '<div class="st-chatu8-settings-section dna-fold" data-fold="' + foldLib + '">'
        + '<div class="dna-sec-head dna-fold-head"><h3><i class="' + C.icon + '"></i> ' + C.title + ' <span class="dna-count" ' + d('Count') + '>0</span></h3>'
        + '<div class="dna-sec-actions">'
        + '<button class="st-chatu8-btn" ' + d('Import') + ' title="导入一份同人资料库 JSON（同格式即可）"><i class="fa-solid fa-file-import"></i>导入</button>'
        + '<button class="st-chatu8-btn" ' + d('Export') + ' title="把当前这份库导成 JSON"><i class="fa-solid fa-file-export"></i>导出</button>'
        + '<button class="st-chatu8-btn" ' + d('Add') + ' title="自己加一条"><i class="fa-solid fa-plus"></i>新增条目</button>'
        + '<button class="st-chatu8-btn danger" ' + d('Reset') + ' title="' + C.resetTip + '"><i class="fa-solid fa-rotate-left"></i>恢复内置</button>'
        + '<button type="button" class="dna-fold-btn" data-fold-btn="' + foldLib + '" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>'
        + '</div></div>'
        + '<div class="dna-status-row"><span class="dna-badge" ' + d('Meta') + '>—</span>'
        + (C.source ? ('<span class="dna-badge" ' + d('Source') + '>—</span>') : '')
        + '</div>'
        + '<div class="st-chatu8-field"><label>搜索</label>'
        + '<input type="text" class="st-chatu8-text-input" ' + d('Search') + ' placeholder="' + C.searchPh + '"></div>'
        + '<div class="dna-actions">'
        + '<button class="st-chatu8-btn" ' + d('SelAll') + '>全选搜索结果</button>'
        + '<button class="st-chatu8-btn" ' + d('SelNone') + '>取消全选</button>'
        + '<button class="st-chatu8-btn" ' + d('Reload') + '><i class="fa-solid fa-rotate"></i>' + C.reloadLabel + '</button>'
        + '</div>'
        + '<div class="dna-list" ' + d('List') + '></div>'
        + '<div class="st-chatu8-field-col"><label>额外要求（可留空）</label>'
        + '<textarea class="st-chatu8-textarea" ' + d('Req') + ' rows="3" placeholder="' + C.reqPh + '"></textarea></div>'
        + '<div class="dna-actions">'
        + '<button class="st-chatu8-btn" ' + d('Run') + '><i class="fa-solid fa-wand-magic-sparkles"></i>生成 DNA</button>'
        + (C.fromWb ? ('<button class="st-chatu8-btn" ' + d('FromWb') + ' title="把当前角色卡世界书里的条目挑进来，成为这份库的条目"><i class="fa-solid fa-book-open"></i>从世界书添加</button>') : '')
        + '<button class="st-chatu8-btn dna-btn-abort" ' + d('Abort') + ' disabled><i class="fa-solid fa-stop"></i>中断请求</button>'
        + '</div>'
        + '<div class="dna-kv" ' + d('Info') + '></div>'
        + '<input type="file" accept=".json,application/json" ' + d('File') + ' style="display:none">'
        + '</div>';
    const test = '<div class="st-chatu8-settings-section">'
        + '<h3><i class="fa-solid fa-flask"></i> 测试工具</h3>'
        + '<div class="dna-actions">'
        + '<button class="st-chatu8-btn" ' + d('TestPreview') + '><i class="fa-solid fa-eye"></i>① 只组装（不请求）</button>'
        + '<button class="st-chatu8-btn" ' + d('TestLLM') + '><i class="fa-solid fa-paper-plane"></i>② 组装 + 发测试请求</button>'
        + '<button class="st-chatu8-btn" ' + d('TestClear') + '>清空</button>'
        + '</div>'
        + '<div class="st-chatu8-field-col"><label>要发出去的 messages</label>'
        + '<textarea class="st-chatu8-textarea dna-mono" ' + d('TestPrompt') + ' rows="10" readonly></textarea></div>'
        + '<div class="st-chatu8-field-col"><label>AI 回复</label>'
        + '<textarea class="st-chatu8-textarea dna-mono" ' + d('TestResult') + ' rows="8" readonly></textarea></div>'
        + '</div>';
    /* 同人资料库页里额外挂一块「世界书生成」：读当前角色卡的世界书，搜索 / 编辑条目 / 勾选生成 */
    const w = (n) => 'data-dna="ranobewb' + n + '"';
    const foldWb = tag + 'Wbgen';
    const wbgen = C.wbGen ? ('<div class="st-chatu8-settings-section dna-fold" data-fold="' + foldWb + '">'
        + '<div class="dna-sec-head dna-fold-head"><h3><i class="fa-solid fa-book-open"></i> 世界书生成 <span class="dna-count" ' + w('Count') + '>0</span></h3>'
        + '<div class="dna-sec-actions">'
        + '<button class="st-chatu8-btn" ' + w('Reload') + '><i class="fa-solid fa-rotate"></i>重新读取世界书</button>'
        + '<button type="button" class="dna-fold-btn" data-fold-btn="' + foldWb + '" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>'
        + '</div></div>'
        + '<div class="dna-status-row"><span class="dna-badge" ' + w('Source') + '>—</span></div>'
        + '<div class="dna-hint dna-hint-inline">读的是当前角色卡的世界书。'
        + '点条目右边的「编辑」可以改标题 / 关键词 / 正文，改动只保存在插件里，不会改动世界书文件。</div>'
        + '<div class="st-chatu8-field"><label>搜索条目</label>'
        + '<input type="text" class="st-chatu8-text-input" ' + w('Search') + ' placeholder="条目标题 / 关键词 / 内容"></div>'
        + '<div class="dna-actions">'
        + '<button class="st-chatu8-btn" ' + w('SelAll') + '>全选搜索结果</button>'
        + '<button class="st-chatu8-btn" ' + w('SelNone') + '>取消全选</button>'
        + '</div>'
        + '<div class="dna-list" ' + w('List') + '></div>'
        + '<div class="st-chatu8-field-col"><label>额外要求（可留空）</label>'
        + '<textarea class="st-chatu8-textarea" ' + w('Req') + ' rows="3" placeholder="例如：这次只写新出场的角色"></textarea></div>'
        + '<div class="dna-actions">'
        + '<button class="st-chatu8-btn" ' + w('Run') + '><i class="fa-solid fa-wand-magic-sparkles"></i>按所选世界书条目生成 DNA</button>'
        + '<button class="st-chatu8-btn dna-btn-abort" ' + w('Abort') + ' disabled><i class="fa-solid fa-stop"></i>中断请求</button>'
        + '</div>'
        + '<div class="dna-kv" ' + w('Info') + '></div>'
        + '</div>') : '';
    /* 同人资料库页：AI 回复下面按顺序先放 LLM 配置、上下文预设（与手动生成同一套 UI） */
    const cards = C.profileCards ? (profileCardHtml(tag) + '\n' + presetCardHtml(tag, { boxTitle: '同人库预设操作' })) : '';
    return '<div class="dna-panel" data-dna-panel="' + tag + '">' + reply + cards + head + wbgen + test + '</div>';
}

const PANEL_HTML = `
<div id="dna-tab" class="dna-wrap">

  <!-- 状态条 -->
  <div class="st-chatu8-settings-section dna-status-section">
    <div class="dna-sec-head">
      <h3><i class="fa-solid fa-dna"></i> 角色 DNA 记录器</h3>
      <div class="dna-sec-actions">
        <button class="st-chatu8-btn" data-dna="scanNow"><i class="fa-solid fa-bolt"></i><span data-dna="scanLabel">立即记录</span></button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="abortScan" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
        <a class="st-chatu8-btn dna-help-btn" data-dna="helpLink"
           href="https://docs.qq.com/doc/DZnF6Z2d3b0xBVVNP"
           target="_blank" rel="noopener noreferrer"
           title="打开角色 DNA 记录器使用说明"><i class="fa-solid fa-book-open"></i>使用说明</a>
      </div>
    </div>
    <div class="dna-status-row">
      <span class="dna-dot"></span>
      <span data-dna="status">空闲</span>
      <span class="dna-sep">·</span>
      <span data-dna="autoState">自动记录已开启</span>
    </div>
  </div>

  <!-- 子板块 -->
  <div class="st-chatu8-sub-nav dna-sub-nav" data-dna="subtabs">
    <a href="#" class="st-chatu8-sub-nav-link active" data-dna-tab="arch"><i class="fa-solid fa-box-archive"></i> 档案库</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="auto"><i class="fa-solid fa-robot"></i> 自动生成</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="gen"><i class="fa-solid fa-wand-magic-sparkles"></i> 手动生成</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="ranobe"><i class="fa-solid fa-users-viewfinder"></i> 同人资料库</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="tools"><i class="fa-solid fa-paper-plane"></i> 发送 &amp; 日志</a>
    <a href="#" class="st-chatu8-sub-nav-link" data-dna-tab="settings"><i class="fa-solid fa-sliders"></i> 设置</a>
  </div>

  <!-- ============ 档案库：只管存角色档案 ============ -->
  <div class="dna-panel active" data-dna-panel="arch">

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
      </div>
      <div class="st-chatu8-field">
        <label>搜索档案</label>
        <input type="text" class="st-chatu8-text-input" data-dna="search" placeholder="角色名 / 别称">
      </div>
      <div class="dna-split dna-split-solo">
        <div class="dna-list" data-dna="list"></div>
        <div class="dna-detail" data-dna="detail" style="display:none"></div>
      </div>
      <input type="file" accept=".json,application/json" data-dna="file" style="display:none">
    </div>

    <div class="st-chatu8-settings-section dna-fold" data-fold="archTpl">
      <div class="dna-fold-head">
        <h3><i class="fa-solid fa-clipboard-list"></i> 档案模板</h3>
        <button type="button" class="dna-fold-btn" data-fold-btn="archTpl" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      
      <div class="st-chatu8-field">
        <label>当前模板</label>
        <select class="st-chatu8-select" data-dna="tplSelect"></select>
      </div>
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="tplBadge">默认模板</span>
        
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="tplNew"><i class="fa-solid fa-plus"></i>新建模板</button>
        <button class="st-chatu8-btn" data-dna="tplEdit"><i class="fa-solid fa-pen-to-square"></i>编辑模板</button>
        <button class="st-chatu8-btn" data-dna="tplExport"><i class="fa-solid fa-file-export"></i>导出模板</button>
        <button class="st-chatu8-btn" data-dna="tplImport"><i class="fa-solid fa-file-import"></i>导入模板</button>
        <button class="st-chatu8-btn" data-dna="tplDelete"><i class="fa-solid fa-trash"></i>删除这个模板</button>
        <button class="st-chatu8-btn" data-dna="tplReset"><i class="fa-solid fa-rotate-left"></i>恢复默认模板</button>
      </div>
      <div class="st-chatu8-field-col">
        <label>当前模板内容（只读，点「编辑模板」改）</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="tplPreview" rows="7" readonly></textarea>
      </div>
      <input type="file" accept=".json,application/json" data-dna="tplFile" style="display:none">
      
      
    </div>
  </div>

  <!-- ============ 自动生成 ============ -->
  <div class="dna-panel" data-dna-panel="auto">

    <div class="st-chatu8-settings-section dna-fold" data-fold="libAI">
      <div class="dna-fold-head">
        <h3><i class="fa-solid fa-comment-dots"></i> AI 回复（实时）</h3>
        <button type="button" class="dna-fold-btn" data-fold-btn="libAI" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="aiReplyLibState">待命</span>
        
      </div>
      <div class="st-chatu8-field-col">
        <textarea class="st-chatu8-textarea dna-mono" data-dna="aiReplyLib" rows="10" readonly placeholder="还没有内容。跑一次自动记录 / 手动生成，AI 正在写什么、写了多少，都会实时出现在这里。"></textarea>
        <div class="dna-hint dna-hint-inline"><button class="st-chatu8-btn dna-btn-sm" data-dna="aiReplyLibCopy"><i class="fa-regular fa-copy"></i>复制</button><button class="st-chatu8-btn dna-btn-sm" data-dna="aiReplyLibClear">清空</button></div>
      </div>
    </div>

    <div class="st-chatu8-settings-section dna-fold" data-fold="libLLM">
      <div class="dna-fold-head">
        <h3><i class="fa-solid fa-microchip"></i> LLM 配置</h3>
        <button type="button" class="dna-fold-btn" data-fold-btn="libLLM" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      
      <div class="st-chatu8-field">
        <label>使用哪份配置</label>
        <select class="st-chatu8-select" data-dna="profileSelect"></select>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="gotoLLM"><i class="fa-solid fa-arrow-right-to-bracket"></i>去 LLM 页签编辑</button>
      </div>
      <div class="dna-kv" data-dna="configDetail"></div>
      
    </div>

    <div class="st-chatu8-settings-section dna-fold" data-fold="libPreset">
      <div class="dna-fold-head">
        <h3><i class="fa-solid fa-layer-group"></i> 上下文预设</h3>
        <button type="button" class="dna-fold-btn" data-fold-btn="libPreset" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="presetLabel">未导入</span>
        
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
                  <button type="button" class="st-chatu8-preset-box-item" data-dna="presetReseed" title="把内置预设刷新成插件里的最新版本（自己导入 / 新建的预设不受影响）"><i class="fa-solid fa-rotate"></i><span>更新内置</span></button>
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

    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-scissors"></i> 正则 &amp; 测试工具</h3>
      
      <div class="dna-kv" data-dna="regexInfo"></div>
      <div class="st-chatu8-field-col">
        <label>原始正文（粘一段想试的文本，留空则取最近 N 层 AI 回复）</label>
        <textarea class="st-chatu8-textarea" data-dna="testInput" rows="4" placeholder="留空 = 用最近 N 层 AI 回复的正文（不含玩家输入）"></textarea>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="testRegex"><i class="fa-solid fa-scissors"></i>① 只跑正则</button>
        <button class="st-chatu8-btn" data-dna="testAssemble"><i class="fa-solid fa-eye"></i>只组装（不请求）</button>
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
      
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-clock-rotate-left"></i> 扫描与记录节奏</h3>
      
      <div class="st-chatu8-field">
        <label>每次扫描最近 N 层 AI 回复</label>
        <input type="number" min="1" max="300" class="st-chatu8-text-input" data-dna="scanDepth">
      </div>
      <div class="st-chatu8-field">
        <label>自动记录间隔（每 N 层）</label>
        <input type="number" min="1" max="50" class="st-chatu8-text-input" data-dna="autoEvery">
      </div>
      <div class="st-chatu8-field">
        <label>最新一层正文至少 N 字才记录（0 = 不限）</label>
        <input type="number" min="0" max="100000" step="100" class="st-chatu8-text-input" data-dna="autoMinChars">
      </div>
    </div>
  </div>

  <!-- ============ 手动生成 ============ -->
  <div class="dna-panel" data-dna-panel="gen">

    <div class="st-chatu8-settings-section dna-fold" data-fold="genAI">
      <div class="dna-fold-head">
        <h3><i class="fa-solid fa-comment-dots"></i> AI 回复（实时）</h3>
        <button type="button" class="dna-fold-btn" data-fold-btn="genAI" title="收起 / 展开这块"><i class="fa-solid fa-chevron-up"></i></button>
      </div>
      
      <div class="dna-status-row">
        <span class="dna-badge" data-dna="aiReplyGenState">待命</span>
        
      </div>
      <div class="st-chatu8-field-col">
        <textarea class="st-chatu8-textarea dna-mono" data-dna="aiReplyGen" rows="10" readonly placeholder="还没有内容。点一次「按…生成 DNA」，AI 正在写什么、写了多少，都会实时出现在这里。"></textarea>
        <div class="dna-hint dna-hint-inline"><button class="st-chatu8-btn dna-btn-sm" data-dna="aiReplyGenCopy"><i class="fa-regular fa-copy"></i>复制</button><button class="st-chatu8-btn dna-btn-sm" data-dna="aiReplyGenClear">清空</button></div>
      </div>
    </div>

    ${profileCardHtml('gen')}

    ${presetCardHtml('gen', { boxTitle: '手动生成预设操作' })}

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
      
      <div class="dna-fold" data-fold="genEntryPick">
        <div class="dna-entry-head dna-fold-head">
          <span class="dna-entry-head-t">世界书条目 <span class="dna-count" data-dna="genEntryCount">0 / 0</span></span>
          <span class="dna-entry-tools">
            <button type="button" class="dna-fold-btn" data-fold-btn="genEntryPick" title="收起 / 展开条目列表"><i class="fa-solid fa-chevron-up"></i></button>
            <input type="text" class="st-chatu8-text-input dna-search" data-dna="genEntrySearch" placeholder="搜条目…">
            <button class="st-chatu8-btn dna-btn-sm" data-dna="genEntryAll">全选</button>
            <button class="st-chatu8-btn dna-btn-sm" data-dna="genEntryNone">全不选</button>
          </span>
        </div>
        <div class="dna-entries" data-dna="genEntryList"></div>
      </div>
      
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunWorld"><i class="fa-solid fa-wand-magic-sparkles"></i>按世界书生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortWorld" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
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
      
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunChars"><i class="fa-solid fa-wand-magic-sparkles"></i>按角色生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortChars" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-layer-group"></i> 组合生成（世界书 + 角色 + 服装）</h3>
      <div class="dna-entry-head">
        <span class="dna-entry-head-t">③ 服装（智绘姬「服装」）<span class="dna-count" data-dna="genOutfitCount">0 / 0</span></span>
        <span class="dna-entry-tools">
          <input type="text" class="st-chatu8-text-input dna-search" data-dna="genOutfitSearch" placeholder="搜服装…">
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genOutfitAll">全选</button>
          <button class="st-chatu8-btn dna-btn-sm" data-dna="genOutfitNone">全不选</button>
        </span>
      </div>
      <div class="dna-entries dna-entries-sm" data-dna="genOutfitList"></div>
      
      
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunMix"><i class="fa-solid fa-wand-magic-sparkles"></i>组合生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortMix" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-file-import"></i> ④ 按导入文本生成</h3>
      
      <div class="dna-actions">
        <input type="file" accept=".txt,text/plain" data-dna="genTxtFile" style="display:none">
        <button class="st-chatu8-btn" data-dna="genTxtPick"><i class="fa-solid fa-folder-open"></i>选择 txt 文件</button>
        <button class="st-chatu8-btn" data-dna="genTxtClearFile"><i class="fa-solid fa-xmark"></i>移除</button>
      </div>
      
      <div class="st-chatu8-field-col">
        <label>文本内容（导入后可以在这里改，改完直接按改过的生成）</label>
        <textarea class="st-chatu8-textarea dna-mono" data-dna="genTxtContent" rows="10" placeholder="点「选择 txt 文件」导入；也可以直接把内容粘到这里。"></textarea>
      </div>
      
      <div class="st-chatu8-field">
        <label>分段生成tokens上限（0 = 不分段）</label>
        <input type="number" min="0" max="200000" step="500" class="st-chatu8-text-input" data-dna="genTxtChunk">
      </div>
      
      <div class="dna-inline-row">
        <select class="st-chatu8-select" data-dna="genTxtPart"></select>
        <button class="st-chatu8-btn" data-dna="genTxtResplit"><i class="fa-solid fa-scissors"></i>重新分段</button>
      </div>
      
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="genRunText"><i class="fa-solid fa-wand-magic-sparkles"></i>按文本生成 DNA</button>
        <button class="st-chatu8-btn dna-btn-abort" data-dna="genAbortText" disabled><i class="fa-solid fa-stop"></i>中断请求</button>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-comment-dots"></i> 额外要求</h3>
      <div class="st-chatu8-field-col">
        <label>额外要求（两条线共用，可留空）</label>
        <textarea class="st-chatu8-textarea" data-dna="genInstruction" rows="3" placeholder="例如：只写主要角色，配角不要；或者重点写服装"></textarea>
      </div>
      <div class="dna-actions">
        <button class="st-chatu8-btn danger" data-dna="genClear">清空全部选择</button>
      </div>
      <div class="dna-kv" data-dna="genInfo"></div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-flask"></i> 测试工具</h3>
      
      <div class="st-chatu8-field">
        <label>测试哪条线</label>
        <select class="st-chatu8-select" data-dna="genTestMode">
          <option value="world">① 按世界书条目生成</option>
          <option value="chars">② 按角色生成</option>
          <option value="text">④ 按导入文本生成</option>
          <option value="mix">组合生成（世界书 + 角色 + 服装）</option>
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
      
    </div>
  </div>

  ${libPanelHtml('ranobe', {
    title: '同人资料库',
    icon: 'fa-solid fa-users-viewfinder',
    searchPh: '名字 / 别名 / 作品 / 标签',
    reqPh: '例如：只写勾选到的人；出生地不写',
    fromWb: true,
    wbGen: true,
    profileCards: true,
    resetTip: '清掉所有改动，回到插件自带的那份同人库',
    reloadLabel: '重新载入内置库'
  })}

  <!-- ============ 发送 & 日志 ============ -->
  <div class="dna-panel" data-dna-panel="tools">
    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-paper-plane"></i> 发送数据</h3>
      
      <div class="st-chatu8-field">
        <label>发送 DNA</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="sendEnabled"><span class="st-chatu8-slider"></span></div>
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
        <label>档案跟随角色卡存档</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="followChar"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>AI自动更新档案库</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="updateExisting"><span class="st-chatu8-slider"></span></div>
      </div>
      
      <div class="st-chatu8-field">
        <label>完成后弹提示</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="notify"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>AI 回复上限（token，0 = 不设上限）</label>
        <input type="number" min="0" max="200000" step="1000" class="st-chatu8-text-input" data-dna="replyMaxTokens">
      </div>
      
      <div class="st-chatu8-field">
        <label>自动重试次数（0 = 不重试）</label>
        <input type="number" min="0" max="5" step="1" class="st-chatu8-text-input" data-dna="retryCount">
      </div>
      
      <div class="st-chatu8-field">
        <label>正文先过智绘姬正则</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="useRegex"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>界面</label>
        <select class="st-chatu8-select" data-dna="uiMode"><option value="auto">自动检测</option><option value="desktop">一直用电脑版</option><option value="mobile">一直用手机版</option></select>
      </div>
      
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-wrench"></i> Tool 与末尾消息</h3>
      
      <div class="st-chatu8-field">
        <label>启用自定义 Tool</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="breakTool"><span class="st-chatu8-slider"></span></div>
      </div>
      <div class="st-chatu8-field">
        <label>启用末尾多 Role 消息</label>
        <div class="st-chatu8-toggle"><input type="checkbox" data-dna="breakTail"><span class="st-chatu8-slider"></span></div>
      </div>
    </div>

    <div class="st-chatu8-settings-section">
      <h3><i class="fa-solid fa-floppy-disk"></i> 保存</h3>
      
      <div class="dna-actions">
        <button class="st-chatu8-btn" data-dna="saveAll"><i class="fa-solid fa-floppy-disk"></i>保存设置</button>
        
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
let genOutfitsCache = [];   // 智绘姬「服装」里的服装预设

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

/* 智绘姬「服装」里的服装预设：{ 服装名: { nameCN, nameEN, owner, upperBody, ... } } */
function chatu8OutfitPresets() {
    let ch = null;
    try { ch = extension_settings[CHATU8]; } catch (e) { ch = null; }
    const p = (ch && ch.outfitPresets && typeof ch.outfitPresets === 'object') ? ch.outfitPresets : {};
    return Object.keys(p).map((key) => {
        const v = (p[key] && typeof p[key] === 'object') ? p[key] : {};
        const owner = String(v.owner || '').trim();
        return { key, name: key, owner, text: outfitText(key, v) };
    });
}

const OUTFIT_FIELD_LABELS = {
    upperBody: '上半身', upperBodyBack: '上半身（背面）',
    fullBody: '全身', fullBodyBack: '全身（背面）',
    photoPrompt: '照片提示词'
};

/* 一套服装压成一段给模型看的资料 */
function outfitText(name, v) {
    const val = (v && typeof v === 'object') ? v : {};
    const owner = String(val.owner || '').trim();
    const lines = ['—— 服装「' + String(name || '') + '」' + (owner ? ('（归属：' + owner + '）') : '（没写归属人）') + ' ——'];
    for (const k of Object.keys(OUTFIT_FIELD_LABELS)) {
        const t = String(val[k] || '').trim();
        if (t) lines.push(OUTFIT_FIELD_LABELS[k] + '：' + t);
    }
    const extra = [];
    if (String(val.nameCN || '').trim()) extra.push('中文名：' + String(val.nameCN).trim());
    if (String(val.nameEN || '').trim()) extra.push('英文名：' + String(val.nameEN).trim());
    if (lines.length === 1 && extra.length) lines.push(extra.join(' / '));
    return lines.join('\n');
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
            + '</label>'
            + '<button type="button" class="dna-eye" data-genlook="' + esc(e.key) + '" title="看一眼这条的内容（可以改，也可以存回去）"><i class="fa-solid fa-eye"></i></button>'
            + '</div></div>';
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

/* ---------- 渲染：服装列表 ---------- */
function renderGenOutfits() {
    const box = document.querySelector('#dna-tab [data-dna="genOutfitList"]');
    if (!box) return;
    const picked = new Set(S.genOutfits || []);
    const sEl = document.querySelector('#dna-tab [data-dna="genOutfitSearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genOutfitsCache.filter((o) => !q || (o.name + ' ' + o.owner).toLowerCase().indexOf(q) >= 0);
    if (!list.length) {
        box.innerHTML = '<div class="dna-entries-empty">' +
            (genOutfitsCache.length ? '没有匹配的服装' : '智绘姬「服装」里还没有服装预设') + '</div>';
        renderGenInfo();
        return;
    }
    box.innerHTML = list.map((o) => {
        const on = picked.has(o.key);
        return '<div class="dna-entry-item"><div class="dna-entry-line">'
            + '<label class="dna-entry' + (on ? '' : ' dna-entry-off') + '" data-genoutfit="' + esc(o.key) + '" title="' + esc(o.text.slice(0, 400)) + '">'
            + '<input type="checkbox"' + (on ? ' checked' : '') + '>'
            + '<span class="dna-entry-name">' + esc(o.name) + (o.owner ? '（→ ' + esc(o.owner) + '）' : '') + '</span>'
            + '<span class="dna-entry-len">' + (o.owner ? '归属 ' + esc(o.owner) : '没写归属') + '</span>'
            + '</label></div></div>';
    }).join('');
    renderGenInfo();
}

function toggleGenOutfit(key, on) {
    const set = new Set(S.genOutfits || []);
    if (on) set.add(key); else set.delete(key);
    S.genOutfits = [...set];
    saveSettings(true);
    renderGenInfo();
}

function setAllGenOutfits(on) {
    const sEl = document.querySelector('#dna-tab [data-dna="genOutfitSearch"]');
    const q = String((sEl && sEl.value) || '').trim().toLowerCase();
    const list = genOutfitsCache.filter((o) => !q || (o.name + ' ' + o.owner).toLowerCase().indexOf(q) >= 0);
    const set = new Set(S.genOutfits || []);
    list.forEach((o) => { if (on) set.add(o.key); else set.delete(o.key); });
    S.genOutfits = [...set];
    saveSettings(true);
    renderGenOutfits();
}

/* ---------- 渲染：手动加的角色 ---------- */
function renderGenExtra() {
    const box = document.querySelector('#dna-tab [data-dna="genExtraList"]');
    if (!box) return;
    const list = S.genExtraChars || [];
    box.innerHTML = list.length
        ? list.map((n) => '<span class="dna-tag">' + esc(n) +
            '<button class="dna-tag-x" data-genextra="' + esc(n) + '" title="移除">×</button></span>').join('')
        : '';
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

function pickedGenOutfits() {
    const picked = new Set(S.genOutfits || []);
    return genOutfitsCache.filter((o) => picked.has(o.key));
}

function renderGenInfo() {
    const box = document.querySelector('#dna-tab [data-dna="genInfo"]');
    if (!box) return;
    const entries = pickedGenEntries();
    const chars = pickedGenChars();
    const outs = pickedGenOutfits();
    const oCnt = document.querySelector('#dna-tab [data-dna="genOutfitCount"]');
    if (oCnt) oCnt.textContent = outs.length + ' / ' + genOutfitsCache.length;
    const eCnt = document.querySelector('#dna-tab [data-dna="genEntryCount"]');
    if (eCnt) eCnt.textContent = entries.length + ' / ' + genEntriesCache.length;
    const cCnt = document.querySelector('#dna-tab [data-dna="genCharCount"]');
    if (cCnt) cCnt.textContent = chars.length + ' / ' + (genCharsCache.length + (S.genExtraChars || []).length);
    const chars2 = entries.reduce((n, e) => n + e.content.length, 0);
    const rows = [
        ['① 世界书', (S.genSource === 'chatu8' ? '智绘姬世界书' : ('酒馆世界书 · ' + (S.genBook || '未选')))
            + ' → ' + (entries.length ? ('已勾 ' + entries.length + ' 条 / ' + chars2 + ' 字') : '（还没勾）')],
        ['② 角色', chars.length ? ('已勾 ' + chars.length + ' 个：' + chars.map((c) => c.name).join('、')) : '（还没勾）'],
        ['③ 服装', outs.length ? ('已勾 ' + outs.length + ' 套：' + outs.map((o) => o.name + (o.owner ? '→' + o.owner : '')).join('、')) : '（还没勾）'],
        ['组装方式', (presetEnabledOf('gen') && presetEntries(undefined, 'gen').length) ? ('手动生成预设「' + activePresetName('gen') + '」') : '插件内置提示词'],
        ['LLM 配置', currentProfileName('gen') || '（没选）']
    ];
    if (chars2 > 40000) rows.push(['提醒', '世界书勾了 ' + chars2 + ' 字（超过 4 万），容易超出模型上下文，建议少勾几条']);
    /* 真正决定成败的是发出去的总量（含预设）。这里只做字符级粗估，不组装提示词，免得勾一下就卡。 */
    const presetTxt = (presetEnabledOf('gen') && presetEntries(undefined, 'gen').length)
        ? presetEntries(undefined, 'gen').map((e) => String(e.content || '')).join('\n') : '';
    const estTok = estimateTokens(presetTxt) + estimateTokens(entries.map((e) => e.content).join('\n')) + 2000;
    const txtLen = genTxtGet().length;
    if (txtLen) rows.push(['导入文本', (S.genTxtName || '(粘贴的内容)') + ' · ' + txtLen + ' 字']);
    rows.push(['请求规模', '约 ' + estTok + ' token（含预设）' + (estTok > 30000 ? ' · 偏大，可能超出模型上下文' : '')]);
    box.innerHTML = rows.map((r) =>
        '<div class="dna-kv-row"><span class="dna-kv-k">' + esc(r[0]) + '</span>' +
        '<span class="dna-kv-v">' + esc(String(r[1])) + '</span></div>'
    ).join('');
}

/* ---------- 导入的 txt ---------- */
/* 正文只放内存（几百 KB 塞 localStorage 会炸），持久化只存文件名。 */
let genTxtBody = '';

function genTxtGet() {
    const ta = document.querySelector('#dna-tab [data-dna="genTxtContent"]');
    if (ta && ta.value) return ta.value;
    return genTxtBody;
}

function genTxtHint(text) {
    const h = document.querySelector('#dna-tab [data-dna="genTxtHint"]');
    if (h) h.textContent = text || '';
}

function genTxtRefresh() {
    const body = genTxtGet();
    const name = S.genTxtName || '';
    if (!body) {
        genTxtHint(name ? ('文件「' + name + '」的内容是空的') : '还没导入文件。');
        return;
    }
    genTxtHint((name ? ('文件「' + name + '」· ') : '粘贴内容 · ') + body.length + ' 字'
        + (body.length > 100000 ? '（偏大，建议先删掉无关段落）' : ''));
}

/* 中文 txt 常见 UTF-8 和 GBK 两种，先按 UTF-8 解，出现大量乱码再退回 GBK */
async function readTxtFile(file) {
    const buf = await file.arrayBuffer();
    let txt = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const bad = (txt.match(/\uFFFD/g) || []).length;
    if (bad > 3) {
        try {
            const alt = new TextDecoder('gbk', { fatal: false }).decode(buf);
            if ((alt.match(/\uFFFD/g) || []).length < bad) txt = alt;
        } catch (e) { /* 浏览器不支持 gbk 就用 utf-8 的结果 */ }
    }
    return txt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

async function onGenTxtPick() {
    const inp = document.querySelector('#dna-tab [data-dna="genTxtFile"]');
    if (inp) inp.click();
}

async function onGenTxtFileChosen(file) {
    if (!file) return;
    try {
        const txt = await readTxtFile(file);
        genTxtBody = txt;
        S.genTxtName = file.name || 'text.txt';
        saveSettings(true);
        const ta = document.querySelector('#dna-tab [data-dna="genTxtContent"]');
        if (ta) ta.value = txt;
        genTxtRefresh();
        S.genTxtPart = 0;
        genTxtRefreshSeg();
        log('导入文本「' + S.genTxtName + '」：' + txt.length + ' 字');
        toast('已导入 ' + txt.length + ' 字');
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        genTxtHint('读取失败：' + msg);
        log('导入文本失败：' + msg, 'error');
    }
}

function onGenTxtClearFile() {
    genTxtBody = '';
    S.genTxtName = '';
    saveSettings(true);
    const ta = document.querySelector('#dna-tab [data-dna="genTxtContent"]');
    if (ta) ta.value = '';
    S.genTxtPart = 0;
    genTxtRefresh();
    genTxtRefreshSeg();
}

/* ---------- 组装「正文」：三条线各说各的 ---------- */
/* 'world' 只用世界书条目 / 'chars' 只用角色 / 'text' 只用导入的 txt /
   'mix' = 组合生成：世界书 / 角色 / 服装按勾选任意组合成一次请求
   （服装没有单独的 mode —— 它必须搭着世界书或角色一起走） */
const GEN_MODES = ['world', 'chars', 'text', 'mix'];
function genMode(mode) {
    const v = String(mode == null ? '' : mode);
    return GEN_MODES.indexOf(v) >= 0 ? v : 'world';
}

function buildGenText(mode, entries, chars, outs, txt) {
    const parts = [];
    const m = genMode(mode);
    const hasE = (m === 'world' || m === 'mix');
    const hasC = (m === 'chars' || m === 'mix');
    const hasO = (m === 'mix');
    if (m === 'text') {
        parts.push('【导入的文本资料】', String(txt || ''));
        parts.push('',
            '请从上面这份资料里，把出现的每一个具体人物各挑出来建一份 DNA 档案，一个都不许漏（泛称群体、地名、组织名不算人物）。',
            '资料里没写到的字段，按人物在文中表现出的气质和身份合理补全，不要留空、不要写“未知”。',
            '不要因为戏份少或只是提到一句就跳过某个具体人物，也不要额外编造资料里没有的人物。');
    } else {
        /* 三条线：勾了几条就拼几段，哪条没勾就整段不出现 */
        if (hasE && entries.length) {
            parts.push('【世界书资料】');
            for (const e of entries) parts.push('—— ' + e.title + ' ——\n' + e.content);
        }
        if (hasC && chars.length) {
            if (parts.length) parts.push('');
            parts.push('【要建档的角色】');
            for (const c of chars) parts.push('· ' + c.name + (c.brief ? '（设定见「角色卡设定」）' : '（没有设定，按名字和身份合理补全）'));
        }
        if (hasO && outs.length) {
            if (parts.length) parts.push('');
            parts.push('【服装资料】');
            for (const o of outs) parts.push(o.text);
        }
        parts.push('');
        if (m === 'chars' || (m === 'mix' && !entries.length && !outs.length)) {
            parts.push(
                '请为上面列出的每个角色各出一份 DNA 档案，依据「角色卡设定」里的资料写。',
                '设定里没写到的字段，按角色的气质和身份合理补全，不要留空、不要写“未知”。');
        } else if (m === 'mix') {
            parts.push(
                '请综合上面全部资料，为每一个出现的具体人物各出一份 DNA 档案，一个都不许漏（泛称群体、地名、组织名不算人物）。',
                '同一个人只出一份档案：世界书里的资料 + 角色卡设定 + 服装资料合并写，服装按「归属人」并进那个人的服装DNA。',
                '资料里没写到的字段，按世界观和人物气质合理补全，不要留空、不要写“未知”。',
                '不要额外编造资料里没有的人物——收录范围由用户勾选决定。');
        } else {
            parts.push(
                '请为上面这些条目里出现的每一个具体人物各出一份 DNA 档案，一个都不许漏（泛称群体、地名、组织名不算人物）。',
                '资料里没写到的字段，按这个世界观合理补全，不要留空、不要写“未知”。',
                '不要因为戏份少或只是配角就跳过某个具体人物，也不要额外编造条目里没有的人物——收录范围由用户勾选决定。');
        }
    }
    const extra = String(S.genInstruction || '').trim();
    if (extra) parts.push('', '【额外要求】', extra);
    return parts.join('\n');
}

/* mode: 'world' = 只用勾到的世界书条目；'chars' = 只用勾到的角色；'text' = 只用导入的 txt；
   'mix' = 组合生成（世界书 / 角色 / 服装按勾选组合） */
function buildGenPrompt(mode, txtOverride) {
    const m = genMode(mode);
    const entries = (m === 'world' || m === 'mix') ? pickedGenEntries() : [];
    const chars = (m === 'chars' || m === 'mix') ? pickedGenChars() : [];
    const outs = (m === 'mix') ? pickedGenOutfits() : [];
    /* txtOverride：分段生成时只喂这一段；不传就按当前选中的段（或不分段的全篇） */
    const txt = (m === 'text')
        ? (txtOverride === undefined ? genTxtSendText() : String(txtOverride || ''))
        : '';
    const text = buildGenText(m, entries, chars, outs, txt);
    const origins = chars.filter((c) => c.brief).map((c) => ({ name: c.name, content: c.brief }));
    /* 旧档案按本名从文本里找：导入的资料提到同一个角色也能命中已有档案 */
    const scanSrc = m === 'chars' ? chars.map((c) => c.name).join(' ') : (m === 'text' ? txt : text);
    const olds = S.updateExisting ? pickOldRecords(scanSrc, OLD_RECORD_BUDGET) : [];
    return { mode: m, entries, chars, outs, txt, text, origins, olds, prompt: buildRecordPrompt(text, { origins, olds }, 'gen') };
}

/* 这次到底喂了什么，写日志用 */
function genBrief(g) {
    const bits = [];
    if (g && g.entries && g.entries.length) {
        bits.push(g.entries.length + ' 条世界书条目 / ' + g.entries.reduce((n, e) => n + e.content.length, 0) + ' 字');
    }
    if (g && g.chars && g.chars.length) bits.push(g.chars.length + ' 个角色（' + g.chars.map((c) => c.name).join('、') + '）');
    if (g && g.outs && g.outs.length) bits.push(g.outs.length + ' 套服装（' + g.outs.map((o) => o.name + (o.owner ? '→' + o.owner : '')).join('、') + '）');
    if (g && String(g.txt || '').trim()) bits.push('导入文本 ' + String(g.txt || '').length + ' 字');
    return bits.join(' + ') || '（什么都没勾）';
}

/* ---------- 预览 ---------- */
const GEN_MODE_LABEL = { world: '按世界书生成', chars: '按角色生成', text: '按导入文本生成', mix: '组合生成' };

/* 组合生成合法性：返回空串＝能生成，否则是拦截原因。
   允许 ① / ② / ①+② / ①+③ / ②+③ / ①②③；只勾 ③ 服装不行（AI 不知道该把衣服记给谁）。 */
function mixBlockReason(g) {
    const e = (g && g.entries) ? g.entries.length : 0;
    const c = (g && g.chars) ? g.chars.length : 0;
    const o = (g && g.outs) ? g.outs.length : 0;
    if (!e && !c && !o) return '组合生成至少要勾一条线：① 世界书条目 或 ② 角色（服装得搭着它们走）。';
    if (o && !e && !c) return '③ 服装不能单独生成：再勾上 ① 世界书条目 或 ② 角色，这套衣服才知道该记到谁头上。';
    return '';
}

/* ---------- 手动生成的测试工具 ---------- */
/* 用当前勾选的世界书条目 / 角色组装一份请求，预览或试跑；结果只显示，不写档案 */
function genTestMode() {
    const sel = document.querySelector('#dna-tab [data-dna="genTestMode"]');
    const v = sel ? String(sel.value || '') : '';
    return genMode(v);
}

function genTestHint(text) {
    const h = document.querySelector('#dna-tab [data-dna="genTestHint"]');
    if (h) h.textContent = text || '';
}

function genTestFill(m, g) {
    const ta = document.querySelector('#dna-tab [data-dna="genTestPrompt"]');
    if (!ta) return;
    const msgs = normalizeMessages(g.prompt);
    ta.value = '【' + (GEN_MODE_LABEL[m] || GEN_MODE_LABEL.world) + '】\n\n'
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
        if (m === 'text' && !String(g.txt || '').trim()) { ta.value = '先在「④ 按导入文本生成」里导入一份 txt。'; genTestHint(''); return; }
        if (m === 'mix') { const r = mixBlockReason(g); if (r) { ta.value = r; genTestHint(''); return; } }
        genTestFill(m, g);
        const msgs = normalizeMessages(g.prompt);
        genTestHint('组装完成：' + msgs.length + ' 条 / ' + promptChars(g.prompt) + ' 字（没发请求、不花钱）');
        /* 摊开成一个窗口，一条条看清楚要发什么 */
        const usePreset = presetEnabledOf('gen') && presetEntries(undefined, 'gen').length > 0;
        openPromptPreview('只组装 · ' + (GEN_MODE_LABEL[m] || m), g.prompt,
            genBrief(g) + ' · ' + (usePreset ? ('预设「' + activePresetName('gen') + '」') : '插件内置 batchPrompt')
            + ' · ' + msgs.length + ' 条消息 / ' + promptChars(g.prompt) + ' 字（不发请求、不花钱）');
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
        if (m === 'text' && !String(g.txt || '').trim()) { if (res) res.value = ''; genTestHint('先在「④ 按导入文本生成」里导入一份 txt。'); return; }
        if (m === 'mix') { const r = mixBlockReason(g); if (r) { if (res) res.value = ''; genTestHint(r); return; } }
        genTestFill(m, g);
        const api = resolveApi('gen');
        genTestHint('正在用 ' + api.source + ' · ' + api.model + ' 请求…（结果只显示，不写档案）');
        liveBegin('gen', '手动测试 · ' + (GEN_MODE_LABEL[m] || m));
        let reply;
        try {
            reply = await callSafe(g.prompt, buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'gen'),
                'gen', undefined, S.replyMaxTokens, (full) => liveDelta('gen', full));
            liveEnd('gen', reply);
        } catch (e) {
            liveEnd('gen', '', (e && e.message) || e);
            throw e;
        }
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
    const m = genMode(mode);
    if (scanning) { toast('上一轮还在跑，等它跑完'); return; }
    if (!S.enabled) { toast('插件已停用，先打开「运行」里的启用插件'); return; }
    const jobs = buildGenJobs(m);
    if (m === 'chars') {
        if (!jobs.length || !jobs[0].g.chars.length) { toast('先在「② 按角色生成」里勾至少一个角色', 'error'); return; }
    } else if (m === 'mix') {
        const g0 = jobs.length ? jobs[0].g : null;
        const r = g0 ? mixBlockReason(g0) : '组合生成至少要勾一条线，再生成';
        if (r) { toast(r, 'error'); return; }
    } else if (m === 'text') {
        if (!String(genTxtGet() || '').trim()) { toast('先在「按导入文本生成」里导入一份 txt', 'error'); return; }
        if (!jobs.length) { toast('这个分段编号不存在，点「重新分段」再来', 'error'); return; }
    } else {
        if (!jobs.length || !jobs[0].g.entries.length) { toast('先在「按世界书条目生成」里勾至少一条条目', 'error'); return; }
    }
    /* 会分几段发就提前说清楚：每段都是一次独立请求，都算钱 */
    if (jobs.length > 1
        && !confirm('这次会分 ' + jobs.length + ' 段依次生成（共 ' + jobs.length + ' 次请求）。\n\n'
            + '想只发一段，就在「④ 按导入文本生成」的段下拉里挑一个。继续吗？')) return;
    /* 两条线统一按「真正发出去的量」估算：一次请求要装下全部勾选内容，
       装不下就会被截断，白花一次请求。这里只提醒，不硬拦。 */
    {
        let ptok = 0;
        for (const j of jobs) ptok = Math.max(ptok, estimateTokens(promptTextOf(j.g.prompt)));
        if (ptok > 30000 && !confirm('这次提示词最大约 ' + ptok + ' token，'
            + '接近或超过常见模型的上下文长度。\n\n建议先少勾几条，或者把「分段生成tokens上限」调小。确定要继续吗？')) return;
    }

    setBusy(true, '生成中…');
    dnaBanner('DNA建档中', 'run');
    let created = 0, updated = 0, skipped = 0, locked = 0, failed = 0;
    let firstName = '';
    try {
        const api = resolveApi('gen');
        const usePreset = presetEnabledOf('gen') && presetEntries(undefined, 'gen').length > 0;
        for (let ji = 0; ji < jobs.length; ji++) {
            if (abortedNow()) { log('已中断，剩下 ' + (jobs.length - ji) + ' 段没有发'); break; }
            const job = jobs[ji];
            const g = job.g;
            if (jobs.length > 1) log('—— 分段 ' + job.tag + ' ——');
            log('手动生成（' + (GEN_MODE_LABEL[m] || '') + '）：' + genBrief(g));
            log('使用 ' + api.source + ' · ' + api.model + '（手动生成）');
            logBreakthrough();
            log('提示词：' + (usePreset ? '手动生成预设「' + activePresetName('gen') + '」' : '插件内置 batchPrompt')
                + ' · ' + (GEN_MODE_LABEL[m] || '') + ' · ' + promptChars(g.prompt) + ' 字 / '
                + normalizeMessages(g.prompt).length + ' 条');
            /* 重试由「自动重试次数」统一管：第 1 次用精简正文，第 2 次换成内置提示词 */
            liveBegin('gen', '手动生成 · ' + (GEN_MODE_LABEL[m] || '') + (job.tag ? ' · ' + job.tag : ''));
            let raw;
            try {
                raw = await callSafe(
                    g.prompt,
                    buildRecordPrompt(clipText(g.text, 400), { origins: g.origins, olds: g.olds }, 'gen'),
                    'gen',
                    usePreset ? batchPrompt(g.text, { origins: g.origins, olds: g.olds }) : undefined,
                    S.replyMaxTokens,
                    (full) => liveDelta('gen', full)
                );
                liveEnd('gen', raw);
            } catch (e) {
                liveEnd('gen', '', (e && e.message) || e);
                throw e;
            }
            const list = parseProfileList(raw);
            if (!list) {
                appendAiReplyMeta('gen', '解析失败，看原文');
                log('AI 返回无法解析：' + String(raw || '').slice(0, 300), 'error');
                toast('返回解析不了，看「AI 回复（实时）」', 'error');
                if (jobs.length === 1) return;
                continue;
            }
            appendAiReplyMeta('gen', list.length + ' 份档案');
            log('AI 返回 ' + list.length + ' 份档案');

            const done = Object.create(null);
            const floorTag = '手动生成';
            for (const item of list) {
                const prof = normalizeProfile(item, item && item['姓名']);
                if (!prof || !String(prof['姓名'] || '').trim()) { failed++; continue; }
                const nm = String(prof['姓名']).trim();
                if (done[nm]) continue;
                done[nm] = 1;
                try {
                    const res = saveProfile(prof, floorTag);
                    if (res.split) log('「' + nm + '」一条里写了多种形态，自动拆成 ' + res.results.length + ' 条档案');
                    for (const one of res.results) {
                        if (one.r === 'created') { created++; log('新建「' + one.name + '」'); if (!firstName) firstName = one.name; }
                        else if (one.r === 'updated') { updated++; log('更新「' + one.name + '」'); if (!firstName) firstName = one.name; }
                        else if (one.r === 'locked') { locked++; log('「' + one.name + '」已锁定，AI 不改它'); }
                        else { skipped++; log('跳过「' + one.name + '」（已建档，且没开「AI自动更新档案库」）'); }
                    }
                } catch (e) {
                    failed++;
                    log('「' + nm + '」写入失败：' + (e && e.message ? e.message : e), 'error');
                }
            }
        }
        log('手动生成完成：新建 ' + created + ' · 更新 ' + updated + ' · 跳过 ' + skipped
            + (locked ? (' · 锁定跳过 ' + locked) : '') + ' · 失败 ' + failed);
        toast('生成完成：新建 ' + created + ' / 更新 ' + updated + (locked ? (' / 锁定跳过 ' + locked) : ''));
        renderList();
        if (created + updated > 0 && firstName) { selected = firstName; renderList(); }
        if (created + updated > 0) dnaBanner('建档成功', 'ok', 2600);
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        if (/已手动中断/.test(msg)) {
            log('手动生成已中断' + ((created + updated) ? ('：前面几段已经建档 ' + (created + updated) + ' 条，保留不动') : '，没写任何档案'));
            toast('已中断这次生成');
            dnaBanner('已中断', 'err', 2400);
        } else {
            log('手动生成失败：' + msg, 'error');
            toast('生成失败：' + msg, 'error');
            dnaBanner('建档失败', 'err', 3600);
        }
    } finally {
        setBusy(false);
        syncAbortBtns();
        renderGenInfo();
        if (dnaBannerKind === 'run') dnaBannerHide();
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
    genOutfitsCache = chatu8OutfitPresets();
    renderGenEntries();
    renderGenChars();
    renderGenOutfits();
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

    /* 智绘姬重灌 .st-chatu8-content 时可能留下一个孤儿 DNA 页签
       （nav 里的链接没了、content 里的 div 还在）。不清掉的话会出现两个 #dna-tab，
       querySelector 只拿到第一个，用户看到的第二个就是没绑过事件的死面板——
       折叠点不动、按钮没反应，都是这么来的。 */
    content.querySelectorAll('.st-chatu8-tab-content[data-tab-id="dna"]').forEach((el) => {
        try { el.remove(); } catch (e) { /* 忽略 */ }
    });

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
        renderTemplateUI();
    });

    bindPanel();
    renderList();
    renderTemplateUI();
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
        log('已切换 LLM 配置：' + name + ((scope === 'gen' || scope === 'ranobe') ? ('（' + presetScopeLabel(scope) + '）') : ''));
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
        S[presetKey(scope, 'Enabled')] = !!e.target.checked;
        saveSettings(true);
        renderPresetCard(scope);
    });
    const merge = q('presetMergeSystem');
    if (merge) merge.addEventListener('change', (e) => {
        S[presetKey(scope, 'MergeSystem')] = !!e.target.checked;
        saveSettings(true);
        renderPresetCard(scope);
        log('system 消息合并：' + (presetMergeOf(scope) ? '开' : '关') + '（' + presetScopeLabel(scope) + '）');
    });
    const sel = q('presetSelect');
    if (sel) sel.addEventListener('change', (e) => {
        S[presetKey(scope, 'Name')] = e.target.value || '';
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
    const reseed = q('presetReseed');
    if (reseed) reseed.addEventListener('click', () => onPresetReseed(scope));
    const rm = q('presetRemove');
    if (rm) rm.addEventListener('click', () => removePreset(scope));
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
            const list0 = presetEntries(undefined, scope);
            const e0 = list0[idx];
            if (!e0) return;
            const role0 = PRESET_ROLES.includes(e0.role) ? e0.role : 'user';
            dnaModalOpen('编辑条目 ' + (idx + 1) + '：' + (e0.name || ''),
                '<div class="dna-modal-row"><label>名称</label>' +
                    '<input type="text" class="st-chatu8-text-input" data-mf="name" value="' + esc(e0.name || '') + '"></div>' +
                '<div class="dna-modal-row"><label>角色</label>' +
                    '<select class="st-chatu8-select" data-mf="role">' +
                    PRESET_ROLES.map((r) => '<option value="' + r + '"' + (r === role0 ? ' selected' : '') + '>' + r + '</option>').join('') +
                    '</select></div>' +
                '<div class="dna-modal-field"><label>内容（支持 {{正文}} / {{角色卡设定}} / {{旧档案}} 等占位符）</label>' +
                    '<textarea class="st-chatu8-edit-input dna-mono" data-mf="content" rows="18">' + esc(e0.content || '') + '</textarea></div>' +
                '<div class="st-chatu8-edit-buttons dna-modal-foot">' +
                    '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>' +
                    '<button type="button" class="st-chatu8-edit-button send" data-modal-save>保存这条</button>' +
                '</div>');
            dnaModalWire((mask) => {
                const nameEl = mask.querySelector('[data-mf="name"]');
                const roleEl = mask.querySelector('[data-mf="role"]');
                const contEl = mask.querySelector('[data-mf="content"]');
                if (!savePresetEntry(idx, {
                    name: nameEl ? nameEl.value : undefined,
                    role: roleEl ? roleEl.value : undefined,
                    content: contEl ? contEl.value : undefined
                }, scope)) { toast('保存失败：这条已经不存在了', 'error'); return; }
                dnaModalClose();
                renderPresetCard(scope);
                log('已修改预设条目 #' + (idx + 1));
            });
            return;
        }
        const act = e.target.closest('[data-eact]');
        if (!act) return;
    });
}


/* ------------------------------ 导入文本：分段 ------------------------------ */
/* 按 token 估算切段：先按空行/换行分块累加，单块自己就超上限的再按句子切，
   单句还超的硬切。切出来的每一段单独发一次请求，提示词里只有这一段。 */
function genTxtSegments(body) {
    const text = String(body || '');
    if (!text.trim()) return [];
    const limit = clampInt(S.genTxtChunk, 0, 200000, 3000);
    if (!limit) return [{ i: 0, text, chars: text.length, tokens: estimateTokens(text) }];
    const out = [];
    const blocks = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    let acc = '';
    const pushHard = (sent) => {
        const step = Math.max(200, Math.floor(limit * 0.9));
        for (let i = 0; i < sent.length; i += step) out.push(sent.slice(i, i + step));
    };
    for (const b of blocks) {
        if (estimateTokens(b) > limit) {
            if (acc.trim()) { out.push(acc); acc = ''; }
            let cur = '';
            for (const sent of b.split(/(?<=[。！？；!?;])/)) {
                if (!sent) continue;
                if (!cur && estimateTokens(sent) > limit) { pushHard(sent); continue; }
                if (cur && estimateTokens(cur + sent) > limit) { out.push(cur); cur = ''; }
                cur += sent;
            }
            if (cur.trim()) out.push(cur);
            continue;
        }
        const next = acc ? (acc + '\n' + b) : b;
        if (acc && estimateTokens(next) > limit) { out.push(acc); acc = b; }
        else acc = next;
    }
    if (acc.trim()) out.push(acc);
    return out.map((t, i) => ({ i, text: t, chars: t.length, tokens: estimateTokens(t) }));
}

/* 界面上选中的那段；分段关着、或选了「全部」时就是全篇 */
function genTxtSendText() {
    const body = genTxtGet();
    const segs = genTxtSegments(body);
    const part = clampInt(S.genTxtPart, 0, 9999, 0);
    if (segs.length > 1 && part > 0 && segs[part - 1]) return segs[part - 1].text;
    return body;
}

function genTxtRefreshSeg() {
    const body = genTxtGet();
    const segs = genTxtSegments(body);
    const limit = clampInt(S.genTxtChunk, 0, 200000, 3000);
    let part = clampInt(S.genTxtPart, 0, 9999, 0);
    if (part > segs.length) { part = 0; S.genTxtPart = 0; }
    const sel = document.querySelector('#dna-tab [data-dna="genTxtPart"]');
    if (sel) {
        sel.innerHTML = segs.length <= 1
            ? '<option value="0">不分段（全文一次发）</option>'
            : ('<option value="0">全部 ' + segs.length + ' 段依次生成</option>'
                + segs.map((sg, i) => '<option value="' + (i + 1) + '">第 ' + (i + 1) + ' 段 · '
                    + sg.chars + ' 字 / 约 ' + sg.tokens + ' token</option>').join(''));
        sel.value = String(part);
    }
    const hint = document.querySelector('#dna-tab [data-dna="genTxtSegHint"]');
    if (hint) {
        if (!String(body || '').trim()) hint.textContent = '还没有文本，导入或粘一段再看分段。';
        else if (segs.length <= 1) {
            hint.textContent = '整篇 ' + body.length + ' 字 / 约 ' + estimateTokens(body) + ' token，'
                + (limit ? ('没超过 ' + limit + ' token 的上限，不用分段。') : '分段关着，整篇一次发。');
        } else if (part > 0) {
            hint.textContent = '共 ' + segs.length + ' 段（上限 ' + limit + ' token/段）。这次只生成第 ' + part
                + ' 段：' + segs[part - 1].chars + ' 字 / 约 ' + segs[part - 1].tokens + ' token。';
        } else {
            hint.textContent = '共 ' + segs.length + ' 段（上限 ' + limit + ' token/段）。这次会依次生成全部 '
                + segs.length + ' 段，一共 ' + segs.length + ' 次请求。';
        }
    }
}

/* 一次点击要发几次请求：世界书/角色各一次；导入文本开了分段就是每段一次 */
function buildGenJobs(m) {
    if (m === 'text') {
        const body = genTxtGet();
        const segs = genTxtSegments(body);
        let part = clampInt(S.genTxtPart, 0, 9999, 0);
        if (part > segs.length) part = 0;
        if (segs.length <= 1 || !part) {
            if (segs.length <= 1) return [{ tag: '', g: buildGenPrompt('text', body) }];
            return segs.map((sg, i) => ({
                tag: '第 ' + (i + 1) + '/' + segs.length + ' 段',
                g: buildGenPrompt('text', sg.text)
            }));
        }
        return [{ tag: '第 ' + part + '/' + segs.length + ' 段', g: buildGenPrompt('text', segs[part - 1].text) }];
    }
    return [{ tag: '', g: buildGenPrompt(m) }];
}

/* ------------------------------ 世界书条目：看 / 改 / 存回去 ------------------------------ */
function genEntryByKey(key) {
    return (genEntriesCache || []).find((e) => e.key === key) || null;
}

function openGenEntryViewer(key) {
    const e = genEntryByKey(key);
    if (!e) { toast('这条已经不在列表里了，点「重新读取」再试', 'error'); return; }
    const isCh = S.genSource === 'chatu8';
    const srcName = isCh ? '智绘姬世界书' : '酒馆世界书';
    dnaModalOpen('查看 / 编辑：' + e.title,
        '<div class="dna-modal-meta">来源：' + esc(srcName)
            + (e.keywords ? (' · 关键词：' + esc(e.keywords)) : '')
            + ' · ' + e.content.length + ' 字</div>' +
        '<div class="dna-modal-field"><label>条目内容（改完点右下角保存，会写回' + esc(srcName) + '）</label>' +
            '<textarea class="st-chatu8-edit-input dna-mono" data-mv="content" rows="20">' + esc(e.content) + '</textarea></div>' +
        '<div class="st-chatu8-edit-buttons dna-modal-foot">' +
            '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>关闭</button>' +
            '<button type="button" class="st-chatu8-edit-button send" data-modal-save>保存到' + esc(srcName) + '</button>' +
        '</div>');
    dnaModalWire(async (mask) => {
        const ta = mask.querySelector('[data-mv="content"]');
        const text = ta ? ta.value : '';
        if (text === e.content) { dnaModalClose(); toast('内容没变，没写入'); return; }
        const done = await saveGenEntryContent(key, text);
        if (done) dnaModalClose();
    });
}

async function saveGenEntryContent(key, text) {
    const e = genEntryByKey(key);
    if (!e) { toast('这条已经不在列表里了，点「重新读取」再试', 'error'); return false; }
    const val = String(text == null ? '' : text);
    try {
        if (S.genSource === 'chatu8') {
            const ch = extension_settings[CHATU8];
            const node = ch && ch.worldBookList ? ch.worldBookList[e.title] : null;
            if (!node) throw new Error('智绘姬世界书里找不到「' + e.title + '」');
            node.content = val;
            saveSettingsDebounced();
            e.content = val;
            renderGenEntries();
            log('已保存智绘姬世界书「' + e.title + '」（' + val.length + ' 字）');
            toast('已存回智绘姬世界书');
            return true;
        }
        /* 酒馆世界书：key = 书名::uid。整本取回来、只改这一条，再整体写回，别的东西不动。 */
        const cut = key.lastIndexOf('::');
        if (cut < 0) throw new Error('条目 key 认不出来：' + key);
        const book = key.slice(0, cut);
        const uid = key.slice(cut + 2);
        const res = await fetch('/api/worldinfo/get', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: book }),
            cache: 'no-cache'
        });
        if (!res.ok) throw new Error('读取世界书失败：HTTP ' + res.status);
        const data = await res.json();
        const entries = (data && data.entries) || {};
        const target = entries[uid];
        if (!target) throw new Error('世界书「' + book + '」里找不到这条（uid ' + uid + '）');
        target.content = val;
        const w = await fetch('/api/worldinfo/edit', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: book, data }),
            cache: 'no-cache'
        });
        if (!w.ok) throw new Error('写入世界书失败：HTTP ' + w.status);
        e.content = val;
        renderGenEntries();
        log('已保存酒馆世界书「' + book + '」的条目「' + e.title + '」（' + val.length + ' 字）');
        toast('已存回酒馆世界书（酒馆里没变就切一下世界书页签刷一下）');
        return true;
    } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        log('保存世界书条目失败：' + msg, 'error');
        toast('保存失败：' + msg, 'error');
        return false;
    }
}

/* ------------------------------ 设置：开关同步 ------------------------------ */
/* 智绘姬本体翻开关的方式是 jQuery：$(this).find('input').prop('checked', !x).trigger('change')。
   jQuery 的 trigger 只走 jQuery 自己的处理器，原生 addEventListener('change') 收不到——
   所以光靠 change 事件，开关点了界面会变、设置却永远是旧值（点保存也存的是旧值，重进就恢复）。
   这里点完等一拍，按 checkbox 的真实状态把设置同步进来；document 级监听，面板被重建也不会丢。 */
let dnaToggleSyncing = false;

/* 开关的中文名（写日志用，用户看不到控制台，靠日志判断有没有同步上） */
function toggleLabelOf(key) {
    const map = {
        enabled: '启用插件', autoScan: '自动记录', followChar: '档案跟随角色卡存档',
        updateExisting: 'AI自动更新档案库', notify: '完成后弹提示', useRegex: '正文先过正则',
        breakTool: '自定义 Tool', breakTail: '末尾多 Role', sendEnabled: '发送 DNA',
        presetEnabled: '档案库用上下文预设', presetMergeSystem: '档案库合并 system',
        genPresetEnabled: '手动生成用上下文预设', genPresetMergeSystem: '手动生成合并 system',
        genBookFollowCard: '世界书跟随角色卡'
    };
    return map[key] || key;
}

function syncTogglesFromDom() {
    const tab = document.querySelector('#dna-tab');
    if (!tab || dnaToggleSyncing) return false;
    const changed = [];
    let followChanged = false;
    let bookFollowChanged = false;
    tab.querySelectorAll('input[type="checkbox"][data-dna]').forEach((el) => {
        const key = el.dataset.dna;
        if (!(key in DEFAULTS) || typeof DEFAULTS[key] !== 'boolean') return;
        const now = !!el.checked;
        if (!!S[key] === now) return;
        S[key] = now;
        changed.push(key);
        if (key === 'followChar') followChanged = true;
        if (key === 'genBookFollowCard') bookFollowChanged = true;
    });
    if (!changed.length) return false;
    dnaToggleSyncing = true;
    try {
        saveSettings(true);
        updateDerivedUI();
        try { renderPresetCard('lib'); renderPresetCard('gen'); renderPresetCard('ranobe'); } catch (e) { /* 忽略 */ }
        if (followChanged) { selected = null; renderList(); }
        log('设置已更新：' + changed.map(toggleLabelOf).join('、'));
    } finally {
        dnaToggleSyncing = false;
    }
    if (bookFollowChanged) {
        followCardWorldBook().then((ok) => {
            if (ok) {
                log('世界书已跟随角色卡切到「' + S.genBook + '」');
                loadGenSource();
            }
        }).catch(() => { /* 取不到角色卡就保持原样 */ });
    }
    return true;
}

function installDnaToggleSync() {
    if (window.__dnaToggleSync) return;
    window.__dnaToggleSync = true;
    /* 点开关：等本体那次 prop/trigger 做完再看真实状态 */
    document.addEventListener('click', (e) => {
        const hit = (e.target && e.target.closest) ? e.target.closest('#dna-tab .st-chatu8-toggle') : null;
        if (!hit) return;
        setTimeout(() => { try { syncTogglesFromDom(); } catch (err) { /* 忽略 */ } }, 0);
    }, false);
    /* 键盘空格、脚本改值这类真原生 change 也同步一次 */
    document.addEventListener('change', (e) => {
        const el = e.target;
        if (!el || el.type !== 'checkbox' || !el.dataset || !el.dataset.dna) return;
        if (!el.closest || !el.closest('#dna-tab')) return;
        syncTogglesFromDom();
    }, true);
}

/* ------------------------------ 设置：手动保存 ------------------------------ */
function onSaveAll() {
    /* 先按界面上的真实状态同步一遍，再落盘（手快时开关同步的那一拍可能还没到） */
    try { syncTogglesFromDom(); } catch (e) { /* 忽略 */ }
    saveSettings(true);
    /* saveSettingsDebounced 是防抖的：点完保存立刻退出应用，可能还没写进 settings.json，这里强刷一次 */
    try {
        if (typeof saveSettingsDebounced.flush === 'function') saveSettingsDebounced.flush();
    } catch (e) { /* 忽略 */ }
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const hhmm = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    const h = document.querySelector('#dna-tab [data-dna="saveHint"]');
    if (h) h.textContent = '已保存 · ' + hhmm;
    log('设置已手动保存（' + hhmm + '）');
    toast('设置已保存');
}

function bindPanel() {
    const tab = document.querySelector('#dna-tab');
    if (!tab || tab.dataset.bound === '1') return;
    tab.dataset.bound = '1';
    bindFoldClicks(tab);

    /* 子板块切换：档案库 / 手动生成 / 发送 & 工具 / 设置
       只切显示，不重建 DOM——所有 data-dna 控件都还在，事件绑定不受影响。 */
    const subTabs = Array.from(tab.querySelectorAll('.st-chatu8-sub-nav-link'));
    const subPanels = Array.from(tab.querySelectorAll('.dna-panel'));
    const showSub = (name) => {
        if (!name || !subPanels.some((p) => p.dataset.dnaPanel === name)) name = 'arch';
        subTabs.forEach((b) => b.classList.toggle('active', b.dataset.dnaTab === name));
        subPanels.forEach((p) => p.classList.toggle('active', p.dataset.dnaPanel === name));
        tab.dataset.sub = name;
        /* 同人资料库：内置本体是静态文件，切过去再载入并渲染 */
        if (name === 'ranobe') {
            const scope = libScopeOf(name);
            const st = libState(scope);
            libSetVal(name, 'Search', st.q || '');
            libSetVal(name, 'Req', st.req || '');
            setTimeout(() => { renderLib(name).catch(() => { /* 读取失败已在 renderLib 里记日志 */ }); }, 0);
            /* 同人资料库页里还挂着一块「世界书生成」，一起渲染 */
            if (name === 'ranobe') {
                libSetVal('ranobewb', 'Search', st.q || '');
                libSetVal('ranobewb', 'Req', st.req || '');
                setTimeout(() => { renderLib('ranobewb').catch(() => { /* 同上 */ }); }, 0);
            }
        }
        /* 切过去的时候再确认一遍折叠结构。幂等的：已经改造过的直接跳过，
           所以就算哪个 section 被外部重建了，切一次页签也能自愈。 */
        applyFolds();
    };
    subTabs.forEach((b) => {
        b.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSub(b.dataset.dnaTab);
        });
    });
    showSub(tab.dataset.sub || 'arch');
    applyFolds();
    bindPresetBoxes(tab);

    const fill = () => {
        applyFolds();
        tab.querySelector('[data-dna="enabled"]').checked = !!S.enabled;
        tab.querySelector('[data-dna="autoScan"]').checked = !!S.autoScan;
        tab.querySelector('[data-dna="followChar"]').checked = !!S.followChar;
        tab.querySelector('[data-dna="updateExisting"]').checked = !!S.updateExisting;
        tab.querySelector('[data-dna="replyMaxTokens"]').value = String(S.replyMaxTokens);
        tab.querySelector('[data-dna="notify"]').checked = !!S.notify;
        tab.querySelector('[data-dna="useRegex"]').checked = !!S.useRegex;
        const rtEl = tab.querySelector('[data-dna="retryCount"]');
        if (rtEl) rtEl.value = S.retryCount;
        tab.querySelector('[data-dna="breakTool"]').checked = !!S.breakTool;
        tab.querySelector('[data-dna="breakTail"]').checked = !!S.breakTail;
        tab.querySelector('[data-dna="scanDepth"]').value = S.scanDepth;
        tab.querySelector('[data-dna="autoEvery"]').value = S.autoEvery;
        const mcEl = tab.querySelector('[data-dna="autoMinChars"]');
        if (mcEl) mcEl.value = String(S.autoMinChars);
        const searchEl = tab.querySelector('[data-dna="search"]');
        if (searchEl) searchEl.value = searchTerm;
        tab.querySelector('[data-dna="uiMode"]').value = S.uiMode || 'auto';
        const gtc = tab.querySelector('[data-dna="genTxtChunk"]');
        if (gtc) gtc.value = String(S.genTxtChunk);
        genTxtRefreshSeg();
        tab.querySelector('[data-dna="sendEnabled"]').checked = !!S.sendEnabled;
        const pe = tab.querySelector('[data-dna="presetEnabled"]');
        if (pe) pe.checked = !!S.presetEnabled;
        const pm = tab.querySelector('[data-dna="presetMergeSystem"]');
        if (pm) pm.checked = S.presetMergeSystem !== false;
        const gpe = tab.querySelector('[data-dna="genPresetEnabled"]');
        if (gpe) gpe.checked = !!S.genPresetEnabled;
        const gpm = tab.querySelector('[data-dna="genPresetMergeSystem"]');
        if (gpm) gpm.checked = S.genPresetMergeSystem !== false;
        const gs = tab.querySelector('[data-dna="genSource"]');
        if (gs) gs.value = S.genSource === 'chatu8' ? 'chatu8' : 'st';
        const gfc = tab.querySelector('[data-dna="genBookFollowCard"]');
        if (gfc) gfc.checked = S.genBookFollowCard !== false;
        const gi = tab.querySelector('[data-dna="genInstruction"]');
        if (gi) gi.value = S.genInstruction || '';
        genTxtRefresh();
        if (!genEntriesCache.length) loadGenSource();
        else { renderGenEntries(); renderGenChars(); renderGenInfo(); }
        updateDerivedUI();
        renderPresetCard('lib');
        renderPresetCard('gen');
        renderPresetCard('ranobe');
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
            renderPresetCard('ranobe');
        });
        if (el.type === 'text' || el.type === 'password' || el.type === 'number') {
            el.addEventListener('input', () => { S[key] = read(); saveSettings(true); updateDerivedUI(); });
        }
    };

    ['enabled', 'autoScan', 'followChar', 'updateExisting', 'notify', 'useRegex', 'breakTool', 'breakTail'].forEach((k) => onChange(k, 'bool'));
    onChange('scanDepth', 'int');
    onChange('replyMaxTokens', 'int');
    onChange('retryCount', 'int');
    onChange('autoEvery', 'int');
    onChange('autoMinChars', 'int');
    onChange('uiMode', 'str');

    tab.querySelector('[data-dna="scanNow"]').addEventListener('click', () => runScan({ depth: S.scanDepth }));
    ABORT_KEYS.forEach((k) => {
        const b = tab.querySelector('[data-dna="' + k + '"]');
        if (b) b.addEventListener('click', () => doAbort());
    });
    /* ---------- 同人资料库（含世界书生成） ---------- */
    ['ranobe', 'ranobewb'].forEach((tag) => {
        const one = (base, ev, fn) => {
            const el = tab.querySelector('[data-dna="' + tag + base + '"]');
            if (el) el.addEventListener(ev, fn);
        };
        one('Copy', 'click', () => copyAiReply('ranobe'));
        one('ClearReply', 'click', () => clearAiReply('ranobe'));
        one('Import', 'click', () => {
            const f = tab.querySelector('[data-dna="' + tag + 'File"]');
            if (f) f.click();
        });
        one('File', 'change', (e) => {
            const f = e.target && e.target.files && e.target.files[0];
            onLibImportFile(tag, f).then(() => { try { e.target.value = ''; } catch (err) { /* 忽略 */ } });
        });
        one('Export', 'click', () => onLibExport(tag));
        one('Add', 'click', () => openLibEntry(tag, '', true));
        one('FromWb', 'click', () => onRanobeFromWb());
        one('Reset', 'click', () => onLibReset(tag));
        one('Reload', 'click', () => onLibReload(tag));
        one('Search', 'input', (e) => {
            libState(libScopeOf(tag)).q = String(e.target.value || '');
            renderLib(tag).catch(() => { /* 忽略 */ });
        });
        one('Search', 'change', () => saveSettings(true));
        one('Req', 'change', (e) => {
            libState(libScopeOf(tag)).req = String(e.target.value || '');
            saveSettings(true);
        });
        one('SelAll', 'click', () => {
            const scope = libScopeOf(tag);
            const st = libState(scope);
            const q = String(st.q || '').trim().toLowerCase();
            const all = LIB_CACHE[scope] || [];
            const hit = (q ? all.filter((e) => libHit(e, q)) : all).map((e) => e.k);
            const cur = st.sel || [];
            libSaveSel(tag, cur.concat(hit.filter((k) => cur.indexOf(k) < 0)));
        });
        one('SelNone', 'click', () => libSaveSel(tag, []));
        one('Run', 'click', () => onLibDna(tag));
        one('Abort', 'click', () => doAbort());
        one('TestPreview', 'click', () => onLibTest(tag, false));
        one('TestLLM', 'click', () => onLibTest(tag, true));
        one('TestClear', 'click', () => { libSetVal(tag, 'TestPrompt', ''); libSetVal(tag, 'TestResult', ''); });
        /* 列表：勾选 + 编辑按钮（事件委托，列表重渲染也不用重绑） */
        const box = tab.querySelector('[data-dna="' + tag + 'List"]');
        if (box) {
            box.addEventListener('change', (e) => {
                const cb = e.target;
                if (!cb || !cb.getAttribute || !cb.hasAttribute('data-libsel')) return;
                const k = cb.getAttribute('data-libsel');
                const scope = libScopeOf(tag);
                const st = libState(scope);
                const cur = new Set(st.sel || []);
                if (cb.checked) cur.add(k); else cur.delete(k);
                st.sel = Array.from(cur);
                saveSettings(true);
                const row = cb.closest ? cb.closest('.dna-lib-row') : null;
                if (row) row.classList.toggle('is-on', !!cb.checked);
                libSetText(tag, 'Meta', '共 ' + (LIB_CACHE[scope] || []).length + ' 条 · 已勾选 ' + libPicked(tag).length);
            });
            box.addEventListener('click', (e) => {
                const btn = (e.target && e.target.closest) ? e.target.closest('[data-libedit]') : null;
                if (!btn) return;
                e.preventDefault();
                openLibEntry(tag, btn.getAttribute('data-libedit'), false);
            });
        }
    });
    tab.querySelector('[data-dna="clearLog"]').addEventListener('click', () => { LOG.length = 0; renderLog(); });

    /* 发送数据 */
    tab.querySelector('[data-dna="sendEnabled"]').addEventListener('change', (e) => {
        S.sendEnabled = !!e.target.checked;
        saveSettings(true);
    });

    bindPresetSection(tab, 'lib');
    bindPresetSection(tab, 'gen');
    bindPresetSection(tab, 'ranobe');

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
    tab.querySelector('[data-dna="genEntryList"]').addEventListener('click', (e) => {
        const eye = e.target.closest('[data-genlook]');
        if (!eye) return;
        e.preventDefault();
        e.stopPropagation();
        openGenEntryViewer(eye.dataset.genlook);
    });
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
    tab.querySelector('[data-dna="genOutfitSearch"]').addEventListener('input', () => renderGenOutfits());
    tab.querySelector('[data-dna="genOutfitAll"]').addEventListener('click', () => setAllGenOutfits(true));
    tab.querySelector('[data-dna="genOutfitNone"]').addEventListener('click', () => setAllGenOutfits(false));
    tab.querySelector('[data-dna="genOutfitList"]').addEventListener('change', (e) => {
        const cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        const row = cb.closest('[data-genoutfit]');
        if (!row) return;
        row.classList.toggle('dna-entry-off', !cb.checked);
        toggleGenOutfit(row.dataset.genoutfit, !!cb.checked);
    });
    tab.querySelector('[data-dna="genRunWorld"]').addEventListener('click', () => onGenDna('world'));
    tab.querySelector('[data-dna="genRunChars"]').addEventListener('click', () => onGenDna('chars'));

    tab.querySelector('[data-dna="genRunMix"]').addEventListener('click', () => onGenDna('mix'));

    /* ③ 按导入文本生成 */
    tab.querySelector('[data-dna="genTxtPick"]').addEventListener('click', () => onGenTxtPick());
    tab.querySelector('[data-dna="genTxtClearFile"]').addEventListener('click', () => onGenTxtClearFile());
    tab.querySelector('[data-dna="genTxtFile"]').addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        onGenTxtFileChosen(f);
        e.target.value = '';       /* 同一个文件再选一次也要能触发 */
    });
    tab.querySelector('[data-dna="genTxtContent"]').addEventListener('input', (e) => {
        genTxtBody = e.target.value || '';
        genTxtRefresh();
    });
    tab.querySelector('[data-dna="genTxtChunk"]').addEventListener('change', (e) => {
        S.genTxtChunk = clampInt(e.target.value, 0, 200000, 3000);
        e.target.value = String(S.genTxtChunk);
        S.genTxtPart = 0;
        saveSettings(true);
        genTxtRefreshSeg();
    });
    tab.querySelector('[data-dna="genTxtPart"]').addEventListener('change', (e) => {
        S.genTxtPart = clampInt(e.target.value, 0, 9999, 0);
        saveSettings(true);
        genTxtRefreshSeg();
    });
    tab.querySelector('[data-dna="genTxtResplit"]').addEventListener('click', () => {
        genTxtRefreshSeg();
        toast('已按当前上限重新分段');
    });
    tab.querySelector('[data-dna="genTxtContent"]').addEventListener('change', () => genTxtRefreshSeg());
    tab.querySelector('[data-dna="genRunText"]').addEventListener('click', () => onGenDna('text'));
    tab.querySelector('[data-dna="genClear"]').addEventListener('click', () => {
        S.genEntries = [];
        S.genChars = [];
        S.genExtraChars = [];
        saveSettings(true);
        onGenTxtClearFile();
        renderGenEntries();
        renderGenChars();
        log('已清空手动生成的选择');
    });

    /* 正则 & 测试工具（档案库这套：正文过正则 → 组装 → 试跑） */
    tab.querySelector('[data-dna="testRegex"]').addEventListener('click', onTestRegex);
    tab.querySelector('[data-dna="testAssemble"]').addEventListener('click', onTestAssemble);
    tab.querySelector('[data-dna="testLLM"]').addEventListener('click', onTestLLM);
    tab.querySelector('[data-dna="aiReplyLibCopy"]').addEventListener('click', () => copyAiReply('lib'));
    tab.querySelector('[data-dna="aiReplyLibClear"]').addEventListener('click', () => clearAiReply('lib'));
    tab.querySelector('[data-dna="aiReplyGenCopy"]').addEventListener('click', () => copyAiReply('gen'));
    tab.querySelector('[data-dna="aiReplyGenClear"]').addEventListener('click', () => clearAiReply('gen'));
    const saveAllBtn = tab.querySelector('[data-dna="saveAll"]');
    if (saveAllBtn) saveAllBtn.addEventListener('click', () => onSaveAll());
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
    bindProfileSection(tab, 'ranobe');

    /* 智绘姬那边换配置时，这边两套都跟着刷新 */
    try {
        const chSel = document.querySelector('#ch-llm_profile_select');
        if (chSel && chSel.dataset.dnaWatch !== '1') {
            chSel.dataset.dnaWatch = '1';
            chSel.addEventListener('change', () => setTimeout(() => {
                ['lib', 'gen', 'ranobe'].forEach((sc) => { fillProfileSelect(sc); renderConfigDetail(sc); updateModelHint(sc); });
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

    /* 档案模板 */
    const tplSel = tab.querySelector('[data-dna="tplSelect"]');
    if (tplSel) tplSel.addEventListener('change', () => onTplSelect(tplSel));
    tab.querySelector('[data-dna="tplNew"]').addEventListener('click', onTplNew);
    tab.querySelector('[data-dna="tplEdit"]').addEventListener('click', onTplEdit);
    tab.querySelector('[data-dna="tplExport"]').addEventListener('click', onTplExport);
    tab.querySelector('[data-dna="tplImport"]').addEventListener('click', () => tab.querySelector('[data-dna="tplFile"]').click());
    tab.querySelector('[data-dna="tplFile"]').addEventListener('change', onTplImport);
    tab.querySelector('[data-dna="tplDelete"]').addEventListener('click', onTplDelete);
    tab.querySelector('[data-dna="tplReset"]').addEventListener('click', onTplReset);
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

    const searchBox = tab.querySelector('[data-dna="search"]');
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            searchTerm = String(searchBox.value || '');
            renderList();
        });
    }

    tab.querySelector('[data-dna="list"]').addEventListener('click', (e) => {
        const row = e.target.closest('.dna-item');
        if (!row) return;
        const name = row.dataset.name;
        if (e.target.closest('[data-act="lock"]')) {
            e.stopPropagation();
            toggleLock(name);
            return;
        }
        if (e.target.closest('[data-act="force"]')) {
            e.stopPropagation();
            toggleForceSend(name);
            return;
        }
        if (e.target.closest('[data-act="rename"]')) {
            e.stopPropagation();
            openRenameModal(name);
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
        /* 改名：整条档案换个键，字段内容 / 锁 / 形态标记都跟着走 */
        const rnBtn = e.target.closest('[data-rename]');
        if (rnBtn && selected) {
            openRenameModal(selected);
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
        /* 单个字段的小锁 */
        const flBtn = e.target.closest('[data-lockfield]');
        if (flBtn) {
            toggleFieldLock(flBtn.dataset.lockfield);
            return;
        }
        /* 字段编辑：弹悬浮窗改，不挤在面板里 */
        const editBtn = e.target.closest('[data-editfield]');
        if (editBtn && selected) {
            if (isLocked(selected)) {
                toast('「' + selected + '」已锁定，先点小锁解锁再改', 'error');
                return;
            }
            if (fieldLocked(editBtn.dataset.editfield)) {
                toast('「' + editBtn.dataset.editfield + '」这个字段已锁，先点它旁边的小锁', 'error');
                return;
            }
            const k = editBtn.dataset.editfield;
            const who = selected;
            const rec0 = currentEntries()[who];
            const cur = rec0 ? String(rec0[k] || '') : '';
            dnaModalOpen('编辑「' + who + '」· ' + k,
                '<div class="dna-modal-field">' +
                    '<textarea class="st-chatu8-edit-input dna-mono" data-modal-ta rows="16">' + esc(cur) + '</textarea>' +
                    '' +
                '</div>' +
                '<div class="st-chatu8-edit-buttons dna-modal-foot">' +
                    '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>' +
                    '<button type="button" class="st-chatu8-edit-button send" data-modal-save>保存</button>' +
                '</div>');
            dnaModalWire((mask) => {
                const ta = mask.querySelector('[data-modal-ta]');
                const rec = currentEntries()[who];
                if (rec && ta) {
                    rec[k] = ta.value;
                    rec._updated = Date.now();
                    saveSettings(true);
                    log('已修改「' + who + '」的「' + k + '」');
                }
                dnaModalClose();
                renderList();
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
    const hint = document.querySelector('#dna-tab [data-dna="' + dkey(scope, 'modelHint') + '"]');
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
    if (autoState) {
        const needC = clampInt(S.autoMinChars, 0, 100000, 0);
        autoState.textContent = S.autoScan
            ? ('自动记录已开启 · 每 ' + S.autoEvery + ' 层' + (needC > 0 ? (' · 正文≥' + needC + ' 字') : ''))
            : '自动记录已关闭';
    }
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
    applyUiMode();
}

function refreshLLMCard() {
    ['lib', 'gen', 'ranobe'].forEach((sc) => {
        fillProfileSelect(sc);
        renderConfigDetail(sc);
        updateModelHint(sc);
    });
}

/* 搜索：角色名 / 本名 / 形态名 / 别称 任意一个包含搜索词就算命中 */
function hitSearch(x, q, entries) {
    if (!q) return true;
    const rec = (entries && entries[x.name]) || {};
    const bag = [x.name, x.info.base, x.info.form, String(rec[ALIAS_FIELD] || ''), String(rec['姓名'] || '')];
    return bag.some((v) => String(v == null ? '' : v).toLowerCase().indexOf(q) >= 0);
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
    const allOrdered = [];
    for (const base of [...groups.keys()].sort((a, b) => String(a).localeCompare(String(b), 'zh'))) {
        for (const x of groups.get(base)) allOrdered.push(x);
    }
    const q = String(searchTerm || '').trim().toLowerCase();
    const ordered = q ? allOrdered.filter((x) => hitSearch(x, q, entries)) : allOrdered;
    const names = ordered.map((x) => x.name);
    if (cnt) cnt.textContent = q ? (names.length + ' / ' + allOrdered.length) : String(allOrdered.length);
    const lkCnt = tab.querySelector('[data-dna="lockCount"]');
    if (lkCnt) {
        /* 一条都没锁的时候不显示这个标签——默认状态就是全解锁，界面上不占地方 */
        const nLk = names.filter((n) => entries[n] && entries[n]._locked).length;
        lkCnt.textContent = nLk ? ('已锁 ' + nLk + ' / ' + names.length) : '';
        lkCnt.style.display = nLk ? '' : 'none';
        lkCnt.classList.toggle('dna-badge-warn', nLk > 0);
    }

    if (!names.length) {
        listBox.innerHTML = '<div class="dna-empty">'
            + (q ? ('没有匹配「' + esc(String(searchTerm || '').trim()) + '」的档案。')
                 : '这个档案库还是空的。点「立即记录」或等自动记录攒几条。')
            + '</div>';
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
        const forced = !!rec._forceSend;
        const fi = x.info;
        const aliases = aliasSplit(rec[ALIAS_FIELD]);
        const aliasHtml = aliases.length
            ? '<span class="dna-item-alias" title="别称：' + esc(aliases.join(ALIAS_SEP)) + '">' + esc(aliases.join(ALIAS_SEP)) + '</span>'
            : '';
        /* 形态档案：显示「本名 · 形态名」+ 状态徽标，一眼看出是同一个人的不同形态 */
        const nameHtml = fi.isForm
            ? ('<span class="dna-form-base">' + esc(fi.base) + '</span>' +
                (fi.form ? '<span class="dna-form-sep">·</span><span class="dna-form-name">' + esc(fi.form) + '</span>' : '') +
                (fi.tag ? '<span class="dna-form-tag' +
                    (fi.isCurrent ? ' is-cur' : (fi.isSealed ? ' is-seal' : '')) + '">' + esc(fi.tag) + '</span>' : ''))
            : esc(n);
        /* 第二行小字：更新时间 + 这条现在的状态（强制发送 / 已锁定） */
        const subBits = [esc(fmtTime(rec._updated))];
        if (forced) subBits.push('强制发送');
        if (lk) subBits.push('已锁定');
        return '<div class="dna-item' + active + (lk ? ' dna-item-locked' : '') + (fi.isForm ? ' dna-item-form' : '') + '" data-name="' + esc(n) + '">' +
            '<span class="dna-item-main">' +
            '<span class="dna-item-name">' + (lk ? '<i class="fa-solid fa-lock dna-lock-ico"></i>' : '') + nameHtml + aliasHtml + '</span>' +
            '<span class="dna-item-sub">' + subBits.join(' · ') + '</span>' +
            '</span>' +
            '<span class="dna-item-acts">' +
            '<button class="dna-mini dna-mini-lock' + (lk ? ' is-locked' : '') + '" data-act="lock" title="' +
            (lk ? '已锁定：AI 不会改这条（点一下解锁）' : '未锁定：点一下锁住，AI 就不会再改这条') + '">' +
            '<i class="fa-solid ' + (lk ? 'fa-lock' : 'fa-lock-open') + '"></i></button>' +
            '<button class="dna-mini dna-mini-force' + (forced ? ' is-on' : '') + '" data-act="force" title="' +
            (forced ? '强制发送已开：以后每次发送都会带上这条（不管正文提没提到）' : '强制发送：打开后每次发送都会带上这条档案，不管正文提没提到') + '">' +
            '<i class="fa-solid fa-paper-plane"></i></button>' +
            '<button class="dna-mini" data-act="rename" title="修改这条档案的名字"><i class="fa-solid fa-pen"></i></button>' +
            '<button class="dna-mini" data-act="copy" title="复制完整档案">复制</button>' +
            '<button class="dna-mini dna-mini-del" data-act="del" title="删除">×</button>' +
            '</span>' +
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
    /* 详情按当前模板的字段顺序展示（姓名在标题上，不重复；旧档案多出来的字段跟在后） */
    const rows = tplDetailFields(rec).map((k) => [k, rec[k]]);
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
                ? ''
                : ('' +
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
        '<button class="dna-mini" data-rename="1" title="改这个角色的档案名">改名</button>' +
        '<button class="dna-mini" data-copy="all">复制全部</button></div>' + formLine +
        rows.map(([k, v]) => {
            const open = (editingField === k);
            const flock = fieldLocked(k);
            const lked = !!rec._locked || flock;
            const head = '<div class="dna-field-h">' + esc(k) +
                '<button class="dna-mini dna-mini-lock' + (flock ? ' is-locked' : '') + '" data-lockfield="' + esc(k) + '" title="' +
                (flock
                    ? '这个字段已锁：AI 不会改写它，也不能手动编辑（点一下解锁）'
                    : '未锁：点一下锁住这个字段，AI 和手动编辑都不会再改它') + '">' +
                '<i class="fa-solid ' + (flock ? 'fa-lock' : 'fa-lock-open') + '"></i></button>' +
                '<button class="dna-mini" data-copy="' + esc(k) + '">复制</button>' +
                '<button class="dna-mini' + (open ? ' dna-mini-on' : '') + (lked ? ' dna-mini-dis' : '') +
                '" data-editfield="' + esc(k) + '" title="' +
                (lked ? (flock ? '这个字段已锁，先点它旁边的小锁' : '已锁定，先解锁再改') : '编辑这个字段') + '">' +
                (open ? '收起' : '编辑') + '</button></div>';
            if (!open) {
                return '<div class="dna-field' + (flock ? ' is-fieldlocked' : '') + '">' + head +
                    '<div class="dna-field-v">' + (v ? esc(v) : '<span class="dna-empty-inline">（空）</span>') + '</div></div>';
            }
            return '<div class="dna-field' + (flock ? ' is-fieldlocked' : '') + '">' + head +
                '<textarea class="st-chatu8-textarea dna-mono" data-fieldbox="' + esc(k) + '" rows="6">' + esc(v || '') + '</textarea>' +
                '<div class="dna-actions"><button class="st-chatu8-btn" data-fact="save"><i class="fa-solid fa-check"></i>保存</button>' +
                '<button class="st-chatu8-btn" data-fact="cancel">取消</button></div></div>';
        }).join('');
}

/* 改档案名：整条档案换一个键，字段内容 / 锁 / 形态标记都跟着走 */
function openRenameModal(oldName) {
    const rec0 = currentEntries()[oldName];
    if (!rec0) return;
    dnaModalOpen('修改档案名',
        '<div class="dna-modal-row"><label>新名字</label>' +
        '<input type="text" class="st-chatu8-text-input" data-rn="name" value="' + esc(oldName) + '"></div>' +
        '<div class="st-chatu8-edit-buttons dna-modal-foot">' +
        '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>' +
        '<button type="button" class="st-chatu8-edit-button send" data-modal-save>保存</button></div>');
    dnaModalWire((mask) => {
        const input = mask.querySelector('[data-rn="name"]');
        const nm = String((input && input.value) || '').trim();
        if (!nm) { toast('名字不能为空', 'error'); return; }
        if (nm === oldName) { dnaModalClose(); return; }
        const list = currentEntries();
        if (list[nm]) { toast('已经有同名档案了：' + nm, 'error'); return; }
        const rec = list[oldName];
        if (!rec) { dnaModalClose(); return; }
        delete list[oldName];
        rec['姓名'] = nm;
        rec._updated = Date.now();
        list[nm] = rec;
        const b = bucket(cardKey(), false);
        if (b) b.updated = Date.now();
        if (selected === oldName) selected = nm;
        saveSettings(true);
        dnaModalClose();
        renderList();
        log('档案改名：' + oldName + ' → ' + nm);
        toast('已改名为「' + nm + '」');
    });
}

/* ------------------------------ 档案模板 UI ------------------------------ */
function tplNames() {
    return Object.keys(S.dnaTemplates || {});
}

function renderTemplateUI() {
    const tab = document.querySelector('#dna-tab');
    if (!tab) return;
    const sel = tab.querySelector('[data-dna="tplSelect"]');
    if (sel) {
        sel.innerHTML = '<option value="">默认模板（内置）</option>' +
            tplNames().map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
        sel.value = tplIsDefault() ? '' : S.dnaTemplate;
    }
    const badge = tab.querySelector('[data-dna="tplBadge"]');
    if (badge) badge.textContent = tplIsDefault() ? '默认模板（内置）' : S.dnaTemplate;
    const hint = tab.querySelector('[data-dna="tplHint"]');
    if (hint) hint.textContent = tplFields().length + ' 个字段（字段规范 / 输出格式由上下文预设提供）';
    const pv = tab.querySelector('[data-dna="tplPreview"]');
    if (pv) pv.value = JSON.stringify(templateExport(''), null, 2);
}

function onTplSelect(sel) {
    const v = String((sel && sel.value) || '');
    S.dnaTemplate = (v && (S.dnaTemplates || {})[v]) ? v : '';
    saveSettings(true);
    renderTemplateUI();
    log('档案模板切到：' + (tplIsDefault() ? '默认模板' : S.dnaTemplate));
}

function onTplExport() {
    const payload = templateExport('');
    if (!payload) { toast('没有可导出的模板'); return; }
    try { payload.name = payload.name || '默认模板'; } catch (e) { /* 忽略 */ }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(payload.name).replace(/[\\/:*?"<>|]/g, '_');
    a.href = url;
    a.download = 'DNA档案模板_' + safe + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    log('已导出模板：' + payload.name);
    toast('已导出模板：' + payload.name);
}

/* 一个文件里可以放一份，也可以放多份（数组 / {templates:{名:…}}） */
function onTplImport(ev) {
    const input = ev.target;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(String(reader.result || ''));
            const list = [];
            if (Array.isArray(data)) list.push.apply(list, data);
            else if (data && Array.isArray(data.templates)) list.push.apply(list, data.templates);
            else if (data && data.templates && typeof data.templates === 'object') {
                for (const k of Object.keys(data.templates)) {
                    list.push(Object.assign({ name: k }, data.templates[k] || {}));
                }
            } else if (data && typeof data === 'object') list.push(data);
            if (!list.length) throw new Error('文件里没找到模板');
            const names = [];
            for (let i = 0; i < list.length; i++) {
                const t = normalizeTemplate(list[i], '导入模板' + (i + 1));
                S.dnaTemplates[t.name] = t;
                names.push(t.name);
            }
            S.dnaTemplate = names[names.length - 1] || '';
            saveSettings(true);
            renderTemplateUI();
            log('导入模板 ' + names.length + ' 份：' + names.join('、'));
            toast('导入模板 ' + names.length + ' 份，已切到「' + names[names.length - 1] + '」');
        } catch (e) {
            log('模板导入失败：' + (e && e.message ? e.message : e), 'error');
            toast('模板导入失败：' + (e && e.message ? e.message : e), 'error');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file, 'utf-8');
}

function onTplDelete() {
    if (tplIsDefault()) { toast('默认模板是内置的，删不掉'); return; }
    const nm = S.dnaTemplate;
    if (!confirm('删除模板「' + nm + '」？（已经在档案里的内容不受影响）')) return;
    delete S.dnaTemplates[nm];
    S.dnaTemplate = '';
    saveSettings(true);
    renderTemplateUI();
    log('已删除模板：' + nm + '（回到默认模板）');
    toast('已删除模板：' + nm);
}

function onTplReset() {
    S.dnaTemplate = '';
    saveSettings(true);
    renderTemplateUI();
    toast('已切回默认模板');
}

/* 模板只提供字段表，提示词在预设里 —— 这句在面板和编辑弹窗里各露一次 */
const TPL_SYNC_NOTE = '修改模板必须要修改对应的上下文预设：模板只提供字段表，字段规范 / 输出格式那些提示词写在预设里，不会跟着模板自动变。';

/* 打开模板编辑器：name 留空 = 新建（用当前模板的字段做底，方便二创） */
function openTplEditor(name) {
    const key = String(name || '');
    const bag = S.dnaTemplates || {};
    const cur = (key && bag[key]) ? bag[key] : null;
    const isNew = !cur;
    const tname = cur ? String(cur.name || key) : ('模板 ' + (tplNames().length + 1));
    const fields = (cur ? (cur.fields || []) : tplFields()).join('\n');
    const body =
        '<div class="dna-modal-row"><label>模板名</label>' +
        '<input type="text" class="st-chatu8-text-input" data-tf="name" value="' + esc(tname) + '"></div>' +
        '<div class="dna-modal-field"><label>字段（一行一个，按这个顺序输出；姓名必须第一个）</label>' +
        '<textarea class="st-chatu8-edit-input dna-mono" data-tf="fields" rows="14">' + esc(fields) + '</textarea></div>' +
        '' +
        '' +
        '<div class="st-chatu8-edit-buttons dna-modal-foot">' +
        '<button type="button" class="st-chatu8-edit-button cancel" data-modal-cancel>取消</button>' +
        '<button type="button" class="st-chatu8-edit-button send" data-modal-save>保存模板</button></div>';
    dnaModalOpen(isNew ? '新建档案模板' : '编辑档案模板', body);
    dnaModalWire((mask) => {
        try {
            const nmIn = mask.querySelector('[data-tf="name"]');
            const fdIn = mask.querySelector('[data-tf="fields"]');
            const nm = String((nmIn && nmIn.value) || '').trim();
            const fd = String((fdIn && fdIn.value) || '');
            const t = normalizeTemplate({ name: nm || tname, fields: fd }, '未命名模板');
            S.dnaTemplates = S.dnaTemplates || {};
            if (S.dnaTemplates[t.name] && (!cur || t.name !== key)) {
                toast('已经有同名模板「' + t.name + '」，换个名字');
                return;
            }
            if (cur && key && key !== t.name) delete S.dnaTemplates[key];
            S.dnaTemplates[t.name] = t;
            S.dnaTemplate = t.name;
            saveSettings(true);
            renderTemplateUI();
            dnaModalClose();
            log('保存档案模板：' + t.name + '（' + t.fields.length + ' 个字段）');
            toast('已保存模板「' + t.name + '」，记得同步改上下文预设');
        } catch (e) {
            toast('保存失败：' + (e && e.message ? e.message : e), 'error');
        }
    });
}

function onTplNew() {
    openTplEditor('');
}

/* 内置默认模板不让直接改：复制一份出来编辑 */
function onTplEdit() {
    if (tplIsDefault()) {
        if (!confirm('「默认模板」是内置的，不能直接改。要复制一份出来编辑吗？')) return;
        openTplEditor('');
        return;
    }
    openTplEditor(S.dnaTemplate);
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
            const k = cardKey();
            /* 导入是「往当前存档里装」：缺库就建空的，不要顺手把老库搬进来 */
            if (!S.records[k]) S.records[k] = { card: cardLabel(), entries: {}, updated: 0 };
            const b = bucket(k, true);
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
/* 最后一条 AI 消息（玩家的楼层不算） */
function lastAiMessage(chat) {
    const arr = Array.isArray(chat) ? chat : [];
    for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        if (!m || m.is_system || m.is_user) continue;
        if (!String(m.mes || m.message || '').trim()) continue;
        return m;
    }
    return null;
}

function onMessageReceived() {
    if (!S.enabled || !S.autoScan) return;
    if (scanning) return;
    try {
        const ctx = getContext();
        const chat = ctx.chat || [];
        /* 字数门槛：最新一层正文不够长就这层不记，等下一层再看 */
        const need = clampInt(S.autoMinChars, 0, 100000, 0);
        if (need > 0) {
            const last = lastAiMessage(chat);
            const len = cleanText(last && (last.mes || last.message)).length;
            if (len < need) {
                log('最新一层正文 ' + len + ' 字，不到 ' + need + ' 字，这次不记录');
                return;
            }
        }
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
    /* 「按世界书生成」的数据源是当前角色卡的世界书，换卡后必须重读 */
    WB_LIB_CACHE = [];
    WB_LIB_BOOK = '';
    (async () => {
        try {
            const cur = document.querySelector('#dna-tab');
            if (!cur) return;
            if (cur.dataset.sub === 'ranobe') await renderLib('ranobewb');
        } catch (e) { /* 页签还没挂上就算了 */ }
    })();
    /* 换存档后让用户看得见现在用的是哪一份档案库 */
    log('档案库：' + cardLabel() + ' · ' + Object.keys(currentEntries()).length + ' 份档案');
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
    /* 开关同步：document 级监听，必须在面板挂上之前就装好 */
    installDnaToggleSync();
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
        .then(() => ensureDefaultRanobePreset())
        .then(() => { try { migrateGenPresets(); } catch (e) { /* 迁移失败不影响使用 */ } })
        .then(() => {
            try { renderPresetCard('lib'); renderPresetCard('gen'); renderPresetCard('ranobe'); } catch (e) { /* 页签还没挂上就算了，fill() 会再渲染 */ }
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
    log('角色DNA记录器已加载 v2.9.18 · 融合版（内置存储 + 上下文预设）');
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
