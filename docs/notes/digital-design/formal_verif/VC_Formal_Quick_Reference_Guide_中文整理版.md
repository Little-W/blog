# VC Formal 命令分类与通用命令详解

## 1. 怎样阅读命令语法

命令不能只按名称记忆，还要同时理解执行阶段、接受的对象、对验证环境的修改以及返回结果。启动命令在操作系统终端执行；会话命令由 VC Formal 的 Tcl 解释器执行；SVA 属性由编译器处理；DPV 的参考函数则属于 C/C++ 源码。把这些层次分清，才能判断某个报错发生在启动、编译、环境设置还是证明阶段。

| 标记 | 含义 | 使用要求 |
| --- | --- | --- |
| 尖括号参数 | 需要替换的名称、路径或数值 | 不把尖括号原样输入命令 |
| 方括号参数 | 语法说明中的可选部分 | 与 Tcl 的命令替换方括号区分 |
| 备选值 | 参数可取的若干互斥值 | 实际调用选择一个合法值 |
| 花括号列表 | Tcl 中保持整体的参数或脚本 | 防止空格和特殊字符被提前解释 |
| 对象集合 | 工具管理的设计或属性对象 | 使用集合命令，不当成普通字符串列表 |

语法框用于描述命令的接受形式；示例框给出具体调用。下列第一行表示选项可以省略，第二行才是可直接解释的 Tcl。语法说明中的竖线只表示备选值，不是要发送给命令的字符；完整 SVA 运算符则必须原样保留。

```text
report_fv [-status <proven|falsified|inconclusive>] [<properties>]
```

```tcl
report_fv -status proven
```

正文以提供的 X-2025.06-SP1 UG 为基线；若 UG 只给出调用示例而将完整参数定义转交给其他参考手册，本章明确标注其范围，不虚构额外选项。下列命令示例通常要求已完成其上游步骤，不能脱离当前设计和任务逐行任意运行。完整可保存的 RTL、SVA、文件列表和 Tcl 工程放在第 5 节，各应用章节也保留自己的完整案例。

## 2. 按工作阶段选择命令

| 阶段 | 要完成的工作 | 详细说明位置 |
| --- | --- | --- |
| 启动与帮助 | 选择工作方式、读取本机命令说明 | 本章第 3 节 |
| 编译与环境 | 读入设计、建立时钟复位和初始状态 | 本章第 3 节 |
| 属性与任务 | 管理断言、假设、覆盖和任务范围 | 本章第 4 节 |
| 运行与资源 | 设置计算资源、执行、报告和保存 | 本章第 4 节 |
| 自动规则与未知值 | 自动提取检查、设置未知值来源及观察点 | AEP、FXP |
| 连通性与低功耗 | 描述端点、电源条件和隔离要求 | CC、FLP / LPC |
| 等价与寄存器 | 建立设计对应关系、加载寄存器规格 | SEQ、DPV、FRV |
| 覆盖及属性质量 | 可达性、形式核心和故障检测能力 | FCA、FTA、覆盖与验证验收 |
| 安全分析 | 故障影响、告警及信息传播 | FuSa、FSV |
| 结构查询 | 查询实例、网络、端口和对象属性 | 设计查询与集合 |
| 调试与分解 | 反例、约束冲突、复杂度和组合证明 | 调试与证明性能、AIP 与分解证明 |

这个分类描述的是依赖顺序，而不是互不相干的菜单。例如 AEP 自动生成的目标仍要通过通用属性命令管理；FXP 设置的来源和观察点需要在正确的复位环境下解释；FRV 生成检查器后，还必须确认实际总线访问能够触发检查。应把应用专用命令嵌入完整验证流程，避免只执行“生成”和“报告”而漏掉证明。

## 3. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `vcf` | 启动外壳、批处理和图形会话 |
| `help` | 按命令名称查询帮助 |
| `man` | 阅读命令的详细手册页 |
| `view_help` | 打开图形帮助条目 |
| `set_fml_appmode` | 选择形式应用 |
| `get_fml_appmode` | 查询当前应用模式 |
| `set_app_var` | 设置平台应用变量 |
| `report_app_var` | 查询平台变量的值和说明 |
| `set_fml_var` | 设置形式分析变量 |
| `report_fml_var` | 查询形式变量 |
| `read_file` | 一次读入、编译并展开设计 |
| `analyze` | 分析源文件并存入设计库 |
| `elaborate` | 展开顶层并建立验证设计 |
| `set_blackbox` | 把选定模块或实例设为黑盒 |
| `report_blackbox` | 报告黑盒对象 |
| `get_blackbox` | 取得黑盒集合 |
| `create_clock` | 定义时钟及参考时钟 |
| `create_reset` | 定义复位有效值及启动复位 |
| `get_resets` | 查询复位对象 |
| `set_constant` | 同时约束初始化与正式分析中的常量 |
| `set_change_at` | 限制输入允许变化的时钟事件 |
| `report_change_at` | 检查输入变化规则 |
| `get_change_at` | 读取输入变化规则对象 |
| `sim_run` | 运行初始化仿真 |
| `sim_force` | 在初始化仿真中强制信号 |
| `sim_set_state` | 设置寄存器和存储器的初始状态 |
| `sim_save_reset` | 把当前状态保存为形式初始状态 |
| `sim_get` | 查询当前初始化仿真值 |
| `fv_setup_config` | 配置模型准备检查 |
| `check_fv_setup` | 执行模型准备检查 |
| `report_fv_setup` | 报告准备检查的状态与违规 |
| `infer_formal_setup` | 推断时钟等形式设置 |
| `formal_setup_config` | 查询或配置自动设置流程 |
| `report_formal_setup` | 报告自动或显式形式设置 |

环境设置决定形式模型中哪些初始状态和输入变化被允许。特别注意编译前生效的变量、黑盒规则、时钟复位定义和初始化仿真的先后顺序；在编译后修改前端开关通常不能自动重建已经生成的模型。

### 3.1 `vcf`：启动外壳、批处理和图形会话

