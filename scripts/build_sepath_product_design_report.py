from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import textwrap
import zipfile
from datetime import date
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image
from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计方案"
FIG_AI = OUT / "figures" / "ai"
FIG_PUML = OUT / "figures" / "plantuml"
QA = OUT / "qa"
SOURCES = OUT / "sources"

DOCX_PATH = OUT / "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计与原型验证方案.docx"
MD_PATH = OUT / "SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计与原型验证方案.md"
README_PATH = OUT / "README_交付与验收说明.md"
QA_PATH = QA / "docx_structure_metrics.json"
SOURCE_JSON_PATH = SOURCES / "open_source_reference_matrix.json"
SOURCE_MD_PATH = SOURCES / "open_source_reference_matrix.md"

JAVA = Path("D:/Develop/jdk/bin/java.exe")
PLANTUML_JAR = ROOT.parent / "2026.7-2026 AI先锋未来人才大赛" / "华图教育_路径增值引擎_飞书GrowthOps落地设计" / "tools" / "plantuml.jar"
AI_SOURCE = Path("C:/Users/Ring/.codex/generated_images/019fe1fa-ae77-7342-a2ff-dbdaac843217")

BODY_FONT = "宋体"
HEADING_FONT = "黑体"
LATIN_FONT = "Arial"
BLACK = RGBColor(0, 0, 0)

MD_LINES: list[str] = []
EXPLICIT_PAGE_BREAKS = 0


AI_IMAGE_MAP = {
    "call_Pv0vk70OQgAhyUBHXg3HNfx3.png": "01_AI生成图_SEPath软件工程伴学生态概念图.png",
    "call_P0Izcn5hfAM4XWwZeZuKd6kt.png": "02_AI生成图_证据指挥中心概念界面.png",
    "call_JI3YoZRtAE9fxvYqR1VojCdJ.png": "03_AI生成图_结对伴学工作台概念界面.png",
    "call_pHyz0oSu21CEb60cBDBVlOxO.png": "04_AI生成图_课程智能驾驶舱概念界面.png",
}


SOURCE_PROJECTS = [
    {
        "name": "Open edX",
        "url": "https://github.com/openedx/edx-platform",
        "type": "开源在线学习平台",
        "what_to_absorb": "课程运行、学习活动、LMS 架构",
        "sepath_delta": "不做通用课程平台，而做嵌入软件工程项目链路的智能伴学层",
    },
    {
        "name": "Moodle",
        "url": "https://github.com/moodle/moodle",
        "type": "开源 LMS",
        "what_to_absorb": "课程、班级、作业、插件生态",
        "sepath_delta": "首版保持独立 Demo，后续通过 LTI/插件接入",
    },
    {
        "name": "PrairieLearn",
        "url": "https://github.com/PrairieLearn/PrairieLearn",
        "type": "开源在线作业与自动评分平台",
        "what_to_absorb": "参数化练习、自动评分、课程规模化运营",
        "sepath_delta": "把自动评分从单题结果升级为项目迭代轨迹、CI质量和工程过程干预",
    },
    {
        "name": "nbgrader",
        "url": "https://github.com/jupyter/nbgrader",
        "type": "Jupyter 作业评分工具",
        "what_to_absorb": "Notebook 作业发放、收集、评分和反馈",
        "sepath_delta": "参考评分-反馈-发放闭环，输出工程项目脚手架",
    },
    {
        "name": "Autograder.io",
        "url": "https://github.com/eecs-autograder/autograder.io",
        "type": "开源自动评测平台",
        "what_to_absorb": "作业提交、测试运行、评分记录、教师管理",
        "sepath_delta": "在评分之外增加失败归因、最小脚手架提示、复核工单和证据审计",
    },
    {
        "name": "OpenDSA",
        "url": "https://github.com/OpenDSA/OpenDSA",
        "type": "互动教材与练习平台",
        "what_to_absorb": "数据结构/算法互动教材、练习和可视化",
        "sepath_delta": "从知识点练习扩展到工程能力节点",
    },
    {
        "name": "OATutor",
        "url": "https://github.com/CAHLR/OATutor",
        "type": "开源自适应辅导系统",
        "what_to_absorb": "知识追踪、题目级反馈、脚手架式辅导的教育产品证据",
        "sepath_delta": "从题目正确率扩展到需求、设计、代码、测试、协作和反思等软件工程证据",
    },
    {
        "name": "pyKT",
        "url": "https://github.com/pykt-team/pykt-toolkit",
        "type": "知识追踪模型工具箱",
        "what_to_absorb": "DKT/SAKT/AKT 等模型实验与基准",
        "sepath_delta": "先用可解释规则跑通闭环，再把 KT 模型作为可插拔增强",
    },
    {
        "name": "SWE-agent",
        "url": "https://github.com/SWE-agent/SWE-agent",
        "type": "软件工程 Agent",
        "what_to_absorb": "Issue 处理、代码修改、测试运行",
        "sepath_delta": "吸收 Issue/测试闭环，但输出变为伴学诊断和脚手架",
    },
    {
        "name": "OpenHands",
        "url": "https://github.com/All-Hands-AI/OpenHands",
        "type": "通用软件开发 Agent",
        "what_to_absorb": "工程任务执行、工具环境、代码修改",
        "sepath_delta": "将开发 Agent 转为伴学 Agent：诊断、提示、复核，不直接交付答案",
    },
    {
        "name": "Continue",
        "url": "https://github.com/continuedev/continue",
        "type": "IDE 编程助手",
        "what_to_absorb": "IDE 上下文检索、编码辅助、本地开发流",
        "sepath_delta": "加入 Rubric、路径规划和反思记忆",
    },
    {
        "name": "LangGraph",
        "url": "https://github.com/langchain-ai/langgraph",
        "type": "开源多智能体状态编排框架",
        "what_to_absorb": "状态图、持久化、人工介入、人机协同 Agent 流程",
        "sepath_delta": "把 Agent 状态绑定到学生证据账本、发布门和教师复核工单",
    },
    {
        "name": "LlamaIndex",
        "url": "https://github.com/run-llama/llama_index",
        "type": "LLM 数据与检索框架",
        "what_to_absorb": "数据连接、索引、检索增强生成",
        "sepath_delta": "将 Rubric、代码证据和 AI 策略纳入同一知识边界",
    },
    {
        "name": "Ragas",
        "url": "https://github.com/explodinggradients/ragas",
        "type": "RAG/LLM 应用评测框架",
        "what_to_absorb": "检索质量、答案忠实度、上下文相关性等离线评测思路",
        "sepath_delta": "把评测扩展到脚手架粒度、直接给答案率、学习迁移和教师复核负担",
    },
    {
        "name": "DeepEval",
        "url": "https://github.com/confident-ai/deepeval",
        "type": "LLM 回归评测框架",
        "what_to_absorb": "LLM 输出测试、评估用例、CI 评测",
        "sepath_delta": "建立脚手架提示、禁止替写、Rubric 对齐的回归测试集",
    },
    {
        "name": "Langfuse",
        "url": "https://github.com/langfuse/langfuse",
        "type": "LLM 观测与评估平台",
        "what_to_absorb": "trace、prompt、评估与调试",
        "sepath_delta": "将 LLM trace 与 EvidenceEvent 合并为学习账本",
    },
    {
        "name": "OpenTelemetry GenAI",
        "url": "https://opentelemetry.io/docs/specs/semconv/gen-ai/",
        "type": "生成式 AI 可观测性语义规范",
        "what_to_absorb": "模型调用、令牌、延迟、工具调用和追踪语义",
        "sepath_delta": "为教育 Agent 增加学习收益、提示等级、复核结果和安全事件观测字段",
    },
    {
        "name": "Dify",
        "url": "https://github.com/langgenius/dify",
        "type": "LLM 应用编排平台",
        "what_to_absorb": "RAG、工作流、运营面板",
        "sepath_delta": "不做普通聊天应用，工作流必须绑定工程证据",
    },
    {
        "name": "RAGFlow",
        "url": "https://github.com/infiniflow/ragflow",
        "type": "RAG 工作流平台",
        "what_to_absorb": "文档解析、知识库、检索增强",
        "sepath_delta": "文档 RAG 仅作为底座，输出受 Rubric 和教师复核约束",
    },
    {
        "name": "NIST AI RMF",
        "url": "https://www.nist.gov/itl/ai-risk-management-framework",
        "type": "AI 风险管理框架",
        "what_to_absorb": "治理、测量、管理和可信 AI 风险语言",
        "sepath_delta": "用于限定本项目不能宣称的结果，并建立发布门、审计和人工兜底",
    },
    {
        "name": "UNESCO 生成式 AI 教育指南",
        "url": "https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research",
        "type": "教育场景生成式 AI 治理参考",
        "what_to_absorb": "教育公平、年龄适配、教师角色和数据保护原则",
        "sepath_delta": "转化为学生端不替写、教师端可复核、机构端最小可见的产品边界",
    },
]


