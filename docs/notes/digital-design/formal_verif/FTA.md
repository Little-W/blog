# FTA：形式测试平台分析使用指南

## 1. FTA 解决的不是 RTL 正确性，而是属性环境的质量

形式验证通常给出很多 `Proven`，但这些证明是否足够覆盖真实设计风险？某个功能错误是否会被当前断言检测到？FTA 使用**故障/RTL 修改（mutation）注入**的方法分析形式测试平台的检错能力。如果注入一个功能变化后仍没有任何断言检测到异常，说明当前检查集合可能存在薄弱位置。它是一项验证质量评估方法，而不是再运行一次普通 FPV。

例如，RTL 中 `grant[0]` 的组合条件被修改。如果已有的互斥属性仍全部通过，但缺少“请求必须得到相应授权”的规则，那么 FTA 可能发现这一类变更不易被现有属性检测。

![FTA 故障注入与属性检出](插图/11_FTA故障.svg)

## 2. 工作过程

1. 在 FPV 模式编译 DUT 和属性，建立正确的时钟、复位与环境前提。
2. 审查现有属性状态，确认值得评估的断言范围，区分断言与覆盖目标。
3. 根据当前软件版本配置可用的故障类型和注入策略。
4. 切换到 FTA，运行激活、传播与检测分析。
5. 汇总可被检出的故障、无法检出的故障以及尚无结论的故障。
6. 对未检测区域补充有意义的设计属性，再运行 FTA 和 FPV 回归。

## 3. 不能直接从 `-fmode FTA` 启动

User Guide 第 65 页明确提醒：该版本通常从 FPV 模式建立工作区，再使用 `set_fml_appmode FTA` 切换，`vcf -fmode FTA` 不属于支持的直接启动方式。快速指南有独立的 `FTA` 命令行，但并不意味着可以跳过准备好的 FPV 环境。

## 4. 示范 Tcl：多阶段流程的轮廓

```tcl
# 第一阶段：FPV 环境和属性分析
set_fml_appmode FPV
read_file -top core -sva -format sverilog -vcs {-f filelist.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
check_fv -block
report_fv -list

# 第二阶段：FTA（故障设置根据具体版本和设计调整）
set_fml_appmode FTA
fta_init
configure_fta_props -par_task FPV -status {proven}
compute_fta -par_task FPV
fta_report
```

这个脚本描述学习顺序，**不是一个对任何 FTA 许可证和故障模型都立即可运行的完整正式工程**。尤其 `fta_init`、`configure_fta_props` 和 `compute_fta` 的参数需与当前会话的 FPV task、故障数据库及流程类型对应。阅读 User Guide 第 923～941 页完整流程再部署生产项目。

### 4.1 FTA 工程配置模板

`error` 明确阻止把缺少已验证属性集合或故障配置的脚本当成真实 FTA 分析。

**保存为 `案例工程/templates/fta_mutation.tcl`：**

<!-- source-begin: 案例工程/templates/fta_mutation.tcl -->

```tcl
# FTA：Formal Testbench Analyzer。须基于真实的 FPV 工程与属性集合。
# 不能仅用 vcf -fmode FTA 直接启动，详见 UG §21 和手册 FTA.md。
error "此文件是 FTA 教学模板：请先完成真实 FPV 环境、属性集合和故障策略"
# set_fml_appmode FPV
# read_file -top dut -sva -format sverilog -vcs {-f filelist.f}
# create_clock clk -period 100
# create_reset rst_n -sense low
# sim_run -stable
# sim_save_reset
# check_fv -block
# set_fml_appmode FTA
# fta_init
# configure_fta_props -par_task FPV -status {proven}
# compute_fta -par_task FPV
# fta_report
```

<!-- source-end -->

## 5. 故障分类与结果含义

| 场景 | 工程解释 | 后续建议 |
| --- | --- | --- |
| 故障被属性检出 | 当前断言对该类改变敏感 | 检查检出的属性是否符合预期 |
| 故障未检出 | 可能是死代码、影响不可达、属性缺失或环境屏蔽 | 先审查可达性和影响路径 |
| 注入无法激活 | 故障点在现有环境下不被触发 | 检查约束及故障定义 |
| 结果未完成 | 当前证明资源不足 | 提升策略或缩小任务 |
| 被审查豁免 | 有外部充分证据认定不需要该项 | 记录依据并保留原结果 |

