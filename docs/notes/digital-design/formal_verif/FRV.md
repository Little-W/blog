---
title: FRV：形式寄存器验证指南
tags: [形式验证, 数字IC, VC Formal, FRV, 寄存器验证]
---

# FRV：形式寄存器验证使用指南

## 1. 典型目标和输入资料

SoC 中寄存器字段数量多，容易出现复位值错误、读写权限错误、写一清零行为错误、保留位处理错误、地址别名或总线包装接口问题。FRV 通过寄存器说明文件（IP-XACT XML、RALF 等）提取字段规则，产生并运行形式检查；其价值在于减少重复手工编写针对每个寄存器位的测试与断言。

输入至少包括真实 RTL、寄存器规格文件、总线协议适配及形式环境。特别注意：寄存器文件包含的**理想行为**必须与设计真实的事务接口含义一致；仅有 XML 不会使工具自动猜到哪一条总线读写应对应哪个寄存器。

## 2. 核心概念

| 寄存器属性 | 预期行为 | 应验证的例子 |
| --- | --- | --- |
| Reset value | 复位后默认值 | 配置字段复位为零 |
| RW | 可读可写 | 写入已接受后读回一致 |
| RO | 只读 | 总线写入不能改变状态 |
| WO | 只写 | 读取行为应符合规格定义 |
| W1C | 写 1 清零 | 写 1 清对应位，写 0 不清 |
| W1S | 写 1 置位 | 写 1 置位，其他位不变 |
| Reserved | 保留位 | 写入是否被忽略、读取返回什么 |
| Volatile | 硬件可以自主更新 | 不要求所有周期保持软件写入值 |
| Side effect | 读取或写入有副作用 | 读清除、中断状态操作 |

访问类型决定一次总线事务应当如何改变寄存器，而复位值规定启动状态，两者需要分开验证。以写一清零字段为例，写入一的位应清除，写入零的位应保持；字节使能关闭的位也应保持。若硬件事件与软件写入同拍发生，还必须在规格中给出优先级，否则工具无法从地址和访问类型推导唯一预期结果。

字段策略由寄存器规范决定。不要把没有发生读写握手的周期当作已接受事务，也不能把硬件会自动变化的计数器字段视作永远保持的软件配置值。

### 2.1 自动断言检查哪条路径

| 断言类别 | 对照对象 | 含义 |
| --- | --- | --- |
| 首次读回与写后读回 | 总线读取值与复位值或最近写入值 | 检查外部可见寄存器行为 |
| 后门初值 | 内部字段与规定初始值 | 检查复位后首个周期的内部状态 |
| 后门读取 | 总线读回与指定周期的内部字段 | 检查读路径及延迟对应 |
| 后门写入 | 总线写入与随后内部字段 | 检查写路径及更新延迟 |
| 地址块以外读取 | 块外访问的返回值 | 检查规格定义的越界访问处理 |

总线检查回答软件看到的数据是否正确，后门检查直接观察内部字段，两者可以同时用于区分“寄存器没有更新”和“寄存器更新了但读路径错误”。是否生成某条检查还受访问类型、是否提供初始值、是否提供后门信号以及 `COMPOSITE` 等参数影响。地址块外访问若设计返回错误响应，数据检查可能空通过；这种接口行为应按规格配置，而不是为了增加目标数量强行要求返回普通数据。

自动生成名称中的 `<attr>` 是字段访问属性相关占位内容。UG 列出的命名形式如下，生成后的真实属性名应从报告中取得：

```text
ast_<attr>_read_data_check
ast_<attr>_initial_read_check
ast_<attr>_write_read_check
ast_<attr>_bdr_initial_check
ast_<attr>_bdr_read_check
ast_<attr>_bdr_write_check
ast_out_adblk_read_check
```

### 2.2 覆盖目标按访问顺序编排

