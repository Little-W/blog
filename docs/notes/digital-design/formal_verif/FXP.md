---
title: FXP：形式 X 传播分析指南
tags: [形式验证, 数字IC, VC Formal, FXP, X传播]
---

# FXP：形式未知值传播验证使用指南

## 1. 为什么未知值传播值得单独验证

RTL 仿真中的 `X` 可能表示：寄存器尚未复位、未驱动、被赋值 X、模块未定义、数组越界、选择条件不确定等。真实电路并不存在一种独立的“X 电压值”；它表示形式或仿真层面上的确定性缺失。在安全控制、启动流程、电源域切换、复位释放和错误路径中，一个无法确定的控制值可能会在时序上被传播或放大。

FXP 的核心目标是查明：**指定的未知值来源是否可能影响那些本不应出现未知值的观察信号**。它通过生成 X 注入点与观察点、建立检查，并使用形式引擎寻找违反条件的轨迹。普通的 FPV 二值断言不能自动等同于这种 X 传播分析。

![FXP 注入源和观察点](插图/07_FXP传播.svg)

## 2. 注入点与观察点的概念

**注入点**是允许引入未知值的位置，例如未初始化寄存器、显式 `X` 赋值、未驱动信号、黑盒输出或人为指定的关键节点。**观察点**则是要求未知值不应到达的位置，例如顶层功能输出、关键状态机控制端、黑盒输入，以及被指定为需要保持稳定、可判定值的寄存器。

形式检查要回答的是：在当前复位和输入条件下，能不能找到一条路径，让注入的不确定性传播到观察点？它并不是统计 X 出现的概率，也不等于电路可靠性故障率分析。

## 3. 自动提取对象：来源与观察点

| 选择值 | 注入来源 | 观察位置 |
| --- | --- | --- |
| `uninit` | 未初始化寄存器 | 否 |
| `xassign`、`undriven`、`undef` | 显式未知值、未驱动、未定义运算 | 否 |
| `in`、`bbout`、`unresout` | 顶层输入、黑盒输出、未解析模块输出 | 否 |
| `out`、`bbin`、`unresin` | 否 | 顶层输出、黑盒输入、未解析模块输入 |
| `oba` | 越界引入未知值的位置 | 越界相关观察位置 |
| `snip`、`abs` | 截断与抽象引入的来源 | 相应截断与抽象观察位置 |
| 截断驱动端类别 | 否 | 截断网络的驱动端 |

来源描述不确定性如何进入模型，观察位置描述哪里必须保持确定。它们是两个独立的选择维度：只指定未初始化寄存器，并不自动等于已经为所有关键输出建立了检查；只建立输出观察目标，也不能保证所有需要分析的未知值来源都已经注入。应当在生成之后同时检查来源数量和目标数量。

例如分析“未初始化缓存是否影响输出”时，可以自动选择 `uninit` 和 `out`，也可以选择 `uninit` 之后再用 `fxp_assert` 明确指定输出。本章的完整案例采用后一种方式，避免把自动输出目标与手工输出目标重复生成。未初始化缓存存在，并不必然构成缺陷；当 `valid` 可靠地屏蔽缓存，且下游在无效期间只看到确定值时，不确定性可能不会到达那些要求确定的观察位置。

User Guide 的类型表把截断驱动端写作 `snip_drv`，语法列表里又有 `snipdrv` 的写法；本章不会把这一差异猜测成两种都有效。实际需要选择该类别时，应当核对安装版本的帮助。其余类别及双重角色来自 User Guide 第 447–448 页的类型定义。

## 4. 标准脚本与运行顺序

```tcl
set_fml_appmode FXP
read_file -top soc_top -format sverilog -vcs {-f filelist.f}
create_clock clk -period 100
create_reset rst_n -sense low
set_constant test_mode -value 1'b0
sim_run -stable
sim_save_reset
check_fv_setup -block
fxp_generate
report_fv -list
check_fv -block
report_fv -verbose
```