故障结果必须结合分析前的属性状态和所选故障模型解释。基准设计本身已经失败时，不能把同一失败计为新增故障被检出；故障无法激活或传播时，也不能据此宣称断言已经检查了对应功能。应把未检出的有效故障回到规格和属性正文中分析。

检出率与业务规格覆盖完整程度相关，但不能直接等同于“芯片功能正确的百分比”。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fta_init` | 限定故障注入设计范围 |
| `configure_fta_props` | 选择检测故障所使用的属性 |
| `compute_fta` | 执行形式测试环境质量分析 |
| `get_fta_faults` | 按实例与状态选取故障 |
| `fta_report` | 输出实例级故障统计 |
| `read_fta_waiver` | 重新应用已审查的故障豁免 |
| `read_faultdb` | 导入仿真测试环境故障数据库 |
| `save_faultdb` | 保存形式故障分析结果 |
| `cluster_fta_faults` | 把相似未检测故障分组 |
| `report_fta_fault_clusters` | 查看未检测故障分组 |
| `debug_fta` | 判断未检测故障能否传播到输出 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 6.1 `fta_init`：限定故障注入设计范围

```text
fta_init -top <top_module>
fta_init -scope <module_list>
```

**参数解释。** `-top` 指定故障注入的顶层，分步 `analyze/elaborate` 流程尤其要先设置；`-scope` 限定参与故障注入的模块列表。两种写法分别出现在 UG 的流程说明中，不等于所有模式都必须同时提供两个选项。

**用法与结果。** FTA 应从已有的干净 FPV 环境开始，随后在读入或展开设计时使用 `-inject_fault`。未提供专用 Certitude 文件时工具可为所有模块自动生成注入配置；这会显著扩大故障集合。显式配置文件中的 FaultSet 与注入开关存在优先级，不能只看一条 Tcl 判断实际故障范围。

```tcl
set_fml_appmode FPV
fta_init -top controller
fta_init -scope {controller}
read_file -top controller -sva -inject_fault RTL \
  -format sverilog -vcs "-f formal.f"
```

来源：User Guide，X-2025.06-SP1，第 923–925 页。

### 6.2 `configure_fta_props`：选择检测故障所使用的属性

```text
configure_fta_props -par_task <fpv_task>
  [-fault_class <classes>] [-type <types>]
  [-usage <usages>] [-status <statuses>]
  [-min_proof_depth <depth>]
```

**参数解释。** `-par_task` 指定父 FPV 任务。`-fault_class` 在已插入的故障内进一步选择类别，例如 SynchronousControlFlow、ComboLogicControlFlow；它不能补插编译时没有生成的故障。`-type`、`-usage`、`-status` 选择参与检测的属性，默认只使用 proven 属性。`-min_proof_depth` 为纳入的未完成属性设定最小有界证明深度；未显式给出时，工具取所选未完成属性中最小的证明深度。

**用法与结果。** 选择 inconclusive 属性时要同时报告其有界深度，不能让最终故障检测率看起来与全部使用完整证明的配置相同。原文一处示例误拼成 `-par_tack`，其他定义和示例使用 `-par_task`；本教程使用后一拼写。

```tcl
configure_fta_props -par_task FPV \
  -fault_class {SynchronousControlFlow ComboLogicControlFlow}
