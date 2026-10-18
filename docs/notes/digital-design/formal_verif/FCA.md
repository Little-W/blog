---
title: FCA：形式覆盖率分析指南
tags: [形式验证, 数字IC, VC Formal, FCA, 覆盖率]
---

# FCA：形式覆盖率分析使用指南

## 1. FCA 与 FPV 的区别

FPV 证明某一条属性是否成立；FCA 侧重理解覆盖目标的可达性，帮助分析仿真中未覆盖的代码和功能点是否在现有约束下真正不可能触发。典型情况：随机回归得到某分支从未执行，是因为测试不够、环境限制过严，还是这个分支从设计初始状态根本不可到达？FCA 可以在适当的逻辑模型中研究可达性，并为覆盖率排除提出依据。

FCA 的结果与 VCS 的覆盖数据通常相配合，常涉及 `simv.vdb`、排除文件 `.el` 和 `save_covdb` 产生的覆盖数据库。**不是所有未覆盖都应该豁免**，覆盖目标在形式模型下不可到达，也不代表目标一定不对应产品真实行为；模型和假设可能过度限制。

## 2. 覆盖对象与每种结果的含义

| 对象 | 要求出现的行为 | 不能据此推断的结论 |
| --- | --- | --- |
| 代码行 | 相应可执行语句能够被执行 | 该语句计算结果正确 |
| 分支 | 某个判断分支或选择分支被采用 | 所有子条件组合均已出现 |
| 布尔条件 | 覆盖模型指定的条件取值或组合出现 | 所有接口时序均已检查 |
| 信号翻转 | 指定位出现规定方向的取值变化 | 数据内容和先后关系正确 |
| 状态与转移 | 状态机进入指定状态或完成指定转移 | 状态机不会死锁或饥饿 |
| 功能覆盖目标 | 覆盖组或用户目标描述的场景出现 | 该场景下所有功能正确 |

**行、分支与条件覆盖的观察层次不同。** 下面的赋值语句可以执行，只说明控制流进入了对应分支。两个分支都执行过，也不表示 `req`、`ready` 和 `cancel` 的各种有效组合都被检查。具体条件覆盖项取决于所导入的数据库以及编译时启用的覆盖配置，不应把“条件覆盖”笼统写成对任意布尔表达式的全部组合穷举。

```systemverilog
always_comb begin
  accepted = 1'b0;
  if (req && ready && !cancel)
    accepted = 1'b1;
end
```

**翻转覆盖与数据正确性不同。** 数据总线的每一位都出现过 0 和 1，并不能说明一次写入后读出的字节顺序正确，也不能说明校验位与数据一致。翻转覆盖适合发现被固定的控制位、没有活动的接口和配置遗漏；数据关系仍要通过断言或参考模型比较。

**状态覆盖与进展性不同。** 一个状态能够到达，不等于可以从它离开；所有状态都到达过，也不等于不存在无限循环。FCA 的状态与转移目标需要结合 AEP 的状态机检查或手工活性属性，才能回答“请求是否最终完成”这类问题。

**覆盖类型必须在编译或数据库导入阶段明确。** 原生覆盖可通过 `read_file -cov ...` 提取，仿真覆盖可以由 `read_covdb` 导入。分支等类别可能需要对应的配置变量在编译前启用。报告必须说明类型、设计范围、初始状态和环境假设，再给出可达、不可达和未完成的数量。来源：User Guide，第 386–443 页。

## 3. 第一个 FCA 用例：输入条件与代码分支可达性

### 3.1 完整设计源码

本例没有限制 `mode`，因此四种输入组合都允许出现。分析其可达性不是预先宣布某个分支不可到达。

**保存为 `案例工程/rtl/coverage_demo.sv`：**

<!-- source-begin: 案例工程/rtl/coverage_demo.sv -->

```systemverilog
// FCA exercise: branch conditions and reachability.
// mode is intentionally unconstrained, unless the verification environment
// supplies an explicitly reviewed operating-mode assumption.
module coverage_demo (
  input  logic       clk,
  input  logic       rst_n,
  input  logic [1:0] mode,
  output logic [1:0] result
);
  always_comb begin
    result = 2'd0;
    case (mode)
      2'd0: result = 2'd1;
      2'd1: result = 2'd2;
      2'd2: result = 2'd3;
      default: result = 2'd0;
    endcase
  end
endmodule
```

<!-- source-end -->

如果真实系统规范要求 `mode[1]` 恒为零，另外两个模式在该约束下才不可达；必须记录约束出处，并区分真实限制与为了提高覆盖数字而新增的假设。组合分支能否保留并产生检查，还受编译优化和覆盖类型配置影响。

