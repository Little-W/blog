# SEQ：顺序等价检查使用指南

## 1. 为什么不能只比较组合逻辑

RTL 优化常常改变状态寄存器数量、编码、流水线或时钟门控。如果参考版本和实现版本内部结构不同，但对外部可观察输入输出仍符合约定，则二者可能功能等价。SEQ 比较两个顺序系统：参考模型（Specification）和实现模型（Implementation），通过寻找状态对应关系、输入关系和输出关系来检查其等价性。

SEQ 可用于 RTL 重构、状态机重编码、寄存器重定时、时钟门控优化以及某些微架构变化。需要明确：**等价的定义离不开观测点、初始状态、输入条件与时间对应关系**。如果实现比参考多一拍输出延迟，未经处理的逐周期相等检查可能失败，而根据允许的事务延迟重写比较规则后则可能成立。

![SEQ 两个版本的比较](插图/10_SEQ比较.svg)

## 2. 初学者例子：两种计数器写法

两边都是四位模 16 计数器；不是 FPV 章的模 10 计数器。接口相同，代码组织不同。

### 2.1 参考实现完整源码

使能时加一，不使能时通过未赋值保持状态。

**保存为 `案例工程/rtl/counter_spec.sv`：**

<!-- source-begin: 案例工程/rtl/counter_spec.sv -->

```systemverilog
module counter_spec(input logic clk, rst_n, en, output logic [3:0] q);
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 4'd0;
    else if (en) q <= q + 4'd1;
endmodule
```

<!-- source-end -->

### 2.2 待比较实现完整源码

将使能扩展为四位加数；为零时相当于保持，为一时相当于递增。

**保存为 `案例工程/rtl/counter_impl.sv`：**

<!-- source-begin: 案例工程/rtl/counter_impl.sv -->

```systemverilog
module counter_impl(input logic clk, rst_n, en, output logic [3:0] q);
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 4'd0;
    else        q <= q + {3'b000,en};
endmodule
```

<!-- source-end -->

### 2.3 故意不等价版本

同样使用 `counter_impl` 作为模块名，但使能时加二。正确版与错误版只能选一个加入本次比较。

**保存为 `案例工程/rtl/counter_impl_bad.sv`：**

<!-- source-begin: 案例工程/rtl/counter_impl_bad.sv -->

```systemverilog
// 故意错误版本：模块名仍为 counter_impl；不要与正确版本同时编译。
module counter_impl(input logic clk, rst_n, en, output logic [3:0] q);
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) q <= 4'd0;
    else        q <= q + (en ? 4'd2 : 4'd0);
endmodule
```

<!-- source-end -->

在合法初始化和对应关系下，前两种写法预期等价，第三种则可在使能后产生差异。预期结果不代替实际的工具证明。

## 3. 编译两个独立设计库并运行

### 3.1 正确实现的完整 SEQ 脚本

参考设计放入 `spec` 库，待比较设计放入 `impl` 库。此脚本直接列出 RTL 路径，没有额外未展示的文件列表。`map_by_name` 后必须查看对应结果，不能认为名字相同就完成了初始化审查。

**保存为 `案例工程/scripts/seq_counter.tcl`：**

<!-- source-begin: 案例工程/scripts/seq_counter.tcl -->

```tcl
set_fml_appmode SEQ
analyze -format sverilog -library spec -vcs {./rtl/counter_spec.sv}
analyze -format sverilog -library impl -vcs {./rtl/counter_impl.sv}
elaborate_seq -spectop counter_spec -impltop counter_impl
create_clock clk -period 100
create_reset rst_n -sense low
map_by_name
report_seq_mappings
check_fv_setup -block
check_fv -block
report_fv -list
```

<!-- source-end -->

### 3.2 错误实现的完整 SEQ 脚本

只替换待比较侧的源文件，参考侧和环境条件不变。

**保存为 `案例工程/scripts/seq_counter_bad.tcl`：**

<!-- source-begin: 案例工程/scripts/seq_counter_bad.tcl -->

