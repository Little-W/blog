# FSV：形式安全信息流验证使用指南

## 1. 目标：检查本不应出现的信息传播

数字系统可能包含安全域与普通域。安全域中的密钥、认证状态、受保护计数器等信息不能在未授权条件下影响普通域输出；普通域输入也不能未经允许改变关键安全状态。FSV 用形式化的来源、目的及传播条件描述这些安全信息流要求。

与一般 CC 不同，FSV 不只是检查“需要的连接是否存在”，还要检查**禁止的信息传播是否可能发生**。示例：安全密钥不允许直接或间接影响公开的调试端口；普通外设不能未经权限检查更新可信启动状态。可见信息流分析并不自动涵盖时间侧信道、功耗侧信道以及模拟泄漏。

![FSV 安全域隔离](插图/12_FSV信息流.svg)

## 2. 什么是信息流与非干扰

假设存在高安全级输入 `secret` 和低安全级输出 `public_out`。一种非干扰（noninterference）性质要求：当普通级输入和合法初态相同时，改变 `secret` 不得改变 `public_out`，除非系统允许某种已定义的解密或公开处理。它是一种关于两种输入情况的关系，而不只是单条波形上某个值等于零。

FSV 通过源和目的定义生成信息流属性，并在形式环境中检查合法传播范围。对于含授权条件、故障检测条件或某些模式允许公开的数据，必须建模对应条件，不能只无条件禁止全部传播。

## 3. 典型命令结构

```tcl
set_fml_appmode FSV
read_file -top security_top -format sverilog -vcs {-f filelist.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
fsv_generate -src secret_key -dest debug_out
check_fv -block
fsv_report
report_fv -list
```

脚本中信号名和复位过程是教学占位，真正的形式模型必须包含完整的普通输入、授权模式及初态。`fsv_generate` 的实际语法支持一个或多个源、一个或多个目的，以及 `-src_condition`、`-dest_condition`、`-exclude`、`-name`、`-zone` 等选项（见 User Guide 第 966 页）。

### 3.1 面向真实系统的完整模板

此模板用于替换成真实安全域层级；第 5 节另有完整的小型设计与运行脚本。这里保留保护性 `error`，不会把尚未审查的系统安全策略自动启用。

**保存为 `案例工程/templates/fsv_secure_flow.tcl`：**

<!-- source-begin: 案例工程/templates/fsv_secure_flow.tcl -->

```tcl
# FSV：信息流安全。请先完成 source、destination 与授权策略审查。
error "此文件是 FSV 教学模板：必须指定真正的安全源与公开输出"
# set_fml_appmode FSV
# read_file -top secure_top -format sverilog -vcs {-f filelist.f}
# create_clock clk -period 100
# create_reset rst_n -sense low
# sim_run -stable
# sim_save_reset
# fsv_generate -src u_core.secret -dest u_dbg.out
# check_fv -block
# fsv_report
```

<!-- source-end -->

## 4. 可控的允许传播

有些设计需要在合法授权后输出秘密信息的某种变换结果，例如密钥派生操作的授权输出。此时不能简单禁止所有相关数据依赖，而应制定允许传播的安全策略。FSV 的 `-src_condition`、`-dest_condition` 等选项可帮助表达仅对特定工作条件分析的信息传播。任何白名单范围都需要安全审查，避免授权信号可由不可信输入随意置位。

## 5. 案例：保护调试输出的完整工程

策略是：无论调试是否开启，公开输出都不得依赖 `secret_key`。允许调试输出普通状态，但不允许输出秘密数据。本节不用“调试永久关闭”这样的假设掩盖泄漏。

### 5.1 正确版本 RTL

**保存为 `案例工程/rtl/debug_guard.sv`：**

<!-- source-begin: 案例工程/rtl/debug_guard.sv -->

```systemverilog
// 安全策略：公开调试输出永远不得依赖 secret_key。
module debug_guard (
  input  logic       clk, rst_n, debug_enable,
  input  logic [7:0] secret_key, normal_status,
  output logic [7:0] debug_out
);
  always_comb begin
    if (debug_enable) debug_out = normal_status;
    else              debug_out = 8'h00;
  end
endmodule
```

<!-- source-end -->

### 5.2 故意泄漏的完整 RTL

两份文件模块名相同，必须分别读入。坏版只把普通状态替换为秘密数据，让读者能看清被检查的差异。

**保存为 `案例工程/rtl/debug_guard_bad.sv`：**

