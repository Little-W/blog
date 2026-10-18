---
title: FLP/LPC：低功耗形式验证指南
tags: [形式验证, 数字IC, VC Formal, FLP, LPC]
---

# FLP / LPC：低功耗连通性形式验证使用指南

## 1. 核心问题

低功耗 SoC 通过不同电源域、电源关断、隔离单元、保持寄存器和电源控制器降低功耗。在普通 RTL 连通性检查中，信号可能看起来已经正确相连，但电源域关断后仍可能把未知或无效数据送到始终通电的逻辑；隔离控制接反，可能导致不同电源状态下的功能不符合规格。

FLP CC 将 RTL 与 UPF（Unified Power Format，IEEE 1801）电源意图结合，验证在相应电源状态及使能条件下，指定源与目的的连通性规则是否成立。它不只是检查 UPF 文件能否成功解析，还要分析电源意图对 RTL 的功能影响。

![低功耗域和隔离输出](插图/14_FLP电源域.svg)

## 2. 重要对象

| 对象 | 解释 | 例子 |
| --- | --- | --- |
| Power domain | 电源控制范围 | 可关断图像处理域 |
| Supply net / set | 电源网络与电压状态 | `VDD_CORE` |
| Isolation | 电源关断时对跨域输出进行限制 | 下游锁定为 0 |
| Retention | 保存关断前需要恢复的状态 | 睡眠前的配置位 |
| Power state table | 组合描述电源合法状态 | 工作、待机、关断 |
| Power controller | 控制电源和隔离时序 | 关断前先使能隔离 |

电源意图描述设计在哪些供电条件下工作，隔离和保持策略分别保护跨域输出与需要保存的状态。常供电控制器必须在被控制电源域关闭后仍能驱动正确的控制信号。验证时应分别覆盖正常供电、掉电、恢复三个阶段，并核对隔离控制相对于供电变化的先后关系。

要求明确：何时隔离、生效电平是什么、钳位值为何、是否需要恢复保存状态。普通 CC 的组合连接模型不足以单独表达所有电源关闭的效果。

## 3. 该版本的工作模式

Quick Reference Guide 的低功耗流程不是直接输入 `set_fml_appmode FLP`，而是：

```tcl
set_fml_appmode CC
fvlp_instrument -type "iso pnm"
set_fml_var fvlp_enable_pst_constraint true
read_file -top lp_top -format sverilog -vcs {-f filelist.f}
read_upf power_intent.upf
create_clock clk -period 100
create_reset rst_n -sense low
```

`fvlp_instrument` 启用低功耗语义插桩，`-type` 可根据设计需要选择 `iso`、`pnm`、`ret` 等，具体支持类型参照 UG 1043 页。插入低功耗支持、读入 RTL/UPF 的顺序需要与安装版本示例一致。`read_upf` 中的路径必须指向该工程真实 UPF 文件。

### 3.1 原生低功耗检查模板完整源码

UPF、电源状态及隔离策略必须来自实际项目。本模板的省略对象属于明确的待配置输入，不是已提供的完整低功耗工程。

**保存为 `案例工程/templates/flp_low_power.tcl`：**

<!-- source-begin: 案例工程/templates/flp_low_power.tcl -->

```tcl
# 低功耗 CC：必须有 RTL、UPF、电源状态表、真正的电源域信号。
# 不支持普通 CC 的 delayed connectivity check（UG 第 1041 页）。
error "此文件是 FLP 教学模板：须先提供 UPF、电源控制与隔离策略"
# set_fml_appmode CC
# fvlp_instrument -type "iso pnm"
# set_fml_var fvlp_enable_pst_constraint true
# read_file -top lp_top -format sverilog -vcs {-f filelist.f}
# read_upf /project/upf/power_intent.upf
# create_clock clk -period 100
# create_reset rst_n -sense low
# add_cc -src ... -dest ... -lpa_type ... ;# 填写真实端点与类型
# check_fv -block
# report_fv -verbose
```