```tcl
set_fml_appmode SEQ
analyze -format sverilog -library spec -vcs {./rtl/counter_spec.sv}
analyze -format sverilog -library impl -vcs {./rtl/counter_impl_bad.sv}
elaborate_seq -spectop counter_spec -impltop counter_impl
create_clock clk -period 100
create_reset rst_n -sense low
map_by_name
report_seq_mappings
check_fv_setup -block
check_fv -block
report_fv -list
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 从包含“案例工程”目录的上一级目录开始。
cd 案例工程
mkdir -p logs
set -o pipefail
vcf -f scripts/seq_counter.tcl -batch 2>&1 | tee logs/seq_counter.log
vcf -f scripts/seq_counter_bad.tcl -batch 2>&1 | tee logs/seq_counter_bad.log
```

这里保留原有教学脚本的初始化框架；实际项目应检查两个设计的复位状态和初始状态关系，不能把 `create_reset` 或名称对应当作“任意初态自动一致”。如需额外复位激励，应按 SEQ 的本地运行流程补充并记录。

## 4. 对应关系是什么

匹配可基于相同名称的输入、输出和部分状态，常用 `map_by_name`，其结果可通过 `report_seq_mappings` 审查；更复杂时可用 `seqmap`、`sequnmap` 或读入人工编写的匹配文件。不能仅因为“映射出来很多对象”就认为匹配一定正确；应特别检查复位极性、寄存器位宽、符号扩展、被优化掉的状态和不同流水线阶段的关系。

### 4.1 未初始化位的影响

若参考版和实现版的寄存器初态均任意，两者不一定要求从任意**独立**初态开始都立刻一致：合理的等价证明需要定义可接受的初始状态关系。将所有未初始化位置零的 `seq_config -map_uninit -map_x zero` 是该版本示例中的一种选择，但只在硬件上电模型允许时使用，否则可能忽略真实启动差异。

## 5. 顺序优化类型与对应关系

| 改动 | 主要挑战 | 需要关注的比较条件 |
| --- | --- | --- |
| 组合表达式重写 | 表达式结构变化 | 相同输入下输出是否同拍一致 |
| 状态机重新编码 | 状态变量命名与编码变化 | 状态关系、输出一致性 |
| 加入时钟门控 | 等效使能与采样行为 | 门控使能关闭时是否保持 |
| 寄存器重定时 | 状态位置与延迟变化 | 正确建立跨状态对应 |
| 流水线深度改变 | 输入到输出周期可能变化 | 确认规格是否允许变化 |
| 微架构重构 | 内部状态数量可能不同 | 匹配可观察事务行为 |

等价检查必须比较相同的外部行为，而不能只依赖内部寄存器名字相似。表达式重写通常可按同拍值比较；状态重编码可能需要状态关系；流水级调整则必须明确输入接受与输出有效之间的周期关系。建立对应关系是为了构造正确的比较问题，不是允许任意把不一致信号强制认为相等。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `elaborate_seq` | 建立参考与实现两个设计 |
| `map_by_name` | 按名称建立两侧对应关系 |
| `seqmap` | 增加人工指定的对应关系 |
| `sequnmap` | 移除或禁止自动对应 |
| `seq_config` | 配置比较策略、未知值与调试 |
| `get_seq_mappings` | 返回可编程查询的对应集合 |
| `report_seq_mappings` | 报告对应对象与未对应原因 |
| `get_seq_equivalences` | 查询内部等价检查状态 |
| `seq_debug` | 计算失败比较的诊断信息 |
| `seq_debug_report` | 输出比较失败分析 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 6.1 `elaborate_seq`：建立参考与实现两个设计

```text
elaborate_seq -spectop <reference_top> -impltop <implementation_top>
              [-speclib <reference_library>] [-impllib <implementation_library>]
elaborate_seq -spectop <top> -same_design
```

**参数解释。** `-spectop`、`-impltop` 分别指定参考和实现顶层。分析时使用非默认 spec、impl 库名，需要相应设置 `-speclib`、`-impllib`。`-same_design` 从同一个已分析设计建立两份实例，不必重复 `analyze`，也不再要求 `-impltop`。

**用法与结果。** 两个版本模块重名时，用库隔离，不能把两个定义放进同一个普通工作库后指望工具自动区分。`-same_design` 适合同一 RTL 在不同配置下的比较，不会自动建立配置差异；差异仍由两侧的常量、模式和环境设置表达。

```tcl
set_fml_appmode SEQ
analyze -format sverilog -library spec ref.sv
analyze -format sverilog -library impl impl.sv
elaborate_seq -spectop ref_top -impltop impl_top
```