```text
vcf [-batch] [-out_dir <dir_name>]
    [-cmd_log_file <log_name>] [-f <file_name>]
    [-fmode <FPV|COV|SEQ|CC|AEP|FRV|FXP|FSV|FUSA|DPV>]
    [-gui] [-verdi] [-verdi_base] [-verdi_apex]
    [-help] [-id] [-lic_wait <minutes>] [-no_init]
    [-no_restore] [-no_ui] [-output_log_file <log_name>]
    [-read_only] [-reset] [-restore] [-session <session_name>]
    [-use_ipv4] [-use_ipv6] [-x <config_tcl_cmd>]
    [-y <post_config_tcl_cmd>] [-doc]
    [-fml_base] [-fml_ultra] [-fml_elite] [-fml_token]
    [-fml_legacy] [-fml_no_legacy] [-fml_zoix] [-fml_z01x]
    [-fml_auto_restore_level <none|job|engine|host|all>]
    [-scl_span] [-rma_off] [-container] [-noecho]
    [-fml_nxg <0|1|2>] [-echo]
```

**参数解释。** `-f` 指定启动后执行的 Tcl 脚本，完整写法为 `-file`；`-batch` 进入非交互批处理，`-out_dir` 指定输出目录，`-session` 指定运行数据库目录。`-cmd_log_file` 保存命令记录，`-output_log_file` 保存控制台输出，两者用途不同。`-fmode` 选择启动应用，省略时为 FPV，启动列表不含 FTA。

`-gui` 和 `-verdi` 打开图形环境；`-verdi_base`、`-verdi_apex` 选择相应的 Verdi 授权。`-fml_base`、`-fml_ultra`、`-fml_elite`、`-fml_token` 选择形式工具授权方式；`-fml_legacy` 使用旧授权查找，`-fml_no_legacy` 不回退到旧方式，两个 FuSa 选项选择分级 FuSa 授权。`-lic_wait` 的单位为分钟，`-scl_span` 允许跨多个服务器获取授权。

`-restore` 恢复会话，`-read_only` 只读恢复；`-no_restore` 删除以前会话并重新开始，`-reset` 清理旧工作会话，使用前应保留需要的数据库。`-no_init` 不读初始化设置文件，`-no_ui` 不启动界面进程。`-x`、`-y` 分别在配置阶段及配置后执行 Tcl 命令。`-fml_auto_restore_level` 控制自动保存会话的恢复层级。`-rma_off` 关闭相应授权模式下自动启用的回归加速，`-container` 用于容器环境；`-use_ipv4`、`-use_ipv6` 选择进程通信协议；`-fml_nxg` 选择命令一致性模式。`-noecho` 不在输出与会话日志中回显命令；`-echo` 只回显环境而不调用可执行程序。`-help` 显示帮助，`-id` 显示构建和环境信息，`-doc` 打开文档。

**用法与结果。** 这是操作系统命令，不是在 `vcf>` 提示符内执行的 Tcl 命令。批处理脚本必须等待需要的证明完成，再导出报告和退出；只加 `-batch` 并不会替脚本中的所有异步命令建立依赖。每个回归任务使用独立会话目录，避免多个进程同时写入同一个数据库。

```bash
vcf -f scripts/fpv_counter.tcl -batch \
    -session counter_run -output_log_file counter.log
vcf -f scripts/fpv_counter.tcl -verdi
vcf -restore -session counter_run -read_only
```

来源：User Guide，X-2025.06-SP1，第 54–62 页。

### 3.2 `help`：按命令名称查询帮助

```text
help [<command-pattern>]
```

**参数解释。** 不指定模式时显示帮助入口；模式可包含通配符，例如 `report*` 用于查找报告类命令。这里的星号是命令名称匹配，不是设计对象筛选。

**用法与结果。** 先确认命令是否存在，再看其参数。未知命令与未知参数是不同问题：前者可能来自应用模式、安装包或命令版本，后者通常需要核对具体调用形式。

```tcl
help
help report*
```

来源：User Guide，X-2025.06-SP1，第 46–50；QRG 6 页。

### 3.3 `man`：阅读命令的详细手册页

```text
man <command-name>
```

**参数解释。** 命令名不带参数。详细页通常给出用途、语法、参数和示例，适合核对超出本文调用形式的选项。

**用法与结果。** UG 对部分平台命令明确转引 VC Static Platform Reference Guide，因此不能把 UG 中的一行示例当成命令支持的全部参数。

```tcl
man report_fv
man create_clock
```

来源：User Guide，X-2025.06-SP1，第 46–50；QRG 6 页。

### 3.4 `view_help`：打开图形帮助条目

```text
view_help <command-name>
```

**参数解释。** 指定需要查看的命令名称。图形帮助依赖可用的文档与界面环境。

**用法与结果。** 它用于阅读说明，不运行该命令，也不改变当前验证状态。批处理环境中应优先保存文本帮助和命令日志。

```tcl
view_help report_fv
```

来源：User Guide，X-2025.06-SP1，第 46–50；QRG 6 页。

### 3.5 `set_fml_appmode`：选择形式应用

```text
set_fml_appmode <FPV|COV|SEQ|CC|AEP|FRV|FXP|FSV|FUSA|DPV|FTA>
```

**参数解释。** 位置参数是应用模式名。FCA 是覆盖分析应用的名称，本文采用该版 UG 明确列出的 Tcl 模式 `COV`；FTA 可以通过本命令切换，但不能用 `vcf -fmode FTA` 启动。

**用法与结果。** 通常在编译前选定应用。FTA 的例外流程是先在 FPV 中准备并运行属性，再切换到 FTA。切换模式不意味着已加载的专用配置、故障数据库或证明条件自动有效。

```tcl
set_fml_appmode FPV
get_fml_appmode
```

来源：User Guide，X-2025.06-SP1，第 64–65 页。

### 3.6 `get_fml_appmode`：查询当前应用模式

```text
get_fml_appmode
```

**参数解释。** 无位置参数，返回当前形式应用名。

**用法与结果。** 在公共脚本入口和专用应用切换后查询一次，可以及早发现使用了错误的默认模式。不要用 GUI 页签名称代替实际 Tcl 模式检查。

```tcl
set current_app [get_fml_appmode]
puts "Current application: $current_app"
```

来源：User Guide，X-2025.06-SP1，第 65 页。

### 3.7 `set_app_var`：设置平台应用变量

```text
set_app_var <variable-name> <value>
```

**参数解释。** 第一个参数是平台登记的应用变量，第二个参数是符合该变量类型和值域的值。变量是否在设计读入前生效，应根据变量说明确定。

**用法与结果。** 本命令不同于 Tcl 的 `set`：后者可以创建普通脚本变量，而本命令针对工具已定义的应用变量。编译开关、前端行为与形式求解变量不能混为一类。

```tcl
report_app_var apply_bind_in_all_units -verbose
set_app_var apply_bind_in_all_units false
```

来源：User Guide，X-2025.06-SP1，第 63–64、119 页。

