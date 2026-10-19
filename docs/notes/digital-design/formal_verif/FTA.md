---
title: FTA：形式测试平台分析指南
tags: [形式验证, 数字IC, VC Formal, FTA]
---

# FTA：形式测试平台分析使用指南

## 1. FTA 解决的不是 RTL 正确性，而是属性环境的质量

形式验证通常会给出很多 `Proven`，但这些证明是否足以覆盖真实的设计风险？某个功能错误是否会被当前的断言检测到？FTA 使用**故障/RTL 修改（mutation）注入**的方法，分析形式测试平台发现错误的能力。如果注入一个功能变化后，仍然没有任何断言检测到异常，就说明当前的检查集合可能存在薄弱之处。它是一种验证质量评估方法，而不是再运行一次普通的 FPV。

例如，RTL 中 `grant[0]` 的组合条件被修改。如果已有的互斥属性仍然全部通过，却缺少“请求必须得到相应授权”的规则，那么 FTA 可能会发现这一类变更不容易被现有属性检测出来。

![FTA 故障注入与属性检出](插图/11_FTA故障.svg)

## 2. 工作过程

1. 在 FPV 模式下编译 DUT 和属性，建立正确的时钟、复位与环境前提。
2. 审查现有属性的状态，确认值得评估的断言范围，并区分断言与覆盖目标。
3. 根据当前软件版本配置可用的故障类型和注入策略。
4. 切换到 FTA，运行激活、传播与检测分析。
5. 汇总可以被检出的故障、无法检出的故障以及尚无结论的故障。
6. 对未检测到的区域补充有意义的设计属性，然后再运行 FTA 和 FPV 回归。

## 3. 不能直接从 `-fmode FTA` 启动

User Guide 第 65 页明确提醒：该版本通常先从 FPV 模式建立工作区，再用 `set_fml_appmode FTA` 切换，`vcf -fmode FTA` 并不是受支持的直接启动方式。快速指南里虽然有独立的 `FTA` 命令行，但这并不意味着可以跳过准备就绪的 FPV 环境。

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

这个脚本描述的是学习顺序，**并不是一个对任何 FTA 许可证和故障模型都能立即运行的完整正式工程**。尤其是 `fta_init`、`configure_fta_props` 和 `compute_fta` 的参数，需要与当前会话的 FPV task、故障数据库及流程类型相对应。先阅读 User Guide 第 923～941 页的完整流程，再部署生产项目。

### 4.1 FTA 工程配置模板

`error` 会明确阻止把缺少已验证属性集合或故障配置的脚本当成真实的 FTA 分析。

**保存为 `templates/fta_mutation.tcl`：**

<!-- source-begin: templates/fta_mutation.tcl -->

