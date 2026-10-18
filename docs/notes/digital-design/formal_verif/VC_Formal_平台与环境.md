---
title: VC Formal 平台、环境与命令执行
tags: [形式验证, 数字IC, VC Formal, 环境配置]
---

# VC Formal 平台、环境与命令执行

## 1. 平台定位与基本结构

VC Formal 是 Synopsys 的形式验证平台，通过共同的编译、展开、属性管理、求解、报告和调试环境，为不同应用提供支持。它既能完成从传统 RTL 和约束出发的功能属性验证，也能完成自动提取问题、基于结构连接列表的检查、顺序等价分析、安全性分析等专用任务。

![VC Formal 应用布局](插图/03_应用布局.svg)

一个验证任务通常由六个部分组成：RTL 或参考模型；SVA/CSV/寄存器描述/故障模型等规格输入；时钟复位与环境假设；证明引擎与资源策略；反例及结果报告；必要时还需要 Verdi 图形调试。不同应用共用同一个 Tcl 外壳，但**应用模式、专用命令和输入数据类型并不统一**。

## 2. 应用名称与 Tcl 模式的区别

| 中文用途 | 文档中的应用名称 | Tcl 模式 | 专用资料 |
| --- | --- | --- | --- |
| 功能属性证明 | FPV | `FPV` | [FPV.md](FPV.md) |
| 自动提取设计检查 | AEP | `AEP` | [AEP.md](AEP.md) |
| 连通性 | CC | `CC` | [CC.md](CC.md) |
| 形式覆盖率分析 | FCA | `COV` | [FCA.md](FCA.md) |
| 未知值传播 | FXP | `FXP` | [FXP.md](FXP.md) |
| 顺序等价 | SEQ | `SEQ` | [SEQ.md](SEQ.md) |
| 寄存器验证 | FRV | `FRV` | [FRV.md](FRV.md) |
| 测试平台分析 | FTA | `FTA`（通常由 FPV 会话切换） | [FTA.md](FTA.md) |
| 功能安全 | FuSa | `FUSA` | [FuSa.md](FuSa.md) |
| 信息流安全 | FSV | `FSV` | [FSV.md](FSV.md) |
| 数据路径对照 | DPV | `DPV` | [DPV.md](DPV.md) |
| 低功耗连通性 | FLP/LPC | `CC` + 低功耗命令（该使用流程） | [FLP_LPC.md](FLP_LPC.md) |

2025 年 9 月快速指南的 FCA 命令行示例使用 `set_fml_appmode FCA`，但同版本 1,168 页的 User Guide 在第 65、395、430 页明确展示的是 `COV`。本教程的 FCA 脚本首选 `COV`，启动后再用 `get_fml_appmode` 确认。User Guide 第 65 页明确指出，FTA 模式不应直接用 `vcf -fmode FTA` 启动，而应在 VC Formal 会话内用 `set_fml_appmode FTA`。这两处都必须与实际安装版本核对。

## 3. 环境准备

正式环境通常需要 Linux 主机、已安装的 VC Formal / VC Static 相关组件、相应的许可证，以及可用的 Verdi（只在需要图形调试时用到）。具体支持的平台、许可证名称、最低内存和批量计算系统，应以单位内部的安装说明及实际版本的安装指南为准，不能根据本文就推断许可证一定已经开通。

首先在终端确认：

```bash
which vcf
vcf -help
pwd
```

工具可以通过 `-f` 读取 Tcl 脚本。推荐在**项目根目录**下执行，这样源文件列表和日志的位置能保持一致：

```bash
vcf -f scripts/run_fpv.tcl -batch
vcf -f scripts/run_fpv.tcl -verdi
vcf -f scripts/run_fpv.tcl
```

典型的授权选项示例有 `-fml_elite`、`-fml_token`，只有在内部许可证策略支持且确有需要时才使用。实际提示和参数请用 `vcf -help` 查看，不要把 shell 指令原样写进 Tcl 脚本。

### 3.1 首次运行所需的全部文件

环境准备好后，可以先保存下面这个最小工程。本节给出 RTL、检查器、文件列表和 Tcl 的完整内容，后续章节再解释这些命令和属性的细节。

### 3.1.1 被验证的计数器 RTL

规格：复位后计数为零；使能时从 0 计到 9，然后回到 0；不使能时保持不变。RTL 文件只包含设计，不能把待验证的结论写进环境假设。

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

### 3.1.2 完整断言与绑定文件

