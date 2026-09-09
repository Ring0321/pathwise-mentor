<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  Check,
  CircleCheckFilled,
  Download,
  Link,
  RefreshLeft,
} from "@element-plus/icons-vue";
import {
  abilityGraphNodes,
  defaultRubricDimensions,
  evidenceSourceMatrix,
} from "../mock/rubric";
import type { RubricDimension } from "../types";

const rubricStorageKey = "sepath-yudao-rubric:software-engineering-2301";

function cloneDimensions(source = defaultRubricDimensions): RubricDimension[] {
  return source.map((item) => ({
    ...item,
    evidenceSources: [...item.evidenceSources],
  }));
}

function readRubricConfig(): RubricDimension[] {
  try {
    const raw = window.localStorage.getItem(rubricStorageKey);
    if (!raw) return cloneDimensions();
    const parsed = JSON.parse(raw) as RubricDimension[];
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDimensions();
    return cloneDimensions(parsed);
  } catch {
    return cloneDimensions();
  }
}

const rubricDimensions = ref<RubricDimension[]>(readRubricConfig());
const selectedRubricId = ref(rubricDimensions.value[0]?.id ?? "");

const activeRubric = computed(
  () =>
    rubricDimensions.value.find((item) => item.id === selectedRubricId.value) ??
    rubricDimensions.value[0],
);

const enabledDimensions = computed(() =>
  rubricDimensions.value.filter((item) => item.enabled),
);

const totalRubricWeight = computed(() =>
  enabledDimensions.value.reduce((sum, item) => sum + Number(item.weight || 0), 0),
);

const averageEvidenceCoverage = computed(() => {
  const dimensions = enabledDimensions.value;
  if (!dimensions.length) return 0;
  const weighted = dimensions.reduce(
    (sum, item) => sum + item.evidenceCoverage * Math.max(item.weight, 0),
    0,
  );
  return Math.round(weighted / Math.max(totalRubricWeight.value, 1));
});

const configReadiness = computed(() => {
  const weightPenalty = Math.min(Math.abs(totalRubricWeight.value - 100), 30);
  const disabledPenalty = rubricDimensions.value.length - enabledDimensions.value.length;
  return Math.max(0, Math.min(100, averageEvidenceCoverage.value - weightPenalty - disabledPenalty * 6));
});

const configWarnings = computed(() => {
  const warnings: string[] = [];
  if (totalRubricWeight.value !== 100) {
    warnings.push(`启用维度权重当前为 ${totalRubricWeight.value}%，建议调整到 100%。`);
  }
  if (enabledDimensions.value.some((item) => item.evidenceCoverage < 60)) {
    warnings.push("仍有能力维度证据覆盖低于 60%，诊断结论需显示不确定性。");
  }
  if (!enabledDimensions.value.length) {
    warnings.push("至少启用一个 Rubric 维度后，系统才允许生成课程诊断。");
  }
  return warnings;
});

function saveRubricConfig() {
  window.localStorage.setItem(
    rubricStorageKey,
    JSON.stringify(rubricDimensions.value, null, 2),
  );
  ElMessage.success("Rubric 配置已保存到本地");
}

function resetRubricConfig() {
  rubricDimensions.value = cloneDimensions();
  selectedRubricId.value = rubricDimensions.value[0]?.id ?? "";
  window.localStorage.removeItem(rubricStorageKey);
  ElMessage.success("Rubric 配置已恢复为课程默认版本");
}