### 3.8 `report_app_var`：查询平台变量的值和说明

```text
report_app_var [<name-pattern>] [-verbose]
```

**参数解释。** 不指定模式时列出平台变量；模式限制名称范围，`-verbose` 显示详细说明。输出区分当前值、类型、默认值和限制。

**用法与结果。** 报告平台变量不会把用户通过 `set` 创建的所有普通变量都列出。需要审计配置时，应同时保存设置脚本和相关详细报告，而不是只记录修改后的一个数值。

```tcl
report_app_var fml_*
report_app_var fml_composite_trace -verbose
```

来源：User Guide，X-2025.06-SP1，第 63–64 页。

### 3.9 `set_fml_var`：设置形式分析变量

```text
set_fml_var <variable-name> <value> [-global]
```

**参数解释。** 变量名决定控制对象，例如运行时间、内存、空洞性分析或轨迹生成。`-global` 在文档示例中用于把设置应用到所有任务；不是每项变量都可在求解过程中即时修改。

**用法与结果。** 变量可能改变模型，也可能仅改变资源。前者需要重新构建并复核结果，后者也要在任务开始前明确设定。不要把缩短时间限制后留下的未完成目标算作成功。

```tcl
set_fml_var fml_max_time 24H
set_fml_var fml_max_memory 32GB
set_fml_var fml_vacuity_on true
set_fml_var fml_report_profile_data true -global
```

来源：User Guide，X-2025.06-SP1，第 131–132、709–713；QRG 7–8 页。

### 3.10 `report_fml_var`：查询形式变量

```text
report_fml_var [<name-pattern>] [-verbose]
```

**参数解释。** 名称模式支持按前缀查找；`-verbose` 用于查看默认值、当前值与具体说明。

**用法与结果。** 文档基线相同也可能启用了不同安装配置。对影响覆盖生成、初始状态或抽象的变量，先查详细说明，再在正式脚本中显式设置需要的值。

```tcl
report_fml_var fml_max_*
report_fml_var fml_vacuity_on -verbose
```

来源：User Guide，X-2025.06-SP1，第 384、1127–1140；QRG 6 页。

### 3.11 `read_file`：一次读入、编译并展开设计

```text
read_file -format <verilog|sverilog|vhdl> -top <top-name>
          [-sva] [-aep <aep-types>] [-cov <coverage-types>]
          -vcs {<compiler-options-and-files>}
```

**参数解释。** `-format` 选择语言，`-top` 指定顶层，`-sva` 启用源代码属性处理。`-aep` 和 `-cov` 是对应应用的目标生成选择，不能在任意应用中随意组合。`-vcs` 后的一个 Tcl 参数传给编译前端，可包含文件名、文件列表和前端选项。

**用法与结果。** 这是 UG 展示的一步流程，不是平台参考手册的全部选项。推荐用花括号包住固定的编译参数串，避免 Tcl 对方括号和美元符号提前替换；需要变量展开时，则使用经过审查的双引号或 `list` 构造。设计文件、属性文件和绑定文件必须全部被编译。

```tcl
set_fml_appmode FPV
read_file -format sverilog -top counter -sva \
    -vcs {-f filelist_counter.f}
```

来源：User Guide，X-2025.06-SP1，第 118–120、371、394–395 页。

### 3.12 `analyze`：分析源文件并存入设计库

```text
analyze -format <verilog|sverilog|vhdl> [-library <library-name>]
        [-vcs {<compiler-options>}] <source-files>
```

**参数解释。** `-format` 指定前端语言，`-library` 用于区分分析库；源文件既可直接给出，也可使用文档中的 `-vcs` 参数串和文件列表形式。

**用法与结果。** 该步骤只完成前端分析，不等于已建立可证明的顶层设计。混合语言工程可分别分析 VHDL 与 SystemVerilog，再通过 `elaborate` 统一展开；SEQ 常为参考实现和待比较实现使用不同的库。

```tcl
analyze -format sverilog -vcs {-f filelist_counter.f}
elaborate counter -sva
```

来源：User Guide，X-2025.06-SP1，第 119–120、522–523 页。

### 3.13 `elaborate`：展开顶层并建立验证设计

```text
elaborate <top-name> [-sva] [-aep <aep-types>]
          [-cov <coverage-types>] [-vcs {<compiler-options>}]
```

**参数解释。** 顶层名来自已分析的设计单元。`-sva` 处理属性，`-aep`、`-cov` 指定相应自动目标。混合语言绑定有时需要额外前端选项，UG 给出了 `-lca` 与绑定相关示例。

**用法与结果。** 展开后应检查顶层、实例层级、参数值、黑盒以及属性数量。对参数化模块，仅仅成功分析文件并不能保证展开的是要验证的那一个参数配置。

```tcl
analyze -format sverilog -vcs {-f filelist_counter.f}
elaborate counter -sva
report_fv -list
```

来源：User Guide，X-2025.06-SP1，第 119–120、375–376 页。

### 3.14 `set_blackbox`：把选定模块或实例设为黑盒

```text
set_blackbox -designs <module-name-list>
set_blackbox -cells <hierarchical-instance-list>
```

**参数解释。** `-designs` 依据设计单元名称选择模块，可能影响它的多个实例；`-cells` 选择具体层级实例。层级名称应与当前顶层下的展开结果一致。

**用法与结果。** 黑盒省略内部功能，输出通常成为模型中的自由输入。这样可以减小问题，也可能产生真实实现中不存在的行为。证明通过与失败的解释必须结合抽象方向；安全信息流应用还需要专门的安全黑盒设置，不能直接沿用普通黑盒的推断。

```tcl
set_blackbox -designs {large_memory}
set_blackbox -cells {u_soc.u_analog}
report_blackbox
```

来源：User Guide，X-2025.06-SP1，第 128–131；QRG 7 页。

### 3.15 `report_blackbox`：报告黑盒对象

```text
report_blackbox
```

**参数解释。** 无参数形式输出当前黑盒配置及对象。

**用法与结果。** 在运行前比对预期黑盒与实际黑盒。未解析模块、显式黑盒和工具优化得到的结构，应按来源分别记录；缺少源文件不应被当成合理抽象。

```tcl
report_blackbox
```

来源：User Guide，X-2025.06-SP1，第 128–131；QRG 7 页。

### 3.16 `get_blackbox`：取得黑盒集合

```text
get_blackbox
```

**参数解释。** 返回当前设计中的黑盒对象，供后续 Tcl 查询使用。

