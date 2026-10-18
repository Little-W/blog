---
title: VC Formal 平台、环境与命令执行
tags: [形式验证, 数字IC, VC Formal, 环境配置]
---

# VC Formal 平台、环境与命令执行

## 1. 平台定位与基本结构

VC Formal 是 Synopsys 的形式验证平台，以共同的编译、展开、属性管理、求解、报告及调试环境提供不同应用。它支持以传统 RTL 与约束出发的功能属性验证，也支持自动提取问题、基于结构连接列表的检查、顺序等价分析、安全性分析等专用任务。

![VC Formal 应用布局](插图/03_应用布局.svg)

一个验证任务一般由六个部分构成：RTL 或参考模型；SVA/CSV/寄存器描述/故障模型等规格输入；时钟复位与环境假设；证明引擎与资源策略；反例及结果报告；必要时的 Verdi 图形调试。不同应用共享 Tcl 外壳，但**应用模式、专业命令与输入数据类型并不统一**。

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

2025 年 9 月快速指南的 FCA 命令行示例使用 `set_fml_appmode FCA`，但同版本 1,168 页 User Guide 在第 65、395、430 页明确展示 `COV`。本教程的 FCA 脚本以 `COV` 为首选，启动后通过 `get_fml_appmode` 确认。FTA 模式在 User Guide 第 65 页明确指出不应直接使用 `vcf -fmode FTA` 启动，而应在 VC Formal 会话内用 `set_fml_appmode FTA`。这两处必须与实际安装版本核对。

## 3. 环境准备

正式环境通常需要 Linux 主机、已安装的 VC Formal / VC Static 相关组件、相应许可证，以及可用的 Verdi（仅在图形调试需要时）。具体支持的平台、许可证名称、最低内存与批量计算系统应以单位内部安装说明及实际版本的安装指南为准，不能从本文推断许可证一定已开通。

首先在终端确认：

```bash
which vcf
vcf -help
pwd
```

工具可以从 `-f` 读取 Tcl 脚本。推荐从**项目根目录**执行，以使源文件列表和日志位置一致：

```bash
vcf -f scripts/run_fpv.tcl -batch
vcf -f scripts/run_fpv.tcl -verdi
vcf -f scripts/run_fpv.tcl
```

典型授权选项示例：`-fml_elite`、`-fml_token`；只有在内部许可证策略支持且确实有需要时再使用。实际提示和参数通过 `vcf -help` 检查，不要把 shell 指令原样放入 Tcl 脚本。

### 3.1 首次运行所需的全部文件

环境准备后，可以先保存以下最小工程。本节给出 RTL、检查器、文件列表和 Tcl 的完整内容。后续章节再解释这些命令和属性的细节。

### 3.1.1 被验证的计数器 RTL

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

### 3.1.2 完整断言与绑定文件

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

### 3.1.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径相对于运行 VC Formal 的 `案例工程/` 目录，而不是 Tcl 文件所在目录。

**保存为 `案例工程/filelist_counter.f`：**

<!-- source-begin: 案例工程/filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 3.1.4 完整运行脚本

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

`help` 与 `-help` 用于核对命令接受的选项；`man`、`view_help` 调出较长帮助；`report_fml_var` 用于查询形式变量，`report_app_var` 用于应用变量。变量归属不能随便互换：有的需要 `set_fml_var`，有的需要 `set_app_var`。**优先执行安装版本的帮助而不是直接复制网络脚本**。

## 5. 读入、编译与展开 RTL

下列两种是供学习的可选路径，通常选其中一种，而不是把 `read_file` 和 `analyze/elaborate` 在同一工程里无条件重复：

```tcl
# 一步读入并完成展开
read_file -top counter -sva -format sverilog -vcs {-f filelist.f}

# 或者分步编译
analyze -format sverilog -vcs {-f filelist.f}
elaborate counter -sva
```

`read_file` 负责读入源与创建形式设计；`analyze` 处理 HDL 分析；`elaborate` 指定顶层并进行展开；`-sva` 表示需要处理断言；`-vcs` 允许传递 VCS 风格的选项；`-format` 应与 HDL 类型对应。`-f filelist.f` 指向相对路径的设计列表，必须处理宏、包含目录、编译顺序及需要的库。参见 UG §4.2（第 118 页起）。

建议文件列表写为：

```text
+incdir+./rtl/include
./rtl/counter.sv
./formal/counter_properties.sv
```

有些示例直接把 `bind` 文件放在最后一行；当属性用包中的定义或其他模块时应按语言编译要求安排顺序。遇到语法或层级错误，先检查源文件展开成功再分析证明失败。

## 6. 时钟与复位定义

```tcl
create_clock clk -period 100
create_reset rst_n -sense low
set_constant test_mode -value 1'b0
set_change_at -clock clk -default
```