function exportRubricConfig() {
  const payload = {
    exportAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    courseClass: "软件工程 2301",
    version: "SE-Path-Rubric-2026.08",
    readiness: configReadiness.value,
    totalWeight: totalRubricWeight.value,
    boundary:
      "Rubric 仅用于形成性诊断和资源调度，不用于排名、惩罚或自动评价学生。",
    dimensions: rubricDimensions.value,
    abilityGraph: abilityGraphNodes,
    evidenceSources: evidenceSourceMatrix,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "SE-Path课程Rubric与能力图谱配置.json";
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success("Rubric 配置已导出");
}

function selectRubric(row: RubricDimension) {
  selectedRubricId.value = row.id;
}
</script>

<template>
  <section class="rubric-workbench">
    <header class="rubric-hero">
      <div>
        <span>课程配置中心</span>
        <h1>Rubric 与能力图谱</h1>
        <p>
          把软件工程课程的能力维度、证据来源和安全门禁配置成可复用规则。
          诊断单不再依赖静态样例，而是从这里读取课程标准。
        </p>
      </div>
      <div class="rubric-actions">
        <el-button type="primary" :icon="Check" @click="saveRubricConfig">
          保存配置
        </el-button>
        <el-button :icon="Download" @click="exportRubricConfig">
          导出配置
        </el-button>
        <el-button :icon="RefreshLeft" @click="resetRubricConfig">
          恢复默认
        </el-button>
      </div>
    </header>

    <section class="rubric-kpis" aria-label="Rubric 配置概览">
      <article>
        <span>启用维度</span>
        <strong>{{ enabledDimensions.length }}/{{ rubricDimensions.length }}</strong>
      </article>
      <article>
        <span>权重合计</span>
        <strong :class="{ warn: totalRubricWeight !== 100 }">{{ totalRubricWeight }}%</strong>
      </article>
      <article>
        <span>证据就绪度</span>
        <strong>{{ configReadiness }}%</strong>
      </article>
      <article>
        <span>诊断边界</span>
        <strong>形成性支持</strong>
      </article>
    </section>

    <section class="rubric-layout">
      <aside class="ability-map">
        <div class="section-title">
          <span>能力图谱</span>
          <h2>从需求到发布的学习路径</h2>
        </div>
        <div class="ability-chain">
          <button
            v-for="node in abilityGraphNodes"
            :key="node.id"
            type="button"
            class="ability-node"
            :class="[node.status, { active: node.mappedRubricId === activeRubric?.id }]"
            @click="selectedRubricId = node.mappedRubricId"
          >
            <span>{{ node.level }}</span>
            <strong>{{ node.label }}</strong>
            <small>{{ node.relation }}</small>
          </button>
        </div>
      </aside>

      <section class="rubric-config-panel">
        <div class="section-title inline">
          <div>
            <span>Rubric 维度</span>
            <h2>可编辑课程评价规则</h2>
          </div>
          <el-tag type="info" effect="light">本地 mock API</el-tag>
        </div>

        <div class="rubric-table-wrap">
          <el-table
            :data="rubricDimensions"
            row-key="id"
            class="rubric-table"
            @row-click="selectRubric"
          >
            <el-table-column label="启用" width="82">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" />
              </template>
            </el-table-column>
            <el-table-column label="能力维度" min-width="220">
              <template #default="{ row }">
                <div class="rubric-name">
                  <strong>{{ row.label }}</strong>
                  <span>{{ row.category }} / 增值目标 +{{ row.targetGrowth }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="权重" width="150">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.weight"
                  :min="0"
                  :max="50"
                  size="small"
                  controls-position="right"
                />
              </template>
            </el-table-column>
            <el-table-column label="证据覆盖" width="160">
              <template #default="{ row }">
                <el-progress :percentage="row.evidenceCoverage" :stroke-width="6" />
              </template>
            </el-table-column>
            <el-table-column label="安全动作" min-width="220">
              <template #default="{ row }">
                <span class="safe-action">{{ row.safeAction }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="rubric-mobile-list" aria-label="移动端 Rubric 维度列表">
          <article
            v-for="row in rubricDimensions"
            :key="row.id"
            class="rubric-mobile-card"
            :class="{ active: row.id === activeRubric?.id }"
          >
            <div class="rubric-mobile-main">
              <button type="button" class="rubric-mobile-select" @click="selectRubric(row)">
                <strong>{{ row.label }}</strong>
                <span>{{ row.category }} / 增值目标 +{{ row.targetGrowth }}</span>
              </button>
              <el-switch
                v-model="row.enabled"
                :aria-label="`启用 ${row.label}`"
                @click.stop
              />
            </div>
            <div class="rubric-mobile-meta">
              <label>
                <span>权重</span>
                <el-input-number
                  v-model="row.weight"
                  :min="0"
                  :max="50"
                  size="small"
                  controls-position="right"
                  @click.stop
                />
              </label>
              <div>
                <span>证据覆盖</span>
                <el-progress :percentage="row.evidenceCoverage" :stroke-width="6" />
              </div>
            </div>
            <p>{{ row.safeAction }}</p>
          </article>
        </div>
      </section>
    </section>

    <section class="rubric-detail-grid">
      <article class="rubric-detail">
        <div class="section-title">
          <span>当前选中</span>
          <h2>{{ activeRubric?.label }}</h2>
        </div>
        <p>{{ activeRubric?.description }}</p>
        <dl>
          <div>
            <dt>安全门禁</dt>
            <dd>{{ activeRubric?.guardrailRule }}</dd>
          </div>
          <div>
            <dt>不确定性规则</dt>
            <dd>{{ activeRubric?.uncertaintyRule }}</dd>
          </div>
        </dl>
      </article>

      <article class="evidence-matrix">
        <div class="section-title">
          <span>证据映射</span>
          <h2>每个结论必须能回到证据</h2>
        </div>
        <div class="evidence-source-list">
          <div
            v-for="source in evidenceSourceMatrix"
            :key="source.id"
            class="evidence-source"
          >
            <div>
              <strong>{{ source.label }}</strong>
              <span>{{ source.sourceType }}</span>
            </div>
            <p>{{ source.description }}</p>
            <small>{{ source.requiredFor.join(" / ") }}</small>
          </div>
        </div>
      </article>
    </section>

    <section class="config-boundary">
      <div>
        <el-icon><CircleCheckFilled /></el-icon>
        低证据覆盖时显示“不确定/待补证”，不强行给能力结论。
      </div>
      <div>
        <el-icon><Link /></el-icon>
        Rubric、证据源、Safe-VOI 动作三者一一映射，可复用到其它课程任务。
      </div>
      <div v-for="warning in configWarnings" :key="warning" class="warning">
        {{ warning }}
      </div>
    </section>
  </section>
</template>

<style scoped>
.rubric-workbench {
  display: grid;
  gap: 14px;
  width: min(1230px, calc(100vw - 252px));
  margin: 14px auto 28px;
}

.rubric-hero,
.rubric-kpis,
.ability-map,
.rubric-config-panel,
.rubric-detail,
.evidence-matrix,
.config-boundary {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 36px rgba(18, 32, 56, 0.04);
}

.rubric-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 28px;
}

.rubric-hero span,
.section-title span {
  color: var(--blue);
  font-size: 13px;
  font-weight: 760;
}

.rubric-hero h1,
.section-title h2 {
  margin: 4px 0 0;
  color: var(--text);
  letter-spacing: 0;
}

.rubric-hero h1 {
  font-size: 30px;
  line-height: 1.18;
}

.rubric-hero p,
.rubric-detail p,
.evidence-source p {
  margin: 8px 0 0;
  color: #46556e;
  font-size: 14px;
  line-height: 1.7;
}

.rubric-actions {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  justify-content: flex-end;
  gap: 8px;
}

.rubric-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  overflow: hidden;
}

.rubric-kpis article {
  min-width: 0;
  padding: 16px 20px;
  border-right: 1px solid var(--line);
}

.rubric-kpis article:last-child {
  border-right: 0;
}

.rubric-kpis span {
  display: block;
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}

.rubric-kpis strong {
  display: block;
  margin-top: 8px;
  color: var(--text);
  font-size: 24px;
  line-height: 1;
}

.rubric-kpis strong.warn {
  color: var(--amber);
}

.rubric-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 14px;
}