**用法与结果。** 返回值是工具对象集合而不是普通文本报告。检查其大小、名称和层级时使用集合命令；不要直接根据控制台截断显示的几项判断黑盒已经全部列出。

```tcl
set boxes [get_blackbox]
puts [sizeof_collection $boxes]
foreach_in_collection box $boxes {
    puts [get_object_name $box]
}
```

来源：User Guide，X-2025.06-SP1，第 128–131；QRG 19 页。

### 3.17 `create_clock`：定义时钟及参考时钟

```text
create_clock -period <period_value> [-name <clock_name>]
             [-waveform <edge_list>] [-add] [-comment <string>]
             [-refclk] [-initial <0|1>] [source_objects]
```

**参数解释。** `-period` 是时钟周期；`source_objects` 是定义时钟的网络、端口或引脚。`-name` 指定时钟对象名，`-waveform` 给出边沿列表，`-add` 向原时钟补充选项，`-comment` 保存说明。`-refclk` 指定参考时钟；`-initial` 指定时间零的时钟值，本版列出的默认值是 1。

**用法与结果。** 参考时钟用于没有显式时钟的脚本属性、复位仿真及部分深度报告。单时钟设计自动使用该时钟，多时钟默认选择最快时钟，可显式覆盖。相同 `-name` 再次用于不同信号会覆盖原时钟，因此不同真实时钟应有不同名称。周期表达相对时间关系，不应把数值直接当成芯片在真实电压温度下的工作频率证明。

```tcl
create_clock clk -name core_clk -period 100 -refclk
create_clock slow_clk -name peripheral_clk -period 200 \
    -waveform {0 100} -initial 0
```

来源：User Guide，X-2025.06-SP1，第 132–138 页。

### 3.18 `create_reset`：定义复位有效值及启动复位

```text
create_reset [-sync] [-async] [-both] [-type <reset|set|both>]
             [-name <reset_name>] [-sense <low|high|any>]
             [-value <low|high>] [-add] [-tdr]
             [-disable_assertions_db] [-untimed] [source_objects]
```

**参数解释。** `source_objects` 是实际复位信号，不可只写对象名而不给源信号。`-sense low` 表示低有效，`-sense high` 表示高有效；共享平台帮助推荐用 `-value` 代替 `-sense`，但本版形式流程正文仍用 `-sense` 解释行为。

`-sync`、`-async`、`-both` 描述复位连接类型，缺省为异步；`-type`、`-name`、`-add` 分别描述类别、命名与选项追加。`-tdr` 标记测试或调试复位，`-disable_assertions_db` 关闭对应 AssertionDB 生成，`-untimed` 表示不是时序单元的时钟化输出。UG 特别指出 VC Formal 的关键行为由复位有效电平决定，不能把共享平台的全部标记都理解为额外形式约束。

**用法与结果。** 低有效复位在初始化仿真时被施加为 0，在后续形式分析中被固定为 1；高有效情况相反。因此标准流程验证的是复位后的工作行为，不是运行过程中任意再次复位。要验证动态复位，必须另建允许复位变化的模型和相应属性。`create_reset -name rst` 不等价于 `create_reset rst`，工具不支持用这种写法创建虚拟复位。

```tcl
create_reset rst_n -sense low
sim_run -stable
sim_save_reset
```

来源：User Guide，X-2025.06-SP1，第 138–140 页。

### 3.19 `get_resets`：查询复位对象

```text
get_resets [-filter <filterexp>] [-regexp] [-quiet] [-nocase]
           [-exact] [-of_objects <object-list>] [patterns]
```

**参数解释。** `patterns` 匹配复位名称；`-filter` 根据属性筛选，`-regexp` 采用正则表达式，`-exact` 要求精确匹配，`-nocase` 忽略大小写，`-quiet` 抑制信息。`-of_objects` 从端口、引脚、网络或复位根对象查询关联复位。

**用法与结果。** 查询出的对象应与真实复位域逐项对应。设计读入后如果增加了包装层，路径必须相对新的顶层修正；名称看起来相近并不保证选中了实际复位源。

```tcl
get_resets
get_resets rst*
get_resets -filter {name == rst_n}
```

来源：User Guide，X-2025.06-SP1，第 140 页。

### 3.20 `set_constant`：同时约束初始化与正式分析中的常量

```text
set_constant <signal-or-object-list> -value <constant>
```

**参数解释。** 信号对象是要固定的端口或网络，`-value` 给出数值。Verilog 数字可带位宽，例如 `1'b0`，传入脚本时应保持正确的 Tcl 字面值。

**用法与结果。** 常量传播能简化后续逻辑，但它不是一条属性，不能像 `fvassume` 创建的约束那样转换成断言。与普通假设相比，它也参与复位状态计算。只能固定当前功能模式确实恒定的信号；固定模式选择之后，其他模式不在本次结论范围。

```tcl
set_constant scan_en -value 1'b0
set_constant test_mode -value 1'b0
```

来源：User Guide，X-2025.06-SP1，第 70 页。

### 3.21 `set_change_at`：限制输入允许变化的时钟事件

```text
set_change_at -clock <clock-name> [-posedge] [-negedge] <signals>
set_change_at -clock <clock-name> -default
set_change_at -default -remove
```

**参数解释。** `-clock` 指定控制输入变化时机的时钟，边沿选项进一步指定允许变化的事件；`-default` 设置默认信号规则，`-remove` 移除对应规则。这里展示 UG 和快速参考出现的调用形式。

**用法与结果。** 在慢时钟上写一个 assume，只保证慢时钟采样点上的条件，并不自动保证两个采样点之间稳定。多时钟验证中，快时钟可能看到中间变化。本命令用于表达真实接口的稳定区间，不能把本来异步变化的输入强行同步化来消除失败。

```tcl
set_change_at -clock clk -default
report_change_at
```

来源：User Guide，X-2025.06-SP1，第 74–76、118；QRG 7 页。

### 3.22 `report_change_at`：检查输入变化规则

```text
report_change_at
```

**参数解释。** 列出当前设置的允许变化事件及关联信号。

**用法与结果。** 应确认每个外部接口受哪个时钟规则影响，尤其注意默认规则是否覆盖了本来需要异步变化的复位、握手或中断输入。

```tcl
report_change_at
```

来源：User Guide，X-2025.06-SP1，第 75–76 页。

### 3.23 `get_change_at`：读取输入变化规则对象

```text
get_change_at
```

**参数解释。** 取得已定义的变化时机设置，供脚本进一步查询。UG 在多时钟建模中列出该查询入口，未在正文展开其完整筛选参数。

