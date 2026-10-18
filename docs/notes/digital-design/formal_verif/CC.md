---
title: CC：连接检查与连通性覆盖
tags: [形式验证, 数字IC, VC Formal, CC]
---

# CC：形式连通性检查使用指南

## 1. 这项应用解决的问题

大规模 SoC 有大量中断线、复位线、测试模式信号、控制总线、调试线和模块间的数据连接。人工核对顶层 RTL 不仅费时，也难以覆盖条件选择、多级复用和逻辑变换。CC 通过预先声明源、目的、使能及延迟条件，验证设计的结构或功能上是否存在符合要求的传播关系。

**结构连通性**关注从源到目的的候选有向路径是否存在；**功能连通性**进一步检查在规定使能、初始状态和时序条件下，目的值是否满足规格。结构上有路径并不能证明功能上始终正确；功能检查还需具体考虑控制条件。

![CC 的源、选择控制与目的端](插图/09_CC连接.svg)

## 2. 连通性规格包含哪些信息

User Guide §13.2 将一个基本连通性要求分解为：名称、源 `src`、目的 `dest`、使能表达式、路径延迟 `path_delay`、使能保持时间 `enable_hold`、使能延迟 `enable_delay`、起始偏移 `offset_delay` 和时钟。常用连接的延迟为 0，并不代表全部 SoC 连接都零延迟。

| 字段 | 要解决的具体问题 | 示例说明 |
| --- | --- | --- |
| name | 这一连接叫什么 | `cc_irq0` |
| src | 信号从哪里来 | `irq_in[0]` |
| dest | 到哪里去 | `irq_out[0]` |
| enable | 何时应该生效 | `sel == 0` |
| path_delay | 源到目的要经过几个时钟 | 0 或固定延迟 |
| enable_hold | 使能需要保持的周期范围 | 与数据到达时机有关 |
| enable_delay | 使能相对源信号何时有效 | 可为 0 或负偏移 |
| offset_delay | 距离初始化的检查起点 | 排除合法启动窗口 |
| clock | 延迟检查采用哪个时钟 | `clk` |

一条连接规格至少应明确源、目的和成立条件。有模式选择时，必须同时描述选择条件与传播关系；有寄存器或流水级时，还必须明确允许的延迟。别名只用于统一路径书写，不改变电路行为。导入后先检查识别出的连接数量和方向，再运行证明，避免拼写错误导致规格没有真正成为待验证目标。

不能用“检查有线路连接”概括含使能的连通性：例如一个由 `sel` 控制的多路选择器，在 `sel=0` 时源 `a` 应到 `y`，在 `sel=1` 时源 `b` 应到 `y`，这属于两条具有不同使能的规格。

## 3. 最小实例：多路选择器

### 3.1 完整多路选择器源码

此处没有寄存器，输出完全由当前 `sel/a/b` 决定。

**保存为 `案例工程/rtl/mux2.sv`：**

<!-- source-begin: 案例工程/rtl/mux2.sv -->

```systemverilog
module mux2 (
  input logic a, b, sel,
  output logic y
);
  assign y = sel ? b : a;
endmodule
```

<!-- source-end -->

对应两条连接规格：当 `sel=0` 时 `a` 与 `y` 相同；当 `sel=1` 时 `b` 与 `y` 相同。可以在 Tcl 中创建：

```tcl
set_fml_appmode CC
read_file -top mux2 -format sverilog -vcs {./rtl/mux2.sv}
add_cc -src a -dest y -enable {!sel}
add_cc -src b -dest y -enable {sel}
check_fv -block
report_fv -list
```

`add_cc` 的 `-enable` 语法应以当前安装帮助为准；如果本版本对复杂表达式格式有限制，可改成 CSV 规格导入。**该脚本是展示连接语义的教学骨架，运行前须按安装版本补充完整的编译和检查配置。**

## 4. CSV 导入：大规模 SoC 的推荐方法

CSV 可以由规格表维护，从模块接口说明或端口表生成。依据 UG 第 461～464 页，默认字段顺序从属性名、源、目的、使能、路径延迟开始。一个简单 CSV 如下：

### 4.1 完整 CSV 连接规格

本例使用名称、源、目的、使能、路径延迟五列。第一行是说明性注释；是否接受这一注释形式仍需按安装版本核对。两条连接覆盖两个选择条件。

**保存为 `案例工程/cc_connections.csv`：**

<!-- source-begin: 案例工程/cc_connections.csv -->

```csv
// format: name,src,dest,enable,path_delay
cc_mux_a,a,y,!sel,0
cc_mux_b,b,y,sel,0
```

<!-- source-end -->

### 4.2 CSV 方式的完整运行脚本

直接读入上节 RTL 和本节 CSV；不需要隐藏的 `filelist.f`。先查看 `report_load_cc`，确认两条连接均成功加载，再分析形式结果。