<!-- source-begin: 案例工程/rtl/debug_guard_bad.sv -->

```systemverilog
// 故意泄漏版本；模块名与正确版相同，必须分开编译。
module debug_guard (
  input  logic       clk, rst_n, debug_enable,
  input  logic [7:0] secret_key, normal_status,
  output logic [7:0] debug_out
);
  always_comb begin
    if (debug_enable) debug_out = secret_key;
    else              debug_out = 8'h00;
  end
endmodule
```

<!-- source-end -->

### 5.3 正确版文件列表

**保存为 `案例工程/filelist_fsv_good.f`：**

<!-- source-begin: 案例工程/filelist_fsv_good.f -->

```text
./rtl/debug_guard.sv
```

<!-- source-end -->

### 5.4 正确版完整 FSV 脚本

本例有明确的源、目的与实际 RTL，不再只使用 `security_top/filelist.f` 占位名称。仍须核对本机 `fsv_generate` 的接口及对象解析结果。

**保存为 `案例工程/scripts/fsv_debug_good.tcl`：**

<!-- source-begin: 案例工程/scripts/fsv_debug_good.tcl -->

```tcl
# 读取一个版本；先检查源/目的是否成功解析，不能把零属性当作通过。
set_fml_appmode FSV
read_file -top debug_guard -format sverilog -vcs {-f filelist_fsv_good.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
fsv_generate -src secret_key -dest debug_out
report_fv -list
check_fv -block
fsv_report
report_fv -verbose
```

<!-- source-end -->

### 5.5 错误版文件列表

**保存为 `案例工程/filelist_fsv_bad.f`：**

<!-- source-begin: 案例工程/filelist_fsv_bad.f -->

```text
./rtl/debug_guard_bad.sv
```

<!-- source-end -->

### 5.6 错误版完整 FSV 脚本

**保存为 `案例工程/scripts/fsv_debug_bad.tcl`：**

<!-- source-begin: 案例工程/scripts/fsv_debug_bad.tcl -->

```tcl
# 读取一个版本；先检查源/目的是否成功解析，不能把零属性当作通过。
set_fml_appmode FSV
read_file -top debug_guard -format sverilog -vcs {-f filelist_fsv_bad.f}
create_clock clk -period 100
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
check_fv_setup -block
fsv_generate -src secret_key -dest debug_out
report_fv -list
check_fv -block
fsv_report
report_fv -verbose
```

<!-- source-end -->

**运行命令（Bash）：**

```bash
# 从包含“案例工程”目录的上一级目录开始。
cd 案例工程
mkdir -p logs
set -o pipefail
vcf -f scripts/fsv_debug_good.tcl -batch 2>&1 | tee logs/fsv_debug_good.log
vcf -f scripts/fsv_debug_bad.tcl -batch 2>&1 | tee logs/fsv_debug_bad.log
```

**结果核查。** 正确版源端不参与输出计算，错误版在调试开启时有明确依赖。工具可能对未使用的源做优化，必须先确认属性生成、源目的解析及报告分类；零属性或对象找不到不能当作通过。示例结果仍待本机 VC Formal 执行确认。

## 6. 信息流安全与普通功能断言相互补充

FPV 可证明 `debug_enable==0` 时 `debug_out==0`，但这不一定足以证明“只要安全源变化，任何普通输出都不发生可识别的变化”。尤其如果信息通过状态机控制、地址、错误响应或其他共享资源间接传播，普通值检查可能漏掉依赖关系。FSV 帮助发现这些关联，但它也需要明确的观察范围和安全模型。

## 7. 黑盒与抽象的风险

`fsv_blackbox <instance>` 用于安全验证中指定特殊黑盒对象；它的抽象行为会影响信息流路径和可证明性。把加密模块全部黑盒化后，若未正确描述安全输出与普通输出的可见关系，结果可能既不保守也不完整。建议先建立最小原型，比较带/不带黑盒的属性数量与失效情况，再决定大型 SoC 的建模策略。

## 8. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fsv_generate` | 定义禁止的信息传播 |
| `fsv_blackbox` | 建立保持传播的安全抽象 |
| `fsv_report` | 审查安全抽象及传播路径 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 8.1 `fsv_generate`：定义禁止的信息传播

```text
fsv_generate -src <signals> [-src_condition <expression>]
  -dest <signals> [-dest_condition <expression>]
  [-exclude <signals_or_instances>] [-name <prefix>]
  [-zone <zone_name>] [-condition_cover]
```

