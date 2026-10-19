---
title: FLP/LPC：低功耗形式验证指南
tags: [形式验证, 数字IC, VC Formal, FLP, LPC]
---

# FLP / LPC：低功耗连通性形式验证使用指南

## 1. 核心问题

低功耗 SoC 通过不同的电源域、电源关断、隔离单元、保持寄存器和电源控制器来降低功耗。在普通的 RTL 连通性检查中，信号看起来可能已经正确相连，但电源域关断后仍可能把未知或无效的数据送到始终通电的逻辑；而隔离控制如果接反，就可能导致不同电源状态下的功能不符合规格。

FLP CC 把 RTL 与 UPF（Unified Power Format，IEEE 1801）电源意图结合起来，验证在相应的电源状态及使能条件下，指定源与目的之间的连通性规则是否成立。它不只是检查 UPF 文件能否成功解析，还要分析电源意图对 RTL 的功能影响。

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

电源意图描述设计在哪些供电条件下工作，隔离策略和保持策略则分别保护跨域输出和需要保存的状态。常供电控制器必须在被控制的电源域关闭之后，仍然能够驱动正确的控制信号。验证时应该分别覆盖正常供电、掉电、恢复三个阶段，并核对隔离控制相对于供电变化的先后关系。

需要明确的要求包括：何时隔离、生效电平是什么、钳位值是多少、是否需要恢复保存状态。普通 CC 的组合连接模型不足以单独表达所有电源关闭的效果。

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

`fvlp_instrument` 启用低功耗语义插桩，`-type` 可以根据设计需要选择 `iso`、`pnm`、`ret` 等，具体支持的类型参照 User Guide 第 1043 页。插入低功耗支持以及读入 RTL/UPF 的顺序，需要与安装版本示例保持一致。`read_upf` 中的路径必须指向该工程真实的 UPF 文件。

### 3.1 原生低功耗检查模板完整源码

UPF、电源状态及隔离策略必须来自实际项目。本模板中省略的对象属于明确的待配置输入，并不是已经提供的完整低功耗工程。

**保存为 `templates/flp_low_power.tcl`：**

<!-- source-begin: templates/flp_low_power.tcl -->

