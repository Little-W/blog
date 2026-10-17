# FPV：功能属性验证应用使用指南

## 1. 定位、能力与不适用范围

FPV 通过数学证明验证 RTL 和 SVA 所描述的设计规则。输入包括：待验证 RTL、用户断言、Assertion IP（AIP）断言、环境假设、时钟复位和初始化状态；输出为证明状态、反例、覆盖轨迹和分析报告。它适合局部协议、状态机、控制面、缓冲区、寄存器副作用、异常控制等，可在传统 testbench 完成前投入使用。

FPV 不会自动理解芯片规格，也不自动生成所有应该证明的规则。只有对**已经编写并启用**的属性进行了证明才有相应结论，且环境约束必须可信。若设计缺少软件配置顺序或外部协议模型，可能出现不实际的反例；若过度约束，则可能出现空洞证明。

## 2. 标准流程与输入输出

![FPV 工作流程](插图/06_FPV工作流程.svg)

| 阶段 | 任务 | 命令或文件 | 核查点 |
| --- | --- | --- | --- |
| 选择应用 | 设置 FPV | `set_fml_appmode FPV` | 模式是否正确 |
| 编译 | 读入 RTL、属性和 bind 文件 | `read_file` 或 `analyze/elaborate` | 顶层、参数、属性数量 |
| 初始化 | 时钟、复位、常量、初始状态 | `create_clock`、`create_reset`、`sim_save_reset` | 与真实启动一致 |
| 环境审查 | 检查黑盒和模型问题 | `report_blackbox`、`check_fv_setup` | 不存在关键环境缺陷 |
| 运行 | 执行验证 | `check_fv -block` | 任务真正结束 |
| 分析 | 输出证明状态和反例 | `report_fv`、`view_trace` | 性质与前提一致 |
| 回归 | 保存可复现结果 | `save_session`、日志/manifest | 版本与运行资源可追踪 |

流程中的每一步都会改变后续证明问题。编译决定结构和属性是否存在，时钟与复位决定状态更新和初始状态，约束决定允许的输入行为，证明命令才负责求解。报告必须与产生它的设置一起保存；只保留最后的通过数量，无法重现验证结论。

## 3. 单时钟计数器：完整 RTL、SVA 与运行流程

本节直接给出全部依赖文件。按“保存为”的路径建立目录并保存代码，就能准备对应教学工程，不必再到附件寻找 RTL、断言或脚本。

### 3.1 被验证的计数器 RTL

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

### 3.2 完整断言与绑定文件

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

### 3.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径相对于运行 VC Formal 的 `案例工程/` 目录，而不是 Tcl 文件所在目录。

**保存为 `案例工程/filelist_counter.f`：**

<!-- source-begin: 案例工程/filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 3.4 完整运行脚本

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

### 3.5 故意错误的 RTL

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

### 3.6 错误版编译文件列表

只读入错误设计及同一份检查器，不同时包含两个同名设计。

**保存为 `案例工程/filelist_counter_bad.f`：**

<!-- source-begin: 案例工程/filelist_counter_bad.f -->