| 分组 | 覆盖对象 | 要确认的场景 |
| --- | --- | --- |
| 本寄存器读写历史 | 首次读、写后读、再次读 | 初始化和写入后的访问均可发生 |
| 交错访问 | 写入后插入其他地址访问再读回 | 周边访问不阻止目标序列出现 |
| 首次访问前的其他访问 | 其他地址访问后首次读或写 | 非空历史下仍能访问目标字段 |
| 访问权限 | 向只读字段写、从只写字段读 | 禁止方向的请求没有被环境直接排除 |
| 用户指定地址 | 指定地址与目标字段的交错顺序 | 特殊副作用和地址关系能够触发 |
| 有效字节通道 | 字节使能覆盖目标 | 字段的有效字节通道确实更新 |

**本寄存器的四种基本历史**区分第一次读是否发生在写之前，以及再次读之前是否已发生写入。覆盖这些场景有助于发现环境把首次访问固定为写入，从而掩盖复位值检查的问题。

```text
cov_first_read_before_write
cov_first_read_after_write
cov_read_after_read_before_write
cov_read_after_read_and_write
```

**交错访问的目标**要求先写目标寄存器，在中间访问其他地址，再读回目标寄存器。其中 `diff_addr` 表示其他寄存器地址，`out_addr` 表示地址块以外，`user_addr` 表示用户指定地址。它们只证明访问顺序可出现，数据是否保持仍由相应断言证明。

```text
cov_diff_addr_write_between_write_read
cov_diff_addr_read_between_write_read
cov_out_addr_write_between_write_read
cov_out_addr_read_between_write_read
cov_user_addr_write_between_write_read
cov_user_addr_read_between_write_read
```

**首次目标访问之前的历史**有四种组合：先读其他地址再首次写目标，先写其他地址再首次读目标，先写其他地址再首次写目标，以及先读其他地址再首次读目标。每种组合分别对应普通其他地址、地址块外地址和用户指定地址。

```text
cov_diff_addr_read_before_first_write
cov_out_addr_read_before_first_write
cov_user_addr_read_before_first_write
cov_diff_addr_write_before_first_read
cov_out_addr_write_before_first_read
cov_user_addr_write_before_first_read
cov_diff_addr_write_before_first_write
cov_out_addr_write_before_first_write
cov_user_addr_write_before_first_write
cov_diff_addr_read_before_first_read
cov_out_addr_read_before_first_read
cov_user_addr_read_before_first_read
```

**权限与字节使能场景**不应被理解为要求非法操作成功。只读字段允许收到写请求，但规格可能要求忽略写入或报错；该请求应能够到达，随后由断言检查正确处理。字节通道目标则检查目标字段的有效字节通道是否发生更新，不能代替逐字节的保持和更新规则。

```text
cov_read_only_write
cov_write_only_read
cov_valid_byte_lane_updated
```

以上按行为分组列出 UG 的 25 个覆盖名称，而不是把每个名称拆成孤立小段。UG 明确将其中一组用户地址目标列为默认不生成，后续版本增加的目标也仍受参数和适用条件控制；不能假定每个字段默认产生全部 25 项。来源：User Guide，第 622–625 页。

## 3. 寄存器规格与 RTL 的对照

例如有 `CTRL`（地址 0x00，位 0 使能，RW）、`STATUS`（地址 0x04，位 0 完成，W1C）。典型教学实现是：接受对 `CTRL` 地址的写入后更新使能位；`STATUS.done` 由硬件事件置位、软件向对应位写 1 清除；异步复位全部清零。对应检查至少覆盖默认值、RW 正常写入、W1C 保持和清零，以及无效地址的处理。

FRV 的自动检查可以缩小手工工作量，但对多写入源冲突、硬件置位和软件清零同周期优先级等复杂语义，通常仍需要补充明确的 SVA。假定硬件事件优先级高于 W1C，需要实现与规格一致的条件判断。

### 3.1 完整教学实现与手写属性

以下把上述规格写成可以独立保存的 RTL 和 SVA。接口不是 APB/AXI：`wr_en=1` 的上升沿立即接受写入，读取是由 `rd_en` 控制的组合输出；无字节使能，无等待周期。这样可以先理解 RW、W1C 与硬件置位优先级，再接入真实总线。

#### 3.1.1 寄存器 RTL

**保存为 `案例工程/rtl/reg_block_demo.sv`：**

<!-- source-begin: 案例工程/rtl/reg_block_demo.sv -->