`history_valid` 在复位后建立历史有效标志。`ap_range` 检查取值范围，`ap_hold` 检查保持，`ap_increment` 检查普通递增，`ap_wrap` 检查回绕；两条 `cover` 检查最高计数值和回绕场景是否会出现。末尾的 `bind` 把检查器接入同名的设计信号，不需要修改 RTL。

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

### 3.1.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径是相对于运行 VC Formal 的工程根目录，而不是 Tcl 文件所在目录。

**保存为 `filelist_counter.f`：**

<!-- source-begin: filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 3.1.4 完整运行脚本

依次完成选择应用、读入设计与 SVA、定义时钟复位、保存初始状态、检查设置、列出属性并开始证明。初始化步骤需要在实际安装环境中核对复位状态，不能把声明复位等同于已经完成复位。

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

**结果解读。** 在初始状态正确的前提下，正确版预期会满足这些断言，并存在到达 9 和回绕的覆盖轨迹。这不是本次 VC Formal 的实际运行结果。这些断言分别覆盖范围、保持、普通递增和回绕；复位值以及运行中的重新复位，仍需结合初始化模型和专用复位检查，不能只凭范围属性成立就认定全部功能正确。

## 4. Tcl 外壳与帮助系统

```tcl
help
help report*
report_fv -help
man report_fv
view_help report_fv
report_fml_var fml_max_*
report_app_var *fml*
get_fml_appmode
```

`help` 和 `-help` 用来核对命令接受的选项；`man`、`view_help` 调出更长的帮助；`report_fml_var` 用来查询形式变量，`report_app_var` 用来查询应用变量。变量的归属不能随便互换：有的需要用 `set_fml_var`，有的需要用 `set_app_var`。**应优先查看安装版本的帮助，而不是直接照抄网上的脚本**。

## 5. 读入、编译与展开 RTL

下列两种做法是供学习的可选路径，通常只需选其中一种，不要在同一个工程里无条件地把 `read_file` 和 `analyze/elaborate` 都做一遍：

```tcl
# 一步读入并完成展开
read_file -top counter -sva -format sverilog -vcs {-f filelist.f}

# 或者分步编译
analyze -format sverilog -vcs {-f filelist.f}
elaborate counter -sva
```

`read_file` 负责读入源码并创建形式设计；`analyze` 负责 HDL 分析；`elaborate` 指定顶层并进行展开；`-sva` 表示需要处理断言；`-vcs` 允许传入 VCS 风格的选项；`-format` 应与 HDL 类型对应。`-f filelist.f` 指向采用相对路径的设计列表，必须处理宏、包含目录、编译顺序以及所需的库。参见 User Guide §4.2（第 118 页起）。

建议文件列表写为：

```text
+incdir+./rtl/include
./rtl/counter.sv
./formal/counter_properties.sv
```

有些示例直接把 `bind` 文件放在最后一行；当属性用到包中的定义或其他模块时，应按语言的编译要求安排顺序。遇到语法或层级错误，先确认源文件是否展开成功，再去分析证明失败的原因。

## 6. 时钟与复位定义

```tcl
create_clock clk -period 100
create_reset rst_n -sense low
set_constant test_mode -value 1'b0
set_change_at -clock clk -default
```

`create_clock` 声明逻辑时钟；这里的 `-period 100` 是形式时钟配置中的周期单位，不能不加说明就把它解释成目标芯片的物理时间；`create_reset` 描述复位信号及其有效电平；`set_constant` 对测试模式等稳定输入建模；`set_change_at` 用来约束输入可以在哪个时钟边沿或时序位置变化（多时钟设计要特别注意）。这些命令并不等同于在 STA 中完成时序约束，也不会自动描述完整的上电过程。

### 6.1 建立复位后的初始化状态

```tcl
sim_run -stable
sim_run 2 -clk clk
sim_save_reset
view_trace -reset
```

这只是操作顺序的示意，并不是对任何 DUT 都成立的复位过程。如果复位需要由外部拉高或拉低，就必须按真实的复位时序添加 `sim_force`、`sim_run` 等操作；保存前应该用 `sim_get` 或可视化追踪检查寄存器值。不要因为示例里写了两拍，就把所有芯片的复位过程都固定成两拍。参见 User Guide §4.13。

### 6.2 多时钟处理

对每一个独立时钟域，分别确定时钟定义、输入变化时机和复位释放规则。不要把异步时钟错误地设成固定整数倍的同步时钟，以换取快速的证明。对于异步握手，接口级假设应该来自 CDC 规格，而不是简单地假定采样不会遇到亚稳态。形式分析的二值逻辑模型一般不能直接证明模拟亚稳态的物理概率。