### 3.2 完整文件列表

**保存为 `案例工程/filelist_fca.f`：**

<!-- source-begin: 案例工程/filelist_fca.f -->

```text
./rtl/coverage_demo.sv
```

<!-- source-end -->

## 4. 主要流程：完整 Tcl

### 4.1 完整运行脚本

本版本使用 `COV` 模式。脚本保留检查设置和结果报告；没有在未审查结果时自动把所有未完成目标导出为排除项。

**保存为 `案例工程/scripts/fca_coverage.tcl`：**

<!-- source-begin: 案例工程/scripts/fca_coverage.tcl -->

```tcl
# Formal Coverage Analyzer uses COV appmode in X-2025.06-SP1 User Guide.
# Run from example project root; treat result as tool-dependent.
set_fml_appmode COV
read_file -top coverage_demo -format sverilog -cov all -vcs {-f filelist_fca.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
check_fv -block
report_fv -verbose
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 从包含“案例工程”目录的上一级目录开始。
cd 案例工程
mkdir -p logs
set -o pipefail
vcf -f scripts/fca_coverage.tcl -batch 2>&1 | tee logs/fca_coverage.log
```

需要导出经过审查的不可达候选时，再按实际会话执行：

```tcl
save_cov_exclusion -file formal_unreachable.el
```

`-cov all` 的覆盖类型仍须核对版本，某些类型有单独的启用变量。应先确认生成了哪些目标、目标数量以及实际完成状态，再解释覆盖率或排除文件。

## 5. 从仿真数据库开始

```tcl
set_fml_appmode COV
read_covdb -cov_input simv.vdb -cov_dut tb.dut
read_file -top dut -format sverilog -cov all -vcs {-f filelist.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv -block
save_covdb -status covered -name formal_result.vdb
save_cov_exclusion -file candidate_exclusion.el
```

`-cov_dut` 必须是仿真数据库中的真实 DUT 实例路径。若层级不匹配，生成的排除记录可能关联错误。UG 第 395 页说明，无仿真数据库时的排除对象与有仿真数据库时的层级来源不同；最终在覆盖可视化工具中导入 `.el` 之前需要确认层级。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `read_covdb` | 导入仿真覆盖数据库 |
| `save_cov_exclusion` | 导出覆盖排除文件 |
| `save_covdb` | 保存形式覆盖分析结果 |
| `view_coverage` | 查看数据库与排除项 |
| `cov_config` | 配置自动分解覆盖分析 |
| `compute_cov` | 执行自动分解后的覆盖任务 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 6.1 `read_covdb`：导入仿真覆盖数据库

```text
read_covdb -cov_input <database_path> -cov_dut <simulation_instance>
           [-fv_dut <formal_instance>]
```

**参数解释。** `-cov_input` 指向仿真生成的覆盖数据库；`-cov_dut` 是数据库内的 DUT 实例路径，不是 RTL 模块名。形式环境另加包装模块时，用 `-fv_dut` 指定形式设计内的 DUT 路径，使两个层次中的覆盖对象正确对应。

**用法与结果。** 通常先设定 COV 应用模式、导入数据库，再读取设计和生成覆盖目标。没有仿真数据库时可以直接从 RTL 开始不可达分析。导入后主要分析仿真尚未覆盖的目标；不能把仿真的实例路径直接当作形式包装中的路径。以下列出 UG 使用流程中展示的选项，不扩展未在该流程中解释的平台参数。

```tcl
set_fml_appmode COV
read_covdb -cov_input simv.vdb -cov_dut simTB.i1.DUT \
           -fv_dut formal_top.u_dut
read_file -top formal_top -format sverilog -vcs "-f formal.f"
```

来源：User Guide，X-2025.06-SP1，第 395–399 页。

### 6.2 `save_cov_exclusion`：导出覆盖排除文件

```text
save_cov_exclusion -file <filename> [-append] [-missing_else]
  [-cov <metric_list>] [-line_intent] [-no_line_intent]
  [-filter <expression>] [-targets <goals>]
  [-enable_top_mod_excl] [-mod_excl] [-mod_excl_scope <modules>]
  [-strict] [-scope <module_or_instance>]
```

**参数解释。** `-file` 指定文件，`-append` 追加。`-missing_else` 纳入隐含的缺失 else 分支。`-cov` 以加号连接指标，支持 line、cond、toggle、fsm_state、fsm_trans、branch、cg、assert、cover、all；all 指结构覆盖类型，assert 和 cover 应显式指定。语法将 `-cov` 标为可选，原文同段又出现“mandatory”，与省略它的示例矛盾，正文采用其明确给出的省略示例，不把该句解释为必填。