configure_fta_props -par_task FPV -status {proven}
```

来源：User Guide，X-2025.06-SP1，第 925–926 页。

### 6.3 `compute_fta`：执行形式测试环境质量分析

```text
compute_fta -par_task <fpv_task> [-property <property_collection>]
```

**参数解释。** `-par_task` 指明提供规格断言和约束的父任务。`-property` 可以显式选取用于检测故障的属性；省略时使用配置及默认选择规则，通常为 proven 属性。

**用法与结果。** 先在全部故障被内部关闭的情况下重跑 FPV，确认注入后的设计模型仍满足原基线，再运行 FTA。故障未被检测并不自动证明故障没有影响：可能是断言漏写、约束屏蔽了激活条件、故障不可传播，或求解尚无结论。需结合分类和反例继续分析。

```tcl
check_fv -block
configure_fta_props -par_task FPV -status {proven}
compute_fta -par_task FPV
# 在 FTA 分析完成后查看结果。
fta_report -instance {controller}
```

来源：User Guide，X-2025.06-SP1，第 925–927，941 页。

### 6.4 `get_fta_faults`：按实例与状态选取故障

```text
get_fta_faults <instance_list> [-status <status_list>]
```

**参数解释。** 位置参数限定设计实例；`-status non_detected` 可筛选未检测故障。返回工具集合，可交给 `report_fv`、`fvdisable`、`fvenable`、`fvwaive`。

**用法与结果。** 是否区分同模块不同实例中的故障，受编译前的 `fml_fta_inst_qual` 设置影响。大量共用模块场景下，应先确认实例级故障是否独立，再比较每个实例的检测率。禁用或豁免集合只是在本次分析中排除目标，不等于已经检测。

```tcl
set nd [get_fta_faults controller.u_fifo -status non_detected]
report_fv $nd -list
report_fv $nd -verbose
```

来源：User Guide，X-2025.06-SP1，第 927–930 页。

### 6.5 `fta_report`：输出实例级故障统计

```text
fta_report -instance <instance_list>
fta_report <instance_name> -list
fta_report <instance_name> -verbose
```

**参数解释。** `-instance` 指定一个或多个实例，`-list` 和 `-verbose` 分别用于逐项和详细报告。这里保留 UG 中分别出现的调用形式；不把示意性的 `-list/-verbose` 连写成一个可执行开关。

**用法与结果。** 先看总量与状态分布，再看未检测故障对应的 RTL 和规格断言。报告应注明故障类、实例范围、被排除故障和参与检测的属性集合，否则不同运行的百分比不可直接比较。

```tcl
fta_report -instance {controller.u_fifo controller.u_arbiter}
fta_report controller.u_fifo -verbose
```

来源：User Guide，X-2025.06-SP1，第 928–930 页。

### 6.6 `read_fta_waiver`：重新应用已审查的故障豁免

```text
read_fta_waiver [-elfiles <exclusion_file_list>]
```

**参数解释。** `-elfiles` 指定一个或多个通过 `save_waiver_file -fta` 生成的文件。故障键包含类别、原 RTL 构造及其他唯一属性，而不是只依赖易变化的显示序号。

**用法与结果。** 设计修改导致原故障键不再匹配时，不应强行沿用旧豁免；应审查失配项。工作目录中的 COI.el、FC.el 可能被相关 FTA/高强度汇总流程自动使用，运行归档时要同时收集这些文件，避免隐藏的排除来源。

```tcl
fvwaive [get_fta_faults controller.u_debug]
save_waiver_file -fta -file reviewed_faults.el
read_fta_waiver -elfiles {reviewed_faults.el}
```

来源：User Guide，X-2025.06-SP1，第 926–927 页。

### 6.7 `read_faultdb`：导入仿真测试环境故障数据库

```text
read_faultdb -name <database_path>
```

**参数解释。** `-name` 指向 Testbench Quality Assurance/Certitude 数据库，而不是普通 VCS 代码覆盖 `.vdb`。

**用法与结果。** 必须在 `read_file` 或 `elaborate` 之前使用。已在仿真数据库中判为检测到的故障可以从形式分析目标中排除，使形式工具集中处理其余故障。合并统计之前仍需确认两个流程的设计版本、故障定义和配置一致。

```tcl
set_fml_appmode FPV
read_faultdb -name simulation_faults
read_file -top controller -inject_fault RTL -sva \
  -format sverilog -vcs "-f formal.f"