```tcl
# FTA：Formal Testbench Analyzer。须基于真实的 FPV 工程与属性集合。
# 不能仅用 vcf -fmode FTA 直接启动，详见 User Guide §21 和手册 FTA.md。
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
| 经审查的 waiver（豁免） | 有外部充分证据认定不需要该项 | 记录依据并保留原结果 |

故障结果必须结合分析前的属性状态和所选的故障模型来解读。当基准设计本身已经失败时，不能把同一个失败算作新增故障被检出；当故障无法激活或传播时，也不能据此宣称断言已经检查了对应功能。应该把未检出的有效故障带回到规格和属性正文中分析。

检出率与业务规格覆盖的完整程度有关，但不能直接等同于“芯片功能正确的百分比”。

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

这一组命令按照准备、生成、执行和结果处理的顺序组织。语法框保留了参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标和证明目标是不同的阶段，调用生成命令后应先检查实际目标数量，再启动证明。

### 6.1 `fta_init`：限定故障注入设计范围

```text
fta_init -top <top_module>
fta_init -scope <module_list>
```

**参数解释：** `-top` 指定故障注入的顶层，在分步的 `analyze/elaborate` 流程中尤其要先设置；`-scope` 限定参与故障注入的模块列表。两种写法分别出现在 User Guide 的流程说明中，但这并不等于所有模式都必须同时提供这两个选项。

**用法与结果：** FTA 应该从已有的干净 FPV 环境开始，随后在读入或展开设计时使用 `-inject_fault`。如果没有提供专用的 Certitude 文件，工具可以为所有模块自动生成注入配置；这会显著扩大故障集合。显式配置文件中的 FaultSet 与注入开关之间存在优先级，不能只凭一条 Tcl 判断实际的故障范围。

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

**参数解释：** `-par_task` 指定父 FPV 任务。`-fault_class` 在已经插入的故障内进一步选择类别，例如 SynchronousControlFlow、ComboLogicControlFlow；它不能补插编译时没有生成的故障。`-type`、`-usage`、`-status` 选择参与检测的属性，默认只使用 proven 属性。`-min_proof_depth` 为纳入的未完成属性设定最小有界证明深度；如果没有显式给出，工具就取所选未完成属性中最小的证明深度。

**用法与结果：** 选择 inconclusive 属性时，要同时报告它的有界深度，不能让最终的故障检测率看起来与全部使用完整证明的配置相同。原文有一处示例误拼成 `-par_tack`，其他定义和示例都使用 `-par_task`；本教程采用后一种拼写。

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

**参数解释：** `-par_task` 指明提供规格断言和约束的父任务。`-property` 可以显式选取用于检测故障的属性；省略时使用配置和默认的选择规则，通常为 proven 属性。

**用法与结果：** 先在全部故障被内部关闭的情况下重跑 FPV，确认注入后的设计模型仍然满足原基线，然后再运行 FTA。故障未被检测并不自动证明故障没有影响：可能是断言漏写、约束屏蔽了激活条件、故障无法传播，或者求解尚无结论。需要结合分类和反例继续分析。

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

**参数解释：** 位置参数限定设计实例；`-status non_detected` 可以筛选出未检测的故障。返回的是工具集合，可以交给 `report_fv`、`fvdisable`、`fvenable`、`fvwaive`。

**用法与结果：** 是否区分同一模块不同实例中的故障，受编译前的 `fml_fta_inst_qual` 设置影响。在大量共用模块的场景下，应该先确认实例级故障是否彼此独立，再比较每个实例的检测率。禁用或豁免集合只是在本次分析中排除掉目标，并不等于已经检测。

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

**参数解释：** `-instance` 指定一个或多个实例，`-list` 和 `-verbose` 分别用于逐项报告和详细报告。这里保留了 User Guide 中分别出现的调用形式；不把示意性的 `-list/-verbose` 连写成一个可执行的开关。

**用法与结果：** 先看总量和状态分布，再看未检测故障对应的 RTL 和规格断言。报告应该注明故障类别、实例范围、被排除的故障和参与检测的属性集合，否则不同运行得到的百分比不能直接比较。

```tcl
fta_report -instance {controller.u_fifo controller.u_arbiter}
fta_report controller.u_fifo -verbose
```

来源：User Guide，X-2025.06-SP1，第 928–930 页。

### 6.6 `read_fta_waiver`：重新应用已审查的故障豁免

```text
read_fta_waiver [-elfiles <exclusion_file_list>]
```

**参数解释：** `-elfiles` 指定一个或多个由 `save_waiver_file -fta` 生成的文件。故障键包含类别、原 RTL 构造及其他唯一属性，而不只是依赖容易变化的显示序号。

**用法与结果：** 当设计修改导致原故障键不再匹配时，不应该强行沿用旧的豁免；应该审查失配项。工作目录中的 COI.el、FC.el 可能会被相关的 FTA/高强度汇总流程自动使用，运行归档时要一并收集这些文件，避免出现隐藏的排除来源。

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

**参数解释：** `-name` 指向的是 Testbench Quality Assurance/Certitude 数据库，而不是普通的 VCS 代码覆盖 `.vdb`。

**用法与结果：** 必须在 `read_file` 或 `elaborate` 之前使用。在仿真数据库中已经判为检测到的故障，可以从形式分析目标中排除，让形式工具集中处理其余的故障。合并统计之前，仍然需要确认两个流程的设计版本、故障定义和配置一致。

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

**参数解释：** `-name` 指定保存目录或数据库路径。结果会保存到 Testbench Quality Assurance 数据库，供独立工具合并和查看。

**用法与结果：** 这是 FTA 的数据库接口，既不是 FuSa 的 `fusa_save`，也不是覆盖率的 `save_covdb`。三者的数据对象和后续使用它们的工具各不相同，文件名相似并不意味着命令可以互换。

```tcl
save_faultdb -name formal_fault_results
```

来源：User Guide，X-2025.06-SP1，第 939 页。

### 6.9 `cluster_fta_faults`：把相似未检测故障分组

```text
cluster_fta_faults
```

**参数解释：** User Guide 在本节给出的调用不带参数；它对未检测的故障进行相似性分组。

**用法与结果：** 分组用于减少重复调试。修复组内一个代表故障所暴露的检查缺失之后，应该重跑整组，而不是直接把其他成员改成“已检测”。相似只是一种分析提示，并不是逻辑等价的证明。

```tcl
cluster_fta_faults
report_fta_fault_clusters
```

来源：User Guide，X-2025.06-SP1，第 955 页。

### 6.10 `report_fta_fault_clusters`：查看未检测故障分组

```text
report_fta_fault_clusters
```

**参数解释：** 输入是先前由 `cluster_fta_faults` 计算出的分组结果；本节没有列出额外参数。

**用法与结果：** 优先选择那些影响可观察输出、关联关键功能且覆盖属性较少的分组，做代表性调试。保留组成员清单，便于在补充断言之后核实整组状态的变化。

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

**参数解释：** `-property` 限定目标故障；不提供时使用流程的默认目标。`-dump_setup` 导出 fta_ndf.tcl；修改这个模板之后再用 `-run_user_setup` 运行用户设置。这三种形式属于不同阶段，不应该把导出和运行开关无条件堆在同一个调用中。

**用法与结果：** 这个命令借助 SEQ 比较正常设计与带目标故障的设计，并自动打开带 Verdi 的独立会话，因此批处理 FTA 也可能需要图形显示和 SEQ 许可。它会调整工作目录中的 Certitude 配置文件；回到原来的 FPV-FTA 流程之前，应该按原文要求恢复。初始化时不启用目标故障，故障在复位阶段的影响不属于这个默认的调试问题。

```tcl
debug_fta -dump_setup
# 审阅并修改生成的 fta_ndf.tcl 后，另行执行：
debug_fta -run_user_setup
```

来源：User Guide，X-2025.06-SP1，第 955–958 页。

## 7. 两个评估示例

**例一：FIFO 缺少溢出断言。** 只写了 FIFO 空闲和复位属性，注入“满时仍然接受写入”的 RTL 改变，可能不会被检出。补充 `occupancy <= DEPTH`、接受写入时机等断言，再重新比较检测结果。**例二：状态机出现错误的状态转换。** 只检查状态编码的合法性，状态从 `WAIT` 错误跳到 `IDLE` 时，编码仍然可能保持合法，却违反了协议。FTA 可以促使增加状态转移规则与完成覆盖。

### 7.1 用完整源码观察断言是否能发现设计变化

下面用计数器的正确版与错误版做手工对照，帮助理解“改变设计之后，原有属性是否敏感”。这一练习使用 FPV；它不能替代 FTA 自动生成故障或计算检出率。为便于单独阅读本章，相关文件再次全文列出。

### 7.1.1 被验证的计数器 RTL

规格：复位后计数为零；使能时从 0 计到 9，然后回到 0；没有使能时保持不变。RTL 文件只包含设计本身，不把待验证的结论写成环境假设。

**保存为 `rtl/counter.sv`：**

<!-- source-begin: rtl/counter.sv -->

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

`history_valid` 在复位后建立历史有效标志。`ap_range` 检查范围，`ap_hold` 检查保持，`ap_increment` 检查普通递增，`ap_wrap` 检查回绕；两条 `cover` 检查最高计数值及回绕场景是否能够出现。末尾的 `bind` 把检查器接入同名的设计信号，不需要修改 RTL。

**保存为 `formal/counter_props.sv`：**

<!-- source-begin: formal/counter_props.sv -->

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

先列出 RTL，再列出包含 `bind` 的属性文件；路径是相对于运行 VC Formal 的工程根目录，而不是 Tcl 文件所在的目录。

**保存为 `filelist_counter.f`：**

<!-- source-begin: filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 7.1.4 完整运行脚本

依次选择应用、读入设计与 SVA、定义时钟复位、保存初始状态、检查设置、列出属性并开始证明。初始化步骤需要在实际安装环境中核对复位状态，不能把声明复位等同于已经完成复位。

**保存为 `scripts/fpv_counter.tcl`：**

<!-- source-begin: scripts/fpv_counter.tcl -->

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
# 在工程根目录执行
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_counter.tcl -batch 2>&1 | tee logs/fpv_counter.log
```