`create_clock` 声明逻辑时钟；这里的 `-period 100` 为形式时钟配置中的周期单位，不应未经说明就解释成目标芯片的物理时间；`create_reset` 描述复位信号及有效电平；`set_constant` 建模测试模式等稳定输入；`set_change_at` 用于约束输入在哪一时钟边沿或时序位置允许变化（特别注意多时钟设计）。这些命令不等同于 STA 中完成时序约束，也不自动描述完整的上电过程。

### 6.1 建立复位后的初始化状态

```tcl
sim_run -stable
sim_run 2 -clk clk
sim_save_reset
view_trace -reset
```

这是操作顺序示意，不是对任何 DUT 都成立的复位过程。如果复位需要由外部拉高或拉低，必须按真实复位时序添加 `sim_force`、`sim_run` 等操作；保存前应使用 `sim_get` 或可视化追踪检查寄存器值。不要因为示例写了两拍就将所有芯片复位程序固定成两拍。参见 UG §4.13。

### 6.2 多时钟处理

对每一个独立时钟域分别确定时钟定义、输入变化时机和复位释放规则。不要把异步时钟误设成固定整数倍的同步时钟来获得快速的证明。对于异步握手，接口级假设应来自 CDC 规格，而不是简单假定采样不会遇到亚稳态。形式分析的二值逻辑模型一般不直接证明模拟亚稳态的物理概率。

### 6.3 初始复位与运行中复位是不同任务

`create_reset` 与初始化仿真主要用于建立证明的起始状态。初始化完成后，复位信号在常见流程中保持无效，使引擎从复位后的状态探索正常运行。若规格还要求处理中途复位、某个电源域单独复位或复位交错，必须另行建立允许这些事件的模型和属性，不能从一次初始化成功推断全部复位行为正确。

`disable iff` 的作用也不同：它描述哪些时刻中止属性尝试，不是在验证环境中生成复位波形。把所有重要属性都在复位期间禁用，只能避免用正常运行规则检查复位过程，并没有证明复位值、释放顺序或未复位寄存器的有效性。来源：User Guide，第 138–154 页。

## 7. 检查准备状态

```tcl
report_blackbox
report_formal_setup
report_fv_complexity
check_fv_setup -block
report_fv_setup -list
```

核对无意中的黑盒、未定义实例、时钟/复位检测、设计复杂度及组合反馈等结构问题。`check_fv_setup` 的结果属于**环境检查**，不等于完成功能证明。过大的黑盒范围可能令断言看起来更容易，也可能产生不实际的反例。

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

`fvassert`、`fvassume`、`fvcover` 可以在 Tcl 环境中创建或改变属性角色。优先用 SV 文件管理复杂时序 SVA，便于维护、测试、版本审查。属性状态需要按分组与任务核对；`check_fv` 未指定 `-block` 时可能处于后台运行方式，输出报告时要确认检查完成。运行后的文字报告与反例都应随任务保存。

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

`fml_effort` 是求解努力程度的预置策略。更高的资源投入不能保证所有属性最终完成；过度并行也可能受单机内存和许可证数量限制。大型项目推荐按模块、属性类别和运行目的组织任务，并在同等硬件条件下比较优化效果。可选的 `fvlearn_config -local_dir rma_db` 适用于符合条件的回归加速流程，详见 UG §5。

## 10. 会话、图形调试与工作区

```tcl
save_session -session my_session
restore_session -session my_session
view_trace -property my_assertion
```

工具重启时可采用 `vcf -restore -session my_session`。注意会话文件和相应数据库是否一起备份，设计或约束更改后不应直接将旧结果当作新版本的证明。Verdi 的属性列表、源代码定位、反例波形和结构视图可用于追踪失败属性；对于没有图形环境的服务器可以先保留文字报告再移交调试。

## 11. 命令出现错误时的检查顺序

1. 命令不识别：先查 `get_fml_appmode`、该应用专属帮助以及版本差异，尤其注意 `COV`/`FCA`。
2. 文件未找到：确认执行目录，检查 `filelist.f` 中的相对路径、`+incdir+`、宏定义和权限。
3. 属性列表为空：检查 `-sva`、`bind` 编译是否生效、顶层、属性是否被禁用。
4. 大量未知初始状态：重新确认复位/初始化保存，避免把初始状态直接强制为期望结果。
5. 反例路径异常：检查外部假设、时钟关系、非法环境输入及黑盒。
6. 显示已证明但无法触发：补充 `cover`、空洞性分析和约束可满足性检查。
7. 证明超时：先缩小验证目标和影响锥，再调整引擎、内存和运行时限。

## 12. 官方资料索引

- User Guide §2 第 53～65 页：环境、启动与模式。
- §3 第 66～114 页：约束、属性、SVA 与属性管理。
- §4 第 115～170 页：编译、时钟、复位、初始状态及设计检查。
- §5～8 第 171～344 页：回归加速、运行控制、结果调试与工作区。
- Quick Reference Guide 第 1～34 页：各应用最常用命令的快速定位。**快速指南并不是完整命令参考书。**