来源：User Guide，X-2025.06-SP1，第 520–521 页。

### 6.2 `map_by_name`：按名称建立两侧对应关系

```text
map_by_name [-exclude <signals>] [-blackbox] [-undriven] [-abstraction]
  [-infer_unresolved_ports] [-map_type <types>]
  [-align_mismatch_bitwidth <alignment>] [-clock <clock>]
  [-edge <posedge|negedge|edge>]
  [-spec_latency <cycles>] [-impl_latency <cycles>]
  [-condition <expression>]
```

**参数解释。** `-exclude` 排除不应自动对应的信号；`-blackbox` 包括同名黑盒和编译存储器抽象；默认还要求其底层模块名相同。`-undriven` 对应未驱动信号，`-abstraction` 对应抽象对象。`-map_type` 限制对象类别，例如只比较 output。`-align_mismatch_bitwidth` 指定不同位宽按 lsb 或 msb 对齐，使用前确认哪一部分具有规格意义。

`-clock` 与 `-edge` 决定比较采样事件，默认边沿为 posedge。`-spec_latency`、`-impl_latency` 设置两侧比较延迟；`-condition` 限定相等检查成立的条件。未解析模块的端口方向可以由 `-infer_unresolved_ports` 辅助推断。此处展开 UG 在使用章节逐项说明的选项，不将其误标为独立平台命令参考的全部选项。

**用法与结果。** 应在 `sim_run` 之前建立对应。初始化之后才执行可能报错；即使降低错误等级，生成的约束种类也可能从环境约束变成普通属性约束，初始状态因此不再等价。输入和黑盒输出之间的相等通常形成假设；输出和黑盒输入之间的相等形成待证明目标，二者不能混淆。

```tcl
seqmap -port spec.request impl.req
map_by_name -exclude {debug_out}
report_seq_mappings -list
# 输出存在明确的采样时钟时，可单独建立带延迟的检查。
map_by_name -map_type {output} -clock spec.clk \
  -spec_latency 3 -impl_latency 3
```

来源：User Guide，X-2025.06-SP1，第 522–528 页。

### 6.3 `seqmap`：增加人工指定的对应关系

```text
seqmap [-name <name>] [-port] [-exact] <spec_expression> <impl_expression>
```

**参数解释。** 两个位置参数可以是信号、实例或匹配表达式。实例形式在两侧实例下按寄存器名称寻找对应；通配形式只接受符合类别和位宽规则的对象。`-name` 给这条规则命名，多对匹配会产生带序号的派生名称；名称不能重复。`-port` 用于端口对象，`-exact` 表示精确信号对，而不是前缀搜索。

**用法与结果。** 寄存器匹配主要为求解器提供提示，并不意味着未经证明就把内部寄存器强制设成相等。端口对应则可生成输入假设和输出断言，必须按接口规格审查。默认表达式匹配中，寄存器与未驱动信号不能跨类别对应。

```tcl
seqmap -name state_pair -exact spec.state impl.state_reg
seqmap -port spec.req impl.request
map_by_name
report_seq_mappings -list
```

来源：User Guide，X-2025.06-SP1，第 558–560 页。

### 6.4 `sequnmap`：移除或禁止自动对应

```text
sequnmap [-port] [-exact] <spec_expression> <impl_expression>
sequnmap -name <mapping_name>
```

**参数解释。** 按信号或实例表达式移除一组关系，或仅用 `-name` 指定已命名关系。`-name` 不能与两个位置表达式一起使用。`-port` 作用于端口对应，`-exact` 避免前缀匹配扩大范围。

**用法与结果。** 移除端口对应可能删除已经生成的属性；移除输入约束会使依赖旧约束的 proven、vacuous、uncoverable 结果失效。被显式取消的对应在后续 `map_by_name` 或 `check_fv` 中可能继续被跳过，因此不能把该命令理解为仅清除报告中的一行。

```tcl
sequnmap -name state_pair
sequnmap -port spec.debug_in impl.debug_in
report_seq_mappings -type not_mapped -list
```

来源：User Guide，X-2025.06-SP1，第 559–561 页。

### 6.5 `seq_config`：配置比较策略、未知值与调试