**参数解释。** `-src`、`-dest` 必填，可为输入输出、寄存器、网络或实例；每个目的对象生成一个目标。`-src_condition` 只要求信息开始传播的那一拍成立；`-dest_condition` 只要求观察传播的那一拍成立，它们不要求同时或一直成立。`-exclude` 排除本条检查中的合法传播路径；`-name` 给属性和约束加前缀。`-zone` 将检查分组，同组源标记共同作用于该组断言，但单条源/目的条件不会自动共享。`-condition_cover` 增加条件覆盖检查，便于识别不可达条件。

**用法与结果。** 该命令证明的是给定模型中不存在指定传播，不是加密强度、所有侧信道或完整系统安全。把源条件换成始终成立的普通假设会改变问题，可能造成错误证明。时钟和复位不能作为普通标记源；被 create_clock/create_reset 声明的对象会被自动忽略并给出警告。

```tcl
fsv_generate -src {key_reg} -dest {debug_data} \
  -name key_to_debug -condition_cover
fsv_generate -src {secret_data} -src_condition {secure_mode} \
  -dest {public_data} -dest_condition {public_valid} \
  -exclude {u_encrypt} -name bypass_encrypt
```

来源：User Guide，X-2025.06-SP1，第 966–973 页。

### 8.2 `fsv_blackbox`：建立保持传播的安全抽象

```text
fsv_blackbox [-all] [-all_auto_path] [-no_auto_path]
  [-add_path] [-remove_path] [-src <input_ports>] [-dest <output_ports>]
  [-add_input_assertion] [-seq_path] [-comb_path]
  [-ignore_unresolved] [-data_path_only] [-remove] [<instance>]
```

**参数解释。** `-all` 处理全部结构黑盒；默认 `-all_auto_path` 自动建路径；`-no_auto_path` 创建无自动路径模型。`-add_path` 与 `-remove_path` 结合 `-src`、`-dest` 增减指定端口间传播；`-add_input_assertion` 检查安全信息能否到达黑盒输入。`-seq_path` 引入一拍传播，帮助避免组合环；`-comb_path` 使用组合传播。`-ignore_unresolved` 跳过未解析模块，`-data_path_only` 限制控制选择信号的传播，`-remove` 撤销安全抽象。

**用法与结果。** 直接对有 RTL 的模块做安全抽象时，自动路径可来自 RTL 的结构关系；先用结构黑盒删除内部逻辑后再加安全抽象，只能保守连接所有输入与输出，可能制造更多失败。反过来，普通结构黑盒切断传播可能制造错误通过。人工删除路径必须有设计或规格依据。

```tcl
fsv_blackbox -seq_path -all_auto_path u_cipher_ctrl
fsv_report -blackbox -path
# 只有确认 ack_i 到 req_o 不存在功能传播时才移除该路径。
fsv_blackbox -remove_path -src ack_i -dest req_o u_cipher_ctrl
```

来源：User Guide，X-2025.06-SP1，第 978–982 页。

### 8.3 `fsv_report`：审查安全抽象及传播路径

```text
fsv_report -blackbox [-list] [-path_config] [-path] [-col]
```

**参数解释。** `-blackbox` 选择安全抽象报告，`-list` 列出对象，`-path_config` 显示用户配置，`-path` 展开当前输入到输出路径，`-col` 返回实例集合。这里只列 UG 对安全黑盒报告明确说明的形式。

**用法与结果。** 用户配置不等于最终路径集合；自动建路径和人工增删后，应查看 `-path`。路径缺失会导致假通过，过多保守路径会导致假失败，二者处理方向相反。

```tcl
fsv_report -blackbox -list
fsv_report -blackbox -path_config
fsv_report -blackbox -path
```

来源：User Guide，X-2025.06-SP1，第 981–982 页。

## 9. 常见错误及处理

- 忽略普通域的间接数据依赖，只检查显式赋值。
- 未考虑复位或切换安全模式期间的合法输入，导致假阳性。
- 把未知授权条件设置为恒真，从而屏蔽真实泄漏。
- 把“没有找到信息传播反例”当成“已经没有所有侧信道风险”。
- 将安全策略与实现混在同一套强制约束中，无法审查真正的安全责任。

## 10. 官方参考

User Guide §22（961～1008 页），尤其 §22.2 的源目的定义和 `fsv_generate`；Quick Reference Guide FSV 部分。