**保存为 `案例工程/scripts/cc_mux.tcl`：**

<!-- source-begin: 案例工程/scripts/cc_mux.tcl -->

```tcl
set_fml_appmode CC
read_file -top mux2 -format sverilog -vcs {./rtl/mux2.sv}
load_cc -format csv cc_connections.csv
report_load_cc
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
vcf -f scripts/cc_mux.tcl -batch 2>&1 | tee logs/cc_mux.log
```

对于跨组织的大规模规格，建议保留完整的九个核心字段并明确表头与默认值。`load_cc -default_param_order` 对应默认列顺序，`load_cc_set_param` 可定义自定义列对应关系，如 `load_cc_set_param csv_src "%2%"`；如果使用自定义格式必须随规格表一起提交，防止 CSV 列移动造成检查错位。

### 4.3 延迟连接的限制

CC 支持与时钟关联的连接延迟；路径中可能有寄存器，也可能由使能控制时序组合。验证之前需要指定准确时钟并检查 `path_delay` 的解释。不要把源和目的之间的**物理布线延迟**误认为 `path_delay=1`；这里描述的是形式模型中按采样时钟计算的功能延迟。多时钟跨域连接不能简单用一条普通单时钟延迟规格代替 CDC 分析。

## 5. 源目的别名与设计层级

实际 SoC 规格名称通常与 RTL 层级名不同，可以使用别名处理：

```tcl
set_cc_alias CPU_IRQ u_top.u_cpu.irq_in
report_cc_alias
# 必要时删除已失效的别名
delete_cc_alias CPU_IRQ
```

别名使规格表与层级变动解耦，但必须建立审查规则：别名应对应单一、明确的对象或合法总线片段；层级优化后应重新检查别名的解析结果。

## 6. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `add_cc` | 建立一条条件连通性检查 |
| `load_cc` | 从 CSV 或表格式导入连接规格 |
| `load_cc_set_param` | 定义 CSV 字段的位置和组合方式 |
| `report_load_cc` | 报告连接规格导入和结构检查 |
| `set_cc_alias` | 定义连接规格中的层级别名 |
| `report_cc_alias` | 查看连接别名 |
| `delete_cc_alias` | 删除旧连接别名 |
| `generate_cc` | 从设计提取可能的连接及使能条件 |
| `compute_cc_cov` | 分析已证明连接的翻转覆盖 |
| `save_cc_cov_results` | 保存连接覆盖和排除资料 |

本组命令按准备、生成、执行与结果处理的关系组织。语法框保留参数名称和可选关系；示例中的实例、属性和文件名称需要与当前工程一致。生成目标与证明目标是不同阶段，调用生成命令后应检查实际目标数量，再启动证明。

### 6.1 `add_cc`：建立一条条件连通性检查

```text
add_cc -src <source-signals> -dest <destination-signals>
       [-enable <expression>] [-path_delay <min:max|latency>]
       [-enable_hold <cycles>] [-enable_delay <cycles>]
       [-offset_delay <cycles>] [-clock <clock-expression>]
       [-name <name>]
```

**参数解释。** `-src`、`-dest` 是有顺序的信号列表，支持名称模式，顺序决定对应关系。`-enable` 是连接成立条件，默认 true；`-path_delay` 是源到目的延迟，默认 0。`-enable_hold` 指定使能需要保持多久，`-enable_delay` 指定使能相对源值需要提前多久成立，默认均为 0。`-offset_delay` 指定复位后多少周期才开始检查。`-clock` 给出采样表达式，默认使用已定义时钟的上升沿；`-name` 为检查命名。

**用法与结果。** 普通同拍连接可不含时序延迟；有延迟时必须有有效时钟。源与目的名字正确但顺序错误、位序颠倒或使能提前量不对，都可能造成失败。对经过寄存器的路径，不能只通过增加 path_delay 随意消除反例，必须以接口时序规格为依据。

```tcl
add_cc -name data0_to_y -src {a} -dest {y} -enable {!sel}
add_cc -name data1_to_y -src {b} -dest {y} -enable {sel}
check_fv -block
report_fv -class connection -list
```

来源：User Guide，X-2025.06-SP1，第 469–479 页。

### 6.2 `load_cc`：从 CSV 或表格式导入连接规格

```text
load_cc [-format <csv|table>] [-quiet] <filename>
        [-default_param_order]
```

**参数解释。** 默认格式是 csv；table 是工具定义的增强表格式，可把使能条件分散在多列。`-quiet` 抑制进度和结构检查汇总，但仍报告错误与警告。`-default_param_order` 让本次读取按默认字段顺序解释，不覆盖已保存的自定义字段配置。