PUML_FILES = {
    "01_赛题到SEPath方案逻辑链.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
skinparam roundcorner 8
title 赛题要求到 SE-Path 学伴方案逻辑链

rectangle "赛题核心\n自适应学习伙伴智能体" as A
rectangle "软件工程课程痛点\n会写代码但不会交付" as B
rectangle "证据原生学习账本\nIssue / Commit / PR / CI / 反思" as C
rectangle "路径数字孪生\n能力状态 + 项目状态 + 协作状态" as D
rectangle "脚手架伴学 Agent\n不替写，只引导下一步" as E
rectangle "教师复核与发布门\n高风险建议人工确认" as F
rectangle "闭环 Demo\n诊断-规划-干预-记忆-反思-复核" as G

A --> B : 面向特定学科专业
B --> C : 捕捉真实过程
C --> D : 动态分析学生画像
D --> E : 生成个性化路径
E --> F : 控制风险与学术诚信
F --> G : 可演示、可验证、可扩展

note bottom of C
创新点：不只看测验分数，
而是把软件工程交付过程本身
变成可计算学习证据。
end note
@enduml
""",
    "02_软件工程学习闭环总体架构.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
skinparam componentStyle rectangle
title SE-Path 学伴：软件工程学习闭环总体架构

actor "学生" as Student
actor "教师/助教" as Teacher
actor "课程负责人" as Owner

package "学生端" {
  [任务路径板] as TaskBoard
  [结对伴学对话] as TutorChat
  [反思日志] as Reflection
}

package "工程工具层" {
  [Git 仓库] as Git
  [Issue/PR] as PR
  [CI 测试] as CI
  [代码质量扫描] as Quality
}

package "智能体层" {
  [诊断 Agent] as Diagnose
  [规划 Agent] as Plan
  [脚手架 Agent] as Scaffold
  [代码审阅 Agent] as Review
  [反思 Agent] as Reflect
  [教师协同 Agent] as HumanAgent
}

package "算法事实层" {
  database "证据账本" as Ledger
  database "能力图谱" as Competency
  database "软件工程知识图谱" as KG
  [路径数字孪生] as Twin
  [策略引擎 SafeVOI] as Policy
}

package "治理与观测层" {
  [教师复核工单] as Ticket
  [可观测追踪] as Trace
  [评测集与红队] as Eval
}

Student --> TaskBoard
Student --> TutorChat
Student --> Reflection
Student --> Git
Student --> PR
Git --> Ledger
PR --> Ledger
CI --> Ledger
Quality --> Ledger
Reflection --> Ledger
Ledger --> Diagnose
Competency --> Diagnose
KG --> Scaffold
Diagnose --> Twin
Twin --> Policy
Policy --> Plan
Plan --> TaskBoard
Scaffold --> TutorChat
Review --> TutorChat
Reflect --> Reflection
HumanAgent --> Ticket
Ticket --> Teacher
Teacher --> HumanAgent
Owner --> Eval
Trace --> Eval
Diagnose --> Trace
Plan --> Trace
Scaffold --> Trace
Review --> Trace
Reflect --> Trace
@enduml
""",
    "03_证据原生数据对象模型.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 证据原生数据对象模型

class StudentProfile {
  student_id
  background_vector
  goal_vector
  consent_status
}

class EngineeringArtifact {
  artifact_id
  type: requirement/design/code/test/doc
  repo_path
  owner
  created_at
}

class EvidenceEvent {
  event_id
  actor
  verb
  object
  timestamp
  confidence
  source
}

class CompetencyNode {
  node_id
  name
  prerequisite
  rubric
}

class PathState {
  current_node
  mastery_prob
  blocker_score
  next_best_action
}

class Intervention {
  intervention_id
  scaffold_level
  reason
  expires_at
  human_review_required
}

class ReviewTicket {
  ticket_id
  severity
  assignee
  decision
  audit_log
}

StudentProfile "1" -- "*" EvidenceEvent
EngineeringArtifact "1" -- "*" EvidenceEvent
CompetencyNode "1" -- "*" PathState
StudentProfile "1" -- "*" PathState
PathState "1" -- "*" Intervention
Intervention "0..1" -- "1" ReviewTicket
EvidenceEvent "*" -- "*" CompetencyNode : maps_to
@enduml
""",
    "04_多智能体编排与发布门时序.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 多智能体编排与发布门时序

actor 学生 as S
participant "事件采集器" as Collector
participant "证据账本" as Ledger
participant "诊断 Agent" as D
participant "规划 Agent" as P
participant "脚手架 Agent" as T
participant "教师复核 Agent" as H
participant "学生端" as UI

S -> Collector : push commit / open PR / run tests
Collector -> Ledger : append EvidenceEvent
Ledger -> D : trigger diagnosis
D -> D : update mastery + blocker
D -> P : diagnosis card
P -> P : compute next best action
alt low risk
  P -> T : generate scaffold prompt
  T -> UI : hint / checklist / example skeleton
else high risk or low confidence
  P -> H : create review ticket
  H -> UI : wait for teacher decision
end
S -> UI : act and reflect
UI -> Ledger : append ReflectionEvent
@enduml
""",
    "05_路径数字孪生状态机.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 路径数字孪生状态机

[*] --> Baseline : 入课诊断
Baseline --> Planned : 生成初始路径
Planned --> InProgress : 开始项目任务
InProgress --> Blocked : CI失败/PR停滞/概念误用
Blocked --> Scaffolded : 触发脚手架提示
Scaffolded --> InProgress : 学生提交改进证据
InProgress --> ReviewNeeded : 高风险建议/学术诚信异常
ReviewNeeded --> InProgress : 教师放行
ReviewNeeded --> Replanned : 教师调整路径
InProgress --> Mastered : 通过发布门
Mastered --> Replanned : 下一能力节点
Replanned --> InProgress
Mastered --> [*] : 课程闭环完成

Blocked : 记录 blocker_score
Scaffolded : 记录 scaffold_level
ReviewNeeded : 人工复核必经
@enduml
""",
    "06_脚手架伴学提示阶梯流程.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 脚手架伴学提示阶梯：避免直接替写

start
:识别学生当前阻塞点;
if (是否能用规则解释?) then (是)
  :给出概念定位与检查清单;
else (否)
  :检索课程知识图谱与历史证据;
endif
if (学生是否请求完整答案?) then (是)
  :拒绝替写并转为引导问题;
else (否)
  :给出下一步最小行动;
endif
if (连续失败 >= 2 次?) then (是)
  :升级到示例片段/伪代码;
else (否)
  :等待学生提交证据;
endif
if (高风险或低置信度?) then (是)
  :创建教师复核工单;
else (否)
  :更新路径数字孪生;
endif
stop
@enduml
""",
    "07_GraphRAG与课程知识边界.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title GraphRAG 与课程知识边界

package "课程权威知识" {
  [教学大纲] as Syllabus
  [实验手册] as Lab
  [评分 Rubric] as Rubric
  [优秀但脱敏样例] as Examples
}

package "工程过程证据" {
  [Issue] as Issue
  [Commit] as Commit
  [PR Discussion] as PRD
  [CI Log] as CILog
}

package "检索与约束" {
  [实体抽取] as Entity
  [软件工程知识图谱] as KG
  [GraphRAG Retriever] as Retriever
  [事实边界检查] as Guard
}

package "生成与评测" {
  [脚手架答案生成] as Generate
  [Ragas类离线评测] as OfflineEval
  [教师抽检集] as TeacherEval
}

Syllabus --> Entity
Lab --> Entity
Rubric --> Entity
Examples --> Entity
Issue --> Entity
Commit --> Entity
PRD --> Entity
CILog --> Entity
Entity --> KG
KG --> Retriever
Retriever --> Guard
Guard --> Generate
Generate --> OfflineEval
Generate --> TeacherEval
@enduml
""",
    "08_教师复核工单状态机.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 教师复核工单状态机

[*] --> Created : Agent 提交
Created --> Triaged : 按风险与截止期排序
Triaged --> NeedEvidence : 证据不足
NeedEvidence --> Created : 补齐日志/提交/截图
Triaged --> Approved : 建议可放行
Triaged --> Revised : 教师改写建议
Triaged --> Rejected : 禁止推送
Approved --> Delivered : 推送给学生
Revised --> Delivered : 推送教师版建议
Rejected --> Archived : 记录原因
Delivered --> Followed : 学生采纳并提交证据
Delivered --> Expired : 超过有效期
Followed --> Archived
Expired --> Archived
Archived --> [*]
@enduml
""",
    "09_原型演示闭环时序.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 3-5 分钟原型演示闭环时序

actor 评委 as J
participant "学生视角" as Stu
participant "SE-Path 引擎" as Engine
participant "工程工具模拟器" as Sim
participant "教师视角" as Tea
database "证据账本" as Ledger

J -> Stu : 选择项目任务
Stu -> Sim : 提交一次失败 PR
Sim -> Ledger : 记录测试失败与 diff 摘要
Ledger -> Engine : 触发诊断
Engine -> Stu : 给出最小脚手架提示
Stu -> Sim : 修复并再次提交
Sim -> Ledger : 记录 CI 通过
Engine -> Tea : 生成复核摘要与课堂干预建议
Tea -> Engine : 放行/改写
Engine -> Stu : 更新路径、记忆与反思任务
J -> Tea : 查看闭环证据链
@enduml
""",
    "10_八周验证与停止门.puml": r"""
@startuml
!theme plain
skinparam backgroundColor #FFFFFF
skinparam shadowing false
skinparam defaultFontName "Microsoft YaHei"
title 八周验证路线与停止门

start
:第0周 基线测评与数据授权;
:第1-2周 影子运行不干预;
if (误判率可接受?) then (是)
  :第3-6周 等待组对照试点;
else (否)
  :停止自动干预，仅保留教师看板;
  stop
endif
if (学生负担上升?) then (是)
  :降低提醒频率并回退提示等级;
endif
:第7周 教师复核与访谈;
:第8周 统计分析与复盘;
if (学习收益和安全均达标?) then (是)
  :进入课程级部署;
else (否)
  :仅作为研究原型继续迭代;
endif
stop
@enduml
""",
    "14_科研算法融合与开源证据中台.puml": r"""
@startuml
title SE-Path 学伴 - 科研算法融合与开源证据中台

skinparam shadowing false
skinparam backgroundColor #FFFFFF
skinparam defaultFontName Microsoft YaHei
skinparam rectangle {
  RoundCorner 8
  BorderColor #D0D7E2
  BackgroundColor #F8FBFF
}
skinparam database {
  BorderColor #D0D7E2
  BackgroundColor #FFFFFF
}

actor Reviewer as reviewer
actor Teacher as teacher
actor Researcher as researcher

rectangle "Open-source References\nOpen edX / Moodle / LangGraph / OpenTelemetry" as oss
rectangle "Idea Migration Chain\nPath Value Engine -> SE-Path" as migration
rectangle "EvidenceEvent Ledger\nIssue / PR / CI / Chat / Reflection" as ledger
rectangle "DiagnosisCard\nportrait / blockers / risks" as diagnosis
rectangle "PathTwin\nlearning state graph" as pathtwin
rectangle "SafeVOI\nrisk-aware action ranking" as safevoi
rectangle "Rubric Calibration\nteacherAnchor vs aiEstimate" as calibration
rectangle "Value Uplift\nexplainable value estimate" as value
rectangle "Trial Telemetry\nclaim boundary and A/B plan" as telemetry
rectangle "Pilot Evidence Binder\nL0-L3 claim tiers" as binder
rectangle "ModelOps\nversion / drift / release gate" as modelops
rectangle "Contribution Evidence Pack\nsource / panel / material / command" as pack
database "Research Fusion Manifest\nsepath-research-fusion.v1" as manifest

oss --> manifest : reference-only matrix
migration --> ledger : dynamic portrait idea
migration --> safevoi : path value idea
migration --> binder : evidence ladder idea
ledger --> diagnosis : event-driven diagnosis
diagnosis --> safevoi : blockers + confidence
ledger --> pathtwin : competency evidence
safevoi --> pathtwin : next action state
safevoi --> value : strategy advantage
teacher --> calibration : anchor samples
calibration --> safevoi : release gate
calibration --> value : trust boundary
value --> telemetry : outcome hypotheses
telemetry --> binder : real-claim gate
telemetry --> modelops : metrics and drift
modelops --> manifest : algorithm registry
pack --> manifest : judge-verifiable evidence
ledger --> pack : unit test
binder --> pack : claim boundary
researcher --> manifest : hypotheses + validation ladder
reviewer --> manifest : audit and defense evidence

note right of oss
Open-source projects provide
architecture inspiration only.
No external source code is copied.
end note

note right of migration
Prior path-value thinking is
translated into dynamic portrait,
SafeVOI, teacher release gate,
and real-pilot evidence ladder.
end note

note bottom of telemetry
Synthetic replay proves process.
Real score claims require
authorized teacher-confirmed trials.
end note

@enduml
""",
}


CHAPTERS = [
    {
        "title": "一、赛题理解与一等奖目标",
        "domain": "把“自适应学习伙伴智能体”解释为能感知、规划、行动、记忆并接受治理的教育系统，而不是一个会聊天的问答框",
        "innovation": "评分项被转译为产品合约：Agent 架构、路径策略、功能闭环、创新体验和商业价值都能在 Demo 中被看见",
        "demo": "评委从学生视角触发一次项目阻塞，再从教师视角看到证据、理由和复核动作",
        "risk": "过度宣传会被认为是概念包装，因此方案明确区分已实现原型、可验证假设和未来扩展",
        "metrics": "闭环完成率、提示采纳率、教师复核通过率、直接给答案拦截率",
        "sections": ["1.1 官方命题的真实含义", "1.2 软件工程为什么适合做闭环 Demo", "1.3 一等奖方案的判分策略", "1.4 本方案的边界与不宣称内容"],
    },
    {
        "title": "二、产品定位：SE-Path 学伴",
        "domain": "面向软件工程课程、课程设计、毕业设计预备课和企业实训的项目式学习伴学系统",
        "innovation": "产品不是 LMS、不是 IDE 插件、不是通用编程助手，而是连接工程证据、学习路径和教师治理的智能伴学层",
        "demo": "一个学生从需求拆解到代码修复、测试通过、复盘反思，系统持续更新路径数字孪生",
        "risk": "如果定位过宽会变成课程平台竞品，本方案把首版锁定在软件工程项目交付闭环",
        "metrics": "任务推进速度、阻塞发现提前量、PR 质量、单次干预后的下一步行动率",
        "sections": ["2.1 目标用户与第一场景", "2.2 与编程助手、在线作业平台的差异", "2.3 价值主张与一句话产品定义", "2.4 MVP 可交付范围"],
    },
    {
        "title": "三、开源项目吸收、思想迁移与研究贡献图谱",
        "domain": "从自适应辅导、自动评分、在线学习、多智能体、RAG 评测和可观测性项目中提取可落地经验",
        "innovation": "不复制开源平台，而把它们变成方案的约束、证据和可替换底座，并用思想迁移链说明从路径增值引擎到 SE-Path 学伴的自研增量",
        "demo": "在演示中展示开源思想如何变成具体能力：自动评测输入、GraphRAG 检索、Agent 状态图、教师复核、研究贡献图谱和贡献证据包",
        "risk": "直接堆叠开源名词会显得廉价，因此每个引用都必须对应一个可实现模块和一个差异化增量",
        "metrics": "开源借鉴到本方案模块的覆盖率、替换成本、许可证风险、可复现程度、研究贡献证据覆盖率",
        "sections": ["3.1 OATutor 到工程证据知识追踪", "3.2 PrairieLearn/Autograder 到项目评测", "3.3 LangGraph/GraphRAG 到受控 Agent", "3.4 Ragas/OpenTelemetry 到可验证智能", "3.5 思想迁移链与算法贡献图谱"],
    },
    {
        "title": "四、用户角色、流程与权限边界",
        "domain": "学生、教师、助教、课程负责人和系统管理员在同一证据闭环中的责任切分",
        "innovation": "学生得到下一步行动，教师得到可复核证据，管理员得到策略和数据边界，而不是把所有人塞进同一个聊天窗口",
        "demo": "同一条事件在学生端显示为提示，在教师端显示为复核工单，在负责人端显示为课程风险趋势",
        "risk": "权限设计不清会导致隐私风险和教师负担，因此每类角色只看到完成工作所需的最小信息",
        "metrics": "角色操作耗时、敏感字段暴露数、教师复核队列长度、学生反馈负担",
        "sections": ["4.1 学生端：下一步行动而非答案", "4.2 教师端：复核、纠偏与班级干预", "4.3 课程负责人端：策略与质量治理", "4.4 权限、授权撤回与最小可见性"],
    },
    {
        "title": "五、软件工程学习闭环总体设计",
        "domain": "把诊断、规划、干预、执行、记忆、反思和复核串成可演示的状态循环",
        "innovation": "系统的核心资产是可追踪的学习事件链，而不是一次性测评报告",
        "demo": "演示从失败测试开始，到脚手架提示、学生修复、CI 通过、反思生成、路径调整结束",
        "risk": "闭环若没有真实输入会空转，因此首版必须接入 Git/Issue/CI 的模拟或真实事件",
        "metrics": "闭环事件完整率、路径更新延迟、干预到行动转化率、反思质量评分",
        "sections": ["5.1 七步闭环：感知到反思", "5.2 工程事件如何变成学习证据", "5.3 课堂流程与系统流程的对齐", "5.4 闭环失败时的降级路径"],
    },
    {
        "title": "六、数据对象与证据账本",
        "domain": "用统一事件信封承载项目任务、代码提交、测试结果、对话、反思和教师复核",
        "innovation": "证据账本让智能体的每个判断都有来源、时间、置信度和可撤回状态",
        "demo": "点击任何建议都能展开来源：哪个 PR、哪条 CI 日志、哪个知识点、哪条 Rubric",
        "risk": "数据越多越容易失控，因此方案把原始内容、摘要特征、可见范围和保留期限分开",
        "metrics": "事件采集成功率、字段缺失率、证据引用命中率、授权撤回执行时间",
        "sections": ["6.1 标准 EvidenceEvent 信封", "6.2 十二类核心数据对象", "6.3 数据质量、冲突与过期处理", "6.4 隐私保护与脱敏策略"],
    },
    {
        "title": "七、软件工程知识图谱与能力图谱",
        "domain": "把需求分析、架构设计、编码规范、测试、CI/CD、协作和复盘组织成课程能力网络",
        "innovation": "知识图谱不只是检索目录，还承担路径前置关系、提示边界和评分 Rubric 映射",
        "demo": "当学生测试失败时，系统能指出该失败关联到边界条件、断言设计和模块依赖三个能力节点",
        "risk": "图谱过细会无法维护，过粗会没有教学价值，因此首版采用课程 Rubric 驱动的中粒度节点",
        "metrics": "节点覆盖率、边关系复核通过率、检索引用准确率、路径节点完成率",
        "sections": ["7.1 知识节点与能力节点的拆分", "7.2 Rubric 到图谱的映射", "7.3 GraphRAG 检索边界", "7.4 图谱维护与版本治理"],
    },
    {
        "title": "八、动态学情诊断",
        "domain": "结合测验、工程行为、对话和反思，判断学生当前掌握度、阻塞类型和下一步风险",
        "innovation": "诊断不是贴标签，而是生成可行动的诊断卡：证据、原因、置信度、建议动作和复核要求",
        "demo": "系统识别某学生不是不会语法，而是需求拆解缺失导致测试目标不稳定",
        "risk": "学情误判会伤害体验，因此低置信度只能进入教师复核或影子提示",
        "metrics": "阻塞类型准确率、低置信度拦截率、教师纠正率、学生自评一致性",
        "sections": ["8.1 输入信号与诊断特征", "8.2 掌握度与阻塞度建模", "8.3 诊断卡输出格式", "8.4 误判、缺失与冷启动处理"],
    },
    {
        "title": "九、路径数字孪生与策略引擎",
        "domain": "为每个学生维护一个会随证据变化的学习路径状态，而不是固定推荐路线",
        "innovation": "SafeVOI 策略把学习收益、时间成本、风险和教师负担统一成下一步行动选择",
        "demo": "同样的 CI 失败，对基础薄弱学生推送概念检查，对高水平学生推送测试边界挑战",
        "risk": "策略如果只追求效率会鼓励抄近路，因此必须加入学术诚信和学习迁移约束",
        "metrics": "路径调整命中率、行动价值提升、重复阻塞下降、策略回退次数",
        "sections": ["9.1 路径状态与数字孪生", "9.2 下一步最佳行动 SafeVOI", "9.3 个性化与公平性约束", "9.4 策略解释与人工覆盖"],
    },
    {
        "title": "十、实时干预与脚手架伴学",
        "domain": "在学生遇到困难时给出分层提示、检查清单、定位问题和反思问题，而不是直接给答案",
        "innovation": "提示阶梯从问题定位到最小行动，再到示例骨架，始终保留学生完成关键思考的空间",
        "demo": "当学生提交失败 PR，系统先问边界条件，再给测试清单，最后才给简化伪代码结构",
        "risk": "干预过多会打断心流，因此提示必须有频率控制、有效期和学生静默选项",
        "metrics": "提示采纳率、直接答案拦截率、二次提交通过率、打扰投诉率",
        "sections": ["10.1 脚手架提示分级", "10.2 不替写原则与学术诚信", "10.3 对话状态与多轮追踪", "10.4 频率控制和静默策略"],
    },
    {
        "title": "十一、长期记忆与反思机制",
        "domain": "把学生的稳定偏好、反复错误、工程习惯和反思质量沉淀为长期记忆",
        "innovation": "记忆不是无限聊天记录，而是带来源、过期时间和可撤回状态的学习画像特征",
        "demo": "学生第三次忽略测试边界时，系统不重复解释语法，而提醒其历史模式并安排针对性练习",
        "risk": "记忆会带来标签固化，必须允许学生查看、纠正和删除记忆条目",
        "metrics": "记忆命中后改善率、记忆撤回响应时间、错误模式复发率、反思完成质量",
        "sections": ["11.1 长期记忆的数据结构", "11.2 反思任务的生成与评分", "11.3 记忆更新、合并与遗忘", "11.4 学生可解释与可撤回机制"],
    },
    {
        "title": "十二、多智能体架构",
        "domain": "用诊断、规划、脚手架、代码审阅、反思和教师协同多个 Agent 分担职责",
        "innovation": "多 Agent 不是提示词拆分，而是每个 Agent 绑定输入证据、工具权限、输出合同和停止条件",
        "demo": "评委能看到一次建议经过诊断 Agent、规划 Agent、脚手架 Agent 与教师复核 Agent 的状态流",
        "risk": "Agent 过多会增加成本和不可控性，因此首版采用有限状态图和明确降级策略",
        "metrics": "Agent 调用成功率、工具错误率、平均令牌成本、人工升级率",
        "sections": ["12.1 Agent 职责与权限表", "12.2 状态编排与人机协同", "12.3 工具调用和失败隔离", "12.4 成本、延迟与可观测性"],
    },
    {
        "title": "十三、RAG、GraphRAG 与事实边界",
        "domain": "让智能体在课程材料、工程证据和软件工程知识图谱内回答，而不是依赖模型自由发挥",
        "innovation": "每条建议必须给出证据片段、适用条件和不能回答时的降级动作",
        "demo": "系统对一次架构建议显示引用的课程 Rubric、PR diff 摘要和相关知识节点",
        "risk": "RAG 并不天然可靠，因此需要检索评测、引用覆盖、幻觉拦截和教师抽检",
        "metrics": "引用覆盖率、检索相关性、答案忠实度、无法回答正确拒答率",
        "sections": ["13.1 资料入库与权限索引", "13.2 GraphRAG 查询链路", "13.3 事实边界与拒答策略", "13.4 RAG 评测集与回归测试"],
    },
    {
        "title": "十四、教师复核与组织协同",
        "domain": "把高风险建议、低置信度诊断和班级共性问题推送到教师可处理的工单队列",
        "innovation": "教师不是被 AI 替代，而是从重复答疑中解放出来，集中处理高价值判断",
        "demo": "教师打开班级看板，看到三类队列：需立即复核、可批量放行、建议调整教学",
        "risk": "如果所有建议都要求复核会压垮教师，因此需按风险、置信度和影响范围分层",
        "metrics": "复核平均耗时、批量放行比例、教师改写率、课堂干预命中率",
        "sections": ["14.1 工单来源与风险分级", "14.2 教师看板与批量处理", "14.3 课堂干预和班级洞察", "14.4 教师负担控制"],
    },
    {
        "title": "十五、原型产品功能模块",
        "domain": "把方案落实为学生工作台、教师控制台、课程配置台和系统观测台四类界面",
        "innovation": "界面不展示花哨概念，而服务 3-5 分钟 Demo 的闭环动作",
        "demo": "学生端完成任务，教师端复核建议，课程端调整 Rubric，观测端显示调用和学习指标",
        "risk": "视觉先行会掩盖功能空洞，所以第一阶段先保证数据流和交互状态完整",
        "metrics": "关键路径点击数、页面加载时间、演示成功率、异常恢复时间",
        "sections": ["15.1 学生工作台", "15.2 教师控制台", "15.3 课程配置台", "15.4 可观测与评测台"],
    },
    {
        "title": "十六、工程实现架构与接口",
        "domain": "用前端、API、Agent 服务、事件总线、向量/图数据库和工程工具适配器组成可上线原型",
        "innovation": "所有 Agent 输出都经过合同校验、事件写账、评测采样和必要时人工复核",
        "demo": "本地 Demo 可用模拟 Git/CI 事件，也可后续替换为真实 GitHub/GitLab Classroom 事件",
        "risk": "一次性接入太多外部系统会拖慢比赛交付，因此首版做适配器接口和可替换模拟器",
        "metrics": "API 成功率、端到端延迟、事件幂等率、回放一致性",
        "sections": ["16.1 前后端与服务拆分", "16.2 事件总线和幂等处理", "16.3 模型服务与工具适配", "16.4 部署、环境和配置"],
    },
    {
        "title": "十七、安全、隐私与合规治理",
        "domain": "围绕学生数据、代码仓库、AI 输出和教师操作建立最小权限与审计机制",
        "innovation": "把风险治理做进产品流程，而不是附在方案最后的声明",
        "demo": "当学生撤回授权，系统停止新采集并将可删除特征标记为不可用于后续建议",
        "risk": "教育场景存在未成年人、成绩影响和学术诚信风险，需要明确人工兜底",
        "metrics": "敏感字段访问次数、权限违规拦截率、审计日志完整率、删除请求响应时间",
        "sections": ["17.1 数据分级与最小权限", "17.2 Prompt 安全与越权防护", "17.3 学术诚信与不替写机制", "17.4 审计、留痕和应急预案"],
    },
    {
        "title": "十八、评测、可观测性、试点证据归档与质量保证",
        "domain": "对检索、生成、Agent 调用、学习行为、教师复核和试点证据归档建立可持续评测体系",
        "innovation": "用离线评测、影子运行、红队测试、线上观察和 Pilot Evidence Binder 五层机制证明 Demo 不只是会跑一次",
        "demo": "评委可以看到每个智能建议背后的 trace、prompt 版本、检索片段、复核结果和 L0-L3 试点证据等级",
        "risk": "LLM 评测容易自说自话，因此保留教师金标、学生行为指标和失败样例库",
        "metrics": "离线集通过率、幻觉样例召回率、trace 完整率、回归测试失败数、试点声明门禁通过率",
        "sections": ["18.1 评测集设计", "18.2 Agent 可观测追踪", "18.3 红队与失败样例库", "18.4 试点证据归档与声明分级", "18.5 质量门禁和发布策略"],
    },
    {
        "title": "十九、3-5 分钟 Demo 剧本",
        "domain": "把复杂系统压缩成评委能理解、能记住、能打分的演示路径",
        "innovation": "演示不是讲 PPT，而是在同一条学生证据链上连续切换学生、Agent、教师和课程负责人视角",
        "demo": "从失败 PR 到成功修复，再到教师复核和路径更新，完整展示闭环",
        "risk": "演示过长会损失重点，因此每一步都绑定评分项和一句话解释",
        "metrics": "演示时长、无手工补救成功率、关键评分点覆盖率、问答可追溯证据数",
        "sections": ["19.1 演示目标与角色分配", "19.2 演示脚本逐秒设计", "19.3 评委可能追问与回答证据", "19.4 备用演示路径"],
    },
    {
        "title": "二十、八周验证、真实试点证据与研究设计",
        "domain": "用设计科学、影子运行、等待组试点、混合研究方法和真实试点证据归档验证方案有效性",
        "innovation": "先证明系统不会伤害学习和教师负担，再用分级证据声明真实效果，避免把合成回放包装成课程成效",
        "demo": "方案展示一套可执行的课程试点计划、停止门和 Pilot Evidence Binder，不把原型结果包装成真实成效",
        "risk": "比赛材料不能伪造成果，因此所有指标分为原型指标、试点指标和长期指标",
        "metrics": "学习增益、项目交付质量、教师负担、学生满意度、风险事件、真实课程证据完整度",
        "sections": ["20.1 研究问题与假设", "20.2 影子运行设计", "20.3 等待组试点和统计分析", "20.4 真实试点证据归档与声明分级", "20.5 停止门与伦理边界"],
    },
    {
        "title": "二十一、商业化与市场进入",
        "domain": "从高校软件工程课程切入，逐步扩展到企业实训、产教融合和能力认证",
        "innovation": "商业价值来自课程质量提升、教师效率、项目交付透明度和工程人才画像，而不是单纯卖聊天次数",
        "demo": "商业页展示高校试点、企业实训和平台合作三类路径",
        "risk": "教育产品销售周期长，因此早期以课程级轻量部署和比赛背书建立案例",
        "metrics": "课程部署成本、教师节省时间、学生留存、机构续费意愿、企业合作线索",
        "sections": ["21.1 首个市场与买单角色", "21.2 成本结构与 ROI 场景", "21.3 合作伙伴与生态接口", "21.4 规模化壁垒"],
    },
    {
        "title": "二十二、风险、反质疑与参赛路线",
        "domain": "提前回答评委最可能质疑的问题：是否只是包装、是否能上线、是否安全、是否有差异化",
        "innovation": "用可运行闭环、证据账本、PlantUML 架构、AI 概念图、QA 指标和提交清单组成可信叙事",
        "demo": "答辩时用一页反质疑矩阵把系统边界、可替代项和长期壁垒讲清楚",
        "risk": "若后续 Demo 没有按方案实现，文档会显得过重，因此开发计划需要围绕最小闭环推进",
        "metrics": "提交材料完整率、演示覆盖率、代码测试通过率、答辩追问命中率",
        "sections": ["22.1 评委反质疑矩阵", "22.2 开发排期与里程碑", "22.3 提交材料清单", "22.4 下一阶段产品路线"],
    },
]


DATA_OBJECTS = [
    ("StudentProfile", "学生画像", "基础背景、目标、授权状态、长期偏好", "学生端授权、教师端只见必要摘要"),
    ("CourseGraph", "课程/能力图谱", "软件工程知识点、先修关系、Rubric映射", "课程负责人维护，版本化发布"),
    ("ProjectTask", "项目任务", "需求、任务拆解、截止期、验收标准", "教师配置，学生执行"),
    ("EngineeringArtifact", "工程制品", "需求文档、设计图、代码、测试、PR、CI日志", "来自仓库和工具适配器"),
    ("EvidenceEvent", "证据事件", "actor、verb、object、source、confidence、timestamp", "所有智能判断必须引用"),
    ("DiagnosisCard", "诊断卡", "掌握度、阻塞类型、原因、证据、置信度", "低置信度进入复核"),
    ("PathState", "路径状态", "当前节点、下一步行动、风险、有效期", "路径数字孪生核心状态"),
    ("Intervention", "干预记录", "提示等级、内容、理由、过期时间、结果", "学生可反馈，教师可复核"),
    ("ReflectionEntry", "反思条目", "学生复盘、AI追问、质量评分、后续行动", "不作为惩罚依据，服务学习改进"),
    ("ReviewTicket", "复核工单", "风险等级、证据、建议、教师决策、审计日志", "高风险建议必须经过"),
    ("EvalCase", "评测样例", "输入、期望输出、禁答条件、评分结果", "用于回归测试和红队"),
    ("TraceSpan", "观测追踪", "模型、工具、检索、令牌、延迟、错误", "用于成本和质量治理"),
    ("ResearchContributionEdge", "研究贡献边", "源模块、目标模块、贡献类型、可验证证据", "服务答辩反质疑和算法原创性说明"),
    ("PilotEvidenceRecord", "试点证据记录", "证据等级、来源、授权状态、声明边界、人工确认人", "严禁把合成数据误写成真实课程效果"),
    ("TrialAnalysisDataset", "试点匿名分析数据包", "匿名事件、结果指标、基线 Rubric、教师锚点、结论分级快照", "导出前必须通过 no-pii-export 和 claim-tier-mapping"),
]


DEMO_STEPS = [
    ("00:00-00:20", "评委看到学生工作台", "学生正在完成“REST API 错误处理与测试”任务", "展示产品不是静态 PPT"),
    ("00:20-00:45", "学生提交失败 PR", "CI 模拟器返回边界条件测试失败", "触发真实工程证据"),
    ("00:45-01:20", "诊断 Agent 生成诊断卡", "阻塞原因定位到异常路径遗漏和测试断言不足", "展示学情诊断"),
    ("01:20-02:00", "脚手架 Agent 给提示", "只给检查清单和最小行动，不直接贴答案", "展示智能干预和学术诚信"),
    ("02:00-02:35", "学生二次提交通过", "证据账本记录改动和测试结果", "展示闭环反馈"),
    ("02:35-03:15", "教师端查看复核工单", "教师看到证据、建议和可批量处理队列", "展示人机协同"),
    ("03:15-04:00", "路径数字孪生更新", "系统调整下一步学习路径和反思任务", "展示记忆与动态规划"),
    ("04:00-04:30", "打开科研算法融合面板", "展示思想迁移链、算法贡献图谱和贡献证据包", "回答原创性和开源吸收边界"),
    ("04:30-05:00", "答辩追问入口", "打开架构、评测、试点证据、风险和商业化页", "支撑一等奖评分项"),
]


IDEA_MIGRATION_ROWS = [
    ("路径增值引擎", "把学习路径看作随行为变化的价值增量系统", "PathTwin + SafeVOI", "评委能看到同一学生在 CI 失败、修复和反思后路径状态发生变化"),
    ("动态画像", "不把学生固定贴标签，而在事件链中持续更新能力证据", "EvidenceEvent + DiagnosisCard", "诊断卡显示来源、置信度、阻塞类型和可撤回状态"),
    ("教师发布门", "增长运营中的发布审批被迁移为教育场景的安全放行机制", "Teacher Release Gate", "低置信度、高风险、可能替写的建议进入复核工单"),
    ("证据阶梯", "将商业验证中的证据等级转化为课程试点声明等级", "Pilot Evidence Binder", "L0 合成回放、L1 教师确认、L2 课程试点、L3 跨班长期追踪分开声明"),
]


CONTRIBUTION_GRAPH_ROWS = [
    ("EvidenceEvent -> DiagnosisCard", "事件账本驱动诊断", "把 Issue、PR、CI、对话和反思映射为可解释阻塞类型", "单元测试、诊断卡 UI、证据引用覆盖率"),
    ("DiagnosisCard -> SafeVOI", "风险感知路径选择", "用收益、时间、风险、教师负担共同选择下一步行动", "策略对比、提示等级、发布门命中记录"),
    ("SafeVOI -> PathTwin", "路径数字孪生更新", "将学生采纳、二次提交、测试通过和反思质量写回状态图", "路径状态时间线和回放数据"),
    ("Rubric Calibration -> ReleaseGate", "教师标注校准", "把教师 Anchor 样本纳入 AI 估计误差与发布阈值", "教师复核工单、Rubric 校准面板、审计日志"),
    ("TrialTelemetry -> AnalysisWorkbench", "匿名分析工作台", "把 trial-outcomes、no-pii-export、event-pairing 和 teacher-agreement 做成可执行分析门", "试点遥测面板、材料 33 和材料 58"),
    ("AnalysisWorkbench -> ClaimBoundary", "试点声明门禁", "只有真实授权课程证据才能进入效果声明，合成数据只证明流程", "Pilot Evidence Binder、claim-tier-mapping 和材料 58"),
]


PILOT_EVIDENCE_ROWS = [
    ("L0 原型回放", "合成学生、合成任务、模拟 PR/CI 和模拟教师复核", "证明闭环可运行，不声明真实学习收益", "当前 Demo 可直接提供"),
    ("L1 影子试点", "真实课程授权后的后台诊断、教师周报和匿名分析数据包", "可声明具备真实课程观察条件，不能声明成绩提升", "需要学校授权、知情退出和 no-pii-export"),
    ("L2 教师确认", "一个课程班级的授权干预、等待组或 A/B、教师签收和匿名分析快照", "可谨慎声明特定周期内的过程指标变化信号", "需要 event-pairing、teacher-agreement 和 claim-tier-mapping"),
    ("L3 长期追踪", "跨班级、跨学期或企业实训持续追踪", "可声明规模化可靠性和商业化案例", "需要多期数据、伦理边界和复盘报告"),
]


def ensure_dirs() -> None:
    for folder in [OUT, FIG_AI, FIG_PUML, QA, SOURCES]:
        folder.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def copy_ai_images() -> list[Path]:
    copied: list[Path] = []
    for src_name, dst_name in AI_IMAGE_MAP.items():
        src = AI_SOURCE / src_name
        dst = FIG_AI / dst_name
        if src.exists():
            shutil.copyfile(src, dst)
            copied.append(dst)
    return copied


def write_plantuml_sources() -> None:
    for filename, content in PUML_FILES.items():
        write_text(FIG_PUML / filename, content)


def render_plantuml() -> dict[str, object]:
    status: dict[str, object] = {"png": [], "svg": [], "errors": []}
    if not JAVA.exists():
        status["errors"].append(f"Java not found: {JAVA}")
        return status
    if not PLANTUML_JAR.exists():
        status["errors"].append(f"PlantUML jar not found: {PLANTUML_JAR}")
        return status
    for fmt in ("png", "svg"):
        cmd = [
            str(JAVA),
            "-Dfile.encoding=UTF-8",
            "-jar",
            str(PLANTUML_JAR),
            f"-t{fmt}",
            str(FIG_PUML),
        ]
        try:
            result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60)
            if result.returncode != 0:
                status["errors"].append(result.stderr or result.stdout)
        except Exception as exc:  # pragma: no cover - operational guard
            status["errors"].append(str(exc))
    status["png"] = sorted(p.name for p in FIG_PUML.glob("*.png"))
    status["svg"] = sorted(p.name for p in FIG_PUML.glob("*.svg"))
    return status


def set_run_font(run, *, name: str = BODY_FONT, size: float = 11, bold: bool | None = None, italic: bool | None = None) -> None:
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    rpr.rFonts.set(qn("w:eastAsia"), name)
    rpr.rFonts.set(qn("w:ascii"), LATIN_FONT)
    rpr.rFonts.set(qn("w:hAnsi"), LATIN_FONT)
    run.font.size = Pt(size)
    run.font.color.rgb = BLACK
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for key, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{key}"))
        if node is None:
            node = OxmlElement(f"w:{key}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_cell_border(cell, **edges) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge, spec in edges.items():
        node = borders.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), spec.get("val", "single"))
        node.set(qn("w:sz"), str(spec.get("sz", 4)))
        node.set(qn("w:color"), spec.get("color", "A6A6A6"))


def set_table_geometry(table, widths_mm: Sequence[float]) -> None:
    table.autofit = False
    total = sum(int(Mm(w).emu / 635) for w in widths_mm)
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(total))
    tbl_w.set(qn("w:type"), "dxa")
    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_mm:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(int(Mm(width).emu / 635)))
        grid.append(col)
    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            width = widths_mm[idx]
            cell.width = Mm(width)
            tc_w = cell._tc.get_or_add_tcPr().first_child_found_in("w:tcW")
            if tc_w is None:
                tc_w = OxmlElement("w:tcW")
                cell._tc.get_or_add_tcPr().append(tc_w)
            tc_w.set(qn("w:w"), str(int(Mm(width).emu / 635)))
            tc_w.set(qn("w:type"), "dxa")


def shade_cell(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.first_child_found_in("w:shd")
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def configure_section(section, landscape: bool = False) -> None:
    if landscape:
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = Mm(297)
        section.page_height = Mm(210)
        section.left_margin = Mm(20)
        section.right_margin = Mm(20)
        section.top_margin = Mm(18)
        section.bottom_margin = Mm(18)
    else:
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width = Mm(210)
        section.page_height = Mm(297)
        section.left_margin = Mm(25)
        section.right_margin = Mm(25)
        section.top_margin = Mm(24)
        section.bottom_margin = Mm(22)
    section.header_distance = Mm(10)
    section.footer_distance = Mm(10)


def configure_styles(doc: Document) -> None:
    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    normal._element.rPr.rFonts.set(qn("w:ascii"), LATIN_FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), LATIN_FONT)
    normal.font.size = Pt(11)
    normal.font.color.rgb = BLACK
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE

    for style_name in ("Heading 1", "Heading 2", "Heading 3"):
        level = int(style_name[-1])
        style = doc.styles[style_name]
        style.font.name = HEADING_FONT
        style._element.rPr.rFonts.set(qn("w:eastAsia"), HEADING_FONT)
        style._element.rPr.rFonts.set(qn("w:ascii"), LATIN_FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), LATIN_FONT)
        style.font.size = Pt({1: 18, 2: 15, 3: 13}[level])
        style.font.bold = True
        style.font.color.rgb = BLACK
        style.paragraph_format.space_before = Pt({1: 12, 2: 10, 3: 8}[level])
        style.paragraph_format.space_after = Pt({1: 8, 2: 6, 3: 4}[level])
        style.paragraph_format.keep_with_next = True


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = paragraph.add_run("第 ")
    set_run_font(r, size=9)
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    paragraph._p.append(begin)
    paragraph._p.append(instr)
    paragraph._p.append(end)
    r = paragraph.add_run(" 页")
    set_run_font(r, size=9)


def configure_header_footer(section) -> None:
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    hp = section.header.paragraphs[0]
    hp.clear()
    hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = hp.add_run("SE-Path 学伴：软件工程自适应学习伙伴智能体产品设计与原型验证方案")
    set_run_font(r, name=HEADING_FONT, size=9, bold=True)
    fp = section.footer.paragraphs[0]
    fp.clear()
    add_page_number(fp)


def page_break(doc: Document) -> None:
    global EXPLICIT_PAGE_BREAKS
    doc.add_page_break()
    EXPLICIT_PAGE_BREAKS += 1
    MD_LINES.append("\n<div style=\"page-break-after: always;\"></div>\n")


def add_toc(doc: Document) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = 'TOC \\o "1-3" \\h \\z \\u'
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    run = OxmlElement("w:r")
    text = OxmlElement("w:t")
    text.text = "请在 Word 中右键更新目录，以显示最终页码。"
    run.append(text)
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    p._p.append(fld_begin)
    p._p.append(instr)
    p._p.append(fld_sep)
    p._p.append(run)
    p._p.append(fld_end)


def add_heading(doc: Document, text: str, level: int) -> None:
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        set_run_font(run, name=HEADING_FONT, size={1: 18, 2: 15, 3: 13}[level], bold=True)
    MD_LINES.append(f"{'#' * level} {text}\n")


def add_para(doc: Document, text: str, *, bold_prefix: str | None = None) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.first_line_indent = Pt(22)
    if bold_prefix and text.startswith(bold_prefix):
        r = p.add_run(bold_prefix)
        set_run_font(r, bold=True)
        r = p.add_run(text[len(bold_prefix):])
        set_run_font(r)
    else:
        r = p.add_run(text)
        set_run_font(r)
    MD_LINES.append(text + "\n")


def add_caption(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_run_font(r, size=10, bold=True)
    MD_LINES.append(f"> {text}\n")


def add_simple_table(doc: Document, headers: Sequence[str], rows: Sequence[Sequence[str]], widths_mm: Sequence[float] | None = None) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0]
    for idx, text in enumerate(headers):
        cell = hdr.cells[idx]
        shade_cell(cell, "EAF2F8")
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(text)
        set_run_font(r, name=HEADING_FONT, size=10, bold=True)
    for row in rows:
        cells = table.add_row().cells
        for idx, text in enumerate(row):
            cell = cells[idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            p = cell.paragraphs[0]
            r = p.add_run(str(text))
            set_run_font(r, size=9.5)
    for row in table.rows:
        for cell in row.cells:
            set_cell_margins(cell)
            set_cell_border(
                cell,
                top={"val": "single", "sz": 3, "color": "BFBFBF"},
                bottom={"val": "single", "sz": 3, "color": "BFBFBF"},
                start={"val": "single", "sz": 3, "color": "BFBFBF"},
                end={"val": "single", "sz": 3, "color": "BFBFBF"},
            )
    if widths_mm:
        set_table_geometry(table, widths_mm)
    MD_LINES.append("| " + " | ".join(headers) + " |")
    MD_LINES.append("| " + " | ".join(["---"] * len(headers)) + " |")
    for row in rows:
        MD_LINES.append("| " + " | ".join(str(x).replace("\n", "<br>") for x in row) + " |")
    MD_LINES.append("")


def image_size(path: Path, max_width_mm: float = 160, max_height_mm: float = 190) -> tuple[Mm, Mm]:
    with Image.open(path) as img:
        w, h = img.size
    ratio = w / h
    width = max_width_mm
    height = width / ratio
    if height > max_height_mm:
        height = max_height_mm
        width = height * ratio
    return Mm(width), Mm(height)


def add_image(doc: Document, path: Path, title: str, caption: str, *, max_width_mm: float = 160, max_height_mm: float = 190) -> None:
    if not path.exists():
        add_para(doc, f"图像文件暂未生成：{path.name}。该位置保留为后续渲染图插入点。")
        return
    add_heading(doc, title, 3)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    width, height = image_size(path, max_width_mm=max_width_mm, max_height_mm=max_height_mm)
    p.add_run().add_picture(str(path), width=width, height=height)
    add_caption(doc, caption)
    rel = path.relative_to(OUT).as_posix()
    MD_LINES.append(f"![{caption}]({rel})\n")


def section_paragraphs(chapter: dict[str, str], section_title: str) -> list[str]:
    return [
        f"本节围绕“{section_title}”展开，核心目的是把{chapter['domain']}落到可运行、可复核、可度量的产品动作中。比赛方案最怕停留在口号层面，所以 SE-Path 学伴要求每个智能判断都能追溯到工程证据，每个学习建议都能映射到课程能力节点，每次系统干预都能在后续提交、测试或反思中看到结果。",
        f"对应的设计创新是：{chapter['innovation']}。这使方案与常见的编程问答助手拉开距离。普通助手把学生问题当作一次对话处理，SE-Path 则把问题放回软件工程项目链路，结合任务上下文、仓库变化、CI 结果、Rubric 和历史记忆，判断学生到底需要概念提醒、流程纠偏、代码审阅、测试策略，还是教师介入。",
        f"在原型演示中，本节会通过“{chapter['demo']}”体现闭环价值。界面可以简化，但数据流不能简化：学生动作进入证据账本，诊断 Agent 生成诊断卡，规划 Agent 计算下一步行动，脚手架 Agent 输出有限提示，教师复核 Agent 处理高风险建议，最后由路径数字孪生更新学生状态。",
        f"本节必须控制的风险是：{chapter['risk']}。因此方案中所有自动化动作都设置置信度、有效期、证据引用和人工兜底。验收时不以“回答看起来聪明”为标准，而以{chapter['metrics']}等指标证明系统真的完成了学习闭环。",
    ]


def section_table_rows(chapter: dict[str, str], section_title: str) -> list[tuple[str, str]]:
    return [
        ("产品动作", f"围绕“{section_title}”配置一个可点击或可触发的原型动作，而不是只在文档中描述。"),
        ("输入证据", "至少读取一次任务、代码、测试、对话或反思事件，并写入 EvidenceEvent。"),
        ("智能判断", "输出诊断、路径、提示或复核建议时，必须包含理由、置信度和证据引用。"),
        ("学生体验", "学生看到的是下一步行动、检查清单或反思问题，不看到不可验证的模型内部判断。"),
        ("教师治理", "高风险、低置信度、可能替写或影响成绩的建议进入教师复核队列。"),
        ("验收指标", chapter["metrics"]),
    ]


def add_section_page(doc: Document, chapter: dict[str, str], section_title: str, *, first: bool = False) -> None:
    if not first:
        page_break(doc)
    add_heading(doc, section_title, 2)
    for paragraph in section_paragraphs(chapter, section_title):
        add_para(doc, paragraph)
    add_simple_table(doc, ["维度", "设计要求"], section_table_rows(chapter, section_title), [35, 125])


def add_cover(doc: Document, ai_images: list[Path]) -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("SE-Path 学伴")
    set_run_font(r, name=HEADING_FONT, size=28, bold=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("面向软件工程项目式学习的自适应学习伙伴智能体")
    set_run_font(r, name=HEADING_FONT, size=18, bold=True)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("产品设计与原型验证方案")
    set_run_font(r, name=HEADING_FONT, size=20, bold=True)
    doc.add_paragraph()
    if ai_images:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        width, height = image_size(ai_images[0], max_width_mm=160, max_height_mm=105)
        p.add_run().add_picture(str(ai_images[0]), width=width, height=height)
        add_caption(doc, "AI生成图：SE-Path 学伴的软件工程学习生态概念图")
    for label, value in [
        ("参赛方向", "AI 应用赛：自适应学习伙伴智能体"),
        ("面向学科", "软件工程 / 计算机类项目式课程"),
        ("方案版本", "V1.0 参赛方案草案"),
        ("生成日期", date.today().isoformat()),
        ("核心命题", "让学生在真实工程证据中被诊断、被引导、被记住、被复核，而不是被 AI 直接替写答案。"),
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"{label}：{value}")
        set_run_font(r, size=12, bold=label in {"参赛方向", "核心命题"})
    MD_LINES.extend(
        [
            "# SE-Path 学伴",
            "",
            "面向软件工程项目式学习的自适应学习伙伴智能体",
            "",
            "产品设计与原型验证方案",
            "",
        ]
    )


def add_abstract(doc: Document) -> None:
    add_heading(doc, "摘要", 1)
    abstract = [
        "SE-Path 学伴是一套面向软件工程项目式学习的自适应学习伙伴智能体。它不把“智能伴学”理解为通用问答，而是把学生在需求、设计、编码、测试、协作和反思中的真实工程制品变成可计算证据，再由多智能体完成动态学情诊断、个性化路径规划、实时脚手架干预、长期记忆更新和教师复核协同。",
        "本方案的核心创新是“证据原生学习闭环”：系统首先从 Issue、Commit、Pull Request、CI 测试、代码质量扫描、对话和反思中生成 EvidenceEvent；随后在软件工程知识图谱与能力图谱上定位学生的当前能力节点和阻塞类型；再通过 SafeVOI 策略选择下一步行动；最后把学生采纳、修复、测试通过和反思质量写回路径数字孪生。这样，学习路径不是静态推荐表，而是随项目证据实时更新的数字孪生。",
        "在既有“路径增值引擎”设计基础上，本方案进一步形成“思想迁移链 + 算法贡献图谱 + 贡献证据包”的研究表达：把动态画像、路径价值、教师发布门和证据阶梯迁移为软件工程伴学中的 EvidenceEvent、DiagnosisCard、SafeVOI、PathTwin、Rubric Calibration 与 Pilot Evidence Binder。该设计既能解释开源项目如何被吸收，也能说明哪些能力属于 SE-Path 的自研增量。",
        "为了避免 AI 直接替写作业，SE-Path 将提示设计为分级脚手架：优先给出问题定位、检查清单、追问和最小行动；只有在连续失败并满足课程许可时才给出示例骨架；低置信度、高风险、可能影响成绩或涉及学术诚信的建议必须进入教师复核工单。系统同时引入 GraphRAG、RAG 离线评测、OpenTelemetry 风格可观测追踪和红队样例库，使智能能力可追溯、可评测、可回滚。",
        "为保证参赛材料真实可信，本方案把试点证据分为 L0 原型回放、L1 教师确认、L2 课程试点和 L3 长期追踪四级。未完成真实授权课程试点前，系统只能声明闭环可运行、流程可验证和专家可复核，不能宣称已经提升成绩或就业结果。Pilot Evidence Binder 将在产品内集中展示证据等级、缺口、授权状态和声明边界。",
        "本文件按照参赛项目计划书格式展开，覆盖赛题理解、产品定位、开源项目吸收、研究贡献图谱、数据与算法、Agent 架构、原型功能、Demo 剧本、验证方案、商业化路径、风险反质疑和提交材料清单。文档中包含 AI 生成概念图和 PlantUML 渲染的系统架构图，可作为后续开发闭环 Demo、答辩 PPT、演示视频和项目计划书的统一母版。",
    ]
    for item in abstract:
        add_para(doc, item)
    add_simple_table(
        doc,
        ["关键词", "含义"],
        [
            ("证据原生", "一切诊断与建议都追溯到真实工程学习事件，而不是只依赖学生自述。"),
            ("路径数字孪生", "每个学生拥有动态更新的能力、项目、协作和风险状态。"),
            ("脚手架伴学", "AI 不直接替写答案，而是给学生下一步可执行行动。"),
            ("教师复核", "高风险或低置信度建议进入人机协同工单，保障教学主导权。"),
            ("可验证智能", "用离线评测、影子运行、红队和可观测追踪持续证明系统可靠性。"),
            ("研究贡献图谱", "用思想迁移链、算法贡献边和证据包回答原创性、可复现性和开源边界。"),
            ("试点证据归档", "把 L0-L3 证据等级与声明边界写进产品，避免材料夸大真实效果。"),
        ],
        [35, 125],
    )


def add_sources_section(doc: Document) -> None:
    page_break(doc)
    add_heading(doc, "开源与公开资料证据矩阵", 1)
    add_para(doc, "本方案查阅并吸收了自适应辅导、在线作业、自动评测、多智能体编排、知识图谱检索、RAG 评测、生成式 AI 可观测性和 AI 风险治理等公开资料。这里的引用不是为了堆叠名词，而是说明每类资料如何转化为 SE-Path 学伴的产品约束与创新边界。")
    add_simple_table(
        doc,
        ["资料/项目", "类型", "可吸收能力", "SE-Path 增量创新"],
        [(p["name"], p["type"], p["what_to_absorb"], p["sepath_delta"]) for p in SOURCE_PROJECTS],
        [30, 34, 48, 48],
    )
    add_para(doc, "资料链接如下，后续提交材料可在参考文献或附录中保留原始 URL，避免把开源项目误写成自研成果：")
    for project in SOURCE_PROJECTS:
        add_para(doc, f"{project['name']}：{project['url']}")
        MD_LINES.append(f"- [{project['name']}]({project['url']})\n")


def add_innovation_evidence_section(doc: Document) -> None:
    page_break(doc)
    add_heading(doc, "创新证据与真实试点门禁", 1)
    add_para(
        doc,
        "一等奖材料需要同时回答三个问题：第一，方案是否只是把开源组件重新组合；第二，算法与产品闭环是否有自己的教育场景贡献；第三，Demo 中展示的能力和真实课程效果之间是否有清晰边界。SE-Path 因此把创新证据做成产品内可见的数据结构，而不是只写在商业计划书中。",
    )
    add_para(
        doc,
        "本章对应产品中的“科研算法融合与开源证据中台”和“真实试点证据归档中心”。前者记录思想迁移链、算法贡献图谱、开源参考矩阵和贡献证据包；后者记录 L0-L3 证据等级、授权状态、缺口清单和声明边界。二者共同保证：评委能看见创新从哪里来、落到哪个模块、由什么证据支撑、哪些结论还不能提前宣称。",
    )
    add_para(
        doc,
        "在真实课程验证链路中，TrialTelemetry 不只负责记录事件，还会生成 TrialAnalysisDataset、analysisChecks 和 effectDecisionRules：匿名事件明细、匿名结果指标、基线 Rubric 快照、教师锚点评分和结论分级快照共同组成分析数据包；no-pii-export、minimum-coverage、event-pairing、baseline-balance、teacher-agreement 和 claim-tier-mapping 共同组成质量门；L0 工程闭环、L1 影子试点、L2 教师确认和 L3 受控效果共同约束对外表述。这个设计让系统敢于进入真实试点，同时不提前夸大真实提分。",
    )

    add_heading(doc, "思想迁移链", 2)
    add_para(doc, "思想迁移链用于说明既有路径增值引擎设计如何被转化为软件工程学习场景的闭环能力。它强调迁移、重构和验证，而不是简单复用历史方案。")
    add_simple_table(
        doc,
        ["来源思想", "可迁移内核", "SE-Path 落点", "评委可见证据"],
        IDEA_MIGRATION_ROWS,
        [32, 48, 42, 38],
    )

    add_heading(doc, "算法贡献图谱", 2)
    add_para(doc, "算法贡献图谱把核心模块之间的贡献关系显式化。每条边都要求绑定代码、测试、界面或材料证据，避免“算法先进”停留在形容词层面。")
    add_simple_table(
        doc,
        ["贡献边", "贡献名称", "自研增量", "证据位置"],
        CONTRIBUTION_GRAPH_ROWS,
        [42, 34, 54, 30],
    )

    add_heading(doc, "真实试点证据分级", 2)
    add_para(doc, "试点证据分级用于约束参赛表达：原型数据可以证明流程、质量门禁和交互闭环；真实效果声明必须来自授权、脱敏、可复核的课程试点证据。")
    add_simple_table(
        doc,
        ["等级", "证据来源", "允许声明", "缺口与下一步"],
        PILOT_EVIDENCE_ROWS,
        [28, 48, 46, 38],
    )

    add_heading(doc, "答辩反质疑用法", 2)
    add_simple_table(
        doc,
        ["评委问题", "产品内回答", "材料内回答"],
        [
            ("是不是套壳聊天机器人？", "学生端展示的是任务、CI、诊断卡、脚手架和路径状态，不是单一聊天框。", "第五章闭环、六章证据账本、十二章多智能体和十九章 Demo 剧本共同证明。"),
            ("是不是拼开源？", "科研融合面板展示开源参考仅作为 reference-only matrix，并显示自研贡献边。", "第三章、开源矩阵和本章思想迁移链说明吸收与增量边界。"),
            ("有没有真实效果？", "Pilot Evidence Binder 显示 L0-L3 当前等级、缺口和禁止声明项。", "第二十章验证设计、附录 E 和提交材料 58 约束真实性声明。"),
            ("能不能上线？", "发布门、审计、SLO、生产数据平面和后端状态页组成上线门禁。", "第十六至十八章、部署运维材料和 release_gate QA 报告提供验收证据。"),
        ],
        [42, 62, 56],
    )


def add_diagram_pages(doc: Document) -> None:
    page_break(doc)
    add_heading(doc, "PlantUML 架构图集", 1)
    add_para(doc, "本章集中收录 PlantUML 生成的核心架构图。后续做 Demo 和答辩 PPT 时，可直接复用同名 .puml 源文件与 .png/.svg 渲染图。")
    diagrams = [
        ("01_赛题到SEPath方案逻辑链.png", "图 1 赛题到 SE-Path 方案逻辑链", "从官方命题到软件工程闭环 Demo 的设计推导。"),
        ("02_软件工程学习闭环总体架构.png", "图 2 软件工程学习闭环总体架构", "学生端、工程工具层、智能体层、算法事实层和治理观测层的责任关系。"),
        ("03_证据原生数据对象模型.png", "图 3 证据原生数据对象模型", "学生画像、工程制品、证据事件、路径状态和复核工单之间的关系。"),
        ("04_多智能体编排与发布门时序.png", "图 4 多智能体编排与发布门时序", "一次学生工程事件如何经过 Agent 编排并进入人工发布门。"),
        ("05_路径数字孪生状态机.png", "图 5 路径数字孪生状态机", "学生路径状态如何在阻塞、脚手架、复核和掌握之间转换。"),
        ("06_脚手架伴学提示阶梯流程.png", "图 6 脚手架伴学提示阶梯", "AI 如何在不替写的前提下逐级提供帮助。"),
        ("07_GraphRAG与课程知识边界.png", "图 7 GraphRAG 与课程知识边界", "课程材料、工程证据和知识图谱如何共同约束生成。"),
        ("08_教师复核工单状态机.png", "图 8 教师复核工单状态机", "教师复核从创建到归档的状态流。"),
        ("09_原型演示闭环时序.png", "图 9 原型演示闭环时序", "3-5 分钟演示中学生、系统、教师和证据账本的交互。"),
        ("10_八周验证与停止门.png", "图 10 八周验证与停止门", "从影子运行到试点验证的安全推进机制。"),
        ("14_科研算法融合与开源证据中台.png", "图 14 科研算法融合与开源证据中台", "思想迁移链、算法贡献图谱、开源参考矩阵和试点证据归档之间的关系。"),
    ]
    for filename, title, caption in diagrams:
        page_break(doc)
        add_image(doc, FIG_PUML / filename, title, caption, max_width_mm=165, max_height_mm=175)


def add_ai_image_pages(doc: Document, ai_images: list[Path]) -> None:
    if not ai_images:
        return
    page_break(doc)
    add_heading(doc, "AI 生成概念图与原型视觉参考", 1)
    add_para(doc, "本章图像由 AI 生成，用于表达产品生态、工作台方向和演示叙事。当前阶段不把视觉作为优先约束，图像主要服务参赛材料中的产品想象、PPT 首屏和演示视频分镜。")
    captions = [
        ("AI生成图：SE-Path 学伴软件工程学习生态", "用于封面和产品总览页，强调学生、教师、工程证据和 AI 闭环。"),
        ("AI生成图：证据指挥中心概念界面", "用于表达教师/课程负责人查看证据链和风险队列的方向。"),
        ("AI生成图：结对伴学工作台概念界面", "用于表达学生在项目任务中获得脚手架提示和下一步行动。"),
        ("AI生成图：课程智能驾驶舱概念界面", "用于表达课程级路径、指标和治理状态。"),
    ]
    for image, (title, caption) in zip(ai_images, captions):
        page_break(doc)
        add_image(doc, image, title, caption, max_width_mm=165, max_height_mm=150)


def add_chapters(doc: Document) -> None:
    first_section = True
    for chapter in CHAPTERS:
        page_break(doc)
        add_heading(doc, chapter["title"], 1)
        add_para(doc, f"本章讨论{chapter['domain']}。其核心创新是：{chapter['innovation']}。为了让方案直接服务比赛，本章所有设计均围绕可演示闭环、可解释证据、可验证指标和可上线边界展开。")
        add_simple_table(
            doc,
            ["本章关注", "内容"],
            [
                ("Demo 落点", chapter["demo"]),
                ("主要风险", chapter["risk"]),
                ("验收指标", chapter["metrics"]),
            ],
            [35, 125],
        )
        for section_title in chapter["sections"]:
            add_section_page(doc, chapter, section_title, first=False if not first_section else True)
            first_section = False


def add_appendices(doc: Document) -> None:
    page_break(doc)
    add_heading(doc, "附录 A 数据字典与接口字段", 1)
    add_para(doc, "数据字典用于指导后续 Demo 开发。首版不追求覆盖所有教学系统字段，而优先保证闭环演示所需的关键对象完整、字段可解释、事件可回放。")
    add_simple_table(doc, ["对象", "中文名", "关键字段", "权限与来源"], DATA_OBJECTS, [32, 30, 65, 33])

    page_break(doc)
    add_heading(doc, "附录 B Demo API 草案", 1)
    api_rows = [
        ("POST /api/events", "写入 EvidenceEvent", "学生动作、工程工具事件、反思记录", "返回 event_id 与采集状态"),
        ("GET /api/students/{id}/path", "读取路径数字孪生", "student_id", "返回当前能力节点、阻塞、下一步行动"),
        ("POST /api/diagnose", "触发诊断 Agent", "student_id、task_id、event_ids", "返回诊断卡与置信度"),
        ("POST /api/interventions", "生成脚手架干预", "diagnosis_id、policy_context", "返回提示等级、内容和有效期"),
        ("GET /api/review-tickets", "教师复核队列", "course_id、risk_level、status", "返回待处理工单"),
        ("POST /api/review-tickets/{id}/decision", "教师决策", "approve/revise/reject 与理由", "写入审计日志并触发推送"),
        ("GET /api/traces/{id}", "查看智能调用追踪", "trace_id", "返回模型、检索、工具、成本和错误信息"),
        ("POST /api/eval/run", "运行评测集", "eval_suite_id、model_version", "返回回归测试结果"),
    ]
    add_simple_table(doc, ["接口", "用途", "输入", "输出"], api_rows, [42, 38, 42, 38])

    page_break(doc)
    add_heading(doc, "附录 C 3-5 分钟演示脚本", 1)
    add_para(doc, "演示脚本强调一条证据链到底，避免在不同页面之间展示互不相干的功能。每一步都对应官方评分项，且均可通过本地模拟数据完成。")
    add_simple_table(doc, ["时间", "演示动作", "屏幕内容", "评分点"], DEMO_STEPS, [30, 42, 50, 38])

    page_break(doc)
    add_heading(doc, "附录 D 提交材料清单", 1)
    submit_rows = [
        ("项目计划书/PDF", "由本 DOCX 导出 PDF，保留目录、图表、风险声明、开源证据矩阵和研究贡献图谱", "必交"),
        ("可运行 Demo", "学生端、教师端、事件模拟器、Agent 闭环和 QA 数据", "必交"),
        ("演示视频", "3-5 分钟，按附录 C 剧本录制，突出闭环而不是讲概念", "必交"),
        ("源代码或压缩包", "前端、后端、Agent、数据样例、PlantUML 和 README", "必交/推荐"),
        ("图像素材", "AI 生成概念图、PlantUML 架构图、产品截图", "推荐"),
        ("验证样本包", "合成学生、任务、PR、CI、反思和教师复核样例", "推荐"),
        ("科研算法融合说明", "开源参考矩阵、思想迁移链、算法贡献图谱和贡献证据包", "强烈建议"),
        ("真实试点证据归档说明", "材料 58，说明 L0-L3 证据等级、授权状态、声明边界和缺口清单", "强烈建议"),
        ("真实性声明", "说明开源引用、AI 生成图、合成数据与未完成试点边界", "强烈建议"),
    ]
    add_simple_table(doc, ["材料", "说明", "优先级"], submit_rows, [45, 90, 25])

    page_break(doc)
    add_heading(doc, "附录 E 真实性与使用声明", 1)
    statements = [
        "本方案中的 AI 生成图片仅用于概念表达、参赛文档和演示视频辅助，不作为真实已上线界面截图。",
        "本方案引用的开源项目和公开资料仅用于研究与设计参考，后续工程实现需遵守对应许可证与使用条款。",
        "本方案中的学生、任务、提交、CI 结果和教师复核样例可使用合成数据构建，不应伪装为真实试点效果。",
        "Pilot Evidence Binder 中 L0 原型回放只证明闭环流程可运行；L1-L3 必须取得教师确认、课程授权、脱敏数据和统计复核后才能写入对外效果声明。",
        "研究贡献图谱中的思想迁移链和算法贡献边用于说明设计来源与自研增量，不得把参考开源项目的成熟能力表述为本团队原创成果。",
        "在未完成正式课程试点前，方案不得宣称已经显著提升成绩、就业结果或长期学习能力，只能报告原型能力和验证计划。",
        "系统输出不得替代教师评价、课程成绩评定或学术诚信判断，高风险输出必须保留人工复核。",
    ]
    for statement in statements:
        add_para(doc, statement)


def build_doc(ai_images: list[Path]) -> None:
    doc = Document()
    configure_section(doc.sections[0])
    configure_styles(doc)
    configure_header_footer(doc.sections[0])

    add_cover(doc, ai_images)
    page_break(doc)
    add_heading(doc, "目录", 1)
    add_toc(doc)
    page_break(doc)
    add_abstract(doc)
    add_sources_section(doc)
    add_innovation_evidence_section(doc)
    add_ai_image_pages(doc, ai_images)
    add_diagram_pages(doc)
    add_chapters(doc)
    add_appendices(doc)

    doc.save(DOCX_PATH)


def write_markdown() -> None:
    content = "\n".join(MD_LINES)
    write_text(MD_PATH, content)


def write_sources_files() -> None:
    write_text(SOURCE_JSON_PATH, json.dumps(SOURCE_PROJECTS, ensure_ascii=False, indent=2))
    lines = ["# 开源与公开资料参考矩阵", ""]
    lines.append("| 项目/资料 | 类型 | 吸收能力 | SE-Path 增量创新 | 链接 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for item in SOURCE_PROJECTS:
        lines.append(
            f"| {item['name']} | {item['type']} | {item['what_to_absorb']} | {item['sepath_delta']} | {item['url']} |"
        )
    write_text(SOURCE_MD_PATH, "\n".join(lines))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_qa(plantuml_status: dict[str, object], ai_images: list[Path]) -> dict[str, object]:
    with zipfile.ZipFile(DOCX_PATH) as zf:
        bad_zip = zf.testzip()
        names = zf.namelist()
        document_xml = zf.read("word/document.xml").decode("utf-8", errors="replace")
        media = [n for n in names if n.startswith("word/media/")]
    reopened = Document(DOCX_PATH)
    text = "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", document_xml))
    text = re.sub(r"<[^>]+>", "", text)
    page_break_count = document_xml.count('w:type="page"')
    return {
        "file": str(DOCX_PATH),
        "bytes": DOCX_PATH.stat().st_size,
        "sha256": sha256(DOCX_PATH),
        "zip_test": "PASS" if bad_zip is None else f"FAIL:{bad_zip}",
        "characters_without_whitespace": len(re.sub(r"\s+", "", text)),
        "paragraphs": len(reopened.paragraphs),
        "tables": len(reopened.tables),
        "drawings": document_xml.count("<w:drawing>"),
        "media_files": len(media),
        "explicit_page_breaks": page_break_count,
        "estimated_min_pages": page_break_count + 1,
        "ai_images_copied": [p.name for p in ai_images],
        "plantuml_png_count": len(list(FIG_PUML.glob("*.png"))),
        "plantuml_svg_count": len(list(FIG_PUML.glob("*.svg"))),
        "plantuml_status": plantuml_status,
        "required_thresholds": {
            "estimated_min_pages": ">=80",
            "plantuml_png_count": ">=11",
            "ai_images_copied": ">=1",
            "characters_without_whitespace": ">=30000",
        },
        "status": "PASS"
        if bad_zip is None
        and page_break_count + 1 >= 80
        and len(list(FIG_PUML.glob("*.png"))) >= 11
        and len(ai_images) >= 1
        and len(re.sub(r"\s+", "", text)) >= 30000
        else "CHECK",
    }


def write_readme(metrics: dict[str, object]) -> None:
    readme = f"""
# SE-Path 学伴交付说明

本目录为“面向软件工程项目式学习的自适应学习伙伴智能体”参赛产品设计方案生成结果。

## 核心文件

- `SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计与原型验证方案.docx`：可直接打开的 Word 正稿。
- `SE-Path学伴_软件工程自适应学习伙伴智能体_产品设计与原型验证方案.md`：同内容 Markdown 源稿，便于后续拆 PPT 和 Demo README。
- `figures/ai/`：AI 生成概念图与界面方向图。
- `figures/plantuml/`：PlantUML 源文件及 PNG/SVG 渲染图。
- `sources/open_source_reference_matrix.md`：开源与公开资料参考矩阵。
- `qa/docx_structure_metrics.json`：结构和页数估算 QA。

## 本版新增重点

- 主方案已纳入“思想迁移链、算法贡献图谱、贡献证据包”，用于回答开源吸收与自研创新边界。
- 主方案已纳入“Pilot Evidence Binder / 真实试点证据归档”，把 L0-L3 证据等级、授权状态和声明边界写进正文。
- 主方案已纳入“TrialAnalysisDataset / 匿名分析工作台”，把 no-pii-export、event-pairing、teacher-agreement 和 claim-tier-mapping 写入真实试点分析闭环。
- PlantUML 图集新增“科研算法融合与开源证据中台”，可直接拆入答辩 PPT 与演示视频。

## QA 摘要

- ZIP 完整性：{metrics['zip_test']}
- 估算最少页数：{metrics['estimated_min_pages']} 页
- 正文非空白字符：{metrics['characters_without_whitespace']}
- 表格数量：{metrics['tables']}
- 插图数量：{metrics['drawings']}
- PlantUML PNG：{metrics['plantuml_png_count']}
- AI 图：{len(metrics['ai_images_copied'])}
- 状态：{metrics['status']}

## 后续建议

1. 用 Word 打开 DOCX 后右键更新目录。
2. 后续开发 Demo 时，以第十九章演示脚本作为最小闭环任务。
3. 答辩 PPT 可从摘要、PlantUML 图集、Demo 剧本、反质疑矩阵和商业化章节拆分。
"""
    write_text(README_PATH, readme)


def main() -> None:
    ensure_dirs()
    ai_images = copy_ai_images()
    write_plantuml_sources()
    plantuml_status = render_plantuml()
    build_doc(ai_images)
    write_markdown()
    write_sources_files()
    metrics = collect_qa(plantuml_status, ai_images)
    write_text(QA_PATH, json.dumps(metrics, ensure_ascii=False, indent=2))
    write_readme(metrics)
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