```systemverilog
// 单周期教学寄存器接口，不是 APB/AXI 适配器。
// 上升沿 wr_en=1 即接受写入；rd_en=1 时组合读出。
module reg_block_demo (
  input  logic        clk, rst_n,
  input  logic        wr_en, rd_en,
  input  logic [7:0]  addr,
  input  logic [31:0] wdata,
  input  logic        hw_done,
  output logic [31:0] rdata,
  output logic        ctrl_enable, status_done
);
  localparam logic [7:0] CTRL_ADDR   = 8'h00;
  localparam logic [7:0] STATUS_ADDR = 8'h04;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      ctrl_enable <= 1'b0;
      status_done <= 1'b0;
    end else begin
      // CTRL[0] 为 RW，其他位忽略写入。
      if (wr_en && addr == CTRL_ADDR)
        ctrl_enable <= wdata[0];

      // 硬件置位优先于软件写一清零；写零保持原状态。
      if (hw_done)
        status_done <= 1'b1;
      else if (wr_en && addr == STATUS_ADDR && wdata[0])
        status_done <= 1'b0;
    end
  end

  always_comb begin
    rdata = 32'd0;
    if (rd_en) begin
      case (addr)
        CTRL_ADDR:   rdata = {31'd0, ctrl_enable};
        STATUS_ADDR: rdata = {31'd0, status_done};
        default:     rdata = 32'd0;
      endcase
    end
  end
endmodule
```

<!-- source-end -->

#### 3.1.2 完整检查器

W1C 检查只有在上一拍没有硬件事件时才要求清零；如果硬件事件和软件写清除同时发生，本例明确要求硬件置位优先。

**保存为 `案例工程/formal/reg_block_demo_props.sv`：**

<!-- source-begin: 案例工程/formal/reg_block_demo_props.sv -->

```systemverilog
module reg_block_demo_props (
  input logic clk, rst_n, wr_en, rd_en, hw_done,
  input logic [7:0] addr,
  input logic [31:0] wdata, rdata,
  input logic ctrl_enable, status_done
);
  logic history_valid;
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) history_valid <= 1'b0;
    else        history_valid <= 1'b1;

  // 当前采样值应等于上一拍已接受写事务的结果。
  ap_rw_write: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid && $past(wr_en && addr == 8'h00)
      |-> ctrl_enable == $past(wdata[0]));
  ap_rw_hold: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid && !$past(wr_en && addr == 8'h00)
      |-> ctrl_enable == $past(ctrl_enable));
  ap_hw_set_priority: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid && $past(hw_done) |-> status_done);
  ap_w1c: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid && $past(!hw_done && wr_en && addr == 8'h04 && wdata[0])
      |-> !status_done);
  ap_status_hold: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid && $past(!hw_done && !(wr_en && addr == 8'h04 && wdata[0]))
      |-> status_done == $past(status_done));

  ap_read_ctrl: assert property (@(posedge clk) disable iff (!rst_n)
    rd_en && addr == 8'h00 |-> rdata == {31'd0, ctrl_enable});
  ap_read_status: assert property (@(posedge clk) disable iff (!rst_n)
    rd_en && addr == 8'h04 |-> rdata == {31'd0, status_done});
  ap_read_default: assert property (@(posedge clk) disable iff (!rst_n)
    (!rd_en || (addr != 8'h00 && addr != 8'h04)) |-> rdata == 32'd0);

  // 不使用 disable iff，单独说明采样到复位时的后继状态。
  ap_reset: assert property (@(posedge clk)
    !rst_n |=> !ctrl_enable && !status_done);
  cp_hw_sw_conflict: cover property (@(posedge clk) disable iff (!rst_n)
    hw_done && wr_en && addr == 8'h04 && wdata[0]);
endmodule

bind reg_block_demo reg_block_demo_props u_reg_props (.*);
```

<!-- source-end -->

#### 3.1.3 文件列表

**保存为 `案例工程/filelist_fpv_register_demo.f`：**

<!-- source-begin: 案例工程/filelist_fpv_register_demo.f -->