`fxp_generate` 使用默认类型自动提取检查。如果原型模块没有复位，应当删除不适用的 `create_reset`，不能输入一个不存在的复位信号。任何被 `set_constant` 固定的控制输入都应当有真实的工程依据，否则可能人为切断未知值的传播路径。

### 4.1 显式选择未初始化寄存器类型

```tcl
fxp_generate -name uninitialized_checks -type {uninit}
```

只关注某一类来源，有利于快速得到第一批可解释的结果。User Guide 中还给出了把某个范围及若干类型一起配置的方式；例如只针对某个子模块，可以传入对应的 scope 列表（需要真实的实例路径）。

## 5. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fxp_generate` | 按实例范围和类别生成 X 检查 |
| `fxp_assume` | 控制 X 来源或排除已知确定的位置 |
| `fxp_assert` | 定义条件化的 X 观察点 |
| `fxp_compute_rootcause` | 计算失败 X 检查的上游来源 |
| `fxp_report_rootcause` | 报告 X 来源计算结果 |

这一组命令按照准备、生成、执行和结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同的阶段，调用生成命令之后应当检查实际的目标数量，再启动证明。

### 5.1 `fxp_generate`：按实例范围和类别生成 X 检查

```text
fxp_generate [<instance-scopes>] [-name <prefix>]
             [-type <type-list>]
```

**参数解释。** 范围使用实例名，而不是模块定义名；嵌套实例使用相对顶层的层级路径，多个实例写入 Tcl 列表。`-name` 作为生成属性的共同前缀。`-type` 选择来源与观察类别，省略时使用默认组合；auto 对应文档列出的默认组合。常见类别包括 uninit、oba、xassign、undef、undriven、in、out、bbin、bbout、unresin、unresout、abs 和 snip。

**用法与结果。** 默认类别并不是“给所有输入都注入 X”：主输入 in、黑盒输出 bbout 和未解析模块输出 unresout 在属性类型表中都不是默认项。语法列表中的 snipdrv 与表中的 snip_drv 拼写存在差异，教程不会把其中任意一个扩展成通用的可运行选项。最小案例显式给出 uninit 和 out，确保既有来源又有观察点。

```tcl
fxp_generate -name reset_x -type {uninit out}
fxp_generate {u_cpu u_uart.regs} \
    -name io_x -type {uninit xassign out}
report_fv -class xprop -list
```

来源：User Guide，X-2025.06-SP1，第 447–451 页。

### 5.2 `fxp_assume`：控制 X 来源或排除已知确定的位置

```text
fxp_assume -injectx [-name <name>] [-reset] [-oba] [-xassign]
           [-undef] [-condition <expression>] [-scope <scope>] <signal>
fxp_assume -nox [-name <name>] [-reset] [-condition <expression>] <signal>
```

**参数解释。** `-injectx` 建立 X 来源，`-nox` 从指定点排除 X。`-name` 命名生成的目标；`-reset` 用于时序单元的出复位状态。`-oba`、`-xassign`、`-undef` 分别对应越界、显式 X 和未定义行为，作用于整个范围时必须配合 `-scope`；`-condition` 是控制该操作的组合条件。

**用法与结果。** 已经用 `create_clock` 或 `create_reset` 定义的时钟、复位信号不能作为 X 注入源。`-nox` 是一种模型前提，不会给 RTL 添加复位或屏蔽逻辑；只有在规格或外部电路保证确定时才可以使用。User Guide 的 nox 语法行漏写了 condition 前的连字符，参数解释和快速参考都采用 `-condition`，这里采用后者并保留该差异说明。

```tcl
fxp_assume -injectx -name cold_data -reset {u_buf.data_q}
fxp_assume -nox -name known_mode -condition {cfg_valid} {mode}
fxp_assert -name output_defined -condition {out_valid} {out_data}
```