```text
seq_config [-specprefix <prefix>] [-implprefix <prefix>]
  [-recipe <recipe>] [-map_uninit] [-map_x <zero|one|safe|bestmatch|none>]
  [-map_counters] [-extended_mapping] [-latch_scope <spec|impl|none>]
  [-auto_failure_debug <ON|OFF>] [-enable_rca_path <ON|OFF>]
  [-map_diff_bb_designs <ON|OFF>] [-enable_clock_coi_analysis <true|false>]
  [-infer_unresolved_ports <ON|OFF>]
  [-enable_infer_blackbox_port_direction <true|false>]
```

**参数解释。** `-specprefix`、`-implprefix` 默认 spec、impl。`-recipe` 可选 orch_generic_easy、orch_generic_low、orch_generic_medium、orch_generic_hard，默认 medium。`-map_uninit` 在复位时按名称对应未初始化寄存器；`-map_counters` 对应抽象计数器；`-extended_mapping` 扩展人工对应的对象搜索范围。`-latch_scope` 选择对哪一侧进行锁存器处理。

`-map_x` 默认 none：zero/one 将工具产生的未定义值固定为 0/1，safe 对应同名但位宽不同的信号，bestmatch 优先按名称对应否则置零，none 保留未知行为。它不处理 snip；切断的两侧信号需另行建立关系。`-auto_failure_debug` 控制失败分析；`-enable_rca_path` 默认 ON。`-map_diff_bb_designs` 默认 OFF，开启后允许同名但底层模块不同的黑盒对应。未解析端口推断默认 ON，所有黑盒端口方向推断默认 false；`-enable_clock_coi_analysis` 默认 false。

**用法与结果。** 这些选项不只是运行速度设置。尤其把 X 固定为常量、对应未初始化状态、允许不同黑盒对应，都改变了比较问题或其抽象方式。应在报告中保留设置及理由，并先确认正常初始化下的行为，不能为了消除失败而直接使用 bestmatch。

```tcl
seq_config -recipe orch_generic_medium
seq_config -map_x none
seq_config -auto_failure_debug ON
seq_config -map_diff_bb_designs OFF
```

来源：User Guide，X-2025.06-SP1，第 562–564 页。

### 6.6 `get_seq_mappings`：返回可编程查询的对应集合

```text
get_seq_mappings [-type <mapped|not_mapped>]
  [-map_type <types>] [-skip_map_type <types>] [-clear_mem]
```

**参数解释。** `-map_type` 支持 input、output、bbin、bbout、absin、absout、sequential、undriven、unloaded、explicit_x、undefined_x、net，以及 auto、all；`-skip_map_type` 排除具体类别。`-type` 区分已对应和未对应，`-clear_mem` 清理之前该命令建立的集合，避免长期脚本累积查询对象。

**用法与结果。** 在 `map_by_name` 后调用。返回值是工具集合，不是普通 Tcl 字符串列表；应用 `foreach_in_collection` 和 `get_attribute` 读取属性。`not_mapped_reason` 比单看未对应数量更有意义，能够区分名称不存在、位宽不同、方向不同等问题。

```tcl
set missing [get_seq_mappings -type not_mapped -map_type input]
foreach_in_collection obj $missing {
  puts "[get_attribute $obj full_name]: [get_attribute $obj not_mapped_reason]"
}
```

来源：User Guide，X-2025.06-SP1，第 545–549 页。

### 6.7 `report_seq_mappings`：报告对应对象与未对应原因

```text
report_seq_mappings [-type <mapped|not_mapped>]
  [-map_type <types>] [-skip_map_type <types>]
  [-backend] [-list] [-verbose] [-no_summary]
  [-sort <ascending|descending>]
```

**参数解释。** 对象类别与 `get_seq_mappings` 相同。`-list` 每对一行，`-verbose` 展开细节，`-no_summary` 去掉汇总；`-sort` 按位宽升序或降序排列。`-backend` 查看求解后端实际采用的对应，不可同时使用 `-map_type`、`-list`、`-verbose`、`-no_summary`。

**用法与结果。** 此命令说明“哪些对象建立了关系”，不是“哪些比较已经证明成功”。默认新流程先给类别汇总，需显式加 `-list` 才逐项显示。最终等价结论仍由输出比较和必要的约束审查决定。

```tcl
report_seq_mappings -map_type all -list
report_seq_mappings -type not_mapped -verbose
report_seq_mappings -backend
```

来源：User Guide，X-2025.06-SP1，第 550–558 页。