```text
./rtl/reg_block_demo.sv
./formal/reg_block_demo_props.sv
```

<!-- source-end -->

#### 3.1.4 手写属性的 FPV 运行脚本

这是 FRV 专章中的配套 FPV 练习，不调用 `frv_load`，不会生成 FRV 自动检查器。

**保存为 `案例工程/scripts/fpv_register_demo.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_register_demo.tcl -->

```tcl
# 从案例工程目录执行；结果必须以本机 VC Formal 日志为准。
set_fml_appmode FPV
read_file -top reg_block_demo -sva -format sverilog -vcs {-f filelist_fpv_register_demo.f}
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
vcf -f scripts/fpv_register_demo.tcl -batch 2>&1 | tee logs/fpv_register_demo.log
```

**检查范围。** 本节源码足以说明并验证这个简化接口下的寄存器规则，但不能替代 FRV 对 IP-XACT/RALF 的加载、总线适配和自动生成属性。原生 FRV 工程仍须由本节之后的规格输入及接口桥接组成。

## 4. 一个最小脚本模板

```tcl
set_fml_appmode FRV
# 二选一：实际工程提供寄存器描述文件
frv_load -ral registers.ralf -top block:REG_BLOCK -auto_load
# frv_load -ipxact registers.xml -auto_load
read_file -top reg_block -sva -format sverilog \
  -vcs {-f filelist_reg.f} bind_frv.sv
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
report_fv -class register -list
check_fv -block
frv_report
report_fv -class register -verbose
```

`bind_frv.sv` 必须实现与实际总线的接口对应关系，不能把此占位文件视作工具自动生成的所有环境组件。在上述 `-top block:REG_BLOCK` 中，`REG_BLOCK` 是 RALF 定义的地址块名称，**不是随意从 RTL 顶层抄来的实例名**；如果使用其他层级，可指定 `comp:`、`mmap:` 或 `block:`，详见 UG 第 626～630 页。IP-XACT 和 RALF 的可支持字段、命名空间及访问类型以该版本 User Guide 16.4～16.11 为准。

### 4.1 原生 FRV 模板完整源码

它保留防误执行的 `error`；RALF/IP-XACT、生成检查器接口以及真实总线绑定并未伪造成已经存在的文件。补齐输入并审查后才能启用相应命令。

**保存为 `案例工程/templates/frv_ralf.tcl`：**

<!-- source-begin: 案例工程/templates/frv_ralf.tcl -->

```tcl
# FRV：RALF/IP-XACT 寄存器检查模板。绝不能原样执行。
# 替换 RTL 顶层、RALF、总线桥接与复位时序，并审核寄存器访问与检查器绑定。
error "此文件是 FRV 教学模板：请先替换设计、寄存器定义、接口桥接和复位序列"
set_fml_appmode FRV
# frv_load -ral /project/csr/regs.ralf -top block:REG_BLOCK -auto_load
# read_file -top reg_top -sva -format sverilog -vcs {-f filelist_reg.f} bind_frv.sv
# create_clock clk -period 100
# create_reset rst_n -sense low
# sim_run -stable
# sim_save_reset
# check_fv -block
# frv_report
```

<!-- source-end -->

## 5. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `frv_load` | 从寄存器规格生成并装入检查器 |
| `frv_config` | 控制寄存器属性生成范围 |
| `frv_report` | 检查规格解析与属性生成情况 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 5.1 `frv_load`：从寄存器规格生成并装入检查器

```text
frv_load [-ipxact <file>] [-ral <file>] [-csv <file>]
  [-bind <bind_file>] [-top <[comp|mmap|block]:name>]
  [-checker_file <file>] [-include <type_list>]
  [-auto_load] [-parameters <parameter_list>] [-verbose]