<!-- source-end -->

## 4. 最小系统案例

上游处理单元运行于可关断电源域 `PD_A`，下游控制单元在始终通电的 `PD_AON`。上游输出 `data_o` 经隔离单元到下游 `data_i`。规格：当 `PD_A` 供电正常且隔离关闭时，`data_i` 应等于 `data_o`；当 `PD_A` 关断时，`data_i` 应被钳位为零。

功能连接与隔离钳位应分别检查。普通端点关系通过低功耗条件下的连通性检查定义；钳位检查则直接指定端口或引脚、隔离单元所在位置以及应保持的钳位值。`fvlp_check_clamp_value` 不接受示例旧稿中混入的 `-lpa_type` 或 `-enable`，这些参数不能从其他命令移植过来。

```tcl
fvlp_check_clamp_value u_aon/data_i -location parent -clamp_value 0
```

该调用要求已经读入实际 RTL 与 UPF，并完成低功耗模型配置；`u_aon/data_i` 必须替换为展开设计中真实的端口或引脚。电源域、隔离使能和供电关系应由 UPF 与设计共同确定，不由这条命令凭空创建。

### 4.1 完整源码：先理解逻辑隔离关系

为了不把 UPF 环境和普通逻辑混在一起，以下单独给出理想隔离控制的 RTL 与 SVA。这里的 `source_power_good` 只是布尔输入，不会使仿真器或形式工具真的把某个电源域关断，也没有建立掉电后的未知值模型。

#### 4.1.1 完整逻辑模型

源电源不正常时，理想控制模型立即使能隔离；真实系统的电源控制时序、跨时钟处理和故障行为必须另行验证。

**保存为 `案例工程/rtl/lp_isolation_demo.sv`：**

<!-- source-begin: 案例工程/rtl/lp_isolation_demo.sv -->

```systemverilog
// 仅表示理想的逻辑隔离关系，不模拟电源关断产生的未知值。
module lp_isolation_demo (
  input  logic       clk, rst_n,
  input  logic       source_power_good, isolation_request,
  input  logic [7:0] source_data,
  output logic       isolation_enable,
  output logic [7:0] destination_data
);
  // 理想控制模型：源电源不正常时强制隔离；真实 PMC 必须另行验证。
  assign isolation_enable = !source_power_good || isolation_request;
  assign destination_data = isolation_enable ? 8'h00 : source_data;
endmodule
```

<!-- source-end -->

#### 4.1.2 完整 SVA

**保存为 `案例工程/formal/lp_isolation_demo_props.sv`：**

<!-- source-begin: 案例工程/formal/lp_isolation_demo_props.sv -->

```systemverilog
module lp_isolation_demo_props (
  input logic clk, rst_n,
  input logic source_power_good, isolation_request, isolation_enable,
  input logic [7:0] source_data, destination_data
);
  ap_isolation_clamp: assert property (@(posedge clk) disable iff (!rst_n)
    isolation_enable |-> destination_data == 8'h00);
  ap_power_off_clamp: assert property (@(posedge clk) disable iff (!rst_n)
    !source_power_good |-> destination_data == 8'h00);
  ap_normal_connection: assert property (@(posedge clk) disable iff (!rst_n)
    source_power_good && !isolation_request
      |-> destination_data == source_data);
  cp_off_on_sequence: cover property (@(posedge clk) disable iff (!rst_n)
    !source_power_good ##1 source_power_good && !isolation_request);
endmodule

bind lp_isolation_demo lp_isolation_demo_props u_lp_props (.*);
```

<!-- source-end -->

#### 4.1.3 文件列表

**保存为 `案例工程/filelist_fpv_lp_logic_demo.f`：**

<!-- source-begin: 案例工程/filelist_fpv_lp_logic_demo.f -->

```text
./rtl/lp_isolation_demo.sv
./formal/lp_isolation_demo_props.sv
```

<!-- source-end -->