来源：User Guide，X-2025.06-SP1，第 451–453 页。

### 5.3 `fxp_assert`：定义条件化的 X 观察点

```text
fxp_assert [-name <name>] [-condition <expression>] <signal>
```

**参数解释。** `-name` 指定检查名称，`-condition` 决定在哪些组合条件成立时要求目标信号确定；位置参数是观察信号。

**用法与结果。** 无有效数据的周期允许数据寄存器未初始化时，应当只在 out_valid 为真时才要求数据确定。同时还必须用 FPV 检查 out_valid 不会提前置位，否则错误的屏蔽条件可能让 FXP 看不到真实的问题。

```tcl
fxp_assert -name data_when_valid \
    -condition {out_valid} {out_data}
check_fv -block
report_fv -class xprop -list
```

来源：User Guide，X-2025.06-SP1，第 453 页。

### 5.4 `fxp_compute_rootcause`：计算失败 X 检查的上游来源

```text
fxp_compute_rootcause [-property <property-names>] [-stop] [-block]
```

**参数解释。** `-property` 指定失败目标，`-block` 等待定位结束，`-stop` 停止相关计算并清理待计算的属性列表。

**用法与结果。** 先要有失败属性和轨迹，再执行来源分析。它会区分未初始化、显式 X、越界等来源，减少从下游逐级人工回溯的工作量，但仍然需要核对该路径的有效性控制。自动模式由 `fxp_compute_rootcause_auto` 控制，默认为 false。

```tcl
fxp_compute_rootcause -property {output_defined} -block
fxp_report_rootcause -property {output_defined} -list
```

来源：User Guide，X-2025.06-SP1，第 456–457 页。

### 5.5 `fxp_report_rootcause`：报告 X 来源计算结果

```text
fxp_report_rootcause [-property <property-names>] [-list] [-no_summary]
```

**参数解释。** `-property` 选择目标，`-list` 按属性逐行输出，`-no_summary` 不显示来源类型的汇总。

**用法与结果。** 只执行报告命令，不会自动补齐缺失的来源计算。看到某个寄存器未初始化之后，应当进一步判断它是否应该有复位、复位是否被门控、工具是否识别了复位，以及下游是否错误地使用了无效数据。

```tcl
fxp_compute_rootcause -block
fxp_report_rootcause -list
```

来源：User Guide，X-2025.06-SP1，第 456–457 页。

### 5.6 什么时候允许 `-nox`

只有当硬件结构、外部协议或正式初始化流程**保证该信号在指定阶段已知**时，才允许消除它的 X 来源。例如某个寄存器由上电复位明确赋值，并且复位时序确实执行；或者某个输入在完成训练之后才被采样，并且存在可证明的有效标志。如果把所有未知数据都用 `-nox` 约束掉，FXP 就失去了实际作用。

## 6. 教学用例 A：未复位的数据寄存器

```systemverilog
module uninit_demo (
  input  logic clk, rst_n, write,
  input  logic [7:0] in_data,
  output logic [7:0] out_data
);
  logic [7:0] cache;
  always_ff @(posedge clk) begin
    if (write)
      cache <= in_data;
  end
  always_comb out_data = cache;
endmodule
```

`cache` 不受 `rst_n` 复位，而且复位后在第一次写入之前，可以作为任意初值输出。如果 `out_data` 必须始终有效，FXP 应当提示这一风险。修复方式有两类：一是复位 `cache`；二是在 `cache` 内容有效之前，通过 `valid` 等硬件逻辑阻止下游采样，或者输出一个确定值。**仅添加形式假设让 `write` 在第一拍发生，不一定等同于真实硬件有这样的保证。**

### 6.1 更合理的有效性控制

```systemverilog
logic initialized;
always_ff @(posedge clk or negedge rst_n) begin
  if (!rst_n) initialized <= 1'b0;
  else if (write) initialized <= 1'b1;
end
assign out_data = initialized ? cache : 8'h00;
```