### 6.3 初始复位与运行中复位是不同任务

`create_reset` 和初始化仿真主要用于建立证明的起始状态。初始化完成后，复位信号在常见流程中会保持无效，让引擎从复位后的状态开始探索正常运行。如果规格还要求处理中途复位、某个电源域单独复位或复位交错，就必须另外建立允许这些事件的模型和属性，不能从一次初始化成功就推断全部复位行为都正确。

`disable iff` 的作用也不同：它描述在哪些时刻中止属性尝试，而不是在验证环境中生成复位波形。把所有重要属性都在复位期间禁用，只能避免用正常运行规则去检查复位过程，并没有证明复位值、释放顺序或未复位寄存器的有效性。来源：User Guide，第 138–154 页。

## 7. 检查准备状态

```tcl
report_blackbox
report_formal_setup
report_fv_complexity
check_fv_setup -block
report_fv_setup -list
```

核对无意中产生的黑盒、未定义实例、时钟/复位检测、设计复杂度以及组合反馈等结构问题。`check_fv_setup` 的结果属于**环境检查**，并不等于完成了功能证明。黑盒范围过大可能让断言看起来更容易通过，也可能产生不切实际的反例。

## 8. 属性管理、运行、输出

```tcl
# 下面是运行阶段的常用命令
report_fv -list
set_fml_var fml_max_time 2H
set_fml_var fml_max_memory 16GB
check_fv -block
report_fv
report_fv -verbose
```

`fvassert`、`fvassume`、`fvcover` 可以在 Tcl 环境中创建或改变属性的角色。复杂的时序 SVA 最好用 SV 文件管理，便于维护、测试和版本审查。属性状态需要按分组和任务核对；`check_fv` 未指定 `-block` 时可能以后台方式运行，输出报告时要确认检查已经完成。运行后的文字报告和反例都应随任务一起保存。

## 9. 计算资源与回归

```tcl
set_fml_var fml_effort default
set_fml_var fml_max_time 4H
set_fml_var fml_max_memory 32GB
report_fml_engines
report_fml_jobs
report_fml_hosts
# 如果本机与网格环境支持，可配置调度方式：
# set_grid_usage -type RSH=4
```

`fml_effort` 是预设的求解努力程度策略。更高的资源投入不能保证所有属性最终都能完成；过度并行也可能受到单机内存和许可证数量的限制。大型项目建议按模块、属性类别和运行目的来组织任务，并在同等硬件条件下比较优化效果。可选的 `fvlearn_config -local_dir rma_db` 适用于符合条件的回归加速流程，详见 User Guide §5。

## 10. 会话、图形调试与工作区

```tcl
save_session -session my_session
restore_session -session my_session
view_trace -property my_assertion
```

工具重启时可以执行 `vcf -restore -session my_session`。注意会话文件和相应的数据库是否一起备份；设计或约束改动后，不应直接把旧结果当作新版本的证明。Verdi 的属性列表、源代码定位、反例波形和结构视图可以用来追踪失败的属性；对于没有图形环境的服务器，可以先保留文字报告，再移交调试。

## 11. 命令出现错误时的检查顺序

1. 命令无法识别：先查看 `get_fml_appmode`、该应用的专属帮助以及版本差异，尤其注意 `COV`/`FCA`。
2. 找不到文件：确认执行目录，检查 `filelist.f` 中的相对路径、`+incdir+`、宏定义和权限。
3. 属性列表为空：检查 `-sva`、`bind` 编译是否生效、顶层以及属性是否被禁用。
4. 出现大量未知初始状态：重新确认复位/初始化的保存，避免直接把初始状态强制成期望结果。
5. 反例路径异常：检查外部假设、时钟关系、非法的环境输入以及黑盒。
6. 显示已证明却无法触发：补充 `cover`、空洞性分析和约束可满足性检查。
7. 证明超时：先缩小验证目标和影响锥，再调整引擎、内存和运行时限。

## 12. 官方资料索引

- User Guide §2 第 53～65 页：环境、启动与模式。
- §3 第 66～114 页：约束、属性、SVA 与属性管理。
- §4 第 115～170 页：编译、时钟、复位、初始状态和设计检查。
- §5～8 第 171～344 页：回归加速、运行控制、结果调试和工作区。
- Quick Reference Guide 第 1～34 页：各应用最常用命令的快速定位。**快速指南并不是完整的命令参考书。**