#### 4.1.4 普通 FPV 练习脚本

**保存为 `案例工程/scripts/fpv_lp_logic_demo.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_lp_logic_demo.tcl -->

```tcl
# 从案例工程目录执行；结果必须以本机 VC Formal 日志为准。
set_fml_appmode FPV
read_file -top lp_isolation_demo -sva -format sverilog -vcs {-f filelist_fpv_lp_logic_demo.f}
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
# 从包含“案例工程”目录的上一级目录开始。
cd 案例工程
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_lp_logic_demo.tcl -batch 2>&1 | tee logs/fpv_lp_logic_demo.log
```

**与原生 FLP 的区别。** 上述练习说明隔离钳位和正常连接的布尔关系，并不验证 UPF 插入位置、电源网络、保持单元或电源关断行为。真正的 FLP 检查还需要第 3 节列出的 UPF 和工具低功耗配置，不能用本节 FPV 结果替代。

## 5. UPF 可信性与 PMC

UPF 应由电源架构负责人确认电源域划分、电源状态、隔离和保持策略；必要时还需为真实电源管理控制器（PMC）建立环境模型。UG §24.2 提到可为不存在于形式 RTL 的 PMC 建模其外部行为，不能把这种模型误当作 RTL 自身需要被证明的功能。错误地假设所有电源域永久打开，将直接屏蔽很多低功耗缺陷。

## 6. FLP CC 和普通 CC 的重要区别

**User Guide 第 1041 页明确说明：FLP CC 不支持连通性延迟检查。** 因此不能直接把普通 CC 中的 `path_delay` 用例复制到低功耗检查环境。对于寄存器延迟、时序握手或跨时钟的低功耗交互，需要以另一套适当的功能属性或等价流程验证，而非宣称 FLP CC 已证明它们。

## 7. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fvlp_instrument` | 选择低功耗模型插装内容 |
| `read_upf` | 将电源意图装入当前设计 |
| `get_fvlp_free_supply_nets` | 查询未驱动的自由电源 |
| `fvlp_set_supply_aon` | 将指定电源设置为常开 |
| `fvlp_set_supply_onoff_net` | 用 RTL 控制信号驱动电源开关状态 |
| `fvlp_check_clamp_value` | 检查端口或引脚的隔离方式 |
| `flp_cc_vacuity_gen_split` | 拆分低功耗空洞通过原因 |
| `flp_cc_vacuity_report` | 解释低功耗属性的空洞状态 |
| `fvlp_cc_print_path` | 显示连通性属性经过的电源相关对象 |
| `fvlp_cc_trace_fanin` | 追踪供电引脚的驱动来源 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 7.1 `fvlp_instrument`：选择低功耗模型插装内容

```text
fvlp_instrument [-type <type_list>]
```

**参数解释。** `-type` 接受 iso、ret、pnm、bind_generics、ret1。iso 表示隔离策略，ret 表示保持策略，pnm 表示供电网络模型；后两类名称在本节作为可选插装类型列出，但没有足够解释可把它们当成通用推荐配置。典型低功耗连通性设置使用 `{iso pnm ret}`。

**用法与结果。** 在建立 FLP CC 流程时先选择 CC 应用模式并声明插装类型，再读取 RTL 与 UPF。缺少隔离或供电模型会改变被分析对象，不能把有 UPF 文件名但没有相应模型的运行认作完成低功耗检查。

```tcl
set_fml_appmode CC
fvlp_instrument -type {iso pnm ret}
read_file -top top -format sverilog -vcs "-f rtl.f"
read_upf top.upf
```

来源：User Guide，X-2025.06-SP1，第 1043–1044 页。

### 7.2 `read_upf`：将电源意图装入当前设计

```text
read_upf <upf_file>
```

**参数解释。** 位置参数是 UPF 文件路径；文件中的对象名称和作用域必须与已经读入的设计对应。UG 在本节使用此简单形式，没有在本章展开平台所有 UPF 读入选项。