`-line_intent` 只保留与代码意图相关的目标，`-no_line_intent` 排除这些目标；`-filter` 按属性筛选，`-targets` 显式指定目标集合。`-enable_top_mod_excl` 对顶层使用模块排除、对子层使用实例排除；`-mod_excl` 求同一模块各实例共有的不可达项，`-mod_excl_scope` 限定模块。`-scope` 限定导出层次。`-strict` 写出供 URG/Verdi 严格检查使用的排除文件，以便发现“数据库中已覆盖、排除文件却排除”的冲突。

**用法与结果。** 默认导出已判为不可达的目标，成功返回 1，失败返回 0。显式 `-targets` 可以改变导出对象，因此仅有排除文件不等于每一项都有不可达证明；审查时同时保留约束、状态和日志。

```tcl
check_fv -block
save_cov_exclusion -file unr.el -strict
save_cov_exclusion -file selected_unr.el \
  -targets [get_props -status uncoverable]
```

来源：User Guide，X-2025.06-SP1，第 401–403 页。

### 6.3 `save_covdb`：保存形式覆盖分析结果

```text
save_covdb -name <covdb_name> [-update] [-overwrite]
  [-cov <metric_list>] [-line_intent] [-no_line_intent]
  [-status <status_list>]
```

**参数解释。** `-name` 给出目标数据库；`-update` 作为新测试结果更新已有数据库，`-overwrite` 删除旧内容并重建，两种策略不要混用。`-cov` 筛选指标，`-line_intent` 与 `-no_line_intent` 筛选代码意图相关目标。`-status` 支持 covered、uncoverable。assert 和 cover 不会因为省略 `-cov` 而自动全部保存，需明确选择。

**用法与结果。** 应先保存数据库，再调用 `view_coverage`。原文特别提醒：未使用 `-status covered` 时，不可达目标可能直接从数据库移除，Verdi Exclusion Manager 不一定显示它们为“被排除的目标”。需要可审计排除记录时，另存 `.el` 文件，不能只保留最终百分比。

```tcl
save_covdb -name formal_result.vdb -overwrite -status covered
save_cov_exclusion -file formal_unr.el -strict
view_coverage -cov_input formal_result.vdb -elfile formal_unr.el
```

来源：User Guide，X-2025.06-SP1，第 404–405 页。

### 6.4 `view_coverage`：查看数据库与排除项

```text
view_coverage -cov_input <saved_database> -elfile <exclusion_file>
```

**参数解释。** `-cov_input` 选择已保存的覆盖数据库，`-elfile` 叠加不可达排除文件。这是 UG 展示的查看流程，而不是声明这两个选项构成该命令的全部平台语法。

**用法与结果。** 打开 Verdi Coverage 后，在 Exclusion Manager 中审查排除项及其来源。检查每个不可达结论是否依赖设计模式、绑常量或环境限制，再决定能否用于仿真覆盖验收。查看窗口本身不执行证明，也不改变已有约束。

```tcl
save_covdb -name fca_result.vdb -overwrite -status covered
view_coverage -cov_input fca_result.vdb -elfile unr.el
```

来源：User Guide，X-2025.06-SP1，第 405 页。

### 6.5 `cov_config`：配置自动分解覆盖分析

```text
cov_config [-auto_scale]
  [-line_task <n>] [-cond_task <n>] [-branch_task <n>]
  [-tgl_task <n>] [-fsm_task <n>] [-cg_task <n>]
  [-limit <percentage>] [-line_limit <n>] [-branch_limit <n>]
  [-tgl_limit <n>] [-fsm_limit <n>] [-cond_limit <n>]
  [-module <module>] [-inst_list <instances>]
  [-start_task_cmd <commands>] [-end_task_cmd <commands>]
  [-start_line_task_cmd <commands>] [-start_cond_task_cmd <commands>]
  [-start_branch_task_cmd <commands>] [-start_tgl_task_cmd <commands>]
  [-start_fsm_task_cmd <commands>] [-start_cg_task_cmd <commands>]
  [-exclude_assumes_covdb] [-exclude_bb_signals]
cov_config -debug
```

**参数解释。** `-auto_scale` 开启自动分解；各 `*_task` 指定对应指标的并行任务数。`-limit` 是模块已有总覆盖率阈值，默认 70；高于阈值的模块跳过。各 `*_limit` 则是未覆盖目标数量阈值，低于该数量的模块跳过，不能把两类阈值都理解为百分比。`-module` 指定形式设计起点，`-inst_list` 指定输入覆盖数据库中的实例起点。