**用法与结果。** 将它与报告命令区分：报告面向阅读，查询结果用于脚本处理。不能据名称推断未列出的参数；自动化脚本只采用经过当前工具帮助确认的筛选方式。

```tcl
set changes [get_change_at]
puts $changes
```

来源：User Guide，X-2025.06-SP1，第 75–76 页。

### 3.24 `sim_run`：运行初始化仿真

```text
sim_run -stable
sim_run <cycles> [-clk <clock-name>]
```

**参数解释。** `-stable` 运行到用于初始化的稳定状态；数值形式运行给定周期数，`-clk` 指定计数所用的时钟。

**用法与结果。** 本命令服务于形式模型的初始化，不等于覆盖设计全部工作行为的动态验证。运行后用 `sim_get` 检查关键寄存器，再执行 `sim_save_reset` 把所得到的状态交给证明。修改会影响形式设置的条件后，工具可能重新生成复位状态，须避免覆盖手工初值。

```tcl
sim_run -stable
sim_get [get_sequentials *count*]
sim_save_reset
```

来源：User Guide，X-2025.06-SP1，第 141–157；QRG 7 页。

### 3.25 `sim_force`：在初始化仿真中强制信号

```text
sim_force <signal-name> -apply <value>
```

**参数解释。** 信号名是需要强制的对象，`-apply` 给出施加值。此处展示复位仿真与初始化示例中的施加形式。

**用法与结果。** 强制初始化信号与在正式分析中固定常量不是同一个操作。标准 `create_reset` 会组合初始化强制和正式分析的非复位常量行为；手工写初始化序列时，需要明确每个阶段的信号值，不能假定施加动作已经建立全部后续约束。

```tcl
sim_force rst_n -apply 1'b0
sim_run 3 -clk clk
sim_save_reset
```

来源：User Guide，X-2025.06-SP1，第 139、141–149 页。

### 3.26 `sim_set_state`：设置寄存器和存储器的初始状态

```text
sim_set_state [-fsdb {<file> <instance> <time>}]
              [-uninit_script <file_name>] [-apply <0|1|x|z>]
              [-exact] [-regexp] [-all] [-uninitialized]
              [-readmemb {<file> <memory> [start_addr [end_addr]]}]
              [-readmemh {<file> <memory> [start_addr [end_addr]]}]
              [-exclude_package] [-top <instance_name>] [-xml <file_name>]
              [<sequential-patterns-or-collection>]
```

**参数解释。** `-apply` 直接设置状态值；位置参数选择时序对象，`-all` 选择全部状态，`-uninitialized` 只选择未初始化对象，`-exact` 与 `-regexp` 改变名称匹配方式。`-fsdb` 从指定实例、指定时间取状态；`-uninit_script` 输出 FSDB 中缺少的未初始化对象脚本。`-readmemb`、`-readmemh` 分别读取二进制、十六进制存储器文件，可指定地址范围。`-xml` 读取保存的初始状态，`-top` 限定加载实例，`-exclude_package` 排除工具包中的信号。

**用法与结果。** 应在初始化仿真完成后设置，并随后保存状态；先设置再运行复位仿真，手工值可能被覆盖。把一个实际未复位寄存器设为 0 是缩小初始状态集合；把有确定初值的寄存器设成 X 则是初始状态抽象。两者对证明结论的影响不同，均需有明确目的和证据。

```tcl
sim_run -stable
sim_set_state {u_counter.count} -apply x
sim_save_reset

sim_set_state -xml reviewed_reset.xml
sim_save_reset
```

来源：User Guide，X-2025.06-SP1，第 141–145 页。

### 3.27 `sim_save_reset`：把当前状态保存为形式初始状态

```text
sim_save_reset
```

**参数解释。** 无参数形式把当前初始化状态保存到任务对应的复位状态资料中。

**用法与结果。** `create_reset` 只定义复位行为，`sim_run` 计算初始化状态，本命令才把当前状态交给后续证明。复制任务或读入复位 XML 后，同样需要明确当前任务采用的初始状态，避免误用其他运行遗留的值。

```tcl
sim_run -stable
sim_save_reset
view_trace -reset
```

来源：User Guide，X-2025.06-SP1，第 141–143、149–157 页。

### 3.28 `sim_get`：查询当前初始化仿真值

```text
sim_get <signals-or-collection>
sim_get -signals {<signal-patterns>}
```

**参数解释。** 位置参数或 `-signals` 选择信号。返回值来自当前仿真时刻；紧接复位仿真查询时，就是所观察的复位状态。

**用法与结果。** 此值不是所有形式轨迹的共同值，也不是某条失败反例的特定周期值。检查未知初值时应同时记录对象名称和初始化步骤，不能把一次仿真取值直接提升为全时域假设。

```tcl
sim_get [get_sequentials *count*]
sim_get -signals {control_reg*}
```

来源：User Guide，X-2025.06-SP1，第 156–157；QRG 7 页。

### 3.29 `fv_setup_config`：配置模型准备检查

```text
fv_setup_config [-check <check-names>] [-category <category>]
                [-severity <error|info|warning>]
                [-autorun <checkpoint>] [-disable] [-enable]
                [-list] [-verbosity <none|summary|verbose>]
```

**参数解释。** `-check` 支持 `clock`、`comb_loop`、`glitch`、`multi_driver`、`osc_loop`、`osc_seq`、`reset`。`-category` 为 `all`、`general` 或 `modport`；非 all 类别要求只指定一种检查，modport 对应多驱动检查。`-severity` 默认 warning，设为 error 可在检查违规时终止流程。`-autorun` 的检查点为 `design_load`；本版组合环自动检查只在设计加载点执行。`-disable`、`-enable` 改变检查启用情况，`-list` 查看配置，`-verbosity` 默认 summary。

**用法与结果。** `modport` 类别用于区分接口输出 modport 造成的特殊多驱动情形与普通多驱动，例如多个接口声明为输出但实际只有一个非高阻赋值。不要为了让脚本继续运行把真实组合环或时钟问题整体关掉。

```tcl
fv_setup_config -check comb_loop -severity error
fv_setup_config -list
check_fv_setup -block
```

来源：User Guide，X-2025.06-SP1，第 157–159 页。

### 3.30 `check_fv_setup`：执行模型准备检查

```text
check_fv_setup [-block] [-run_finish <commands>] [-stop]
               [-break <number-of-falsifications>]
               [-check <check-names>] [-category <category>] [-verbose]
```