```tcl
# 低功耗 CC：必须有 RTL、UPF、电源状态表、真正的电源域信号。
# 不支持普通 CC 的 delayed connectivity check（User Guide 第 1041 页）。
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

上游处理单元运行于可关断的电源域 `PD_A`，下游控制单元位于始终通电的 `PD_AON`。上游的输出 `data_o` 经过隔离单元到达下游的 `data_i`。规格要求：当 `PD_A` 供电正常且隔离关闭时，`data_i` 应该等于 `data_o`；当 `PD_A` 关断时，`data_i` 应该被钳位为零。

功能连接和隔离钳位应该分别检查。普通的端点关系通过低功耗条件下的连通性检查来定义；钳位检查则直接指定端口或引脚、隔离单元所在的位置以及应该保持的钳位值。`fvlp_check_clamp_value` 不接受旧示例稿中混入的 `-lpa_type` 或 `-enable`，这些参数不能从其他命令移植过来。

```tcl
fvlp_check_clamp_value u_aon/data_i -location parent -clamp_value 0
```

这个调用要求已经读入实际的 RTL 与 UPF，并完成低功耗模型配置；`u_aon/data_i` 必须替换成展开设计中真实的端口或引脚。电源域、隔离使能和供电关系应该由 UPF 与设计共同确定，不能靠这条命令凭空创建。

### 4.1 完整源码：先理解逻辑隔离关系

为了不把 UPF 环境和普通逻辑混在一起，下面单独给出理想隔离控制的 RTL 与 SVA。这里的 `source_power_good` 只是一个布尔输入，不会让仿真器或形式工具真的把某个电源域关断，也没有建立掉电后未知值的模型。

#### 4.1.1 完整逻辑模型

源电源不正常时，理想的控制模型会立即使能隔离；真实系统的电源控制时序、跨时钟处理和故障行为必须另行验证。

**保存为 `rtl/lp_isolation_demo.sv`：**

<!-- source-begin: rtl/lp_isolation_demo.sv -->

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

**保存为 `formal/lp_isolation_demo_props.sv`：**

<!-- source-begin: formal/lp_isolation_demo_props.sv -->

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

**保存为 `filelist_fpv_lp_logic_demo.f`：**

<!-- source-begin: filelist_fpv_lp_logic_demo.f -->

```text
./rtl/lp_isolation_demo.sv
./formal/lp_isolation_demo_props.sv
```

<!-- source-end -->

#### 4.1.4 普通 FPV 练习脚本

**保存为 `scripts/fpv_lp_logic_demo.tcl`：**

<!-- source-begin: scripts/fpv_lp_logic_demo.tcl -->

```tcl
# 在工程根目录执行；结果必须以本机 VC Formal 日志为准。
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
# 在工程根目录执行
mkdir -p logs
set -o pipefail
vcf -f scripts/fpv_lp_logic_demo.tcl -batch 2>&1 | tee logs/fpv_lp_logic_demo.log
```

**与原生 FLP 的区别：** 上面的练习只说明隔离钳位和正常连接的布尔关系，并不验证 UPF 插入位置、电源网络、保持单元或电源关断行为。真正的 FLP 检查还需要第 3 节列出的 UPF 和工具的低功耗配置，不能用本节的 FPV 结果来替代。

## 5. UPF 可信性与 PMC

UPF 应该由电源架构负责人确认电源域划分、电源状态、隔离和保持策略；必要时还需要为真实的电源管理控制器（PMC）建立环境模型。User Guide §24.2 提到，可以为不存在于形式 RTL 中的 PMC 建立其外部行为模型，但不能把这种模型误当成 RTL 自身需要被证明的功能。错误地假设所有电源域永久打开，会直接屏蔽掉很多低功耗缺陷。

## 6. FLP CC 和普通 CC 的重要区别

**User Guide 第 1041 页明确说明：FLP CC 不支持连通性延迟检查。** 因此不能直接把普通 CC 中的 `path_delay` 用例复制到低功耗检查环境中。对于寄存器延迟、时序握手或跨时钟的低功耗交互，需要用另一套合适的功能属性或等价流程来验证，而不是宣称 FLP CC 已经证明了它们。

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

这一组命令按照准备、生成、执行和结果处理的顺序组织。语法框保留了参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标和证明目标是不同的阶段，调用生成命令后应先检查实际目标数量，再启动证明。

### 7.1 `fvlp_instrument`：选择低功耗模型插装内容

```text
fvlp_instrument [-type <type_list>]
```

**参数解释：** `-type` 接受 iso、ret、pnm、bind_generics、ret1。iso 表示隔离策略，ret 表示保持策略，pnm 表示供电网络模型；后面的两类名称在本节只是作为可选的插装类型列出，但解释不够充分，不能把它们当成通用的推荐配置。典型低功耗连通性设置使用 `{iso pnm ret}`。

**用法与结果：** 建立 FLP CC 流程时，先选择 CC 应用模式并声明插装类型，然后再读取 RTL 与 UPF。缺少隔离模型或供电模型会改变被分析的对象，不能把有 UPF 文件名却没有相应模型的运行当成完成了低功耗检查。

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

**参数解释：** 位置参数是 UPF 文件路径；文件中的对象名称和作用域必须与已经读入的设计相对应。User Guide 在本节使用了这种简单形式，并没有在本章展开该平台所有的 UPF 读入选项。

**用法与结果：** 读取 UPF 之后，工具会建立电源网络、隔离、保持及掉电相关的模型。额外的形式封装层可能需要自己的电源域并设置 DUT 作用域，不能直接把原 SoC UPF 的顶层路径照搬到另一层封装中。这个命令只装入电源意图，不能替代时钟、复位和缺省 PMC 行为的建模。

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

**参数解释：** 本节展示的是无参数查询，它的输出是供电模型中没有被驱动的自由 supply 列表。原文把命令和示例返回的列表排在同一行，这个列表并不是必须追加的输入参数。

**用法与结果：** 自由电源并不会自动“始终上电”。未建模的供电状态可能任意变化，从而形成不符合系统设计的掉电路径；也可能暴露出实际缺少电源约束的问题。先查询，再根据真实的电源控制设计决定哪些常开、哪些受 RTL 控制。

```tcl
get_fvlp_free_supply_nets
```

来源：User Guide，X-2025.06-SP1，第 1058 页。

### 7.4 `fvlp_set_supply_aon`：将指定电源设置为常开

```text
fvlp_set_supply_aon <supply_list>
```

**参数解释：** 位置参数是一个 Tcl 列表，例如 `{VDD_AON VDD_RET}`；不要把原文展示列表中出现的逗号复制进正常的、用空白分隔的 Tcl 列表。

**用法与结果：** 只把架构上确实常开的电源设为 AON。为了减少失败就把所有可掉电域都设为常开，会删掉隔离和保持最需要检查的情形。User Guide 的示例日志给出了工具采用的供电值，但这并不代表可以用这个命令描述任意的模拟电压或地网。

```tcl
get_fvlp_free_supply_nets
fvlp_set_supply_aon {VDD_AON VDD_RET}
```

来源：User Guide，X-2025.06-SP1，第 1058–1059 页。

### 7.5 `fvlp_set_supply_onoff_net`：用 RTL 控制信号驱动电源开关状态

```text
fvlp_set_supply_onoff_net -netname <rtl_signal> <supply_list>
```

**参数解释：** `-netname` 指定 RTL 中的开关控制信号，末尾的列表指定要受它控制的 supply。

**用法与结果：** 这个关联让供电状态随控制信号变化，但它不会自动实现完整的电源管理时序协议。隔离的先后顺序、保持控制和复位恢复仍然需要由 PMC 或形式环境来描述，并用相应的覆盖目标确认能够到达关电、上电场景。

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

**参数解释：** 位置参数选择端口或引脚；`-location` 限定隔离位置；`-clamp_value` 指定期望的隔离行为。0/1 检查固定的钳位值，LATCH 对应保持原值，BASIC 创建 LPA_BASIC 检查，用来验证没有定义隔离的情况。

**用法与结果：** 原 User Guide 的命令名是 `fvlp_check_clamp_value`，不能因为快速参考或旧笔记里的缩写就删去前缀中的 v。它用于针对隔离模型生成检查，而不只是打印 RTL 引脚当前的电平。

```tcl
fvlp_check_clamp_value u_core/data_out \
  -location parent -clamp_value 0
