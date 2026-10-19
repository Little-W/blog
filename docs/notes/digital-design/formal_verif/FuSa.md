---
title: FuSa：功能安全形式分析指南
tags: [形式验证, 数字IC, VC Formal, FuSa, 功能安全]
---

# FuSa：功能安全形式分析使用指南

## 1. 场景与关键概念

对于汽车、工业控制或其他要求功能安全的芯片而言，故障不仅要判断“是否存在”，还需要分析它在规定的运行状态下可能带来什么影响，以及能否通过硬件检测机制观察到。FuSa 可以与故障数据库和 Z01X 等工具协同工作，按故障的可控性、可观察性和检测能力进行分类，为 FMEDA（失效模式、影响及诊断分析）提供支持。

**可控性**：是否可能在允许的输入/状态下触发相关故障影响；**可观察性**：故障差异是否可能传播到指定的观察点；**可检测性**：预定的诊断机制是否能够检测到故障。三者相互关联但各不相同。不能把“故障可观察”直接写成“已经被安全机制检测到”。

## 2. 前置要求和故障输入

根据 User Guide 第 1015～1016 页，准备 FuSa 之前应该先有一个没有关键设置问题的 FPV 环境；故障定义可以来自 Standard Fault Format（SFF）或统一故障数据库（FDB），此外还需要提供观察点、检测点以及相关的常量前提。工具版本和故障数据库版本应该保持兼容。

典型的输入资料包括：RTL、参数配置、故障清单、正确的时钟复位与初始化、合法运行模式的定义，以及观察/检测节点列表。如果观察点设置错误，那么即使某个故障在真实系统中很危险，也可能被错误分类。

## 3. 四类分析

| 分析类别 | 目标 | 可能的误解 |
| --- | --- | --- |
| 结构分析（Structural） | 初步查看故障与观察/检测点的结构关系 | 有结构路径不代表一定可传播 |
| 可控性分析（Control） | 检查是否能激活相应故障效应 | 不可控可能受环境约束影响 |
| 可观察性分析（Observe） | 研究故障效应是否到达观察端 | 到达观察端不代表诊断会报警 |
| 可检测性分析（Detection） | 判断指定检测机制是否响应 | 取决于指定检测点和时序规则 |

这四类分析形成逐级细化的证据：结构关系只说明存在可能的传播路径；可控性研究故障能否被激活；可观测性研究故障能否影响指定的功能输出；检测分析研究安全机制能否在要求的条件和时间内报警。“一个故障不能被观察到”和“一个故障已经被安全机制检测到”，是完全不同的两个结论。

User Guide 23.1.1 给出了结构、可控性、可观察性及检测分析。不同模式的输出状态不应该混合汇总，尤其不能把“结构排除”当成已经对完整的工作状态完成了所有逻辑分析。

## 4. 标准脚本结构

```tcl
set_fml_appmode FUSA
# 先配置故障清单，后读入设计
fusa_config -sff faults.sff
# 或者结合 FDB 设置，具体数据库名与路径按项目确定
# fusa_config -fdb campaign -fdb_path /project/faultdb
read_file -top safety_top -format sverilog -vcs {-f filelist.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
fusa_observation -add safety_output
fusa_detection -add alarm
fusa_generate
set_fml_var fusa_run_mode structural
check_fv -block
fusa_report
```

在这个教学骨架中，`faults.sff`、`safety_output`、`alarm` 这些对象必须用实际的故障清单和 RTL 来替换。正式项目应该先在 FPV 环境完成 `check_fv_setup -block` 等准备检查，并了解 User Guide 中关于正式 FuSa 重复执行这些检查的性能提示。

### 4.1 原生 FuSa 模板完整源码

真实的 SFF/FDB 文件和系统安全故障定义属于必要输入，不能用下面的教学用异或掩码代替这些输入，来声称已经完成 FuSa。模板默认停止执行。