**用法与结果。** CSV 的列顺序是规格的一部分，不能只凭第一行标题猜测工具解释方式。table 格式需要两行表头，条件通常是多个位或字的相等判断的合取，不能把任意 SVA 写在表格里。导入后先看 `report_load_cc` 的成功条数和错误，再进行功能连通性证明。

```tcl
load_cc -format csv cc_connections.csv
report_load_cc -verbose
check_fv -block
```

来源：User Guide，X-2025.06-SP1，第 461–469 页。

### 6.3 `load_cc_set_param`：定义 CSV 字段的位置和组合方式

```text
load_cc_set_param <parameter-name> <value>
```

**参数解释。** 字段位置写成 `%1%`、`%2%` 等占位符；如 csv_src、csv_dest、csv_prop_name、csv_enable。层级字段可以拼接，例如 `%3%.%4%`。csv_start_line、csv_end_line 用于行范围，csv_comment_pattern 指定行首注释标志。其余延迟、时钟和使能字段应与连接定义一致。

**用法与结果。** 列编号从 1 开始。拼接时空字段会省略，相应多余层级分隔符也会删除。它改变后续文件的解释规则，不修改 CSV 本身；多个不同格式文件在同一会话导入时，要显式切换配置或使用默认字段顺序选项。

```tcl
load_cc_set_param csv_prop_name "%1%"
load_cc_set_param csv_src "%2%"
load_cc_set_param csv_dest "%3%"
load_cc_set_param csv_enable "%4%"
load_cc_set_param csv_start_line "2"
load_cc cc_connections.csv
```

来源：User Guide，X-2025.06-SP1，第 464–468 页。

### 6.4 `report_load_cc`：报告连接规格导入和结构检查

```text
report_load_cc [-list] [-verbose] [-no_summary] [-error]
               [-warning] [-connected] [-disconnected]
               [-not_applicable] [filename]
```

**参数解释。** `-list` 按文件列出每个目标的状态、行号和连接名；`-verbose` 还显示详细消息；`-no_summary` 去掉汇总。其余状态选项分别筛选错误、警告、结构已连接、结构不连接和不适用的目标；位置文件名限制来源。

**用法与结果。** connected 在本报告中是导入阶段的结构信息，不是使能和延迟条件下的完整功能证明。not_applicable 可能来自禁用或常量源等情况，不能当成已通过。正式报告应同时包含导入条数和 `check_fv` 的结果。

```tcl
report_load_cc -error -verbose
report_load_cc -disconnected -list
report_load_cc -verbose cc_connections.csv
```

来源：User Guide，X-2025.06-SP1，第 468–469 页。

### 6.5 `set_cc_alias`：定义连接规格中的层级别名

```text
set_cc_alias [-nest] <alias> <replacement>
```

**参数解释。** 别名只能使用字母、数字和下划线，点号保留给层级分隔。`-nest` 允许递归解析别名；replacement 可以是层级路径或用已有别名组成的表达式。

**用法与结果。** 别名是路径书写便利，不改变电路。带位选择的替换值应用花括号包住，防止 Tcl 把方括号当成命令替换。递归别名应避免循环，并在导入目标后核对实际源目的。

```tcl
set_cc_alias core chip_top.u_core
set_cc_alias irq {chip_top.irq_bus[0]}
set_cc_alias -nest core_irq core.irq_o
report_cc_alias
```

来源：User Guide，X-2025.06-SP1，第 479 页。

### 6.6 `report_cc_alias`：查看连接别名

```text
report_cc_alias [<alias-pattern>]
```

**参数解释。** 不带模式查看定义列表，模式用于查找单个或一组别名。

**用法与结果。** 在 IP 复用和顶层层级调整后，先确认别名仍指向当前对象。旧别名没有自动随 RTL 的层级重命名更新。

```tcl
report_cc_alias
report_cc_alias core*
```

来源：User Guide，X-2025.06-SP1，第 479 页。

### 6.7 `delete_cc_alias`：删除旧连接别名

```text
delete_cc_alias <alias-name>
```

**参数解释。** 指定要删除的别名。

**用法与结果。** 删除影响后续名字解析；不能假定已经生成的属性会随别名删除而重建。改变别名后需要重新确认规格导入结果。

```tcl
delete_cc_alias core_irq
report_cc_alias
```

来源：User Guide，X-2025.06-SP1，第 479 页。

### 6.8 `generate_cc`：从设计提取可能的连接及使能条件

```text
generate_cc [-src <objects>] [-dest <objects>] [-control <objects>]
            [-run] [-preserve] [-clearall] [-file <path>]
            [-limit <integer>] [-verbose]
```