```

来源：User Guide，X-2025.06-SP1，第 1046 页。

### 7.7 `flp_cc_vacuity_gen_split`：拆分低功耗空洞通过原因

```text
flp_cc_vacuity_gen_split [<property_name>]
```

**参数解释：** 省略属性时处理默认的空洞属性集合；提供名称则只拆分该属性。它生成 src、dest、iso、src_dest、src_iso、dest_iso 六类辅助 cover，分别检查供电和隔离条件单独以及联合的可达性。

**用法与结果：** 辅助 cover 在本流程中不一定显示在普通属性表里，需要在执行证明之后通过专门的报告查看。某个条件单独可达，并不意味着它和另一个条件能够同时成立，联合 cover 正是用来找出这种环境互斥的。

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

**参数解释：** 它读取拆分生成并运行后的辅助 cover 状态；提供属性名可以限制范围。

**用法与结果：** 当源电源可以打开、目的电源可以打开但隔离条件不可达时，报告会把这些情况区分开。修复应该针对 UPF、PMC 或使能规格，而不是直接关闭 vacuity 检查，或者把全部电源强制设为常开。

```tcl
flp_cc_vacuity_report cc_core_to_bus
```

来源：User Guide，X-2025.06-SP1，第 1048 页。

### 7.9 `fvlp_cc_print_path`：显示连通性属性经过的电源相关对象

```text
fvlp_cc_print_path <property_name>
```

**参数解释：** 位置参数是已经生成的低功耗连通性属性名称；报告会列出它源与目的之间的对象。

**用法与结果：** 适合检查中间的电源域、隔离单元、开关和连接。路径存在只是结构信息，仍然需要结合反例中的电源状态和隔离使能，判断检查为什么失败。

```tcl
fvlp_cc_print_path cc_core_to_bus
```

来源：User Guide，X-2025.06-SP1，第 1064 页。

### 7.10 `fvlp_cc_trace_fanin`：追踪供电引脚的驱动来源

```text
fvlp_cc_trace_fanin -prop <property_name> -dest <destination> [-incr]
```

**参数解释：** `-prop` 指定分析属性，`-dest` 指定待追踪的节点。发现并行驱动时，把其中一条驱动作为下一次的 `-dest`，加上 `-incr` 继续追踪。

**用法与结果：** 它主要帮助分析 PG 引脚和 supply 的连接，不能和普通 RTL 数据扇入报告混为一谈。每次迭代都保留前一次列出的节点，直到找到真实的供电端口、开关或未连接的位置。

```tcl
fvlp_cc_trace_fanin -prop cc_core_to_bus -dest PD_CORE/PSW/VDD
fvlp_cc_trace_fanin -prop cc_core_to_bus -dest PD_CORE/VDDA -incr
```

来源：User Guide，X-2025.06-SP1，第 1064 页。

## 8. 三个需要分别检查的场景

**正常通电：**隔离关闭时，功能数据能够到达下游；**关断阶段：**隔离在失去电源之前启动，钳位值正确并持续保持；**恢复阶段：**电源回到合法状态后，对隔离解除、复位和保持恢复的顺序进行验证。第三个阶段常常涉及跨周期时序，可能需要 FPV 与电源控制器的状态属性配合。

## 9. 调试方法

从失败的低功耗连接属性开始，检查 UPF 的源目的供电网络、`iso_en` 及电源状态，然后再查看波形或 Power Browser。要特别注意电源状态表是否包含不切实际的组合、隔离使能是否被形式环境错误地固定住，以及低功耗插桩是否真正参与了编译。不能仅因为正常供电情况下路径连接正确，就结束验证。

## 10. 参考

User Guide §24（1040～1065 页），以及 Quick Reference Guide 的 Low Power Connectivity Checking 部分；涉及 UPF 语法时，还应该参考项目采用的 IEEE 1801 版本与电源意图开发规范。