**结果阅读：** 在初始状态正确的前提下，正确版预期会满足这些断言，并存在到达 9 和回绕的覆盖轨迹。这并不是本次 VC Formal 的实际运行结果。这些断言分别覆盖范围、保持、普通递增和回绕；复位值以及运行中的重新复位仍然需要结合初始化模型和专门的复位检查，不能仅凭范围属性成立就认定全部功能正确。

### 7.1.5 故意错误的 RTL

错误只在回绕阈值上：把 9 改成 10。模块名仍然是 `counter`，所以这个文件与正确版必须分别编译。属性文件沿用本节已经完整列出的 `counter_props.sv`。

**保存为 `rtl/counter_bad.sv`：**

<!-- source-begin: rtl/counter_bad.sv -->

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

只读入错误设计和同一份检查器，不要同时包含两个同名的设计。

**保存为 `filelist_counter_bad.f`：**

<!-- source-begin: filelist_counter_bad.f -->

```text
./rtl/counter_bad.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 7.1.7 错误版完整运行脚本

与正确版采用相同的接口和初始化方法，不要为了让错误版通过而增加输入限制。

**保存为 `scripts/fpv_counter_bad.tcl`：**

<!-- source-begin: scripts/fpv_counter_bad.tcl -->

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
# 在工程根目录执行
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_counter_bad.tcl -batch 2>&1 | tee logs/fpv_counter_bad.log
```

错误版的预期反例是：在允许连续使能的输入下，计数从 9 进入 10，违反了范围和回绕规则。查看反例时，应该区分时钟沿的采样值与非阻塞赋值之后的寄存器值；不能把这里描述的预期现象伪装成工具日志。

## 8. FTA 与故障仿真的区别

FTA 使用形式分析，寻找能够触发和传播注入差异的逻辑证据；故障仿真通常依赖已经准备好的激励序列。两者都可以用来研究测试平台的质量，但对状态空间、收敛条件、故障模型和资源需求的依赖各不相同。FTA 的故障并不等同于制造测试中的 stuck-at / transition ATPG 故障模型。

## 9. 参考

User Guide 第 21 章，尤其是多阶段运行、故障注入、结果调试与性能部分；以及 User Guide 第 20 章的最终验证质量评估方法。
