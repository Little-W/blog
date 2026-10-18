---
title: AEP：自动提取属性检查指南
tags: [形式验证, 数字IC, VC Formal, AEP]
---

# AEP：自动提取属性应用使用指南

## 1. AEP 的角色与应用价值

AEP 不需要用户先手工写出每一条 SVA，就能从 RTL 结构和编码方式中自动推导出一批容易引发功能问题的条件，并把它们交给形式引擎检查。它适用于新接入的 IP、第三方 RTL、复杂状态机、溢出与数组访问风险排查，以及验证项目启动阶段的快速质量筛查。

AEP **不等于自动证明全部功能规格**。它擅长发现通用的实现错误（越界、算术溢出、状态机问题、三态冲突、某些不完整分支等），但不会知道客户要求某个控制寄存器在第几个周期复位，也不会自动理解外部协议的最终响应期限。经过 AEP 筛查之后，仍然需要补充 FPV 业务属性。

## 2. 检查对象与生成条件

| 检查类型 | 选择值 | 主要检查对象 |
| --- | --- | --- |
| 数组访问 | `bounds_check` | 数组索引是否超出声明范围 |
| 算术结果 | `arith_oflow` | 支持的运算是否发生算术溢出 |
| 移位结果 | `shift_oflow` | 左操作数的全部位是否被移出 |
| 类型转换 | `cast_oflow` | 赋值右侧最外层转换的有效位是否丢失 |
| 三态悬空 | `floating_bus` | 是否没有有效三态驱动 |
| 三态多驱动 | `multi_driver` | 是否同时启用多个三态驱动 |
| 三态驱动冲突 | `conflict_driver` | 多个三态驱动是否输出相反值 |
| 分支完整性 | `full_case` | 声明为完整的选择条件是否确实完整 |
| 分支互斥性 | `parallel_case` | 声明为并行的选择条件是否确实互斥 |
| 异步置位与复位 | `set_reset` | 异步置位和复位是否同时有效 |
| 显式未知值 | `x_assign` | 显式 X 赋值是否可被执行 |
| 单状态无限等待 | `fsm_deadlock` | 是否无限停留于一个状态 |
| 多状态循环等待 | `fsm_livelock` | 是否困在多个状态组成的循环 |
| 状态机综合锁定 | `fsm_unionlock` | 用一条状态机属性检查两种锁定 |

**算术、移位与转换不是同一种检查。** `shift_oflow` 关注的是全部位都被移出，并不是只要丢失任意一位就算失败。8 位左操作数使用最大为 7 的移位量时，不能仅仅因为高位被丢弃就推断该检查一定失败。`cast_oflow` 的自动提取条件是赋值右侧最外层为 `$signed` 或 `$unsigned`，然后检查参数中最左侧的置位能否存入左侧信号。两者在本版本都是 beta 功能，不能当作通用的数值精度检查器，也不能覆盖所有截位问题。

**三态多驱动与数值冲突必须区分。** 两个三态驱动同时开启属于多驱动；如果两者都输出相同的值，未必会触发 `conflict_driver`。冲突检查针对的是相反值同时驱动的情况，并不会为普通的非三态多赋值结构生成同一种目标。悬空检查关注的则是所有驱动都关闭，三者分别覆盖不同的场景。

**分支检查依赖设计声明。** `full_case` 和 `parallel_case` 检查的是相应综合指示或 SystemVerilog 的 `unique`、`priority` 等结构所做出的承诺，并不等于对每个没有 `default` 的分支都生成相同的检查。某个非法编码应该被拒绝、忽略还是返回错误，应当由功能规格决定，不能依靠增加综合注释来消除设计问题。

**状态机检查需要单独启用。** `fsm_deadlock` 和 `fsm_livelock` 按状态生成相应目标，`fsm_unionlock` 则为每个状态机生成一条同时考虑死锁和活锁的目标。它们的计算代价较高，**不会因为使用 `-aep all` 就自动生成**。等待外部响应是否算错误，还取决于真实系统是否保证最终响应；公平性条件必须来自环境保证，而不是为了让目标通过而临时添加。

本版本的 VHDL 不支持 `parallel_case`、`full_case`、`shift_oflow` 和 `cast_oflow`；三态总线检查还需要额外启用变量。来源：User Guide，第 363–371 页。

## 3. 入门 AEP 案例：数组越界

### 3.1 完整设计源码