```text
./rtl/counter_bad.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 3.7 错误版完整运行脚本

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

## 4. 如何组织断言

建议把每条属性归入四个类别：初始化（复位值和复位后输出）；协议（有效应答、授权、稳定性）；内部安全性（计数范围、状态合法、资源互斥）；进展性（最大等待时间、错误响应）。每个类别不仅包含断言，还要有能触发关键规则的覆盖目标。可将大型属性拆成“输入合法 → 请求被接受 → 内部状态变化 → 输出响应”的小性质，降低定位和求解难度。

### 4.1 它真正验证了什么

```systemverilog
ap_range: assert property (@(posedge clk) disable iff(!rst_n)
  count <= 4'd9);

cp_wrap: cover property (@(posedge clk) disable iff(!rst_n)
  count == 4'd9 ##1 count == 4'd0);
```

`ap_range` 证明占用值不超过上界；`cp_wrap` 搜索一次从 9 到 0 的回绕。两者不能互相替代。若设计从未能到达 9，`ap_range` 仍可能通过，但回绕规则并未真正被验证。对错误 RTL，前者应给出反例，后者是否能够覆盖取决于更新条件。

### 4.2 使用 `bind` 与外部属性模块

推荐把待验证 RTL 与检查器分离，方便调试和提交代码：

```systemverilog
module interface_checker (
  input logic clk, rst_n,
  input logic valid, ready,
  input logic [7:0] data
);
  ap_stable: assert property (@(posedge clk) disable iff(!rst_n)
     valid && !ready |=> valid && $stable(data));
  cp_transfer: cover property (@(posedge clk) disable iff(!rst_n)
     valid && ready);
endmodule
```

在 `formal/bind.sv` 内写 `bind <DUT_type> interface_checker ...`，然后使绑定文件编译进入 `-sva` 的设计。必须确认属性端口与 DUT 的实际时序一致，不要仅凭属性能被编译就认为建模正确。

## 5. 属性与运行命令详解

| 操作 | 命令 | 核心区别 |
| --- | --- | --- |
| 建立责任和前提 | `fvassert`、`fvassume`、`fvcover` | 证明、限制与搜索见证是不同逻辑问题 |
| 查询目标 | `get_props` | 返回可继续筛选和处理的属性集合 |
| 执行和报告 | `check_fv`、`report_fv` | 启动证明与读取状态是两个步骤 |
| 调整参与范围 | `fvdisable`、`fvenable` | 禁用目标不是证明通过 |

下列命令是 FPV 属性工作的核心。编译、时钟复位、任务复制和集群参数的完整说明位于通用命令章节；本章保留最直接影响断言责任和结果解释的命令全文，便于在完整案例旁理解每个操作。

### 5.1 `fvassert`：创建断言或改变已有属性的使用方式

```text
fvassert [<name>] -expr {<property-expression>} [-clock <clock>]
fvassert [-class <classes>] [-type <types>] [-usage <usages>]
         [-filter <expression>] <property-names-or-collection>
```

**参数解释。** 带 `-expr` 时创建脚本属性；不带 `-expr`、直接传入已有属性名称时，将其使用方式设为 assert 并启用。`-class` 表示来源类别，`-type` 是声明或生成类型，`-usage` 是当前用途，三者不是同义词。

**用法与结果。** 表达式含显式采样事件时使用该事件；此时额外写 `-clock` 会给出警告并优先采用表达式中的时钟。没有事件时使用参考时钟。表达式用花括号保护，避免 `$past` 和位选择被 Tcl 解释。将假设转成断言是验证环境承诺的方法之一，但必须在承担该承诺的设计范围内证明。

```tcl
fvassert AP_HOLD -expr {
  @(posedge clk) disable iff (!rst_n)
  valid && !ready |=> valid && $stable(data)
}
fvassert assume_input_protocol
```

来源：User Guide，X-2025.06-SP1，第 87–89、106–113 页。

### 5.2 `fvassume`：创建环境前提或改变属性用途

```text
fvassume [<name>] -expr {<expression>} [-clock <clock>]
fvassume [<name>] -expr {<combinational-expression>} -depth <n>
fvassume [<name>] -env -expr {<environment-expression>}
fvassume <property-names-or-collection>
```

**参数解释。** 普通 `-expr` 创建证明过程中的假设。`-depth n` 要求正整数，仅在复位后的前 n 个采样周期施加，默认以参考时钟上升沿计数，可用 `-clock` 改变；其表达式必须是组合逻辑，不能含 SVA 时序运算符。`-env` 创建同时参与初始化和正式分析的环境约束，表达式只允许涉及主输入、未驱动网络、截断点和黑盒输出等指定对象，且复位仿真能接受的表达式有额外限制。

**用法与结果。** `-env` 必须在 `sim_run` 之前建立，否则对已经完成的初始化不生效。假设应表达外部环境确实保证的条件；在同一任务中把待证明的设计输出直接设成假设，会把问题本身删除。已证明断言的复用必须说明证明依赖，不能形成循环。

```tcl
fvassume AS_INPUT_STABLE -expr {
  @(posedge clk) disable iff (!rst_n)
  valid && !ready |=> valid && $stable(data)
}
fvassume AS_BOOT_MODE -expr {mode == 2'b00} -depth 3
fvassume AS_NO_TEST -env -expr {test_mode == 1'b0}
```

来源：User Guide，X-2025.06-SP1，第 66–76、87–89、106–113 页。

### 5.3 `fvcover`：创建可达性目标并扩展到事务结束

```text
fvcover [<name>] -expr {<sequence-or-expression>}
fvcover -extend_cond {<end-condition>} [-suffix <suffix>]
        <base-cover-property>
fvcover [-usage cover] [-class <class>] [-type <type>]
        -extend_cond {<end-condition>} [-suffix <suffix>]
```

**参数解释。** `-expr` 创建要寻找见证的目标。`-extend_cond` 基于已有覆盖追加布尔结束条件，不能与 `-expr` 同时使用；`-suffix` 指定新名字后缀，省略时追加 `_extended`。也可以按 source、script、covergroup 等属性类别或类型选择基础覆盖。

**用法与结果。** 到达一个覆盖点不等于事务已经正常退出。扩展覆盖要求该点之后还能到达空闲或事务清空条件，适合检查“触发以后仍能完成”。它本质上仍在寻找一条轨迹，并不自动证明所有命中该点的轨迹都能完成。

```tcl
fvcover CP_REQUEST -expr {@(posedge clk) req}
fvcover CP_TRANSFER -expr {@(posedge clk) req ##[1:4] ack}
fvcover -extend_cond {idle} -suffix eot CP_TRANSFER
```

来源：User Guide，X-2025.06-SP1，第 87–89、108–110 页。

### 5.4 `get_props`：按类型、用途和状态查询属性集合

```text
get_props [-class <classes>] [-type <types>] [-usage <usages>]
          [-status <statuses>] [-filter <expression>]
          [-regexp] [-exact] [-selected] [<names-or-patterns>]
```

**参数解释。** `-class` 包括 source、script、aep、connection、coverage、register、security、seq、xprop、fusa 等来源；`-type` 描述具体种类；`-usage` 为 assert、assume、cover。`-status` 按报告状态筛选，`-filter` 根据属性表达式筛选，`-regexp` 和 `-exact` 调整匹配规则；`-selected` 只取界面当前选择的属性。

**用法与结果。** 返回的是工具集合。空集合可能是名称错误、没有生成目标、筛选条件错误或属性被停用，不能直接解释为所有目标已经通过。应查询集合大小并结合未筛选的总报告。

```tcl
set asserts [get_props -usage assert]
puts "Assertions: [sizeof_collection $asserts]"
foreach_in_collection p $asserts {
    puts "[get_object_name $p] [get_attribute $p status]"
}
```

来源：User Guide，X-2025.06-SP1，第 110–114 页。

### 5.5 `check_fv`：证明属性或寻找覆盖见证

```text
check_fv [-block] [-run_finish <commands>] [-stop]
         [-break <number-of-falsifications>]
         [-property <properties-or-collection>]
         [-subtype <property|vacuity|witness>] [-assume]
```

**参数解释。** `-block` 阻塞直到本次检查结束；默认非阻塞。`-run_finish` 指定非阻塞完成后执行的 Tcl 命令。`-stop` 停止当前运行，`-break` 在达到指定失败数时停止。`-property` 选择目标；`-subtype` 可取一个或多个 property、vacuity、witness。`-assume` 允许把已证明断言及不可达覆盖用于约束。

**用法与结果。** 证明同时服从启用的假设、常量、初始状态、黑盒和截断设置。非阻塞运行期间可以查看报告，但不能并行改变影响运行的设置。完成意味着这次资源限制下的运行结束，不等于全部目标获得确定结果；因此报告中的未完成状态必须单独处理。

```tcl
check_fv_setup -block
check_fv -block
report_fv -list > results.txt

check_fv -property [get_props AP_HOLD] \
    -subtype {property vacuity} \
    -run_finish {report_fv -verbose > hold_results.txt}
```

来源：User Guide，X-2025.06-SP1，第 184–189、202–207 页。

### 5.6 `report_fv`：读取证明状态、深度和详细结果

```text
report_fv [-class <classes>] [-type <types>] [-usage <usages>]
          [-status <statuses>] [-list] [-verbose] [-no_summary]
          [<property-names-or-patterns>]
```

**参数解释。** `-list` 输出逐项列表，`-verbose` 增加引擎、用时、证明深度和属性详细信息，`-no_summary` 省略汇总。筛选参数限定报告对象，但不会运行目标或改变其状态。

**用法与结果。** 报告是当前状态的快照。安全深度表示有界检查已经覆盖的范围，不是无界证明；反例深度表示失败位置，两者不能合并比较。筛选后只看到 proven 目标时，必须另查总目标数以及其他状态，防止通过筛选制造“全部通过”的假象。

```tcl
report_fv
report_fv -list -status falsified > failures.txt
report_fv -verbose -no_summary AP_HOLD
```

来源：User Guide，X-2025.06-SP1，第 247–261 页。

### 5.7 `fvdisable`：停用选定的断言、假设或覆盖

```text
fvdisable [-class <classes>] [-type <types>] [-usage <usages>]
          [-filter <expression>] [<properties>]
```

**参数解释。** 可按来源、声明类型、当前用途或名称选择属性；不明确区分筛选条件容易影响错误的对象。`-usage assume` 选择当前参与约束的属性，而非所有原始声明为 assume 的属性。

**用法与结果。** 停用断言只是不再检查该断言，停用假设则放宽了允许行为，会使已有证明资料失效或需要重新求解。UG 对 enabled 与 usage 的部分旧例描述并不一致，脚本应查询这两个属性，不依赖旧输出中的 none 文本。

```tcl
fvdisable -class aep -type bounds_check
fvdisable -usage cover
report_fv -list
```

来源：User Guide，X-2025.06-SP1，第 106–113、375 页。

### 5.8 `fvenable`：重新启用已有属性

```text
fvenable [-class <classes>] [-type <types>] [-usage <usages>]
         [-filter <expression>] [<properties>]
```

**参数解释。** 按选择条件启用已有目标，不重新生成 RTL 中未插入的检查。

**用法与结果。** 重新启用与重新声明不是一回事。若使用 `aep_config -dont_generate` 在编译前阻止了生成，这里没有可供启用的对象；需要重新配置并编译。重新启用假设后，应重新检查是否产生约束冲突或空洞。

```tcl
fvenable -class aep -type bounds_check
fvenable AP_HOLD
report_fv -list
```

来源：User Guide，X-2025.06-SP1，第 106–113 页。

## 6. 四个逐步进阶的用例

### 用例 A：复位后状态正确

规格：复位退出后，状态机应进入空闲状态。首先明确同步或异步复位和断言采样时刻：

```systemverilog
ap_reset_release: assert property (
  @(posedge clk) $rose(rst_n) |-> state == IDLE);
```

这段规则只适用于状态在第一次采样到复位高电平的时刻应该已经是 `IDLE` 的实现。若模块采用同步释放后的一个周期才进入有效状态，则必须调整响应周期。为复位前提单独建立初始化流程，不能只靠 `disable iff` 回避复位检查。

### 用例 B：握手停止期间数据不变

```systemverilog
ap_stall_hold: assert property (@(posedge clk) disable iff(!rst_n)
  valid && !ready |=> valid && $stable(data));
cp_backpressure: cover property (@(posedge clk) disable iff(!rst_n)
  valid && !ready ##1 ready);
```

如 `ready` 为外部驱动，禁止假设 `ready` 始终为 1；否则背压规则可能很容易被证明，却没有真正触发的测试场景。

### 用例 C：深层计数器溢出

使用参数化深度为 10 的计数器，故意把最大值条件写错。预期安全性 `count <= 9` 会失败；反例提供每拍 `enable`，可从逐周期变化找到第一次非法值。修复后重新运行，与更早的报告比较应以 RTL 的校验值为前提。

### 用例 D：多端口仲裁

```systemverilog
ap_mutex: assert property (@(posedge clk) disable iff(!rst_n)
  $onehot0(grant));
cp_contend: cover property (@(posedge clk) disable iff(!rst_n)
  req == 2'b11);
```

这是最基础的安全性和触发覆盖。若想证明“等待不超过 8 拍”，必须明确持续请求和仲裁器能否接收新请求，并对每一个端口分别写属性。状态空间复杂时，可先证明互斥与请求合法，再证明有界公平性。

### 6.5 FIFO 控制器：完整代码

这个例子只验证 FIFO 的占用计数、空满标志和请求接受规则，不包含存储阵列，因此不能据此宣称已经证明数据顺序正确。满状态允许同时读写；空状态不能读出，且本例没有空 FIFO 直通功能。

#### 6.5.1 控制器 RTL

`pop_accept` 先排除空读；`push_accept` 在未满或本拍成功读出的条件下接受写入。实际更新依据接受信号，而不是原始 `push/pop` 请求。

**保存为 `案例工程/rtl/fifo_ctrl.sv`：**

<!-- source-begin: 案例工程/rtl/fifo_ctrl.sv -->

```systemverilog
module fifo_ctrl #(
    parameter int DEPTH = 4,
    parameter int CW = $clog2(DEPTH + 1)
) (
    input logic clk, rst_n,
    input logic push, pop,
    output logic full, empty,
    output logic push_accept, pop_accept,
    output logic [CW-1:0] occupancy
);
  assign full       = (occupancy == DEPTH);
  assign empty      = (occupancy == 0);
  assign pop_accept  = pop && !empty;
  assign push_accept = push && (!full || pop_accept);

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) occupancy <= '0;
    else case ({push_accept, pop_accept})
      2'b10: occupancy <= occupancy + 1'b1;
      2'b01: occupancy <= occupancy - 1'b1;
      default: occupancy <= occupancy;
    endcase
  end
endmodule
```

<!-- source-end -->

#### 6.5.2 完整 SVA 与参数绑定

属性参数与 RTL 的 `DEPTH/CW` 对应；检查范围、标志一致性以及禁止空读、禁止无空间写入。覆盖目标辅助确认满状态与使用后回到空状态可达。

**保存为 `案例工程/formal/fifo_ctrl_props.sv`：**

<!-- source-begin: 案例工程/formal/fifo_ctrl_props.sv -->

```systemverilog
module fifo_ctrl_props #(
  parameter int DEPTH = 4,
  parameter int CW = $clog2(DEPTH + 1)
) (
  input logic clk, rst_n, push, pop,
  input logic full, empty, push_accept, pop_accept,
  input logic [CW-1:0] occupancy
);
  ap_safe_count: assert property (@(posedge clk) disable iff (!rst_n)
    occupancy <= DEPTH);
  ap_flag_full: assert property (@(posedge clk) disable iff (!rst_n)
    full == (occupancy == DEPTH));
  ap_flag_empty: assert property (@(posedge clk) disable iff (!rst_n)
    empty == (occupancy == 0));
  ap_no_empty_pop: assert property (@(posedge clk) disable iff (!rst_n)
    pop_accept |-> !empty);
  ap_no_overflow_push: assert property (@(posedge clk) disable iff (!rst_n)
    push_accept |-> (!full || pop_accept));
  cp_full: cover property (@(posedge clk) disable iff (!rst_n)
    full);
  cp_empty_after_use: cover property (@(posedge clk) disable iff (!rst_n)
    !empty ##[1:5] empty);
endmodule

bind fifo_ctrl fifo_ctrl_props #(.DEPTH(DEPTH), .CW(CW)) u_fifo_ctrl_props (.*);
```

<!-- source-end -->

#### 6.5.3 文件列表

**保存为 `案例工程/filelist_fifo.f`：**

<!-- source-begin: 案例工程/filelist_fifo.f -->

```text
./rtl/fifo_ctrl.sv
./formal/fifo_ctrl_props.sv
```

<!-- source-end -->

#### 6.5.4 完整脚本

**保存为 `案例工程/scripts/fpv_fifo.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_fifo.tcl -->

```tcl
set_fml_appmode FPV
read_file -top fifo_ctrl -sva -format sverilog -vcs {-f filelist_fifo.f}
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
vcf -f scripts/fpv_fifo.tcl -batch 2>&1 | tee logs/fpv_fifo.log
```

## 7. 如何分析结果

`Proven`：属性在该模型和假设下成立。需要查触发是否可达与约束是否合理。`Falsified`：工具给出违反路径，首先检查输入是否符合环境规格与时钟复位是否正确。`Inconclusive`：目前未完成，不能当作通过。`Covered`：存在一条满足覆盖目标的路径。`Uncoverable`：该目标在当前模型不可达，需要区分真实死逻辑与过度约束。详见 [验证工程与结果判读](验证工程与结果判读.md)。

## 8. 优化证明效率而不损害结论

1. 缩小模块验证范围，必要时划分不同 `fvtask`；不要先大面积假设内部值。
2. 将复杂的一条断言拆成可解释的若干不变量与阶段性结果。
3. 分析影响锥，确认算术、RAM、时钟域和不必要的外围逻辑是否进入证明。
4. 再考虑 `set_fml_var fml_effort high`、资源限制、`set_abstractions`、`snip_driver` 等进阶优化；新抽象可能引入虚假反例。
5. 对长期回归使用符合条件的 `fvlearn_config -local_dir ...`，并区分继承的缓存与新运行获得的真实结果。
6. 使用 `report_fml_engines`、`report_fml_jobs`、`report_fml_hosts` 定位瓶颈。

## 9. 常见故障与排查

| 现象 | 优先检查 | 不应做的事 |
| --- | --- | --- |
| 所有断言都轻松通过 | 触发覆盖、空洞性和假设 | 直接宣布完整验证通过 |
| 许多断言在第 0 拍失败 | 初始化状态与 `$past` | 假设所有寄存器为预期值 |
| 证明几乎没有进展 | 影响锥、参数和 RAM | 无审查地增加内部假设 |
| 只有有界深度结论 | 是否真正 `Proven` | 把展开深度当作无限证明 |
| Verdi 中找不到信号 | 优化、层级、会话版本 | 在不知影响的情况下关掉全部优化 |
| 频繁得到非法请求反例 | 环境模型与协议规范 | 把所有 DUT 失败行为都排除 |

优先检查会改变验证问题本身的设置，再考虑求解器。没有生成目标、输入被固定、复位释放错误或属性触发条件不可达，都可能造成“运行很快且全部通过”的假象。对任何性能优化，都应比较修改前后的属性数量、环境前提和关键覆盖场景。

## 10. 进阶主题

FPV 可以与 AIP、覆盖质量评估（FCA）、FTA 的形式测试平台突变分析、Proof Architect 的组合式证明方法等配合。有关无法快速证明的属性，阅读 [调试与证明性能](调试与证明性能.md)；有关交付报告，阅读 [覆盖与验证验收](覆盖与验证验收.md)。FPV 的物理规模限制随属性影响锥、状态空间及引擎而变化，没有一个对所有设计都有效的固定门数门槛。

## 11. 参考定位

User Guide §17（FPV，686 页起），§3（SVA/属性，66 页起），§4（初始化，115 页起），§6～7（运行与调试，183～312 页），§18～20（性能、组合式证明与验收）。Quick Reference Guide 的 FPV 页面提供命令速览，但不是全部参数说明。