当 `cache` 尚未被写入时，输出为确定值；写入之后则使用缓存数据。FXP 仍然要检查选择条件以及其他传播分支是否可能携带未知值。

### 6.2 本节完整工程文件

上面的片段展示的是问题原理。下面是同一类未初始化缓存案例的完整文件，故意保留复位端口却不复位缓存，用来说明“端口存在”并不意味着缓存就有已知初值。

#### 6.2.1 被验证的完整 RTL

**保存为 `rtl/uninit_demo.sv`：**

<!-- source-begin: rtl/uninit_demo.sv -->

```systemverilog
// Purposefully uninitialized cache to illustrate FXP, not recommended RTL.
module uninit_demo (
  input logic clk, rst_n, write,
  input logic [7:0] in_data,
  output logic [7:0] out_data
);
  logic [7:0] cache;
  always_ff @(posedge clk)
    if (write) cache <= in_data;
  assign out_data = cache;
endmodule
```

<!-- source-end -->

#### 6.2.2 完整文件列表

**保存为 `filelist_fxp.f`：**

<!-- source-begin: filelist_fxp.f -->

```text
./rtl/uninit_demo.sv
```

<!-- source-end -->

#### 6.2.3 完整 FXP 脚本

`fxp_generate` 选择未初始化对象，`fxp_assert` 把输出作为必须已知的观察位置。输入 `write` 没有被假设为始终有效，因此必须考虑尚未写入的路径。

**保存为 `scripts/fxp_uninit.tcl`：**

<!-- source-begin: scripts/fxp_uninit.tcl -->

```tcl
set_fml_appmode FXP
read_file -top uninit_demo -format sverilog -vcs {-f filelist_fxp.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
fxp_generate -name uninitialized_checks -type {uninit}
fxp_assert -name output_must_be_known out_data
check_fv -block
report_fv -verbose
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 在工程根目录执行
mkdir -p logs
set -o pipefail
vcf -f scripts/fxp_uninit.tcl -batch 2>&1 | tee logs/fxp_uninit.log
```

预期的观察结果是：未发生有效写入时，缓存的不确定性可能到达输出。分析失败时，应当查看工具实际选择的注入点和反例，不应通过把 `write` 固定为 1 来掩盖初始化缺陷。这里没有真实的 FXP 运行报告。

## 7. 教学用例 B：显式 X 赋值与越界

```systemverilog
always_comb begin
  unique case (opcode)
    2'b00: result = a + b;
    2'b01: result = a ^ b;
    default: result = 'x;
  endcase
end
```

对未定义的操作码，显式 X 可能被后级直接使用；`-type {xassign}` 可以帮助定位。如果协议规定未支持的操作码必须返回错误码或忽略写入，那么直接赋 X 就不是完整的实现，应当修改 RTL 和相应 SVA。如果设计规则明确规定非法操作码永远不会输入，就需要有可审查的上游保证，不能只针对当前检查添加无限制的输入假设。

对数组 `mem[index]` 的非法访问则属于 `oba` 等相关检查。在一些 RTL 里，越界索引导致的 X 传播既可以由 AEP 发现，也可以通过 FXP 分析它实际影响的观察点，两者的结论不同、相互补充。

## 8. 教学用例 C：有意屏蔽不确定数据

```systemverilog
assign packet_out = valid ? raw_packet : '0;
```

如果 `valid` 的生成完全可靠，而且只有 `valid=1` 时 `raw_packet` 才被使用，那么未初始化的 `raw_packet` 未必造成危险的输出。FXP 应当在考虑 `valid` 的实际来源和复位行为之后，判断它是否能够影响 `packet_out`；不要只凭 `raw_packet` 未复位就断定必须增加复位网络。对于大面积的数据寄存器，**有效位优先**的方案往往比强行复位所有触发器更合理，但前提是证明有效位本身可靠，并且它的控制能够完全屏蔽未知数据。