### 6.8 `get_seq_equivalences`：查询内部等价检查状态

```text
get_seq_equivalences [-status <success|failed|bounded|no_status>]
                     [-id <integer>]
```

**参数解释。** `-status` 筛选内部等价点状态；`-id` 选择报告中指定的内部等价编号。success 是内部检查成功，failed 是内部不等价，bounded 是有界结果，no_status 可能表示该提示未被使用。

**用法与结果。** 内部寄存器不等价不必然导致输出不等价，例如重编码或不同流水组织可能改变内部状态而保持接口功能。该查询服务于调试和分析，不可用“所有提示必须 success”替代最终输出检查标准。

```tcl
set failed [get_seq_equivalences -status failed]
foreach_in_collection eq $failed {
  puts [get_attribute $eq full_name]
}
```

来源：User Guide，X-2025.06-SP1，第 564–566 页。

### 6.9 `seq_debug`：计算失败比较的诊断信息

```text
seq_debug [-stop] [-block] [<property_list>]
```

**参数解释。** 省略目标列表时对当前适用的失败属性计算；提供属性名则限制范围。`-block` 等待分析完成，`-stop` 停止正在进行的分析。

**用法与结果。** 先运行比较并获得反例，再计算诊断。信息区分第一处不一致、驱动关系不一致、未对应、未驱动、切断、抽象或黑盒影响等类型。这些类型说明反例如何形成，不自动判定是 RTL 错误还是环境设置错误。

```tcl
check_fv -block
seq_debug -block
seq_debug_report -detail verbose
```

来源：User Guide，X-2025.06-SP1，第 584–588 页。

### 6.10 `seq_debug_report`：输出比较失败分析

```text
seq_debug_report [-detail <list|summary|verbose>]
  [-format <text|xml>] [-group_failure <criteria>] [<property_list>]
```

**参数解释。** `-detail` 默认 summary；`-format` 默认 text；`-group_failure` 可按 mismatch、depth、rootcause_type、rootcause_signal 分组。属性列表限制报告范围。

**用法与结果。** 必须先有诊断计算结果。按最早失败深度和共同原因信号分组，可以避免逐条重复检查同一个接口配置错误；XML 格式适合后续脚本汇总，但应保留原属性名称和反例索引。

```tcl
seq_debug -block
seq_debug_report -detail verbose -format text
seq_debug_report -group_failure {depth rootcause_type}
```

来源：User Guide，X-2025.06-SP1，第 587–589 页。

## 7. 如何解释不等价结果

首先判断是否为真实对外行为差异，然后才检查内部状态。推荐按如下顺序：确定失败的输出或检查点；核对两设计的输入在同一采样时刻是否一致；检查复位起始状态；检查 X 与未初始化值策略；检查流水线延迟或时钟门控；最后追踪内部状态分歧最早发生的位置。

**三种不同结论不能混同：**一是明确找到了两者输出行为不一致的反例；二是当前资源下无法证明；三是当前对应关系或抽象造成局部失败。若初始状态和外部协议前提建错，需要修复比较环境而不是简单修改 RTL。

## 8. 高级优化策略

对于寄存器重定时、多时钟门控和大型算术逻辑，可考虑 `seq_config -recipe orch_generic_medium`、`set_fml_var fml_effort high`、`set_seq_abstractions ...` 和分组证明。抽象可能缩小计算量，也可能引入新反例，需要再验证其可实现性。

对复杂关系建议分步骤：证明复位和普通模式的基础等价，确认输入输出映射，再处理新增加的内部状态及特殊操作模式。不要将所有复杂证明一次交给自动命名对应而忽略潜在误配。

## 9. 教学练习

1. 证明 `en ? q+1 : q` 与 `q+en` 在指定位宽下是否一致；注意表达式位宽。
2. 修改实现版，使输出晚 1 拍，观察直接逐拍比较为什么失败。
3. 在实现版增加一个无功能影响的寄存器，分析映射报告和求解结果。
4. 把初始状态改为未定义，比较是否仍成立，并说明真正的硬件上电规格。

## 10. 参考

User Guide §14（517～611 页），尤其设计编译、映射与调试部分；§18 的复杂性分析；Quick Reference Guide SEQ 章节。对比较多周期事务而非逐拍行为的需求，也可对照 [DPV.md](DPV.md)。