```

**参数解释。** `-ipxact`、`-ral`、`-csv` 选择相应格式的寄存器规格，工程应明确选择自己的输入格式，不把三种规格混在一次调用中。`-bind` 给出总线连接文件；`-checker_file` 指定生成的检查器文件名，默认 frv.sv。`-top` 限定 component、memoryMap 或 addressBlock；不写类型时依次按 comp、mmap、block 查找，同名对象可使用完整层次。

`-include` 可选 unmapped、unmapped_reg、unmapped_field、reserved、reserved_reg、reserved_field。包含保留或未分配空间后，还需设置 RSVD_MODE：0 不检查，1 期望全零，2 期望全一，3 使用 snps:outAddrValue 自定义值。`-auto_load` 装入生成的检查器、绑定文件和依赖库。`-parameters` 是 Tcl 参数列表，例如 `{RSVD_MODE=1 COVER_READ=1}`；支持的检查器参数还包括 ADDR_WIDTH、DATA_WIDTH、COMPOSITE、BUS_LATENCY、WR_LATENCY、RD_LATENCY、COVER_TYPE、COVER_WRITE、COVER_BYTE_UPDATE、OUTADDR_EN、LATENCY_MD、OUTABLK_MD、SNPS_AD_ABS、COVER_ALLOW_ERROR。`-verbose` 显示不支持的结构，而不是静默忽略。

**用法与结果。** 该命令生成检查器，不代表已经完成证明。总线包装必须把协议事件转换成检查器所需的读写事件；APB/AHB/AXI 包装在安装目录的 Frv 包中，其他协议需要检查并适配通用包装。原文示例部分用 `-parameter`，正式语法用 `-parameters`，正文统一使用后者，不依赖工具对缩写的接受行为。

```tcl
frv_config -generate_covers true
frv_load -ipxact regs.xml -bind regs_bind.sv \
  -top block:soc.main.regs -include {reserved_field} \
  -parameters {RSVD_MODE=1 COVER_READ=1 COVER_WRITE=1} \
  -auto_load -verbose
frv_report
```

来源：User Guide，X-2025.06-SP1，第 626–630 页。

### 5.2 `frv_config`：控制寄存器属性生成范围

```text
frv_config [-generate_backdoor_checks <boolean>]
  [-generate_covers <boolean>]
  [-generate_out_of_block_range_checks <true|false>:<0|1>]
  [-ignore <type_list>] [-disable_backdoor_checks <reg_array|all>]
  [-generate_wo_read_check <boolean>]
  [-generate_wo_read_check_value <value>]
  [-generate_bdrsig_from_name] [-enable_fiv <true|false>]
  [-enable_volatile_check <none|with_hw_update|all>]
```

**参数解释。** 反向观察检查与 cover 生成默认开启；地址块之外的检查默认关闭。`-generate_out_of_block_range_checks` 同时给出开关及期望读值，期望值只能为 0 或 1，省略时默认 0。`-ignore` 当前列出 unknown_access；`-disable_backdoor_checks` 可禁用寄存器数组或全部反向观察检查。

`-generate_wo_read_check` 默认关闭，开启后再用 `-generate_wo_read_check_value` 指定只写字段被读时的期望值，顺序不能颠倒。`-generate_bdrsig_from_name` 根据规格的 name 属性生成 RTL 信号路径，只有名称确实对应 RTL 时才可用。`-enable_fiv` 默认 false；`-enable_volatile_check` 默认 none，with_hw_update 只对带硬件更新描述的易变字段生成读数据检查，all 对所有此类字段生成。

**用法与结果。** 必须在 `frv_load` 之前配置，因为这些选项决定生成哪些属性，而不是仅在结果报告时过滤。无参数调用打印当前默认配置，适合保存到运行日志。boolean 选项按原文支持 true/false 或 1/0；对明确只列 true/false 的选项保持该拼写。

```tcl
frv_config -generate_covers true
frv_config -generate_wo_read_check true
frv_config -generate_wo_read_check_value 0
frv_config -enable_volatile_check with_hw_update
frv_config
frv_load -ipxact regs.xml -auto_load
```

来源：User Guide，X-2025.06-SP1，第 630–632 页。

### 5.3 `frv_report`：检查规格解析与属性生成情况

```text
frv_report [-hide_fields] [-no_summary]
  [-top <[comp|mmap|block]:name>]
  [-vendor_extensions <[comp|mmap|block]:hierarchical_name>]
  [-filter <expression>]