数组只有两个元素，但两位 `index` 能表示 0、1、2、3。这里故意保留未检查的索引访问；数组内容是否已经初始化，与本例的索引越界问题应当分开分析。

**保存为 `rtl/array_demo.sv`：**

<!-- source-begin: rtl/array_demo.sv -->

```systemverilog
// Deliberately has an index range wider than the 2-element memory.
module array_demo (
  input  logic       clk,
  input  logic [1:0] index,
  output logic [7:0] data_out
);
  logic [7:0] mem [0:1];
  always_ff @(posedge clk)
    data_out <= mem[index];
endmodule
```

<!-- source-end -->

如果接口规格确实允许任意两位索引，就应当由 RTL 来拒绝非法访问。只有在接口规范明确禁止索引 2、3 时，才可以建立相应的环境假设，不能为了消除反例而任意限制输入。

### 3.2 完整文件列表

**保存为 `filelist_aep.f`：**

<!-- source-begin: filelist_aep.f -->

```text
./rtl/array_demo.sv
```

<!-- source-end -->

## 4. 标准运行步骤

### 4.1 最小数组检查脚本

先选择 `bounds_check`，再检查属性是否真的生成。没有生成属性，并不等同于数组安全。

**保存为 `scripts/aep_bounds.tcl`：**

<!-- source-begin: scripts/aep_bounds.tcl -->

```tcl
set_fml_appmode AEP
read_file -top array_demo -aep bounds_check -format sverilog -vcs {-f filelist_aep.f}
create_clock clk -period 100
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
vcf -f scripts/aep_bounds.tcl -batch 2>&1 | tee logs/aep_bounds.log
```

真实工程如果带有复位，应当加上 `create_reset` 和必要的初始化序列；上面的 `array_demo` 刻意只有时钟，用来突出数组检查的概念。如果工具对该语言、数组形式或优化方式没有生成相应属性，先检查 `-aep` 语法与对象是否符合它的抽取前提。

### 4.2 多种 AEP 组合

```tcl
read_file -top my_top -aep fsm_deadlock+fsm_livelock \
  -format sverilog -vcs {-f filelist.f}
```

这里的 `+` 表示组合多个检查选择值，是指南中提供的一种常见写法；`-aep all` 不包含状态机锁定检查，也不意味着对每个设计都应该一开始就开启全部普通检查。建议先对高优先级逻辑运行一个小集合，再逐步扩展，以便降低误报排查的成本。

### 4.3 VHDL 的相关配置

```tcl
set_app_var fml_enable_vhdl_aep true
set_fml_var fml_enable_vhdl_bus_checks true
set_app_var fml_enable_vhdl_cov true
```

前一个是应用变量，后一个是形式变量，分别用 `set_app_var` 和 `set_fml_var` 设置，不能互换。它们用来启用 VHDL 自动检查及三态总线检查。VHDL 的语言结构与 SystemVerilog 不同，不能假定每一种 AEP 的覆盖条件都完全相同。

## 5. 状态机检查：死锁、活锁与公平性

FSM 死锁一般指在给定约束下进入无法合理继续的状态；活锁指能够不停转移、却始终不进入完成或期望状态。是否一定算设计缺陷，取决于环境前提：一个等待读取外设的状态，如果允许外设永远不响应，可能属于系统规格缺失，而不是状态机 RTL 必然有错。

```tcl
read_file -top controller -aep fsm_deadlock+fsm_livelock \
  -format sverilog -vcs {-f controller.f}
aep_generate -type fsm_fairness
# 可把候选公平性配置保存为脚本后审查
aep_generate -type fsm_fairness -tcl fairness.tcl
```

生成公平性相关条件时，应当由系统工程师审查其物理可实现性。例如“不停请求外部总线”并不能保证对方必然授权，除非系统规格已经明确了调度公平性。

### 5.1 控制某种状态的自动生成

```tcl
aep_config -dont_generate -type fsm_livelock {state_reg:state_name}
```

这个指令适用于已经确认某个状态的自动生成规则不适当的情况；必须给出关闭的原因和关联的设计评审。示例 `state_reg:state_name` 只是占位对象，实际名称应当从生成属性和设计状态列表中获取。不要用大量关闭属性的方式来解决真正的问题。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `aep_config` | 在读入设计前控制自动检查生成 |
| `aep_generate` | 生成状态机公平性及输入变化约束 |
| `enable_aep_goals_in_coi` | 只启用指定 FPV 目标相关的 AEP |
| `fvwaive` | 对可豁免目标记录豁免 |
| `fvunwaive` | 撤销目标豁免 |
| `save_waiver_file` | 保存当前目标豁免 |
| `read_waiver_file` | 读入已审核豁免 |

