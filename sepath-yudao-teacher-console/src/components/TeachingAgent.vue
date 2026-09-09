<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ChatLineRound, Document, Refresh, Promotion } from "@element-plus/icons-vue";
import { getAgentConversation, prepareAgentDraft, sendAgentMessage } from "../services/workbenchApi";
import type { LearningWorkOrder } from "../types";
import type { AgentContext, AgentDraftSelection, AgentTurn } from "../types/teachingAgent";

const props = defineProps<{ modelValue: boolean; order: LearningWorkOrder | null; authenticated: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  login: [];
  intake: [];
  draft: [selection: AgentDraftSelection & { workOrderId: string }];
}>();
const open = computed({ get: () => props.modelValue, set: (value) => emit("update:modelValue", value) });
const scopeMode = ref<"order" | "course">("order");
const workOrderId = computed(() => scopeMode.value === "order" ? props.order?.id || "" : "");
const turns = ref<AgentTurn[]>([]);
const context = ref<AgentContext | null>(null);
const contextVersion = ref("");
const input = ref("");
const error = ref("");
const loading = ref(false);
const sending = ref(false);
const preparing = ref("");
const pendingQuestion = ref("");
const conversation = ref<HTMLElement | null>(null);
let controller: AbortController | undefined;
let epoch = 0;
let retry: { message: string; id: string } | undefined;

const quickQuestions = computed(() => workOrderId.value ? [
  "这张工单目前能确定什么，还不能确定什么？",
  "下一步最值得补哪条证据？请说明理由。",
  "给学生安排一个可以验证理解的学习任务。",
] : [
  "我应该先采集哪些学习证据？",
  "怎么设计一次软件工程课程的形成性评价？",
]);
const canSend = computed(() => props.authenticated && !!context.value && !loading.value && !sending.value && !!input.value.trim());

async function scrollLatest() {
  await nextTick();
  conversation.value?.scrollTo({ top: conversation.value.scrollHeight, behavior: "auto" });
}

async function load() {
  const version = ++epoch;
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  sending.value = false;
  pendingQuestion.value = "";
  error.value = "";
  try {
    const result = await getAgentConversation(workOrderId.value, controller.signal);
    if (version !== epoch) return;
    turns.value = result.turns;
    context.value = result.context;
    contextVersion.value = result.contextVersion;
    await scrollLatest();
  } catch (cause) {
    if (version === epoch && !controller.signal.aborted) error.value = cause instanceof Error ? cause.message : "会话暂时无法读取，请重试。";
  } finally {
    if (version === epoch) loading.value = false;
  }
}

// Cancel obsolete requests when the teacher switches work orders or signs out.
// https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup
watch(() => [props.modelValue, props.authenticated, workOrderId.value], () => {
  ++epoch;
  controller?.abort();
  turns.value = [];
  context.value = null;
  contextVersion.value = "";
  input.value = "";
  retry = undefined;
  pendingQuestion.value = "";
  sending.value = false;
  loading.value = false;
  error.value = "";
  if (props.modelValue && props.authenticated) void load();
}, { immediate: true });
onBeforeUnmount(() => controller?.abort());

async function send(question?: string) {
  if (question) input.value = question;
  if (!canSend.value) return;
  const message = input.value.trim();
  if (!retry || retry.message !== message) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    retry = { message, id: `msg_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` };
  }
  const version = epoch;
  controller = new AbortController();
  const activeController = controller;
  const signal = activeController.signal;
  const timeout = setTimeout(() => activeController.abort(), 60000);
  sending.value = true;
  error.value = "";
  pendingQuestion.value = message;
  await scrollLatest();
  try {
    const result = await sendAgentMessage(workOrderId.value, message, retry.id, signal);
    if (version !== epoch) return;
    turns.value = [...turns.value.filter((turn) => turn.id !== result.turn.id), result.turn].slice(-40);
    context.value = result.context;
    contextVersion.value = result.turn.contextVersion;
    input.value = "";
    retry = undefined;
  } catch (cause) {
    if (version === epoch) error.value = signal.aborted ? "等待回答超时。可重试同一问题，已保存的回答不会重复生成。" : cause instanceof Error ? cause.message : "发送失败，问题已保留。";
  } finally {
    clearTimeout(timeout);
    if (version === epoch) {
      sending.value = false;
      pendingQuestion.value = "";
      await scrollLatest();
    }
  }
}