## 9. 调试：由下游症状回溯到上游来源

```tcl
check_fv -block
report_fv -list
view_trace -property <failed_property>
fxp_compute_rootcause <failed_property>
fxp_report_rootcause
```

定位时先找出观察点在何时受到影响，然后从该周期往前追踪经过的条件选择、多路复用器、寄存器和复位逻辑。重点确认是否存在以下情况：复位未覆盖、输出在有效位之前被采样、黑盒建模不当、未知模式输入未处理、未驱动网络，或隐含的时钟门控。必须把“真正产生不确定性”和“最终使不确定性可见”这两件事分开分析。

![FXP 调试排查流程](插图/08_FXP排查.svg)

## 10. 设计规模很大时怎么做

先针对关键输出与重要控制节点建立一批观察点；然后根据报告，只针对相关模块开启额外的注入类型；最后再扩大到全模块或全芯片。全信号扫描往往会生成大量属性，其中可能包含没有工程意义的中间节点和普通数据寄存器，因此不推荐把 `get_signals` 的全部对象直接、无差别地传给 `fxp_assert`，尤其不推荐在没有容量预算和报告分类的情况下执行。如果需要批量生成对象列表，应当过滤掉时钟、复位、扫描测试、非功能占位和已知允许变化的信号，并在最终报告中清楚地列出排除规则。

### 10.1 与复位覆盖工作的关系

FXP 可以帮助识别“实际运行时需要已知，但没有完整初始化”的重要状态，但**不能单独替代复位规格验证**。建议同时使用 FPV 证明复位之后关键控制寄存器为规定的常量。这样发现的 X 传播问题可以分成几类：状态未初始化、控制路径泄漏、协议保护失效，或仿真 X 语义不同。

## 11. 常见问题

| 现象 | 可能原因 | 改进方向 |
| --- | --- | --- |
| 复位后一拍输出为 X | 数据寄存器未复位或有效位错误 | 修改 RTL 或协议保护 |
| 某黑盒输出引起所有下游失败 | 模型过于自由 | 提供正确的黑盒约束或可综合模型 |
| 所有属性都通过但已知存在 X 问题 | 未将关键输出列为观察点或注入范围不足 | 核对 `fxp_generate` 类型及属性数量 |
| 生成属性太多，内存不足 | 扫描范围过宽 | 按重要模块、输出和原因分批 |
| `-injectx` 报错 | 选中时钟/复位或不支持对象 | 查该命令对象与 scope 限制 |
| 人工 `-nox` 后全部通过 | 可能屏蔽真实传播 | 审查硬件依据，保留原始对照结果 |

FXP 反例是观察点在特定条件下可能不确定的证据，不应直接把所有未复位寄存器都加上复位。先确认下游是否在数据有效之前采样，再核对屏蔽条件和复位时序；只有规格要求上电即确定时，才需要相应的初始化实现。

## 12. FXP 与 AEP、FPV 的分工

AEP 检查数组越界或危险表达式之类的自动规则；FXP 检查不确定性是否影响重要观察点；FPV 则证明指定输入规范下的功能值和时序关系。同一处越界访问可以同时涉及这三种问题，但三者的目标和通过条件不同。

例如越界读可能导致数据不确定，这三个应用依次能够定位越界原因、传播风险以及实际功能规则的失败。联合使用会更全面，但三者仍然依赖正确的模型和约束。

## 13. 官方依据与版本提醒

User Guide 第 12 章（444～457 页），Quick Reference Guide FXP 部分。`set_blackbox` 的开关应当以安装版本的帮助为准，部分旧笔记中存在 `-design` 与 `-designs` 混用；不要把未经核对的选项直接写入生产脚本。源码形式验证与真实芯片的亚稳态、模拟电压和物理故障不是同一个模型。