.ability-map,
.rubric-config-panel,
.rubric-detail,
.evidence-matrix {
  min-width: 0;
  padding: 20px;
}

.section-title.inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-title h2 {
  font-size: 18px;
  line-height: 1.3;
}

.ability-chain {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.ability-node {
  position: relative;
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px 12px;
  align-items: center;
  width: 100%;
  min-height: 70px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.ability-node::after {
  position: absolute;
  left: 32px;
  bottom: -11px;
  width: 1px;
  height: 10px;
  background: var(--line-strong);
  content: "";
}

.ability-node:last-child::after {
  display: none;
}

.ability-node:hover,
.ability-node.active {
  border-color: #8bb6ff;
  box-shadow: 0 10px 24px rgba(21, 103, 232, 0.1);
}

.ability-node > span {
  display: grid;
  place-items: center;
  grid-row: span 2;
  width: 36px;
  height: 36px;
  border-radius: 7px;
  background: var(--blue-soft);
  color: var(--blue);
  font-weight: 820;
}

.ability-node.gap > span {
  background: var(--red-soft);
  color: var(--red);
}

.ability-node.watch > span {
  background: var(--amber-soft);
  color: var(--amber);
}

.ability-node strong,
.ability-node small {
  display: block;
  min-width: 0;
}

.ability-node strong {
  font-size: 15px;
}

.ability-node small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.rubric-table-wrap {
  margin-top: 16px;
  overflow-x: auto;
}

.rubric-table {
  min-width: 760px;
}

.rubric-mobile-list {
  display: none;
}

.rubric-name strong,
.rubric-name span,
.safe-action {
  display: block;
}

.rubric-name strong {
  font-size: 14px;
}

.rubric-name span,
.safe-action {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.rubric-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 14px;
}

.rubric-detail dl {
  display: grid;
  gap: 10px;
  margin: 16px 0 0;
}

.rubric-detail dl div {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fbfdff;
}

.rubric-detail dt {
  color: var(--muted);
  font-size: 12px;
  font-weight: 720;
}

.rubric-detail dd {
  margin: 6px 0 0;
  color: #24324a;
  font-size: 13px;
  line-height: 1.65;
}

.evidence-source-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.evidence-source {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #fff;
}

.evidence-source div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.evidence-source strong {
  font-size: 14px;
}

.evidence-source span {
  flex: 0 0 auto;
  color: var(--blue);
  font-size: 12px;
  font-weight: 720;
}

.evidence-source small {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.config-boundary {
  display: grid;
  gap: 8px;
  padding: 14px 18px;
  color: #24524d;
  font-size: 13px;
}

.config-boundary div {
  display: flex;
  gap: 8px;
  align-items: center;
}

.config-boundary .el-icon {
  color: var(--teal);
}

.config-boundary .warning {
  color: #9a5a00;
}

@media (max-width: 1180px) {
  .rubric-workbench {
    width: min(100% - 28px, 1180px);
  }

  .rubric-layout,
  .rubric-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .rubric-workbench {
    width: calc(100vw - 20px);
    max-width: calc(100vw - 20px);
    margin: 10px auto 22px;
  }

  .rubric-hero {
    display: grid;
    padding: 18px 14px;
  }

  .rubric-actions {
    justify-content: flex-start;
  }

  .rubric-kpis,
  .evidence-source-list {
    grid-template-columns: 1fr;
  }

  .rubric-kpis article {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .rubric-kpis article:last-child {
    border-bottom: 0;
  }

  .ability-map,
  .rubric-config-panel,
  .rubric-detail,
  .evidence-matrix {
    padding: 16px 14px;
  }

  .rubric-table-wrap {
    display: none;
  }

  .rubric-mobile-list {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .rubric-mobile-card {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: #fff;
  }

  .rubric-mobile-card.active {
    border-color: #8dbbff;
    background: #f8fbff;
  }

  .rubric-mobile-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
  }

  .rubric-mobile-select {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .rubric-mobile-select strong,
  .rubric-mobile-select span {
    display: block;
  }

  .rubric-mobile-select strong {
    font-size: 15px;
    line-height: 1.35;
  }

  .rubric-mobile-select span {
    margin-top: 4px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .rubric-mobile-meta {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    margin-top: 12px;
  }

  .rubric-mobile-meta label,
  .rubric-mobile-meta div {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .rubric-mobile-meta span {
    color: var(--muted);
    font-size: 12px;
    font-weight: 720;
  }

  .rubric-mobile-meta .el-input-number {
    width: 104px;
  }

  .rubric-mobile-card p {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    color: #2d3b52;
    font-size: 12px;
    line-height: 1.6;
  }
}
</style>