```

**参数解释。** `-hide_fields` 隐藏字段细节，`-no_summary` 隐藏汇总。`-top` 限定规格对象，类型省略时按 comp、mmap、block 查找。`-vendor_extensions` 展开指定寄存器或字段的厂商扩展信息。`-filter` 支持 regAccess、fieldAccess，以 `==` 或 `!=` 比较访问类型。

**用法与结果。** 应在证明前检查寄存器数量、地址、属性数量与预期是否一致。缺少寄存器或字段检查往往来自规格格式、访问类型、包含范围或参数设置，不能用“所有已生成断言通过”来掩盖漏生成。

```tcl
frv_report
frv_report -filter {regAccess == rw}
frv_report -top block:soc.main.regs -hide_fields
frv_report -vendor_extensions block:soc.main.regs.CTRL.EN
```

来源：User Guide，X-2025.06-SP1，第 632–633 页。

### 5.4 FRV 检查器和总线桥接的实际组成

UG 第 627 页说明，`frv_load` 可以生成专用的 SVA 检查器文件（默认 `frv.sv`），并可用 `-auto_load` 自动装入生成的检查器、绑定文件及库文件。对于常见的 AMBA 总线，安装目录 `$VC_STATIC_HOME/packages/Frv/` 还包含 APB、AHB、AXI 的预制适配模块，以及用于简单非 AMBA 接口的通用适配模块。

| 典型路径 | 用途 |
| --- | --- |
| `snps_frv_apb_wrapper.sv` | APB 总线寄存器访问抽象 |
| `snps_frv_ahb_wrapper.sv` | AHB 总线寄存器访问抽象 |
| `snps_frv_axi_wrapper.sv` | AXI 总线寄存器访问抽象 |
| `snps_frv_gen_wrapper.sv` | 一般寄存器读写接口示例 |

桥接模块主要负责把总线请求、响应、地址和有效数据准确提供给属性检查器。**提供预制适配模块并不意味着可以免除总线配置检查**：例如 AXI 的 `ready/valid` 接受时刻、超时和响应对应关系仍需核实。若 IP 自定义了特殊握手，需要编写自己的适配器并检查覆盖目标是否生成。

### 5.5 关于 `-parameter` / `-parameters` 的说明

同一版 UG 第 626 页的语法框将选项写成 `-parameters`，随后第 630 页示例写成 `frv_load -parameter {...}`。正文语法统一采用语法框中的 `-parameters`；不推断两种拼写均被 Tcl 接受。移植已有脚本时，使用安装版本的命令帮助确认是否支持示例中的简写。

## 6. 结果分析的方法

如果复位值属性失败：检查该寄存器是不是在真实复位域内、复位序列是否正确、字段是否含上电未知值。若读回失败：先确定读请求是否被接受以及返回数据何时有效，再检查寄存器地址、字节使能与读数据对齐。若 W1C 失败：检查写入掩码、硬件事件与软件写清除的优先级。若很多属性都没被生成：核对寄存器描述路径与映射，不要直接把“没有失败”理解为“寄存器全部正确”。

## 7. 与 UVM RAL、仿真和 FPGA/SoC 寄存器校验的配合

软件寄存器模型适合生成仿真激励和软件驱动期望值；FRV 可以对寄存器行为进行更系统的逻辑证明。两者应复用同一权威寄存器描述，避免手工维护两份不一致的默认值。对异步硬件更新、跨时钟寄存器和只在某个模式下可写的寄存器，还应有专用接口前提和 SVA 约束。

## 8. 工程清单

- 确认 IP-XACT/RALF 字段地址、宽度、复位和访问类型均与规格一致。
- 确认总线读写接受点、字节使能、错误响应、超时与复位行为。
- 确认已经报告并审查 FRV 自动生成属性的数量及类别。
- 对 W1C/W1S/volatile/自清除等字段增加必要的手工检查。
- 对无法证明、豁免和未支持的字段单独汇总，而不是将其遗漏。

## 9. 参考资料

User Guide §16（619～685 页）及附录中的相关设计查询命令；工具安装目录 `<VC_STATIC_INSTALL>/doc/vcst/examples/FRV` 可寻找官方示例（若随本机安装）。