async function useDraft(turn: AgentTurn) {
  if (!workOrderId.value || preparing.value) return;
  const orderId = workOrderId.value;
  const version = epoch;
  preparing.value = turn.id;
  error.value = "";
  try {
    const result = await prepareAgentDraft(orderId, turn.id);
    if (version !== epoch) return;
    turn.draftPreparedAt = result.draftPreparedAt;
    emit("draft", { ...result, workOrderId: orderId });
  } catch (cause) {
    if (version === epoch) error.value = cause instanceof Error ? cause.message : "任务草稿未保存，请重试。";
  } finally { preparing.value = ""; }
}

function time(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function canUseDraft(turn: AgentTurn) {
  return !!workOrderId.value && props.order?.status !== "closed" && !props.order?.interventionPackage
    && turn.contextVersion === contextVersion.value && turn.outcome.mode !== "guarded" && !!turn.outcome.checklist.length;
}
</script>

<template>
  <el-drawer v-model="open" title="课程助教" size="min(760px, 100vw)" class="teaching-agent-drawer" :destroy-on-close="true">
    <div class="teaching-agent" data-testid="teaching-agent">
      <header class="ta-context">
        <div class="ta-scope">
          <el-icon><ChatLineRound /></el-icon>
          <div><strong>{{ workOrderId ? order?.courseName : "课程交流" }}</strong><small>{{ workOrderId ? `${order?.studentName} · ${order?.trigger}` : "软件工程教学与证据采集" }}</small></div>
          <el-button v-if="authenticated" :icon="Refresh" circle :disabled="sending || loading" aria-label="刷新会话和证据" title="刷新会话和证据" @click="load" />
        </div>
        <el-radio-group v-if="order" v-model="scopeMode" size="small" aria-label="会话范围" :disabled="sending">
          <el-radio-button value="order">当前工单</el-radio-button><el-radio-button value="course">课程交流</el-radio-button>
        </el-radio-group>
        <div v-if="context?.valueAdded" class="ta-metrics">
          <span>{{ context.valueAdded.label }}</span>
          <span>当前估计 <b>{{ context.valueAdded.current ?? "待补证" }}</b></span>
          <span>期望 <b>{{ context.valueAdded.expected ?? "未设定" }}</b></span>
          <span :class="{ 'ta-uncertain': context.valueAdded.uncertainty !== 'low' }">{{ context.valueAdded.uncertainty === "high" ? "高不确定性" : context.valueAdded.uncertainty === "medium" ? "中等不确定性" : "低不确定性" }}</span>
        </div>
      </header>

      <div ref="conversation" class="ta-conversation" role="log" aria-label="助教会话" aria-live="polite" :aria-busy="loading || sending">
        <div v-if="!authenticated" class="ta-empty">
          <el-icon><ChatLineRound /></el-icon><h3>登录后继续交流</h3>
          <el-button type="primary" @click="emit('login')">教师登录</el-button>
        </div>
        <div v-else-if="loading" class="ta-empty" role="status">正在读取会话与课程证据…</div>
        <div v-else-if="!turns.length && !sending" class="ta-empty">
          <el-icon><ChatLineRound /></el-icon>
          <h3>{{ workOrderId ? "一起看这次学习的下一步" : "从本轮课程的学习目标开始" }}</h3>
          <p v-if="context">{{ workOrderId ? `已读取 ${context.evidence.length} 条证据，${context.missingEvidence.length} 项待补证据` : context.sampledOrders ? `当前有 ${context.pendingOrders} 张待处理工单` : "课程中还没有学习工单" }}</p>
          <div class="ta-starters"><button v-for="question in quickQuestions" :key="question" type="button" :disabled="!context" @click="send(question)">{{ question }}<span aria-hidden="true">↗</span></button></div>
          <el-button v-if="!workOrderId && context?.sampledOrders === 0" :icon="Document" @click="emit('intake')">导入学习事件</el-button>
        </div>
        <article v-for="turn in turns" :key="turn.id" class="ta-turn" data-testid="agent-turn">
          <div class="ta-user"><small>教师 · {{ time(turn.createdAt) }}</small><p>{{ turn.message }}</p></div>
          <div class="ta-answer">
            <header><el-icon><ChatLineRound /></el-icon><strong>SE-Path 助教</strong><span :class="{ 'ta-uncertain': turn.outcome.fallback }">{{ turn.outcome.mode === "model" ? "模型回答" : turn.outcome.mode === "guarded" ? "学习边界提示" : "规则建议 · 模型暂不可用" }}</span></header>
            <p class="ta-answer-text">{{ turn.outcome.answer }}</p>
            <div v-if="turn.outcome.questions.length" class="ta-result-section"><h4>先确认</h4><ul><li v-for="question in turn.outcome.questions" :key="question">{{ question }}</li></ul></div>
            <div v-if="turn.outcome.checklist.length" class="ta-result-section"><h4>下一步学习任务</h4><ol><li v-for="step in turn.outcome.checklist" :key="step">{{ step }}</li></ol></div>
            <div v-if="turn.outcome.evidenceToSubmit.length" class="ta-result-section"><h4>需要补充</h4><ul><li v-for="item in turn.outcome.evidenceToSubmit" :key="item">{{ item }}</li></ul></div>
            <details v-if="turn.evidence.length" class="ta-evidence"><summary>查看本轮依据 · {{ turn.evidence.length }} 条</summary><dl><template v-for="item in turn.evidence" :key="item.id"><dt>{{ item.title }} <small>{{ turn.outcome.citations.includes(item.id) ? "已引用" : "已读取" }} · {{ item.source }}</small></dt><dd>{{ item.detail }}</dd></template></dl></details>
            <footer v-if="canUseDraft(turn)"><el-button :icon="Document" :loading="preparing === turn.id" :disabled="sending || !!preparing" @click="useDraft(turn)">{{ turn.draftPreparedAt ? "继续编辑任务草稿" : "转为任务草稿" }}</el-button><small>待教师确认发布</small></footer>
            <p v-else-if="workOrderId && turn.contextVersion !== contextVersion" class="ta-stale">证据已更新，本条建议基于先前记录。</p>
          </div>
        </article>
        <div v-if="sending" class="ta-turn"><div class="ta-user"><small>教师</small><p>{{ pendingQuestion }}</p></div><p class="ta-thinking" role="status">正在结合证据与前文整理回答…</p></div>
      </div>

      <footer class="ta-composer">
        <div v-if="error" class="ta-error" role="alert">{{ error }}<el-button v-if="!sending && authenticated && !context" text @click="load">重试</el-button></div>
        <form @submit.prevent="send()">
          <label class="ta-input-label" for="agent-question">给助教的问题</label>
          <textarea id="agent-question" v-model="input" maxlength="2000" rows="3" :disabled="!authenticated || sending" placeholder="例如：怎样区分学生没理解，还是只漏了测试？" data-testid="agent-question" />
          <div class="ta-compose-actions"><small>{{ input.length }}/2000 · 仅教师可见</small><el-button type="primary" native-type="submit" :icon="Promotion" :loading="sending" :disabled="!canSend" data-testid="agent-send">发送</el-button></div>
        </form>
        <p class="ta-boundary">建议供教学参考，任务由教师确认后发布。</p>
      </footer>
    </div>
  </el-drawer>
</template>

<style>
.teaching-agent-drawer .el-drawer__header { margin-bottom: 0; padding: 20px 24px; border-bottom: 1px solid #e6e9e8; color: #232b2a; }
.teaching-agent-drawer .el-drawer__title { font-size: 18px; font-weight: 650; }
.teaching-agent-drawer .el-drawer__body { padding: 0; overflow: hidden; }
.teaching-agent { height: 100%; min-height: 0; display: grid; grid-template-rows: auto minmax(0,1fr) auto; color: #27302f; background: #fff; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.7; letter-spacing: 0; --el-color-primary: #237461; }
.teaching-agent * { box-sizing: border-box; min-width: 0; letter-spacing: 0; }
.teaching-agent button, .teaching-agent textarea { font: inherit; }
.ta-context { padding: 16px 24px; background: #f5f8f7; border-bottom: 1px solid #e4ebe7; }
.ta-scope { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.ta-scope > .el-icon { color: #237461; font-size: 23px; }
.ta-scope > div { flex: 1; }
.ta-scope strong, .ta-scope small { display: block; overflow-wrap: anywhere; }
.ta-scope small { color: #687772; font-size: 12px; }
.ta-metrics { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; font-size: 12px; color: #596662; }
.ta-metrics b { color: #293c35; }
.teaching-agent .ta-uncertain { color: #926321; }
.ta-conversation { overflow-y: auto; overscroll-behavior: contain; padding: 24px; }
.ta-empty { padding: 26px 0; max-width: 520px; margin: auto; }
.ta-empty > .el-icon { font-size: 28px; color: #237461; }
.ta-empty h3 { font-size: 20px; font-weight: 600; margin: 12px 0 6px; }
.ta-empty p { margin: 0 0 22px; color: #687772; font-size: 13px; }
.ta-starters { display: grid; gap: 0; margin: 16px 0; }
.ta-starters button { display: flex; justify-content: space-between; gap: 14px; padding: 13px 0; border: 0; border-bottom: 1px solid #e8eeeb; background: transparent; color: #37594a; text-align: left; cursor: pointer; }
.ta-starters button:hover { color: #136a50; }
.ta-starters button:disabled { opacity: .5; cursor: default; }
.ta-turn + .ta-turn { margin-top: 30px; }
.ta-user { margin-left: 40px; padding: 12px 16px; border-radius: 6px; background: #f0f4f2; }
.ta-user small { color: #6c7871; font-size: 11px; }
.ta-user p { margin: 3px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ta-answer { padding-top: 20px; }
.ta-answer > header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.ta-answer > header .el-icon { color: #237461; }
.ta-answer > header span { margin-left: auto; color: #728078; font-size: 11px; }
.ta-answer-text { margin: 12px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.ta-result-section { margin: 16px 0; }
.ta-result-section h4 { margin: 0 0 5px; font-size: 13px; font-weight: 650; color: #3d5145; }
.ta-result-section ul, .ta-result-section ol { padding-left: 21px; margin: 0; }
.ta-result-section li { margin: 5px 0; overflow-wrap: anywhere; }
.ta-evidence { border-top: 1px solid #e7ece9; padding: 10px 0; margin-top: 16px; font-size: 12px; color: #596a60; }
.ta-evidence summary { cursor: pointer; }
.ta-evidence dl { margin: 10px 0; }
.ta-evidence dt { font-weight: 600; margin-top: 12px; }
.ta-evidence dt small { display: block; font-weight: 400; color: #738078; }
.ta-evidence dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.ta-answer > footer { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
.ta-answer > footer small, .ta-stale { color: #738078; font-size: 11px; }
.ta-thinking { color: #526d5d; font-size: 13px; padding: 16px 0; }
.ta-composer { border-top: 1px solid #e3e9e5; padding: 12px 24px 16px; background: #fff; }
.ta-composer form { border: 1px solid #cdd9d1; border-radius: 6px; padding: 10px 12px; }
.ta-composer form:focus-within { border-color: #237461; }
.ta-input-label { display: block; font-size: 11px; color: #66786c; }
.ta-composer textarea { display: block; width: 100%; resize: none; min-height: 60px; max-height: 130px; border: 0; outline: 0; color: #27302f; background: transparent; font-size: 14px; }
.ta-compose-actions { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.ta-compose-actions small, .ta-boundary { color: #738078; font-size: 11px; }
.ta-boundary { margin: 6px 0 0; }
.ta-error { color: #a33629; background: #fff5f2; padding: 8px 10px; margin-bottom: 8px; font-size: 12px; overflow-wrap: anywhere; }
@media (max-width: 520px) {
  .ta-context, .ta-conversation { padding: 14px 16px; }
  .ta-composer { padding: 10px 16px; }
  .ta-user { margin-left: 14px; }
  .ta-empty h3 { font-size: 18px; }
  .ta-metrics { gap: 4px 10px; }
}
</style>
