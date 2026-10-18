# Assertion IP 与分解证明

## 1. 两类复用方式

Assertion IP 复用协议检查知识，Proof Architect 复用经过组织的子证明。前者把接口规则转成属性；后者规定哪些局部证明可以作为其他证明的前提。两者都不能免除环境审查：加载了协议检查器不代表接口角色和时序配置正确，划分了多个子任务也不代表这些任务之间的依赖一定合法。

| 方法 | 输入 | 解决的问题 |
| --- | --- | --- |
| Assertion IP | 协议、接口角色、参数和绑定 | 减少重复编写标准协议规则 |
| 分解证明 | 子任务、局部结论和依赖关系 | 用较小证明支持较大结论 |
| 独立覆盖检查 | 场景条件及环境前提 | 判断任务或协议事务是否真正可达 |

协议检查器需要区分控制方与响应方。例如一个模块主动发出请求时，对它自己负责的协议关系应生成断言；外部响应方承担的协议条件可以成为环境前提。角色配置颠倒，可能把设计本应保证的规则变成假设，使本来错误的实现被排除在搜索范围之外。

## 2. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `aip_load` | 预装协议断言库 |

加载检查库只是准备阶段。仍需将检查器绑定到实际接口，设置协议版本、位宽、角色和合法事务范围，再检查断言、假设、覆盖目标各自的数量。

### 2.1 `aip_load`：预装协议断言库

```text
aip_load [-protocol <protocols>] [-aip_src_path <directory>]
```

**参数解释。** `-protocol` 支持 APB、AHB、AXI3、AXI4、AXI5、AXI_STREAM、ACE、ACE5、CHI、LPI、GIC、RISCV、I2C、SPI、SPMI、FSCB、all。省略时预装全部支持协议。`-aip_src_path` 指定自定义库目录，否则使用安装包中的 AIP 目录。

**用法与结果。** 该命令在展开前为分析预装库文件，不自动知道 DUT 扮演的协议角色，也不自动完成用户绑定。主设备与从设备需要分别配置哪些规则是环境假设、哪些是 DUT 断言。调试以实际接口信号和协议事件为中心，不必首先深入库的内部辅助信号。

```tcl
set_fml_appmode FPV
aip_load -protocol APB
analyze -format sverilog -vcs "-f rtl_and_bind.f"
elaborate -sva top
```

来源：User Guide，X-2025.06-SP1，第 614–615 页。

## 3. 组合证明的逻辑要求

假设要证明最终性质 P，先证明局部性质 L，再在第二个任务中以 L 为前提证明 P。只有当 L 在与第二个任务兼容的真实环境下成立，组合才有意义。不能让“证明 L”依赖尚未证明的 P，再让“证明 P”依赖 L；这会形成互相担保的循环，而不是对原设计的证明。

对情况拆分同样需要完整性。例如把状态分为模式 0、1、2，就必须说明模式 3 为什么不属于合法行为，或者额外建立模式 3 的证明任务。遗漏一种输入情况不能由其余任务全部通过来弥补。保存任务依赖、使用的假设和每个任务状态，与保存最终属性状态同样重要。

## 4. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `fv_proof_arch` | 创建、生成与审查分解证明策略 |
| `fv_proof_arch_report` | 查看分解关系和结果传播安全性 |

使用 Proof Architect 前，先准备被引用的任务和属性集合。策略报告用于核对任务依赖和组合状态；它不允许把循环依赖或遗漏的情况自动视为已完成证明。

### 4.1 `fv_proof_arch`：创建、生成与审查分解证明策略

```text
fv_proof_arch -name <name> [-type <type>] [-subtype <subtype>]
  [-append] [-generate] [-property <properties>] [-assumes <properties>]
  [-ignore_status] [-unsafe] [-propagate <true|false>]
  [-distribute_max_tasks <n>] [-distribute_max_props <n>]
  [-distribute_custom] [-model_summary] [-model_ref <strategy>]
  [-audit] [-signal <signal>] [-values <values>] [-enumerate <mode>]
```

**参数解释。** `-name` 全局唯一且必填。`-type` 可选 copy、assume_guarantee、abstraction、over_constraint、case_split。assume_guarantee 的 `-subtype` 可选 acyclic（默认）、chain、grouped_induction；case_split 默认 subspace，event 另属该版本的 Beta 说明范围。`-append` 添加字段，`-generate` 根据当前定义生成并锁定子任务；`-property` 选择待证明目标，`-assumes` 选择辅助假设。

`-distribute_max_tasks` 限定任务数，`-distribute_max_props` 限定每任务目标数，`-distribute_custom` 允许自定义分配。`-ignore_status` 调整按状态纳入目标的限制；原文描述与相邻默认筛选说明不够一致，使用时应核对生成任务，而不假定所有状态都被接受。`-unsafe` 标为不安全策略；`-propagate` 控制结果是否向父任务传播。`-model_summary` 比较模型，`-model_ref` 指定参考策略，`-audit` 做一致性审查。case_split 用 `-signal`、`-values` 指定分支对象与取值，`-enumerate` 默认 custom。

**用法与结果。** 先设置 `fv_proof_architect true`。假设—保证分解不能让两个未独立成立的目标循环互相假设；chain 中工具禁止这种循环。抽象、增加限制和子空间分解有不同的结果传播规则，因此所有子任务显示成功仍需通过策略完整性审查。

```tcl
set_fml_var fv_proof_architect true
fv_proof_arch -name split_goals -type copy -distribute_max_props 20
fv_proof_arch -name split_goals -property [get_props -usage assert] -generate
fv_proof_arch_report -name split_goals
check_fv -proof_arch split_goals -block
fv_proof_arch -name split_goals -audit
```

来源：User Guide，X-2025.06-SP1，第 805–810 页。

### 4.2 `fv_proof_arch_report`：查看分解关系和结果传播安全性

```text
fv_proof_arch_report [-name <strategy>] [-format <text|xml|collection>]
```

**参数解释。** `-name` 限定策略，省略为全部；`-format` 默认 text，也可选择 XML 或工具集合。

**用法与结果。** 报告应检查策略类型、所属任务、Safe、Propagate、锁定状态及子任务中的 assert/assume 配置。Safe 是工具在该策略规则下的审查结果，不免除用户对规格、环境和允许的建模变更的责任。

```tcl
fv_proof_arch_report -name split_goals
fv_proof_arch_report -format xml
```

来源：User Guide，X-2025.06-SP1，第 810–812 页。