**用法与结果。** 读取 UPF 后工具建立电源网络、隔离、保持及掉电相关模型。额外的形式包装层可能需要自己的电源域并设置 DUT 作用域，不能直接把原 SoC UPF 顶层路径照搬到另一层包装中。此命令只装入电源意图，不替代时钟、复位和缺省 PMC 行为的建模。

```tcl
fvlp_instrument -type {iso pnm ret}
read_file -top formal_top -format sverilog -vcs "-f rtl.f"
read_upf formal_top.upf
```

来源：User Guide，X-2025.06-SP1，第 1043–1046 页。

### 7.3 `get_fvlp_free_supply_nets`：查询未驱动的自由电源

```text
get_fvlp_free_supply_nets
```

**参数解释。** 本节展示无参数查询，其输出是供电模型中没有被驱动的自由 supply 列表。原文把命令与示例返回列表排在同一行，列表不是必须追加的输入参数。

**用法与结果。** 自由电源不是自动“始终上电”。未建模的供电状态可能任意变化，从而形成不符合系统设计的掉电路径；也可能暴露实际缺少电源约束的问题。先查询，再根据真实电源控制设计决定哪些常开、哪些受 RTL 控制。

```tcl
get_fvlp_free_supply_nets
```

来源：User Guide，X-2025.06-SP1，第 1058 页。

### 7.4 `fvlp_set_supply_aon`：将指定电源设置为常开

```text
fvlp_set_supply_aon <supply_list>
```

**参数解释。** 位置参数为 Tcl 列表，例如 `{VDD_AON VDD_RET}`；不要把原文展示列表中的逗号复制进正常的空白分隔 Tcl 列表。

**用法与结果。** 只把架构上确实常开的电源设为 AON。为了减少失败而把所有可掉电域都常开，会删除隔离和保持最需要检查的情形。UG 的示例日志给出工具采用的供电值，不代表可用该命令描述任意模拟电压或地网。

```tcl
get_fvlp_free_supply_nets
fvlp_set_supply_aon {VDD_AON VDD_RET}
```

来源：User Guide，X-2025.06-SP1，第 1058–1059 页。

### 7.5 `fvlp_set_supply_onoff_net`：用 RTL 控制信号驱动电源开关状态

```text
fvlp_set_supply_onoff_net -netname <rtl_signal> <supply_list>
```

**参数解释。** `-netname` 指定 RTL 中的开关控制信号，末尾列表指定要受它控制的 supply。

**用法与结果。** 该关联使供电状态随控制信号变化，但它不自动实现完整的电源管理时序协议。隔离先后顺序、保持控制和复位恢复仍需由 PMC 或形式环境描述，并用相应覆盖目标确认能到达关电、上电场景。

```tcl
fvlp_set_supply_onoff_net -netname pmc.core_power_on {VDD_CORE}
```

来源：User Guide，X-2025.06-SP1，第 1059 页。

### 7.6 `fvlp_check_clamp_value`：检查端口或引脚的隔离方式

```text
fvlp_check_clamp_value <port_or_pin>
  [-location <parent|self|default>]
  [-clamp_value <0|1|LATCH|BASIC>]
```

**参数解释。** 位置参数选择端口或引脚；`-location` 限定隔离位置；`-clamp_value` 指定期望隔离行为。0/1 检查固定钳位，LATCH 对应保持原值，BASIC 创建 LPA_BASIC 检查以验证没有定义隔离。

**用法与结果。** 原 UG 命令名是 `fvlp_check_clamp_value`，不能因快速参考或旧笔记缩写而删去前缀中的 v。它用于针对隔离模型生成检查，不只是打印 RTL 引脚当前电平。

```tcl
fvlp_check_clamp_value u_core/data_out \
  -location parent -clamp_value 0
```

来源：User Guide，X-2025.06-SP1，第 1046 页。

### 7.7 `flp_cc_vacuity_gen_split`：拆分低功耗空洞通过原因