**参数解释。** 源、目的和控制对象可为网络、端口或实例。先用 `-src`、`-dest` 积累对象对，`-run` 才执行提取。`-control` 指定使能表达式追溯到哪些控制对象；`-preserve` 保留源目的供后续运行，`-clearall` 清除已设源、目的和控制列表。`-file` 输出 Tcl，否则写入属性数据库；`-limit` 限制每对对象提取的路径数量，默认 1；`-verbose` 输出细节。

**用法与结果。** 提取的是当前 RTL 已存在的连接，不是独立规格。它适合辅助生成待审核连接清单，但不能把由错误 RTL 自己提取的连接再证明一遍就称为满足原设计需求。多对对象一次运行通常比逐对运行更高效。

```tcl
generate_cc -src {a} -dest {y}
generate_cc -src {b} -dest {y}
generate_cc -run -file extracted_connections.tcl
```

来源：User Guide，X-2025.06-SP1，第 502–506 页。

### 6.9 `compute_cc_cov`：分析已证明连接的翻转覆盖

```text
compute_cc_cov [-par_task <task>] [-endpoint] [-net]
               [-structural] [-property <properties>] [-block]
               [-run_finish <commands>] [-enable]
```

**参数解释。** `-par_task` 指定父 CC 任务，默认当前任务；`-endpoint` 计算源和目的翻转，`-net` 计算路径上网络，`-enable` 包含使能表达式及其到选择位置的路径。`-property` 指定启用且已证明的连接。`-structural` 直接把证明连接对应的覆盖目标标为已覆盖，不执行覆盖分析。`-block` 等待完成；本页对 `-run_finish` 写有只在阻塞模式有效的限制，不能套用 check_fv 的非阻塞回调规则。

**用法与结果。** 必须在读设计时生成翻转目标，并启用连通性覆盖流程。`-structural` 的直接标记与实际翻转可达性证明不是同一种证据；报告中必须区分。库文件缺省可能不生成覆盖，需根据工程使用 `-cm_libs vy`。

```tcl
compute_cc_cov -endpoint -net -block
save_cc_cov_results -covdb_name cc_toggle.vdb
```

来源：User Guide，X-2025.06-SP1，第 510–515 页。

### 6.10 `save_cc_cov_results`：保存连接覆盖和排除资料

```text
save_cc_cov_results [-covdb_name <database>]
                    [-exclude_disabled] [-elfile]
```

**参数解释。** `-covdb_name` 指定输出数据库，缺省 `cc_tgl_cov.vdb`；`-exclude_disabled` 把禁用或无关目标写入排除文件；`-elfile` 保存不可达翻转目标的排除文件，并沿用数据库基本名称。

**用法与结果。** 保存结果不会重新执行覆盖计算。启用严格排除模式后，已覆盖目标在后续运行中保留已覆盖标记，因此更需要控制适用的设计版本和约束条件，不能跨不相容配置沿用。

```tcl
compute_cc_cov -endpoint -block
save_cc_cov_results -covdb_name cc_toggle.vdb -elfile
```

来源：User Guide，X-2025.06-SP1，第 511–515 页。

## 7. 三种常见用例

**用例一：复位信号分发。** 检查顶层复位能否经过相关复位控制逻辑到达每个子模块的对应复位端；如经过同步复位器，不要错误地要求零拍直接等值。**用例二：中断选择器。** 按每个路由配置值检查中断来源与目的的条件连接，另外独立检查未使能中断不应错误出现在输出端。**用例三：测试模式控制。** 检查正常模式 `test_mode=0` 时功能信号未被测试逻辑截断，同时要避免把受硬件控制的测试状态误假设成永久关闭。

## 8. 失败分类与排查

**结构不连通**：检查层级、拼写、位选择、网表优化、黑盒以及真正是否有从源到目的的组合/时序路径。**结构有路径但功能失败**：检查控制使能、复位时序、源目的位宽、数据翻转关系、被插入的反相器或优先级。**不可适用或无意义的连接**：确认目的是否可观察、是否被固定常量、规则是否超出所支持的延迟/时钟形式。

不会因为报告中某条连接显示 `Connected` 就证明整个 SoC 的功能行为。CC 只覆盖已经列出的连接规则，规格完整性需要接口所有者审核。

## 9. 对大型项目的建议

按接口类别分 CSV 文件（时钟、复位、中断、扫描、调试、寄存器地址控制等），为每行保留规格编号及责任模块。批处理时针对真实的错误分类输出 `report_load_cc` 与 `report_fv`。将结构不连通与功能不符合分开处理；以保留全部输入列表的方式生成导出报告，便于发现某个连接根本没有被加载的情况。

## 10. 参考

User Guide §13（458～516 页），尤其 §13.2（460 页起）、CSV 格式说明（461～465 页）、连接延迟与覆盖章节；Quick Reference Guide CC 章节。低功耗场景另见 [FLP_LPC.md](FLP_LPC.md)。