**参数解释。** `-block` 等待检查结束；缺省非阻塞，可用报告命令查看进度。`-run_finish` 指定非阻塞结束后执行的命令，`-stop` 停止运行，`-break` 达到指定失败数后停止。`-check` 与 `-category` 的检查类型同配置命令，`-verbose` 逐项打印违规。

**用法与结果。** 这是时钟、复位、组合环和多驱动等准备条件检查，不是业务属性证明。若要检查经过电源开关的电源逻辑异常，必须先读 UPF。自动生成了潜在问题目标不等于这些目标已经运行；`POTENTIAL_SETUP_ISSUE` 提示正是要求进一步执行并阅读准备检查。

```tcl
check_fv_setup -block
report_fv_setup -list
check_fv -block
```

来源：User Guide，X-2025.06-SP1，第 157–160 页。

### 3.31 `report_fv_setup`：报告准备检查的状态与违规

```text
report_fv_setup [-list] [-limit <integer>]
```

**参数解释。** `-list` 逐条列出违规，`-limit` 限制列出的网络数量。

**用法与结果。** 异步检查未结束时，报告只是当前进度快照。正式归档应在阻塞检查结束或完成回调后生成，且保留未经截断的原始日志。

```tcl
check_fv_setup -block
report_fv_setup -list -limit 100
```

来源：User Guide，X-2025.06-SP1，第 160–161 页。

### 3.32 `infer_formal_setup`：推断时钟等形式设置

```text
infer_formal_setup -type <setup-type>
```

**参数解释。** `-type clock` 是快速参考展示的时钟推断用法。推断结果需通过 `report_formal_setup` 查看；其他推断类型不在此调用形式中擅自扩展。

**用法与结果。** 推断减少重复输入，不替代设计意图。门控时钟、测试时钟、多源选择和包装层可能使结构推断与实际工作模式不同，因此应在正式证明前确认并必要时显式定义。

```tcl
infer_formal_setup -type clock
report_formal_setup
```

来源：Quick Reference Guide，X-2025.06-SP1，第 QRG 7 页。 此处为快速参考提供的补充调用；UG 未列出完整参数定义。

### 3.33 `formal_setup_config`：查询或配置自动设置流程

```text
formal_setup_config
```

**参数解释。** 快速参考列出无参数入口，用于查看形式设置相关配置。该资料没有在此处展开全部参数。

**用法与结果。** 把该入口用于检查工具当前配置，不应凭名称补写未证实的选项。需要改变自动推断行为时，采用安装版本帮助中明确支持的配置项，并保存修改后的报告。

```tcl
formal_setup_config
infer_formal_setup -type clock
report_formal_setup
```

来源：Quick Reference Guide，X-2025.06-SP1，第 QRG 7 页。 此处为快速参考提供的补充调用；UG 未列出完整参数定义。

### 3.34 `report_formal_setup`：报告自动或显式形式设置

```text
report_formal_setup
```

**参数解释。** 无参数入口用于查看当前形式设置报告。

**用法与结果。** 核对时钟、复位和相关建模条件后，再看具体属性状态。报告设置与 `report_fv_setup` 报告检查结果不同，不能因设置表中存在时钟名称就认为时钟检查已通过。

```tcl
report_formal_setup
check_fv_setup -block
report_fv_setup -list
```

来源：Quick Reference Guide，X-2025.06-SP1，第 QRG 7 页。 此处为快速参考提供的补充调用；UG 未列出完整参数定义。

## 4. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fvassert` | 创建断言或改变已有属性的使用方式 |
| `fvassume` | 创建环境前提或改变属性用途 |
| `fvcover` | 创建可达性目标并扩展到事务结束 |
| `fvdisable` | 停用选定的断言、假设或覆盖 |
| `fvenable` | 重新启用已有属性 |
| `fvdelete` | 删除脚本属性 |
| `get_props` | 按类型、用途和状态查询属性集合 |
| `check_fv` | 证明属性或寻找覆盖见证 |
| `report_fv` | 读取证明状态、深度和详细结果 |
| `fvlearn_config` | 配置回归学习的保存与复用 |
| `set_grid_usage` | 配置并行工作进程与计算集群 |
| `set_backup_grid_usage` | 配置备用计算资源 |
| `report_fml_hosts` | 查看集群主机和工作进程状态 |
| `report_fml_engines` | 按目标报告求解引擎表现 |
| `report_fml_jobs` | 按作业报告运行状态与结束原因 |
| `fvtask` | 创建、切换和删除验证任务 |
| `get_fvtask` | 取得当前或指定任务集合 |
| `report_fvtask` | 报告任务状态 |
| `save_session` | 保存设置与运行资料 |
| `restore_session` | 在工具中恢复保存的会话 |
| `quit` | 退出工具 |
| `fvcompile` | 编译延后建立的脚本属性 |

属性管理改变当前任务中哪些结论需要证明、哪些条件被假设、哪些事件只要求存在一次。运行命令还可能是非阻塞的：脚本继续执行不表示证明已经结束。报告、会话和波形分别保存不同的信息，应共同用于复现结果。

### 4.1 `fvassert`：创建断言或改变已有属性的使用方式

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

### 4.2 `fvassume`：创建环境前提或改变属性用途

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

### 4.3 `fvcover`：创建可达性目标并扩展到事务结束

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

### 4.4 `fvdisable`：停用选定的断言、假设或覆盖

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

### 4.5 `fvenable`：重新启用已有属性

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

### 4.6 `fvdelete`：删除脚本属性

```text
fvdelete <property-names-or-collection>
```

**参数解释。** 指定要删除的属性对象。快速参考给出本命令作为属性管理操作，示例用于可由脚本重新建立的属性。

**用法与结果。** 删除会失去对象本身，停用则保留对象与便于审计的信息。临时试验可删除脚本目标；正式工程更应修改版本受控的属性源码和生成脚本，而不是只在交互会话里删除失败目标。

```tcl
fvcover CP_TEMP -expr {@(posedge clk) req}
fvdelete CP_TEMP
```

来源：Quick Reference Guide，X-2025.06-SP1，第 QRG 8、19 页。 此处为快速参考提供的补充调用；UG 未列出完整参数定义。

### 4.7 `get_props`：按类型、用途和状态查询属性集合

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

### 4.8 `check_fv`：证明属性或寻找覆盖见证

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

### 4.9 `report_fv`：读取证明状态、深度和详细结果

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

### 4.10 `fvlearn_config`：配置回归学习的保存与复用