```text
flp_cc_vacuity_gen_split [<property_name>]
```

**参数解释。** 省略属性时处理默认的空洞属性集合；提供名称则只拆分该属性。生成 src、dest、iso、src_dest、src_iso、dest_iso 六类辅助 cover，分别检查供电和隔离条件的单独及联合可达性。

**用法与结果。** 辅助 cover 在本流程中不一定显示在普通属性表里，需要执行证明后通过专门报告查看。某个条件单独可达不意味着它与另一个条件能同时成立，联合 cover 正是用于找出这种环境互斥。

```tcl
flp_cc_vacuity_gen_split cc_core_to_bus
check_fv -block
flp_cc_vacuity_report cc_core_to_bus
```

来源：User Guide，X-2025.06-SP1，第 1047–1048 页。

### 7.8 `flp_cc_vacuity_report`：解释低功耗属性的空洞状态

```text
flp_cc_vacuity_report [<property_name>]
```

**参数解释。** 读取拆分生成并运行后的辅助 cover 状态；提供属性名限制范围。

**用法与结果。** 当源电源可开、目的电源可开但隔离条件不可达时，报告会把这些情况区分开。修复应针对 UPF、PMC 或使能规格，而不是直接关闭 vacuity 检查或把全部电源强制常开。

```tcl
flp_cc_vacuity_report cc_core_to_bus
```

来源：User Guide，X-2025.06-SP1，第 1048 页。

### 7.9 `fvlp_cc_print_path`：显示连通性属性经过的电源相关对象

```text
fvlp_cc_print_path <property_name>
```

**参数解释。** 位置参数为已经生成的低功耗连通性属性名称；报告列出其源与目的之间的对象。

**用法与结果。** 适合检查中间电源域、隔离单元、开关及连接。路径存在仅是结构信息，仍需结合反例中的电源状态和隔离使能判断为何检查失败。

```tcl
fvlp_cc_print_path cc_core_to_bus
```

来源：User Guide，X-2025.06-SP1，第 1064 页。

### 7.10 `fvlp_cc_trace_fanin`：追踪供电引脚的驱动来源

```text
fvlp_cc_trace_fanin -prop <property_name> -dest <destination> [-incr]
```

**参数解释。** `-prop` 指定分析属性，`-dest` 指定待追踪节点。发现并行驱动时，把其中一条驱动作为下一次 `-dest`，加 `-incr` 继续追踪。

**用法与结果。** 它主要帮助分析 PG 引脚和 supply 的连接，不能与普通 RTL 数据扇入报告混为一谈。每次迭代保留前一次列出的节点，直到找到真实供电端口、开关或未连接位置。

```tcl
fvlp_cc_trace_fanin -prop cc_core_to_bus -dest PD_CORE/PSW/VDD
fvlp_cc_trace_fanin -prop cc_core_to_bus -dest PD_CORE/VDDA -incr
```

来源：User Guide，X-2025.06-SP1，第 1064 页。

## 8. 三个需要分别检查的场景

**正常通电：**隔离关闭时功能数据能够到达下游；**关断阶段：**隔离在失去电源前启动、钳位值正确并持续；**恢复阶段：**电源回到合法状态后，对隔离解除、复位和保持恢复的顺序进行验证。第三阶段常涉及跨周期时序，可能需要 FPV 与电源控制器的状态属性配合。

## 9. 调试方法

从失败的低功耗连接属性开始，检查 UPF 的源目的供电网络、`iso_en` 及电源状态，再查看波形或 Power Browser。特别注意电源状态表是否包含不实际的组合、隔离使能是否被形式环境错误固定、以及低功耗插桩是否真正参与了编译。不能仅因为正常供电情况下路径连接正确就结束验证。

## 10. 参考

User Guide §24（1040～1065 页），Quick Reference Guide Low Power Connectivity Checking 部分；涉及 UPF 语法时还应参考项目采用的 IEEE 1801 版本与电源意图开发规范。