这一组命令按照准备、生成、执行和结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同的阶段，调用生成命令之后应当检查实际的目标数量，再启动证明。

### 6.1 `aep_config`：在读入设计前控制自动检查生成

```text
aep_config [-dont_generate] [-type <type-list>]
           [-enable_counter_arith_oflow <true|false>]
           [-generate_only_with_fanout <true|false>]
           [<signal-name:state>]
```

**参数解释。** `-dont_generate` 阻止所选类别生成；`-type` 可以选择数组越界、算术溢出、驱动冲突、悬空、多驱动、分支完整性或互斥、置位复位、X 赋值、三种状态机锁定检查以及 all。位置参数可以精确到状态寄存器及某一个状态，使用单个冒号连接。`-enable_counter_arith_oflow` 控制自增、自减计数器的算术溢出检查，默认为 true；`-generate_only_with_fanout` 只保留目标信号有扇出使用的检查，默认为 false。

**用法与结果。** 这个命令必须在 `read_file` 之前执行。它会改变插入到模型中的目标，而 `fvdisable` 只是停用已经生成的目标。对于设计本来允许等待的 RESET 状态，应当按规格局部排除，不应把全部死锁检查都关闭。User Guide 语法注释中提到的 `-exclude` 与展示的选项不一致，示例采用正文明确给出的 `-dont_generate`。

```tcl
set_fml_appmode AEP
aep_config -dont_generate -type fsm_deadlock \
    {u_ctrl.state:RESET}
aep_config -enable_counter_arith_oflow false
read_file -top ctrl -format sverilog \
    -aep bounds_check+fsm_deadlock -vcs {ctrl.sv}
```

来源：User Guide，X-2025.06-SP1，第 375–377 页。

### 6.2 `aep_generate`：生成状态机公平性及输入变化约束

```text
aep_generate -type <fsm_fairness|change_at>
             [-input_type <in|snip|abstract|bbout>]
             [-inputs <inputs-or-collection>] [-tcl <file_name>]
             [-max_width <integer>] [-bit] [-property <properties>]
```

**参数解释。** `-type fsm_fairness` 为有关的输入建立公平性前提；`change_at` 建立允许变化的边沿规则。`-input_type` 指定主输入、截断点、抽象点或黑盒输出；`-inputs` 指定对象，不给时使用属性影响范围内的输入。`-tcl` 把生成结果写到文件，以供审核。`-max_width` 限制总线位宽：未指定 inputs 时默认阈值为 2，指定 inputs 时默认为 10；超限会给出警告，没有生成任何公平性约束则会报错。`-bit` 按位生成，`-property` 限定相关属性。

**用法与结果。** 先建立时钟、复位和常量，然后再生成。总线公平性可能要求遍历其全部可能值，按位公平性与总线组合公平性也不相同；这些都是额外的环境承诺。建议先输出 Tcl，逐条确认外部环境真的保证这种变化，然后再 `source`。不能用公平性去强迫设计内部卡住的状态“总会变化”。

```tcl
create_clock clk -period 100
create_reset rst_n -sense low
aep_generate -type fsm_fairness \
    -inputs {ready response_valid} -max_width 2 \
    -tcl fairness_review.tcl
```

来源：User Guide，X-2025.06-SP1，第 377–380 页。

### 6.3 `enable_aep_goals_in_coi`：只启用指定 FPV 目标相关的 AEP

```text
enable_aep_goals_in_coi [-type <types>] [-status <statuses>]
                        [-filter <expression>] [-regexp] [-exact]
                        [<names-ids-or-property-collections>]
```

**参数解释。** 位置参数指定 FPV 目标；`-type` 限制 AEP 类别，`-status` 限定状态，`-filter` 施加属性过滤，`-regexp` 或 `-exact` 改变名称的匹配方式。

**用法与结果。** 这个命令在 FPV 应用中工作，会启用所选目标影响范围内的 AEP，并停用其他 AEP。它用来聚焦相关的结构，并不等于其他结构已经验证过。使用之后应当记录 AEP 总数和启用数量，避免在汇总报告中忽略未检查的部分。

```tcl
fvassert AP_OUTPUT_NONZERO -expr {out > 0}
enable_aep_goals_in_coi AP_OUTPUT_NONZERO
report_fv -class aep -list
```