**保存为 `templates/fusa_safety.tcl`：**

<!-- source-begin: templates/fusa_safety.tcl -->

```tcl
# FuSa：功能安全分析，需要 SFF/FDB、真实的安全检测点和失效定义。
error "此文件是 FuSa 教学模板：请先提供 SFF/FDB、观察点、检测点、RTL 和安全场景"
# set_fml_appmode FUSA
# fusa_config -sff /project/faults/campaign.sff
# read_file -top safety_top -format sverilog -vcs {-f filelist.f}
# create_clock clk -period 100
# create_reset rst_n -sense low
# sim_run -stable
# sim_save_reset
# fusa_observation -add {safety_top.data_out safety_top.done}
# fusa_detection -add {safety_top.error_alarm}
# fusa_generate
# set_fml_var fusa_run_mode structural
# check_fv -block
# fusa_report
```

<!-- source-end -->

## 5. 逐步提高分析精度

```tcl
set_fml_var fusa_run_mode structural
check_fv -block
set_fml_var fusa_run_mode control
check_fv -block
set_fml_var fusa_run_mode observe
check_fv -block
```

执行不同的分析阶段时，需要使用每个阶段生成的故障类别并保存结果。某些版本或项目中还需要专用的检测配置，不能仅凭这三条命令就推断出完整的 FMEDA 已经生成。请阅读该安装版本的 `fusa_config -help`、`fusa_generate -help`、`fusa_report -help`。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fusa_config` | 读取安全故障清单与数据库 |
| `fusa_clear` | 清理本轮故障与生成属性 |
| `fusa_map_status` | 指定内部结果的外部状态编码 |
| `fusa_blackbox` | 为安全分析建立可传播的抽象模块 |
| `fusa_observation` | 设置功能观察点 |
| `fusa_detection` | 设置安全检测点 |
| `fusa_generate` | 生成安全故障及分析属性 |
| `fusa_get_ignored_signals` | 查看未参与故障生成的信号 |
| `fusa_report` | 检查安全故障、分析模式与传播抽象 |
| `fusa_save` | 导出安全故障分析结果 |

这一组命令按照准备、生成、执行和结果处理的顺序组织。语法框保留了参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标和证明目标是不同的阶段，调用生成命令后应先检查实际目标数量，再启动证明。

### 6.1 `fusa_config`：读取安全故障清单与数据库

```text
fusa_config [-sff <files>] [-fdb <database_name>]
  [-fdb_path <local_project_path>] [-fdb_server <server:port>]
  [-fdb_campaign <campaign>] [-status <statuses>]
  [-dut_path <dut_path>] [-save_fdb_incr <interval>]