```

来源：User Guide，X-2025.06-SP1，第 938–939 页。

### 6.8 `save_faultdb`：保存形式故障分析结果

```text
save_faultdb [-name <database_path>]
```

**参数解释。** `-name` 指定保存目录或数据库路径。结果保存到 Testbench Quality Assurance 数据库，供独立工具合并和查看。

**用法与结果。** 这是 FTA 的数据库接口，不是 FuSa 的 `fusa_save`，也不是覆盖率的 `save_covdb`。三者的数据对象和后续消费工具不同，文件名相似不能互换命令。

```tcl
save_faultdb -name formal_fault_results
```

来源：User Guide，X-2025.06-SP1，第 939 页。

### 6.9 `cluster_fta_faults`：把相似未检测故障分组

```text
cluster_fta_faults
```

**参数解释。** UG 在本节给出的调用不带参数；它对未检测故障进行相似性分组。

**用法与结果。** 分组用于减少重复调试。修复组内一个代表故障暴露的检查缺失后，应重跑整组，而不是直接把其他成员改成“已检测”。相似只是分析提示，不是逻辑等价证明。

```tcl
cluster_fta_faults
report_fta_fault_clusters
```

来源：User Guide，X-2025.06-SP1，第 955 页。

### 6.10 `report_fta_fault_clusters`：查看未检测故障分组

```text
report_fta_fault_clusters
```

**参数解释。** 输入是先前 `cluster_fta_faults` 计算的分组结果；本节未列额外参数。

**用法与结果。** 优先选择影响可观察输出、关联关键功能且覆盖属性较少的分组做代表性调试。保留组成员清单，便于在断言补充后核实整组状态变化。

```tcl
cluster_fta_faults
report_fta_fault_clusters
```

来源：User Guide，X-2025.06-SP1，第 955 页。

### 6.11 `debug_fta`：判断未检测故障能否传播到输出

```text
debug_fta [-property <fault_property>]
debug_fta -dump_setup
debug_fta -run_user_setup
```

**参数解释。** `-property` 限定目标故障；不提供时使用流程默认目标。`-dump_setup` 导出 fta_ndf.tcl；修改该模板后用 `-run_user_setup` 运行用户设置。三个形式是不同阶段，不应把导出与运行开关无条件堆在同一调用中。

**用法与结果。** 命令借助 SEQ 比较正常设计与带目标故障的设计，并自动打开带 Verdi 的独立会话，因此批处理 FTA 也可能需要图形显示与 SEQ 许可。它会调整工作目录中的 Certitude 配置文件；回到原 FPV-FTA 流程前应按原文要求恢复。初始化时不启用目标故障，故障在复位阶段的影响不属于这个默认调试问题。

```tcl
debug_fta -dump_setup
# 审阅并修改生成的 fta_ndf.tcl 后，另行执行：
debug_fta -run_user_setup
```

来源：User Guide，X-2025.06-SP1，第 955–958 页。

## 7. 两个评估示例

**例一：FIFO 缺少溢出断言。** 只写了 FIFO 空闲和复位属性，注入“满时仍接受写入”的 RTL 改变，可能不被检出。补充 `occupancy <= DEPTH`、接受写入时机等断言，重新比较检测结果。**例二：状态机错误状态转换。** 只检查状态编码合法性，状态从 `WAIT` 错误跳到 `IDLE` 仍可能保持编码合法，却违反协议。FTA 可以促使增加状态转移规则与完成覆盖。

### 7.1 用完整源码观察断言是否能发现设计变化

下面采用计数器的正确版与错误版进行手工对照，帮助理解“改变设计后，原有属性是否敏感”。这一练习使用 FPV；它不是 FTA 自动生成故障或计算检出率的替代品。为便于单独阅读本章，相关文件再次全文列出。

### 7.1.1 被验证的计数器 RTL

规格：复位后计数为零；使能时从 0 计到 9 后回到 0；没有使能时保持。RTL 文件只包含设计，不把待验证结论写成环境假设。

**保存为 `案例工程/rtl/counter.sv`：**

<!-- source-begin: 案例工程/rtl/counter.sv -->

```systemverilog
module counter (
    input  logic       clk,
    input  logic       rst_n,
    input  logic       enable,
    output logic [3:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n)             count <= 4'd0;
    else if (enable) begin
      if (count == 4'd9)    count <= 4'd0;
      else                  count <= count + 4'd1;
    end
  end
endmodule
```

<!-- source-end -->

### 7.1.2 完整断言与绑定文件

`history_valid` 在复位后建立历史有效标志。`ap_range` 检查范围，`ap_hold` 检查保持，`ap_increment` 检查普通递增，`ap_wrap` 检查回绕；两条 `cover` 检查最高计数值及回绕场景是否能够出现。末尾 `bind` 将检查器接入同名设计信号，不需要修改 RTL。

**保存为 `案例工程/formal/counter_props.sv`：**

<!-- source-begin: 案例工程/formal/counter_props.sv -->

```systemverilog
module counter_props (
    input logic       clk, rst_n, enable,
    input logic [3:0] count
);
  logic history_valid;
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) history_valid <= 1'b0;
    else        history_valid <= 1'b1;

  ap_range: assert property (@(posedge clk) disable iff (!rst_n)
      count <= 4'd9);

  ap_hold: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(!enable) |-> count == $past(count));

  ap_increment: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(enable && count < 4'd9)
      |-> count == $past(count) + 4'd1);

  ap_wrap: assert property (@(posedge clk) disable iff (!rst_n)
      history_valid && $past(enable && count == 4'd9)
      |-> count == 4'd0);

  cp_reaches_nine: cover property (@(posedge clk) disable iff (!rst_n)
      count == 4'd9);
  cp_wrap: cover property (@(posedge clk) disable iff (!rst_n)
      count == 4'd9 ##1 count == 4'd0);
endmodule

bind counter counter_props u_counter_props (.*);
```

<!-- source-end -->

### 7.1.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径相对于运行 VC Formal 的 `案例工程/` 目录，而不是 Tcl 文件所在目录。

**保存为 `案例工程/filelist_counter.f`：**

<!-- source-begin: 案例工程/filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 7.1.4 完整运行脚本

依次选择应用、读入设计与 SVA、定义时钟复位、保存初始状态、检查设置、列出属性并开始证明。初始化步骤需要在实际安装环境核对复位状态，不能把声明复位等同于已经完成复位。

**保存为 `案例工程/scripts/fpv_counter.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_counter.tcl -->

```tcl
# Run from the example project root with: vcf -f scripts/fpv_counter.tcl -batch
set_fml_appmode FPV
read_file -top counter -sva -format sverilog -vcs {-f filelist_counter.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
report_fv_setup -list
report_fv -list
set_fml_var fml_max_time 1H
set_fml_var fml_max_memory 8GB
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
vcf -f scripts/fpv_counter.tcl -batch 2>&1 | tee logs/fpv_counter.log
```

**结果阅读。** 在初始状态正确的前提下，正确版预期满足这些断言，并存在到达 9 和回绕的覆盖轨迹。这不是本次 VC Formal 的实际运行结果。这些断言分别覆盖范围、保持、普通递增和回绕；复位值及运行中重新复位仍需结合初始化模型和专用复位检查，不能仅凭范围属性成立就认定全部功能正确。

### 7.1.5 故意错误的 RTL

错误只在回绕阈值：把 9 改为 10。模块名仍为 `counter`，所以此文件与正确版必须分别编译。属性文件沿用本节已经完整列出的 `counter_props.sv`。

**保存为 `案例工程/rtl/counter_bad.sv`：**

<!-- source-begin: 案例工程/rtl/counter_bad.sv -->

```systemverilog
// Intentionally buggy teaching variant: roll-over condition is 10 instead of 9.
// Do NOT include with rtl/counter.sv in the same compilation.
module counter (
    input  logic       clk,
    input  logic       rst_n,
    input  logic       enable,
    output logic [3:0] count
);
  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n)             count <= 4'd0;
    else if (enable) begin
      if (count == 4'd10)   count <= 4'd0;
      else                  count <= count + 4'd1;
    end
  end
endmodule
```

<!-- source-end -->

### 7.1.6 错误版编译文件列表

只读入错误设计及同一份检查器，不同时包含两个同名设计。

**保存为 `案例工程/filelist_counter_bad.f`：**

<!-- source-begin: 案例工程/filelist_counter_bad.f -->

```text
./rtl/counter_bad.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 7.1.7 错误版完整运行脚本

与正确版采用相同接口和初始化方法，不为了让错误版通过而增加输入限制。

**保存为 `案例工程/scripts/fpv_counter_bad.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_counter_bad.tcl -->

```tcl
# Intentionally failing counter example. Do not include the good counter at once.
set_fml_appmode FPV
read_file -top counter -sva -format sverilog -vcs {-f filelist_counter_bad.f}
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
vcf -f scripts/fpv_counter_bad.tcl -batch 2>&1 | tee logs/fpv_counter_bad.log
```

错误版的预期反例是：在允许连续使能的输入下，计数从 9 进入 10，违反范围与回绕规则。查看反例时应区分时钟沿的采样值与非阻塞赋值后的寄存器值；不能把这里描述的预期现象伪装成工具日志。

## 8. FTA 与故障仿真的区别

FTA 使用形式分析寻找能够触发和传播注入差异的逻辑证据；故障仿真通常依赖已准备的激励序列。两者都可用来研究测试平台质量，但对状态空间、收敛条件、故障模型和资源需求的依赖不同。FTA 的故障并不等同于制造测试的 stuck-at / transition ATPG 故障模型。

## 9. 参考

User Guide 第 21 章，尤其多阶段运行、故障注入、结果调试与性能部分；User Guide 第 20 章的最终验证质量评估方法。