来源：User Guide，X-2025.06-SP1，第 373–375 页。

### 6.4 `fvwaive`：对可豁免目标记录豁免

```text
fvwaive <property-name>
```

**参数解释。** 指定已经审核、需要保留为例外的目标。AEP 豁免流程要求在读入设计之前设置 `fml_aep_enable_waiver_flow`。

**用法与结果。** 豁免并不会把目标变成已证明。User Guide 明确说明该机制不支持 assert 类型的 AEP，因此不能把这个命令当成通用的断言免检方式。FCA 还有覆盖目标豁免，应当区分不同的应用和目标类型。

```tcl
set_fml_var fml_aep_enable_waiver_flow true
# 在设计读入和目标审核完成后执行：
fvwaive reviewed_waivable_goal
```

来源：User Guide，X-2025.06-SP1，第 383–384、424–428 页。

### 6.5 `fvunwaive`：撤销目标豁免

```text
fvunwaive <property-name>
```

**参数解释。** 指定已有豁免的目标名称。

**用法与结果。** 规格、RTL 或输入约束发生变化后，应当撤销不再有依据的旧豁免并重新分析；如果只是重新导入旧的排除文件，就会继承过时的结论。

```tcl
fvunwaive reviewed_waivable_goal
report_fv -list
```

来源：User Guide，X-2025.06-SP1，第 383–384、424–428 页。

### 6.6 `save_waiver_file`：保存当前目标豁免

```text
save_waiver_file -file <filename>
```

**参数解释。** `-file` 指定输出文件；在 AEP 用法中保存可复用的 XML 豁免内容。

**用法与结果。** 文件扩展名并不能决定文件的真实格式。保存时应当同时保存豁免理由、适用的设计版本和审核人；工具生成的文件通常不足以表达全部的工程依据。

```tcl
save_waiver_file -file aep_waivers.xml
```

来源：User Guide，X-2025.06-SP1，第 384 页。

### 6.7 `read_waiver_file`：读入已审核豁免

```text
read_waiver_file -elfiles <filename>
```

**参数解释。** `-elfiles` 在本版 AEP 用法中指定之前保存的豁免文件。

**用法与结果。** 应当在目标已经建立、正式检查之前导入，并确认匹配的目标数量。名称变化导致豁免未匹配，与目标无需再检查，是两种不同的情况。

```tcl
read_waiver_file -elfiles aep_waivers.xml
report_fv -list
check_fv -block
```

来源：User Guide，X-2025.06-SP1，第 384 页。

## 7. 常见问题与处理方案

**问题 A：数组越界属性失败。** 检查索引值、数组的实际维度、索引来源，以及它是否属于非法但允许的输入；如果设计应当防御非法访问，就修复输入检查和返回行为。**问题 B：`full_case` 告警。** 检查组合分支是否覆盖了所有合法编码；如果某些编码应视为非法，先明确它们的可达性，不能仅靠注释 `full_case` 来掩盖。**问题 C：状态机活锁告警。** 查看反例循环，确认是否需要外设公平假设。**问题 D：属性数为零。** 检查 AEP 开关、RTL 类型和提取范围，不要因此推断“RTL 不存在问题”。

### 用例：审查豁免

```tcl
fvwaive <property_name>
save_waiver_file -file reviewed_aep.el
```

建议在豁免记录中独立写明编号、原始现象、为什么不是设计缺陷、所依据的系统规格、最后审查日期与责任人。`fvwaive` 只是结果管理，并不会让设计行为变正确。

## 8. 推荐的 AEP + FPV 双阶段工作方法

先在整段 RTL 范围内运行 AEP，发现基础实现风险；然后再针对关键模块编写 FPV 属性，以覆盖具体的时序与功能规格。AEP 发现的真缺陷，应当补充成可以长期回归的手工断言（如果合适）。AEP 发现的假阳性，应当检查真实前提并保留说明；不能简单地添加 `assume` 让它消失。

对于大型 SoC，可以先用 AEP 检查地址解码、寄存器文件索引、FIFO 状态机、宽窄运算及三态总线。对于自动生成属性无法证明的情况，可以单独分组并提升资源，而不是影响所有检查的分析时间。

## 9. 官方参考

User Guide §10：第 362～385 页；§3.5 属性 class 与 type；§7 反例与状态；Quick Reference Guide 的 AEP 章节。本文对检查类型的简述属于独立归纳，并不是逐页复制官方表格。