```

**参数解释：** 至少要提供 `-sff` 或 `-fdb` 所代表的故障输入。`-sff` 接受 SFF 文件列表；`-fdb` 指定统一故障数据库。`-fdb_path` 是本地数据库路径，不能同时与 `-sff`、`-fdb_server` 一起使用；`-fdb_server` 选择服务端，`-fdb_campaign` 选择故障分析活动。`-status` 选择待分析的状态或状态组，状态组在 `fusa_generate` 时展开。`-dut_path` 用于对齐故障文件与当前设计的顶层路径。

`-save_fdb_incr` 控制运行期间的增量保存，单位是 M 或 H，默认 1H，非零时最小为 10M，设为 0 表示关闭。SFF 流程在重新配置之前需要 `fusa_clear`，并且 SFF 输入应该在读设计之前完成。

**用法与结果：** 统一安全流程涉及的工具版本需要相互匹配。User Guide 的“本地 FDB”示意代码存在重复远程选项的排版问题，因此本教程以 `-fdb_path` 的明确定义来区分本地和服务端用法。数据库能够连接，并不代表其中的故障对象都能在当前设计中找到，随后必须检查生成报告和忽略报告。

```tcl
set_fml_appmode FUSA
fusa_config -sff {faults.sff}
# FDB 工程可改用下面这一形式，而不是与上面的 SFF 调用连续混用。
# fusa_config -fdb safety_db -fdb_path /project/fdb \
#   -fdb_campaign main_campaign -dut_path controller
```

来源：User Guide，X-2025.06-SP1，第 1016–1019 页。

### 6.2 `fusa_clear`：清理本轮故障与生成属性

```text
fusa_clear
```

**参数解释：** 不带参数；它清除已经读入的故障和相关属性，使后续可以重新配置。

**用法与结果：** FDB 流程可以在保留设计的情况下切换故障配置，但必须先 clear。更换 SFF 文件受到读设计时机的限制：读设计之后再提供新的 SFF 会报错，而在旧式 SFF 流程中，读设计之后连 clear 也不允许。它并不是普遍适用的“随时重启本应用”命令。

```tcl
fusa_config -sff first.sff
fusa_clear
fusa_config -sff second.sff
# 然后才读取并展开设计。
```

来源：User Guide，X-2025.06-SP1，第 1024 页。

### 6.3 `fusa_map_status`：指定内部结果的外部状态编码

```text
fusa_map_status [-sff_status <status_code>] [<internal_status>]
```

**参数解释：** 位置参数是内部状态，例如 FNR、SIN、SSF、SNO、SND、CNC、CCC、CIN、ONO、OOB、OIN、DND、DDT、DIN、NOD、NON、ODT、OND；`-sff_status` 指定输出的编码。

**用法与结果：** 状态编码存在版本差异，不能仅凭两三个字母就判断分析证据。内部的“不可观察”“可检测”“无结论”属于不同维度；自定义外部编码之后，仍然要保留原来的内部状态和分析模式。下面的示例显式重申了原文列出的 FNR→NA 关系，不擅自改写安全分类。

```tcl
fusa_map_status -sff_status NA FNR
```

来源：User Guide，X-2025.06-SP1，第 1019–1021 页。

### 6.4 `fusa_blackbox`：为安全分析建立可传播的抽象模块

```text
fusa_blackbox [-module <modules>] [-all]
  [-all_auto_path] [-no_auto_path] [-seq_path] [-comb_path]
  [-ignore_unresolved] [-data_path_only] [-remove]
  [-task <failure_mode_task>] [<instances>]
```

**参数解释：** `-module` 或实例列表用来限定对象；`-all` 作用于全部结构黑盒。`-all_auto_path` 默认自动创建从输入到输出的路径，`-no_auto_path` 不自动创建；`-seq_path` 和 `-comb_path` 分别采用时序传播和组合传播。`-ignore_unresolved` 跳过未解析的模块；`-data_path_only` 不沿多路选择器的选择控制传播，但允许数据分支传播。`-remove` 撤销安全抽象。`-task` 仅在存在多个 failure mode 时指定所属任务。

**用法与结果：** 在设计展开之后、`fusa_generate` 之前使用。普通的结构黑盒会断开传播路径，可能错误地证明故障不可观察；安全抽象则保持保守传播，但也可能添加实际上并不成立的路径，形成需要进一步精化的失败。生成前的报告不一定列出最终的安全黑盒。

```tcl
fusa_blackbox -all -seq_path
fusa_generate
fusa_report -blackbox -path
```

来源：User Guide，X-2025.06-SP1，第 1021–1022 页。

### 6.5 `fusa_observation`：设置功能观察点

```text
fusa_observation [-add] [-delete] [-file <filename>] [<signals>]
```

**参数解释：** `-add` 增加，`-delete` 删除；信号可以直接以 Tcl 列表给出，也可以通过 `-file` 读取。对象应该是输出数据、事务响应或其他用于判断功能影响的信号。

**用法与结果：** 观察点和检测点应该分别根据系统规格确定，不应该为了提高检测率就把所有功能输出都当作告警。FDB/SFF 中已有的点可能会自动导入，也可以再用 Tcl 补充或修改；生成之后用报告核实最终的集合。

```tcl
fusa_observation -add {controller.data_out controller.done}
fusa_report -observation
```

来源：User Guide，X-2025.06-SP1，第 1022–1023 页。

### 6.6 `fusa_detection`：设置安全检测点

```text
fusa_detection [-add] [-delete] [-file <filename>] [<signals>]
```

**参数解释：** `-add` 增加，`-delete` 删除；信号可以直接以 Tcl 列表给出，也可以通过 `-file` 读取。对象应该是错误标志、告警或其他安全机制用于报告故障的信号。

**用法与结果：** 观察点和检测点应该分别根据系统规格确定，不应该为了提高检测率就把所有功能输出都当作告警。FDB/SFF 中已有的点可能会自动导入，也可以再用 Tcl 补充或修改；生成之后用报告核实最终的集合。

```tcl
fusa_detection -add {controller.error_alarm}
fusa_report -detection
```

来源：User Guide，X-2025.06-SP1，第 1022–1023 页。

### 6.7 `fusa_generate`：生成安全故障及分析属性

```text
fusa_generate [-scopes <scopes>] [-excludes <scopes>] [-exact]
  [-fault_type <st0|st1|both|transient|transient_0|transient_1|all>]
  [-analysis <analysis_list>] [-verbose] [-types <node_types>]