```text
fvlearn_config [-local_dir <directory>] [-enable <0|1>]
               [-local_dir_learn <directory>]
               [-local_dir_apply <directory>]
               [-learn_only] [-apply_only] [-global] [-verbose] [-status]
```

**参数解释。** `-local_dir` 共用学习和应用目录，也可分别用 `-local_dir_learn`、`-local_dir_apply` 设置。`-learn_only` 只保存当前学习并可能覆盖已有数据；`-apply_only` 只应用旧数据，不写入本次学习。`-enable` 开关 RMA，`-global` 应用于当前各任务，`-verbose` 输出收益信息，`-status` 返回开关与数据库路径字典。

**用法与结果。** 应在证明命令之前配置。复用的是学习结果与求解经验，不是免除对修改后设计的检查。准备检查和形式核心计算不积累这类学习。目标数量极大的 COV 任务可能因保存数据库增加成本，必须比较真实端到端耗时，而非只看引擎用时。

```tcl
fvlearn_config -local_dir rma_db
check_fv -block
fvlearn_config -status

fvlearn_config -local_dir rma_db -apply_only
```

来源：User Guide，X-2025.06-SP1，第 171–182 页。

### 4.11 `set_grid_usage`：配置并行工作进程与计算集群

```text
set_grid_usage [-type <string>] [-control <string>] [-dir <string>]
  [-file <string>] [-memory <string>] [-global] [-default]
  [-job_array] [-prefetch_pct <percent>] [-level <integer>] [-navigator]
```

**参数解释。** `-type` 指定计算集群类型及工作进程数，例如 `LSF=8`、`SLURM=6`；`-control` 是该集群实际使用的提交命令及资源要求。`-dir` 指定工作进程临时目录，`-file` 指定提交配置文件。`-memory` 表示多级资源配置对应的内存容量（GB），`-level` 指定级别，必须从 0 开始连续编号。`-global` 作用于全部当前任务，`-navigator` 作用于 navigator 任务而非普通当前任务；`-default` 恢复默认设置。`-job_array` 启用作业数组，`-prefetch_pct` 控制预取进程比例，范围 0–100。

**用法与结果。** 请求工作进程数不等于实际获得资源，也不是线程数或总内存。各节点必须能访问相同设计、临时目录和授权服务；队列的内存限制与形式引擎的内存限制应一致。提交字符串是集群特定配置，不能直接照搬其他站点名称。

```tcl
set_grid_usage -type rsh=8
check_fv -block
report_fml_jobs -list

set_grid_usage -type SLURM=6 \
    -control {/nfs/slurm/bin/sbatch -p vcfM5 --wait}
```

来源：User Guide，X-2025.06-SP1，第 190–198 页。

### 4.12 `set_backup_grid_usage`：配置备用计算资源

```text
set_backup_grid_usage -type <backend=worker-count>
                      -control {<submission-command-and-options>}
```

**参数解释。** 快速参考把此命令列为备用集群配置入口。后端与提交选项必须来自实际部署的队列设置。

**用法与结果。** 备用资源用于运行环境的资源切换，不改变验证目标的逻辑含义。主资源失败时，应通过作业报告区分排队、启动失败、内存耗尽和外部终止，而不是把所有未完成归为证明困难。

```tcl
set_backup_grid_usage -type LSF=4 \
    -control {bsub -q backup -R rusage[mem=8000]}
```

来源：User Guide，X-2025.06-SP1，第 190–198；QRG 7–8 页。

### 4.13 `report_fml_hosts`：查看集群主机和工作进程状态

```text
report_fml_hosts
```

**参数解释。** 报告实际可用或分配的主机及工作进程信息；用于和资源请求配置比对。

**用法与结果。** 集群请求成功并不代表工作进程已经开始运行。长时间没有证明进展时，先确认机器是否已分配、进程是否启动以及共享目录是否可访问，再调整形式算法。

```tcl
report_fml_hosts
report_fml_jobs -list
```

来源：User Guide，X-2025.06-SP1，第 208–217；QRG 8 页。

### 4.14 `report_fml_engines`：按目标报告求解引擎表现

```text
report_fml_engines [-no_summary] [-list] [-verbose]
                   [-depthCounts] [-depthVsTime]
                   [-status <statuses>] [-jobId <number>]
                   [-goalId <number>] [-engine <name>]
                   [-subtype <subtypes>] [-jobStatus <statuses>]
```

**参数解释。** 默认汇总当前任务最近一次运行。`-list` 每个目标一行，`-verbose` 每个目标在不同引擎中的状态分别列出。`-depthCounts` 按失败深度和有界深度计数，`-depthVsTime` 查看深度随时间的变化。`-jobId`、`-goalId`、`-engine`、`-subtype`、`-jobStatus` 分别按作业、目标、引擎、目标子类和作业状态筛选。

**用法与结果。** 一个属性可能产生自身、空洞性和见证等多个目标。报告中的累计引擎时间不是墙上时钟经过时间；SEQ 子证明的时间也可能是多个引擎的总和。判断性能改动时，应同时记录端到端时间、完成目标数和安全深度。

```tcl
report_fml_engines -list
report_fml_engines -verbose -status bounded
report_fml_engines -depthCounts
```

来源：User Guide，X-2025.06-SP1，第 209–212 页。

### 4.15 `report_fml_jobs`：按作业报告运行状态与结束原因

```text
report_fml_jobs [-status <status>] [-reason <reason>] [-list]
                [-totaltime] [-no_summary] [-engine <name>]
                [-host <name>] [-jobId <integer>] [-profile]
                [-memBucket <GB>] [-grid_level <integer>]
```

**参数解释。** `-status` 筛选 scheduled、running 或 completed；`-reason` 筛选 normal、timeout、memout、orc_killed、sig_killed、crash、start_fail、misc_error 等原因。`-list` 列出每个作业的状态、时间、CPU 利用率、内存、目标数量和机器信息；`-totaltime` 汇总作业时间，`-no_summary` 省略汇总。`-engine`、`-host`、`-jobId` 按对象过滤；`-profile` 按引擎统计时间、内存与完成目标，`-memBucket` 控制内存分组宽度，默认 8 GB；`-grid_level` 筛选资源级别。

**用法与结果。** timeout 可能只是工具分阶段尝试短时引擎的正常结果；orc_killed 常表示其他引擎已经解决目标；sig_killed 可能来自集群外部限制。它们都不能直接等同于 RTL 错误。CPU 利用率明显低于预期时，应先检查机器争用与资源分配。