`-start_task_cmd` 在每个任务创建后、证明前执行，`-end_task_cmd` 在该任务证明结束后执行；各 `-start_*_task_cmd` 仅作用于对应指标。`-exclude_assumes_covdb` 保存约束对应的排除信息，`-exclude_bb_signals` 排除数据库中的黑盒信号。`-debug` 输出时间和内存消耗信息，是后文使用示例补充的开关。

**用法与结果。** 必须先开启 `-auto_scale`，再配置其他自动分解选项，或者在同一条命令中设置。阈值和层次选择项必须在 `read_file` 或 `elaborate` 之前使用；读取设计后再修改，不会按预期重新决定覆盖插装范围。此流程用 `compute_cov` 启动，而不是简单替换几个 `check_fv` 参数。

```tcl
set_fml_appmode COV
read_covdb -cov_input simv.vdb -cov_dut tb.u_dut
cov_config -auto_scale -limit 80 -tgl_task 4
cov_config -start_task_cmd {set_fml_var fml_max_time 10M}
read_file -top dut -format sverilog -vcs "-f rtl.f"
compute_cov
```

来源：User Guide，X-2025.06-SP1，第 435–438 页。

### 6.6 `compute_cov`：执行自动分解后的覆盖任务

```text
compute_cov
```

**参数解释。** 该用法不需要位置参数；输入是 `cov_config` 建立的自动分解配置以及已读取的 RTL、覆盖数据库和环境。

**用法与结果。** 命令负责按指标和层次生成并执行任务，报告各任务和总体结果。每个任务可以产生自己的排除文件，流程还合并产生 `unreachables.el`。任务被筛选跳过不等于目标已证明不可达，应将自动筛选范围与最终结论一起记录。

```tcl
cov_config -auto_scale
cov_config -tgl_task 4
# 完成数据库、RTL、时钟和复位设置后执行。
compute_cov
```

来源：User Guide，X-2025.06-SP1，第 438–440 页。

## 7. Auto Scale 及资源策略

当覆盖目标数量巨大时，FCA 可自动划分多个覆盖类型和模块任务。先运行一个小范围测试估计内存与每类目标的数量，再考虑 `cov_config -auto_scale`、`-line_task`、`-fsm_task`、`-tgl_task` 等参数。不要在不了解网格队列和许可证预算的情况下照搬快速指南中几十或上百个 worker 的示例。汇总结果时，应说明每一类型完成、不可达和未完成的数量。

## 8. 排除文件需要审查

“不可达”至少可能来自三种情形：设计逻辑确实使其不可达；复位/环境约束使其不可达；模型存在缺失使其无法触发。前者可能是冗余 RTL，也可能是特定配置下合法不可达；后两者则不能简单纳入永久覆盖排除。建议每条排除记录带上规格版本、环境限制和审批人。

一个完整的报告应区分仿真原始覆盖率、形式分析发现的不可达目标、审查后允许排除的目标、仍需增加激励的可达目标。不能把形式分析结果当成单纯提高覆盖率百分比的手段。

## 9. 常见排查

| 现象 | 检查事项 |
| --- | --- |
| 无覆盖属性 | `-cov` 类型、模式、文件展开、分支额外开关 |
| 导出的排除文件和仿真层级不一致 | `-cov_dut`、顶层名、编译优化 |
| 许多目标显示不可达 | 复位、环境常量、黑盒与约束 |
| 计算耗时非常长 | 按模块、覆盖类型拆分任务；使用 Auto Scale |
| `.el` 无法被查看器识别 | 数据库版本和导入路径 |

覆盖目标缺失首先属于模型构建问题，而不是目标已经不可达。数据库应与当前层级、参数和编译设置一致；排除文件应保留来源。得到不可达结果以后，还应撤去非必要约束或检查对应输入场景，以区分设计死代码与验证环境过度限制。

## 10. 命名差异和官方参考

X-2025.06-SP1 版本的 Quick Reference Guide 使用 `set_fml_appmode FCA`，但 User Guide §2（65 页）及 §11.2.2（395 页）使用 `set_fml_appmode COV`。本手册选择 User Guide 的 `COV` 作为示例；安装环境如存在别名或不同版本行为，以 `set_fml_appmode -help` 和 `get_fml_appmode` 确认为准。资料：User Guide 第 11 章及 Quick Reference Guide FCA 页。