```

**参数解释：** 按已经导入的 SFF/FDB 清单运行时，使用无参数形式。主动生成或筛选对象时，`-scopes` 指定范围，`-excludes` 排除子范围，`-exact` 避免部分名称匹配。`-fault_type` 选择固定故障或瞬态故障；`-analysis` 选择 structural、control、observe、detect；`-types` 选择 WIRE、PORT、VARI、ARRY；`-verbose` 展开生成的信息。

**用法与结果：** 生成属性之后，仍然需要设置运行模式并执行 `check_fv`。该版本对瞬态故障的支持范围不能从允许的枚举值推断出来：User Guide 的支持矩阵只列出了它对结构分析的支持。时钟和复位故障也有专门的结构分析限制，不能把全部注入对象都纳入同一个动态检测率的分母。

```tcl
fusa_generate
set_fml_var fusa_run_mode structural
check_fv -block
fusa_report -fault_category
fusa_get_ignored_signals
```

来源：User Guide，X-2025.06-SP1，第 1017–1018，1023–1027 页。

### 6.8 `fusa_get_ignored_signals`：查看未参与故障生成的信号

```text
fusa_get_ignored_signals [-clock] [-reset] [-skipped]
```

**参数解释：** `-clock` 只显示被忽略的时钟，`-reset` 只显示复位，`-skipped` 显示其他被跳过的信号；不加筛选时查看整体情况。

**用法与结果：** 这个报告是故障范围审查的一部分。信号出现在 RTL 中，并不表示它的故障参与了全部分析模式，尤其不要把时钟、复位对结构分析的支持误说成可控、可观察和检测分析也都支持。

```tcl
fusa_get_ignored_signals -clock
fusa_get_ignored_signals -reset
fusa_get_ignored_signals -skipped
```

来源：User Guide，X-2025.06-SP1，第 1025 页。

### 6.9 `fusa_report`：检查安全故障、分析模式与传播抽象

```text
fusa_report [-list] [-verbose] [-no_summary]
  [-observation] [-detection] [-fault_id <id>]
  [-blackbox] [-fdb_report] [-file <filename>]
  [-path] [-path_config] [-col] [-with_top]
  [-instance <instances>] [-fault_category] [-fdb_version]