```tcl
report_fml_jobs -list
report_fml_jobs -reason memout -list
report_fml_jobs -profile -memBucket 4
```

来源：User Guide，X-2025.06-SP1，第 212–217 页。

### 4.16 `fvtask`：创建、切换和删除验证任务

```text
fvtask [-create] [-delete] [-limit_copy] [-copy <copy_task>]
  [-appcopy <app_name>] [-attributes <name/value-pairs>]
  [-asserts <properties>] [-assumes <properties>] [-covers <properties>]
  [-constants <signals>] [-snips <signals>] [-changeats <signals>]
  [-keep_status] [-keep_task] [<task_name>]
```

**参数解释。** `-create` 创建任务并通常切换为当前任务；`-delete` 删除非默认任务；仅给任务名表示切换任务。`-copy` 从指定任务复制，`-appcopy` 从指定应用复制。`-asserts`、`-assumes`、`-covers` 选择属性；`-constants`、`-snips`、`-changeats` 选择现有常量、截断信号和变化时刻约束。`-limit_copy` 限制复制范围，要求至少指定一类属性；`-attributes` 显式指定任务属性名和值。`-keep_status` 保留父任务的目标状态；`-keep_task` 创建或修改目标任务但不切换当前任务。

**用法与结果。** 任务隔离允许按功能和难度组织证明，但不自动使任务之间的假设正确。限制复制时特别检查约束、初始状态及任务专属属性，UG 明确提示专属属性不会总是默认复制。新任务缺少关键环境约束可能出现伪反例，多复制错误假设则可能导致不真实的通过。 时钟与复位定义是全局设置，不会因为拆成任务而形成独立时钟环境。同一会话同一时刻只有一个任务执行 `check_fv`。语法定义中没有单列 `-abstractions`，即使说明文字提到复制抽象，也不应据此构造不存在于语法框的开关。

```tcl
fvtask -create hold_checks -copy FPV \
    -asserts *hold* -assumes *
check_fv -block
report_fv -list
fvtask FPV
```

来源：User Guide，X-2025.06-SP1，第 313–323 页。

### 4.17 `get_fvtask`：取得当前或指定任务集合

```text
get_fvtask [-filter <attribute-expression>] [tasks]
```

**参数解释。** 无参数取得当前任务，星号取得所有任务；`-filter` 按任务属性筛选。

**用法与结果。** 返回工具集合，适合读取任务属性或构造批量报告。不要把 `get_fvtask` 无参数误认为列出所有任务。

```tcl
set current [get_fvtask]
set all_tasks [get_fvtask *]
puts [sizeof_collection $all_tasks]
```

来源：User Guide，X-2025.06-SP1，第 317 页。

### 4.18 `report_fvtask`：报告任务状态

```text
report_fvtask [-filter <expression>] [-xml] [tasks]
```

**参数解释。** 任务名称或模式限制范围，`-filter` 按属性过滤，`-xml` 采用 XML 输出。

**用法与结果。** 该报告说明任务是否活动以及汇总状态；具体失败属性仍需进入对应任务查看。批量回归应把任务名与设计配置一起记录，不能合并不同前提下的通过计数。

```tcl
report_fvtask *
report_fvtask -xml * > task_report.xml
```

来源：User Guide，X-2025.06-SP1，第 317 页。

### 4.19 `save_session`：保存设置与运行资料

```text
save_session [-session <session-name>]
```

**参数解释。** 省略名称保存当前会话；`-session` 指定会话保存位置或名称。

**用法与结果。** 退出并不保证所需设置和结果已经保存。与源代码版本、Tcl 脚本和日志一起归档，才能在后续调试中知道数据库由哪一组输入生成。保存会话也不是可移植的正式证明证书。

```tcl
check_fv -block
report_fv -list > results.txt
save_session -session reviewed_run
```

来源：User Guide，X-2025.06-SP1，第 324–329 页。

### 4.20 `restore_session`：在工具中恢复保存的会话

```text
restore_session -session <session-name>
```

**参数解释。** 参数指定已保存的会话。也可以从操作系统通过 `vcf -restore -session ...` 启动恢复。

**用法与结果。** 恢复后先查询应用模式、任务和报告，再决定继续求解。恢复旧数据库不会自动把后来修改的源码读入，也不能将旧结果标记为对新设计有效。

```tcl
restore_session -session reviewed_run
get_fml_appmode
report_fvtask *
report_fv
```

来源：User Guide，X-2025.06-SP1，第 324–329 页。

### 4.21 `quit`：退出工具

```text
quit [-force]
```

**参数解释。** 无参数退出当前外壳；`-force` 用于跳过保存相关步骤快速退出。

**用法与结果。** 正式批处理应在证明或指定完成回调结束后生成报告，并按需要显式保存会话，然后退出。不能在非阻塞 `check_fv` 后立即执行 `quit`，否则结果可能尚未产生。

```tcl
check_fv -block
report_fv -list > final_results.txt
save_session
quit
```

来源：User Guide，X-2025.06-SP1，第 185、324–325 页。

### 4.22 `fvcompile`：编译延后建立的脚本属性

```text
fvcompile
```

**参数解释。** 无参数调用，用于在延后属性编译流程中一次编译已生成的脚本属性。

**用法与结果。** 自动生成大量属性时，先设置延后编译、建立各个属性，再统一编译，可避免逐条重复处理。这里的编译针对属性，不取代设计前端的 analyze 和 elaborate。

```tcl
set_fml_var fml_defer_property_compile true
fvassert AP_ONEHOT -expr {@(posedge clk) $onehot0(grant)}
fvcover CP_REQUEST -expr {@(posedge clk) req}
fvcompile
```

来源：User Guide，X-2025.06-SP1，第 379–380 页。

## 5. 完整计数器工程

上面的命令列表用于按用途检索，其中 `top/filelist.f` 等名称属于参数示意。下面则列出全部实际文件，帮助读者从命令清单进入可保存的教学工程。

### 5.1 被验证的计数器 RTL

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

### 5.2 完整断言与绑定文件

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

### 5.3 编译文件列表

先列 RTL，再列包含 `bind` 的属性文件；路径相对于运行 VC Formal 的 `案例工程/` 目录，而不是 Tcl 文件所在目录。

**保存为 `案例工程/filelist_counter.f`：**

<!-- source-begin: 案例工程/filelist_counter.f -->

```text
./rtl/counter.sv
./formal/counter_props.sv
```

<!-- source-end -->

### 5.4 完整运行脚本

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