```

**参数解释：** `-list` 让每个故障占一行，`-verbose` 输出详细记录，`-no_summary` 去掉汇总；`-fault_id` 定位故障，`-instance` 按实例筛选，`-with_top` 保留顶层前缀。`-observation`、`-detection` 输出这两类点。`-blackbox` 查看安全黑盒，`-path` 查看传播路径，`-path_config` 查看用户路径配置，`-col` 返回对应的实例集合。`-fdb_report` 输出数据库报告，`-file` 指定该报告的 SFF 文件；`-fault_category` 展示分类，`-fdb_version` 查看数据库版本。

**用法与结果：** 报告中的故障状态和分析模式都应该保留。例如，结构上无通路、动态不可激活和尚未求得结论，不能合并成一个“通过”。需要复核检测能力时，要同时查看检测点是否正确导入，而不只是读取 observed 的数量。

```tcl
fusa_report -list
fusa_report -observation
fusa_report -detection
fusa_report -blackbox -path
fusa_report -fault_category
```

来源：User Guide，X-2025.06-SP1，第 1027–1028 页。

### 6.10 `fusa_save`：导出安全故障分析结果

```text
fusa_save [-sff <filename>] [-fault_db <database_path>]
  [-test <test_name>] [-status <statuses>] [-all_failure_modes]
```

**参数解释：** `-sff` 保存 SFF；`-fault_db` 指定数据库；`-test` 指定结果所属的测试名；`-status` 只保存所选的状态；`-all_failure_modes` 保存全部 failure mode 的当前结果。已经配置了本地 FDB 时，可以不带参数保存到当前数据库。

**用法与结果：** 输出格式应该与输入流程一致：SFF 输入就导出 SFF，FDB 输入就保存 FDB，不要把这个命令当作通用的格式转换器。它保存的是当前的证据，不会补做尚未完成的分析；汇总报告应该明确指出还有哪些状态未知。

```tcl
fusa_save -sff formal_safety_result.sff
# FDB 工程使用 fusa_save 或明确的 -fault_db/-test 配置。
```

来源：User Guide，X-2025.06-SP1，第 1029 页。

## 7. 案例：带奇偶校验的安全寄存器

一个重要配置寄存器使用奇偶校验位，写入时更新校验值；读取或使用时，如果校验与数据不一致，就把 `alarm` 拉高。可以把寄存器数据以及校验位中的故障指定为分析对象，把 `alarm` 作为检测点，把关键输出作为观察点。分析时要区分：故障是否真正改变了数据；改变是否到达输出；奇偶校验是否在规定时延内报警。即使某个故障没有影响输出，也不能把其他故障的检测结果套用到它身上。

### 7.1 完整代码：观察值、报警与漏检场景

为了把“输出受影响”和“报警检测到”区分开，下面只在读取路径上增加教学用的异或掩码。数据寄存器和校验寄存器正常更新；`fault_mask` 改变读出的数据位，`fault_parity` 改变读出的校验位。这个模型既不是晶体管故障模型，也不是故障数据库文件。

#### 7.1.1 完整 RTL

**保存为 `rtl/safety_reg_demo.sv`：**

<!-- source-begin: rtl/safety_reg_demo.sv -->

```systemverilog
// 教学故障模型：用异或掩码改变读取路径的数据/校验位。
// 不是 SFF/FDB 注入器，也不代表真实硬件故障的全部类型。
module safety_reg_demo (
  input  logic       clk, rst_n, write_en,
  input  logic [7:0] write_data,
  input  logic [7:0] fault_mask,
  input  logic       fault_parity,
  output logic [7:0] safety_output,
  output logic       alarm
);
  logic [7:0] stored_data;
  logic       stored_parity;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      stored_data   <= 8'd0;
      stored_parity <= 1'b0;
    end else if (write_en) begin
      stored_data   <= write_data;
      stored_parity <= ^write_data;
    end
  end

  assign safety_output = stored_data ^ fault_mask;
  assign alarm = (^safety_output) ^ stored_parity ^ fault_parity;
endmodule
```

<!-- source-end -->

#### 7.1.2 完整 SVA

除了单比特错误会报警之外，还覆盖两位数据同时翻转却不报警的情况。这有助于识别奇偶校验的能力限制，不能把单个场景的结果推广成全部故障的检出率。

**保存为 `formal/safety_reg_demo_props.sv`：**

<!-- source-begin: formal/safety_reg_demo_props.sv -->

```systemverilog
module safety_reg_demo_props (
  input logic clk, rst_n,
  input logic [7:0] fault_mask,
  input logic fault_parity, alarm
);
  ap_no_fault_no_alarm: assert property (@(posedge clk) disable iff (!rst_n)
    fault_mask == 8'd0 && !fault_parity |-> !alarm);
  ap_single_bit_detected: assert property (@(posedge clk) disable iff (!rst_n)
    $onehot(fault_mask) && !fault_parity |-> alarm);
  ap_parity_bit_detected: assert property (@(posedge clk) disable iff (!rst_n)
    fault_mask == 8'd0 && fault_parity |-> alarm);
  // 两位数据同时翻转不改变奇偶性，用覆盖目标寻找漏检场景。
  cp_two_bit_undetected: cover property (@(posedge clk) disable iff (!rst_n)
    fault_mask == 8'h03 && !fault_parity && !alarm);
endmodule

bind safety_reg_demo safety_reg_demo_props u_safety_props (
  .clk(clk), .rst_n(rst_n), .fault_mask(fault_mask),
  .fault_parity(fault_parity), .alarm(alarm)
);
```

<!-- source-end -->

#### 7.1.3 文件列表

**保存为 `filelist_fpv_safety_demo.f`：**

<!-- source-begin: filelist_fpv_safety_demo.f -->

```text
./rtl/safety_reg_demo.sv
./formal/safety_reg_demo_props.sv
```

<!-- source-end -->

#### 7.1.4 配套 FPV 脚本

**保存为 `scripts/fpv_safety_demo.tcl`：**

<!-- source-begin: scripts/fpv_safety_demo.tcl -->

```tcl
# 在工程根目录执行；结果必须以本机 VC Formal 日志为准。
set_fml_appmode FPV
read_file -top safety_reg_demo -sva -format sverilog -vcs {-f filelist_fpv_safety_demo.f}
create_clock clk -period 100
create_reset rst_n -sense low
# 先核验实际复位状态，再保存初始状态。
sim_run -stable
sim_save_reset
check_fv_setup -block
report_fv -list
check_fv -block
report_fv -verbose
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 在工程根目录执行
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_safety_demo.tcl -batch 2>&1 | tee logs/fpv_safety_demo.log
```

在这个教学模型中，单个数据位或单独的校验位发生改变，预期会报警；两位数据同时翻转的覆盖目标预期可以达到。只有把真实的故障清单、观察点、检测点和系统失效定义接入原生 FuSa 流程之后，才能解释该流程实际的故障分类。

## 8. 与 ISO 26262 / FMEDA 的关系

FuSa 的分析结果可以作为硬件随机故障指标评估的一部分，但不能仅凭工具中的一个百分比就认定达到了某个 ASIL 等级。功能安全还涉及故障模型、故障率来源、诊断间隔、残余风险、独立性、系统级失效影响和安全机制完整性。所有故障分类以及能够被排除的对象，都应该由功能安全负责人审查。

## 9. 常见错误

- 故障数据与 RTL 的层级不一致，导致部分故障没有真正进入分析。
- 没有先校验时钟、复位及模式常量，造成大量虚假的不可控。
- 观察点或检测点太少，使报告过于乐观或不完整。
- 把可观察与已检测、未完成与不可达混为一谈。
- 把结构分析结果当成所有故障的最终证明。

## 10. 官方资料

User Guide §23（1009～1039 页）、§4（初始化）、§6（结果控制）；如果涉及数据库交互，还应该同时参照 Z01X / FDB 相同软件版本的文档。
