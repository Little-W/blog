---
title: RISC-V：整数寄存器、ABI、CSR 与 trap 处理
sidebar_position: 1
slug: /notes/digital-design/riscv-abi-and-csr
---

# RISC-V：整数寄存器、ABI、CSR 与 trap 处理

RISC-V 基础整数 ISA 定义 `x0`–`x31`、程序计数器和整数指令；ABI 规定寄存器在函数调用中的用途；特权架构定义 CSR、特权级、中断、异常和地址转换。三部分解决的问题不同：ISA 约束指令的硬件行为，ABI 约束不同目标文件之间的调用兼容性，特权架构约束操作系统与处理器之间的控制接口。

## 32 个整数寄存器

RV32 与 RV64 均有 32 个整数寄存器。每个寄存器宽度等于 `XLEN`，即 RV32 为 32 位，RV64 为 64 位。`x0` 的读值恒为零；其余寄存器没有硬件固定用途，表中的名称和保存规则来自标准 psABI。

| 物理寄存器 | ABI 名称 | 标准用途 | 跨函数调用保留 | 详细说明 |
| --- | --- | --- | --- | --- |
| `x0` | `zero` | 常数零 | 固定值 | 读值恒为 0，写入结果被丢弃；常用于生成伪指令和不保留 CSR 旧值。 |
| `x1` | `ra` | 返回地址 | 否 | `jal`/`jalr` 通常写入返回地址；非叶子函数若继续调用其他函数，必须先保存原值。 |
| `x2` | `sp` | 栈指针 | 是 | 栈向低地址增长；标准 ABI 要求函数入口处按 16 字节对齐，并在函数执行期间维持规定对齐。 |
| `x3` | `gp` | 全局指针 | 固定用途 | 工具链可用它访问小数据区；标准 ABI 将其列为不可分配寄存器，普通函数不应修改。 |
| `x4` | `tp` | 线程指针 | 固定用途 | 指向线程局部存储或运行时线程结构；信号处理与运行库可能直接读取，普通函数不应修改。 |
| `x5` | `t0` | 临时寄存器 0 | 否 | 调用者保存；也常用于 trap 入口的临时交换。 |
| `x6` | `t1` | 临时寄存器 1 | 否 | 调用者保存。 |
| `x7` | `t2` | 临时寄存器 2 | 否 | 调用者保存。 |
| `x8` | `s0` / `fp` | 保存寄存器 0 / 帧指针 | 是 | 使用帧指针时必须选用 `x8`；无帧指针时仍按 `s0` 的保存规则处理。 |
| `x9` | `s1` | 保存寄存器 1 | 是 | 被调用者使用后必须恢复入口值。 |
| `x10` | `a0` | 参数 0 / 返回值 0 | 否 | 第一个整数参数；也是第一个整数返回值。 |
| `x11` | `a1` | 参数 1 / 返回值 1 | 否 | 第二个整数参数；也是第二个整数返回值，可与 `a0` 共同返回宽值。 |
| `x12` | `a2` | 参数 2 | 否 | 第三个整数参数。 |
| `x13` | `a3` | 参数 3 | 否 | 第四个整数参数。 |
| `x14` | `a4` | 参数 4 | 否 | 第五个整数参数。 |
| `x15` | `a5` | 参数 5 | 否 | 第六个整数参数。 |
| `x16` | `a6` | 参数 6 | 否 | 第七个整数参数。 |
| `x17` | `a7` | 参数 7 / 系统调用号 | 否 | 第八个整数参数；许多执行环境用它传递系统调用号，但具体定义由运行环境规定。 |
| `x18` | `s2` | 保存寄存器 2 | 是 | 被调用者保存。 |
| `x19` | `s3` | 保存寄存器 3 | 是 | 被调用者保存。 |
| `x20` | `s4` | 保存寄存器 4 | 是 | 被调用者保存。 |
| `x21` | `s5` | 保存寄存器 5 | 是 | 被调用者保存。 |
| `x22` | `s6` | 保存寄存器 6 | 是 | 被调用者保存。 |
| `x23` | `s7` | 保存寄存器 7 | 是 | 被调用者保存。 |
| `x24` | `s8` | 保存寄存器 8 | 是 | 被调用者保存。 |
| `x25` | `s9` | 保存寄存器 9 | 是 | 被调用者保存。 |
| `x26` | `s10` | 保存寄存器 10 | 是 | 被调用者保存。 |
| `x27` | `s11` | 保存寄存器 11 | 是 | 被调用者保存。 |
| `x28` | `t3` | 临时寄存器 3 | 否 | 调用者保存。 |
| `x29` | `t4` | 临时寄存器 4 | 否 | 调用者保存。 |
| `x30` | `t5` | 临时寄存器 5 | 否 | 调用者保存。 |
| `x31` | `t6` | 临时寄存器 6 | 否 | 调用者保存。 |

“调用者保存”表示调用指令执行前，调用方必须保存调用后仍需使用的值；“被调用者保存”表示被调用函数若修改寄存器，必须在返回前恢复入口值。`gp` 与 `tp` 属于固定用途寄存器，不应按普通临时寄存器分配。

### 参数、返回值与栈帧

标准整数调用约定提供八个参数寄存器 `a0`–`a7`。宽度不超过 `XLEN` 的标量优先使用一个参数寄存器；寄存器不足时，后续参数按 ABI 规则放入栈中。`a0` 和 `a1` 兼作返回值寄存器。栈向低地址增长，函数入口的 `sp` 必须按 128 位对齐。

帧指针不是强制状态。编译器启用帧指针时，`s0/fp` 指向当前栈帧的固定位置，使调试器和栈展开器不依赖函数执行期间变化的 `sp`。叶子函数若不保存寄存器且不分配局部对象，可以不建立栈帧。

下例是一个 RV64 非叶子函数的基本栈帧。实际帧大小由局部对象、保存寄存器和栈上传参共同决定。

```riscv
sum_then_scale:
  addi sp, sp, -32
  sd   ra, 24(sp)
  sd   s0, 16(sp)
  addi s0, sp, 32

  call sum2             # a0/a1 传参，a0 返回结果
  slli a0, a0, 1

  ld   s0, 16(sp)
  ld   ra, 24(sp)
  addi sp, sp, 32
  ret
```

## CSR 地址与访问权限

CSR 使用 12 位地址，因此指令编码可表示 4096 个 CSR 地址。地址高四位同时编码默认读写属性和最低访问特权级：`csr[11:10]` 为 `11` 时表示只读，`csr[9:8]` 表示 U、S、H/VS 或 M 级。更高特权级通常可以访问低特权级 CSR，但实现仍可依据特权扩展截获部分访问。

### CSR 地址空间的完整分类

| 最低特权级 | 地址范围 | 属性 | 标准或自定义用途 |
| --- | --- | --- | --- |
| U | `0x000`–`0x0FF` | 读写 | 标准 U 级 CSR |
| U | `0x400`–`0x4FF` | 读写 | 标准 U 级 CSR |
| U | `0x800`–`0x8FF` | 读写 | 自定义 U 级 CSR |
| U | `0xC00`–`0xC7F` | 只读 | 标准 U 级 CSR |
| U | `0xC80`–`0xCBF` | 只读 | 标准 U 级 CSR，常用于 RV32 高 32 位计数器 |
| U | `0xCC0`–`0xCFF` | 只读 | 自定义 U 级 CSR |
| S | `0x100`–`0x1FF` | 读写 | 标准 S 级 CSR |
| S | `0x500`–`0x5BF` | 读写 | 标准 S 级 CSR |
| S | `0x5C0`–`0x5FF` | 读写 | 自定义 S 级 CSR |
| S | `0x900`–`0x9BF` | 读写 | 标准 S 级 CSR |
| S | `0x9C0`–`0x9FF` | 读写 | 自定义 S 级 CSR |
| S | `0xD00`–`0xDBF` | 只读 | 标准 S 级 CSR |
| S | `0xDC0`–`0xDFF` | 只读 | 自定义 S 级 CSR |
| H/VS | `0x200`–`0x2FF` | 读写 | 标准虚拟化 CSR |
| H/VS | `0x600`–`0x6BF` | 读写 | 标准虚拟化 CSR |
| H/VS | `0x6C0`–`0x6FF` | 读写 | 自定义虚拟化 CSR |
| H/VS | `0xA00`–`0xABF` | 读写 | 标准虚拟化 CSR |
| H/VS | `0xAC0`–`0xAFF` | 读写 | 自定义虚拟化 CSR |
| H/VS | `0xE00`–`0xEBF` | 只读 | 标准虚拟化 CSR |
| H/VS | `0xEC0`–`0xEFF` | 只读 | 自定义虚拟化 CSR |
| M | `0x300`–`0x3FF` | 读写 | 标准 M 级 CSR |
| M | `0x700`–`0x79F` | 读写 | 标准 M 级 CSR |
| M | `0x7A0`–`0x7AF` | 读写 | M 级可访问的调试触发器 CSR |
| Debug | `0x7B0`–`0x7BF` | 读写 | 仅 Debug Mode 可见 |
| M | `0x7C0`–`0x7FF` | 读写 | 自定义 M 级 CSR |
| M | `0xB00`–`0xBBF` | 读写 | 标准 M 级计数器 CSR |
| M | `0xBC0`–`0xBFF` | 读写 | 自定义 M 级 CSR |
| M | `0xF00`–`0xFBF` | 只读 | 标准 M 级信息 CSR |
| M | `0xFC0`–`0xFFF` | 只读 | 自定义 M 级 CSR |

访问不存在的 CSR、以不足的特权级访问 CSR，或写入只读 CSR，通常产生非法指令异常。表中的“标准”只表示地址由规范分配，不表示所有处理器都必须实现对应扩展。

### 六条 CSR 访问指令

`Zicsr` 定义三种寄存器形式和三种立即数形式。每条指令对单个 CSR 执行原子读改写，软件不会观察到指令内部的中间值。

| 指令 | 读操作 | 写操作 | 省略读或写的条件 |
| --- | --- | --- | --- |
| `csrrw rd, csr, rs1` | 旧值写入 `rd` | 将 `rs1` 完整写入 CSR | `rd=x0` 时不读取 CSR；写操作仍执行。 |
| `csrrs rd, csr, rs1` | 旧值写入 `rd` | 将 CSR 与 `rs1` 按位 OR 后写回 | `rs1=x0` 时只读，不执行写操作。 |
| `csrrc rd, csr, rs1` | 旧值写入 `rd` | 将 `rs1` 中为 1 的对应 CSR 位清零 | `rs1=x0` 时只读，不执行写操作。 |
| `csrrwi rd, csr, uimm` | 旧值写入 `rd` | 将 5 位零扩展立即数完整写入 CSR | `rd=x0` 时不读取 CSR。 |
| `csrrsi rd, csr, uimm` | 旧值写入 `rd` | 按立即数掩码置位 | `uimm=0` 时只读。 |
| `csrrci rd, csr, uimm` | 旧值写入 `rd` | 按立即数掩码清零 | `uimm=0` 时只读。 |

汇编器提供 `csrr`、`csrw`、`csrs`、`csrc` 等伪指令。例如 `csrr a0, mstatus` 通常展开为 `csrrs a0, mstatus, x0`。

### CSR 字段的写入类型

| 类型 | 含义 | 软件处理方式 |
| --- | --- | --- |
| WPRI | 保留写值、读时忽略 | 修改同一 CSR 的其他字段时，应保留这些位的原值。未实现字段通常读为 0。 |
| WLRL | 只允许写入有限的合法编码 | 软件只写规范列出的合法值；读回值一定属于合法集合。 |
| WARL | 可写任意值、读回合法值 | 实现可把不支持的写值转换成某个合法值；软件应写入后读回以确认实际设置。 |

## 当前规范分配的 U 级 CSR

下表覆盖当前特权规范列出的 U 级 CSR。带扩展名称的寄存器只在对应扩展存在时实现。

| 地址 | 名称 | 权限 | 所属功能 | 说明 |
| --- | --- | --- | --- | --- |
| `0x001` | `fflags` | URW | F/D/Q | 浮点累积异常标志。 |
| `0x002` | `frm` | URW | F/D/Q | 浮点动态舍入模式。 |
| `0x003` | `fcsr` | URW | F/D/Q | `frm` 与 `fflags` 的组合视图。 |
| `0x008` | `vstart` | URW | V | 向量指令开始处理的元素序号。 |
| `0x009` | `vxsat` | URW | V | 向量定点饱和累积标志。 |
| `0x00A` | `vxrm` | URW | V | 向量定点舍入模式。 |
| `0x00F` | `vcsr` | URW | V | `vxrm` 与 `vxsat` 的组合视图。 |
| `0x011` | `ssp` | URW | Zicfiss | 影子栈指针。 |
| `0x015` | `seed` | URW | 熵源扩展 | 密码随机数发生器的种子接口。 |
| `0x017` | `jvt` | URW | Zcmt | 表跳转基址与控制。 |
| `0xC00` | `cycle` | URO | Zicntr | 周期计数器的低 XLEN 位。 |
| `0xC01` | `time` | URO | Zicntr | 实时时钟计数值的低 XLEN 位。 |
| `0xC02` | `instret` | URO | Zicntr | 已退休指令数的低 XLEN 位。 |
| `0xC03`–`0xC1F` | `hpmcounter3`–`hpmcounter31` | URO | Zihpm | 性能监测计数器。 |
| `0xC20` | `vl` | URO | V | 当前向量长度。 |
| `0xC21` | `vtype` | URO | V | 当前向量元素宽度、寄存器组和非活动元素策略。 |
| `0xC22` | `vlenb` | URO | V | 单个向量寄存器的字节数。 |
| `0xC80` | `cycleh` | URO | Zicntr，RV32 | `cycle` 的高 32 位。 |
| `0xC81` | `timeh` | URO | Zicntr，RV32 | `time` 的高 32 位。 |
| `0xC82` | `instreth` | URO | Zicntr，RV32 | `instret` 的高 32 位。 |
| `0xC83`–`0xC9F` | `hpmcounter3h`–`hpmcounter31h` | URO | Zihpm，RV32 | 性能监测计数器的高 32 位。 |

## 当前规范分配的 S 级 CSR

| 地址 | 名称 | 权限 | 功能分类 | 说明 |
| --- | --- | --- | --- | --- |
| `0x100` | `sstatus` | SRW | trap 配置 | `mstatus` 中 S 级可见字段的受限视图。 |
| `0x104` | `sie` | SRW | trap 配置 | S 级中断使能。 |
| `0x105` | `stvec` | SRW | trap 配置 | S 级 trap 入口基址与模式。 |
| `0x106` | `scounteren` | SRW | 计数器 | 控制 U 级是否可读取各计数器。 |
| `0x10A` | `senvcfg` | SRW | 环境配置 | S 级执行环境功能控制。 |
| `0x10C`–`0x10F` | `sstateen0`–`sstateen3` | SRW | 状态使能 | 控制低特权级对扩展状态的访问。 |
| `0x120` | `scountinhibit` | SRW | 计数器 | S 级计数器停止控制。 |
| `0x140` | `sscratch` | SRW | trap 处理 | S 级 trap handler 临时寄存器。 |
| `0x141` | `sepc` | SRW | trap 处理 | 进入 S 级 trap 前的 PC。 |
| `0x142` | `scause` | SRW | trap 处理 | S 级 trap 的中断标志与原因码。 |
| `0x143` | `stval` | SRW | trap 处理 | 与 trap 原因相关的附加值。 |
| `0x144` | `sip` | SRW | trap 处理 | S 级中断挂起状态。 |
| `0x14D` | `stimecmp` | SRW | Sstc | S 级定时比较值。 |
| `0x14E` | `sctrctl` | SRW | 控制转移记录 | S 级控制转移记录控制。 |
| `0x14F` | `sctrstatus` | SRW | 控制转移记录 | S 级控制转移记录状态。 |
| `0x150` | `siselect` | SRW | Smcsrind/Sscsrind | S 级间接 CSR 选择。 |
| `0x151`–`0x153` | `sireg`–`sireg3` | SRW | Smcsrind/Sscsrind | S 级间接 CSR 别名 1–3。 |
| `0x155`–`0x157` | `sireg4`–`sireg6` | SRW | Smcsrind/Sscsrind | S 级间接 CSR 别名 4–6。 |
| `0x15D` | `stimecmph` | SRW | Sstc，RV32 | `stimecmp` 的高 32 位。 |
| `0x15F` | `sctrdepth` | SRW | 控制转移记录 | S 级控制转移记录深度。 |
| `0x180` | `satp` | SRW | 地址转换 | 地址转换模式、地址空间标识符和根页表物理页号。 |
| `0x181` | `srmcfg` | SRW | 资源管理 | S 级资源管理配置。 |
| `0x5A8` | `scontext` | SRW | 调试/跟踪 | S 级上下文标识。 |
| `0xDA0` | `scountovf` | SRO | 计数器 | S 级可见的计数器溢出状态。 |

## 当前规范分配的 M 级 CSR

M-mode 是唯一强制实现的特权级，但表中仍有多个 CSR 依赖可选扩展。实现不支持某个扩展时，对应地址不必存在。

| 地址 | 名称 | 权限 | 功能分类 | 说明 |
| --- | --- | --- | --- | --- |
| `0x300` | `mstatus` | MRW | trap 配置 | 全局中断、此前特权级、扩展上下文和内存访问控制。 |
| `0x301` | `misa` | MRW/WARL | ISA 配置 | `MXL` 与已实现扩展位；部分实现可只读。 |
| `0x302` | `medeleg` | MRW | trap 委托 | 将指定同步异常交给 S-mode。 |
| `0x303` | `mideleg` | MRW | trap 委托 | 将指定中断交给 S-mode。 |
| `0x304` | `mie` | MRW | trap 配置 | M/S 级各中断源使能位。 |
| `0x305` | `mtvec` | MRW | trap 配置 | M 级 trap 入口基址与模式。 |
| `0x306` | `mcounteren` | MRW | 计数器 | 控制 S/U 级能否访问硬件计数器。 |
| `0x30A` | `menvcfg` | MRW | 环境配置 | M 级对低特权级执行环境的控制。 |
| `0x30C`–`0x30F` | `mstateen0`–`mstateen3` | MRW | 状态使能 | 控制低特权级对扩展状态的访问。 |
| `0x310` | `mstatush` | MRW | trap 配置，RV32 | `mstatus` 的附加高位字段。 |
| `0x312` | `medelegh` | MRW | trap 委托，RV32 | `medeleg` 的高 32 位。 |
| `0x31A` | `menvcfgh` | MRW | 环境配置，RV32 | `menvcfg` 的高 32 位。 |
| `0x31C`–`0x31F` | `mstateen0h`–`mstateen3h` | MRW | 状态使能，RV32 | `mstateen*` 的高 32 位。 |
| `0x320` | `mcountinhibit` | MRW | 计数器 | 按位停止 `mcycle`、`minstret` 与性能计数器。 |
| `0x321` | `mcyclecfg` | MRW | Smcntrpmf | 周期计数器过滤配置。 |
| `0x322` | `minstretcfg` | MRW | Smcntrpmf | 指令退休计数器过滤配置。 |
| `0x323`–`0x33F` | `mhpmevent3`–`mhpmevent31` | MRW | Zihpm | 选择性能计数器统计的事件。 |
| `0x340` | `mscratch` | MRW | trap 处理 | M 级 trap handler 临时寄存器。 |
| `0x341` | `mepc` | MRW | trap 处理 | 进入 M 级 trap 前的 PC。 |
| `0x342` | `mcause` | MRW | trap 处理 | M 级 trap 的中断标志与原因码。 |
| `0x343` | `mtval` | MRW | trap 处理 | 错误地址、非法指令位或其他原因相关值。 |
| `0x344` | `mip` | MRW | trap 处理 | M/S 级各中断源挂起状态。 |
| `0x34A` | `mtinst` | MRW | H 扩展 | 转换后的 trap 指令信息。 |
| `0x34B` | `mtval2` | MRW | H 扩展 | 第二个 trap 附加值。 |
| `0x34E` | `mctrctl` | MRW | 控制转移记录 | M 级控制转移记录控制。 |
| `0x350` | `miselect` | MRW | Smcsrind | M 级间接 CSR 选择。 |
| `0x351`–`0x353` | `mireg`–`mireg3` | MRW | Smcsrind | M 级间接 CSR 别名 1–3。 |
| `0x355`–`0x357` | `mireg4`–`mireg6` | MRW | Smcsrind | M 级间接 CSR 别名 4–6。 |
| `0x3A0`–`0x3AF` | `pmpcfg0`–`pmpcfg15` | MRW | PMP | PMP 条目的权限和地址匹配方式；部分奇数编号仅用于 RV32。 |
| `0x3B0`–`0x3EF` | `pmpaddr0`–`pmpaddr63` | MRW | PMP | PMP 地址寄存器。实际条目数量由实现决定。 |
| `0x721`–`0x73F` | `mcyclecfgh`、`minstretcfgh`、`mhpmevent3h`–`mhpmevent31h` | MRW | Smcntrpmf，RV32 | 计数器过滤和事件选择的高 32 位。 |
| `0x740` | `mnscratch` | MRW | Smrnmi | 可恢复 NMI 临时寄存器。 |
| `0x741` | `mnepc` | MRW | Smrnmi | 可恢复 NMI 返回 PC。 |
| `0x742` | `mncause` | MRW | Smrnmi | 可恢复 NMI 原因。 |
| `0x744` | `mnstatus` | MRW | Smrnmi | 可恢复 NMI 状态。 |
| `0x747` | `mseccfg` | MRW | Smepmp | M 级安全配置。 |
| `0x757` | `mseccfgh` | MRW | Smepmp，RV32 | `mseccfg` 的高 32 位。 |
| `0x7A0` | `tselect` | MRW | 调试触发器 | 选择当前触发器。 |
| `0x7A1`–`0x7A3` | `tdata1`–`tdata3` | MRW | 调试触发器 | 触发器配置与比较数据。 |
| `0x7A8` | `mcontext` | MRW | 调试/跟踪 | M 级上下文标识。 |
| `0x7B0` | `dcsr` | DRW | Debug Mode | 调试控制和状态。M-mode 普通访问不可见。 |
| `0x7B1` | `dpc` | DRW | Debug Mode | 调试返回 PC。 |
| `0x7B2`–`0x7B3` | `dscratch0`–`dscratch1` | DRW | Debug Mode | 调试临时寄存器。 |
| `0xB00` | `mcycle` | MRW | 计数器 | 机器周期计数。 |
| `0xB02` | `minstret` | MRW | 计数器 | 已退休指令计数。 |
| `0xB03`–`0xB1F` | `mhpmcounter3`–`mhpmcounter31` | MRW | Zihpm | M 级性能监测计数器。 |
| `0xB80` | `mcycleh` | MRW | 计数器，RV32 | `mcycle` 的高 32 位。 |
| `0xB82` | `minstreth` | MRW | 计数器，RV32 | `minstret` 的高 32 位。 |
| `0xB83`–`0xB9F` | `mhpmcounter3h`–`mhpmcounter31h` | MRW | Zihpm，RV32 | M 级性能计数器的高 32 位。 |
| `0xF11` | `mvendorid` | MRO | 实现信息 | JEDEC 厂商编号。允许为 0。 |
| `0xF12` | `marchid` | MRO | 实现信息 | 架构实现编号。 |
| `0xF13` | `mimpid` | MRO | 实现信息 | 实现版本编号。 |
| `0xF14` | `mhartid` | MRO | 实现信息 | 当前硬件线程 ID。系统内必须唯一。 |
| `0xF15` | `mconfigptr` | MRO | 实现信息 | 配置数据结构指针；为 0 表示未提供。 |

H 扩展还定义 `hstatus`、`hedeleg`、`hideleg`、`hie`、`hgatp`、`htval`、`htinst`、`hgeip`、`vsstatus`、`vstvec`、`vsepc`、`vscause`、`vsatp` 等虚拟化 CSR。它们只在实现 H 扩展时存在，不属于基础 M/S trap 处理的必需状态。

## 与 trap 直接相关的字段

### `mstatus` 的主要控制字段

| 字段 | 位位置 | 作用 |
| --- | --- | --- |
| `SIE` | `[1]` | S-mode 全局中断使能。 |
| `MIE` | `[3]` | M-mode 全局中断使能。 |
| `SPIE` | `[5]` | 进入 S 级 trap 前保存的 `SIE`。 |
| `MPIE` | `[7]` | 进入 M 级 trap 前保存的 `MIE`。 |
| `SPP` | `[8]` | 进入 S 级 trap 前的特权级。 |
| `VS` | `[10:9]` | 向量状态：Off、Initial、Clean、Dirty。 |
| `MPP` | `[12:11]` | 进入 M 级 trap 前的特权级。 |
| `FS` | `[14:13]` | 浮点状态：Off、Initial、Clean、Dirty。 |
| `XS` | `[16:15]` | 其他扩展状态的摘要。通常只读。 |
| `MPRV` | `[17]` | M-mode 数据访问按 `MPP` 指定的特权级执行权限检查。 |
| `SUM` | `[18]` | S-mode 是否允许访问 U 级页中的数据。 |
| `MXR` | `[19]` | 是否允许从只可执行页读取数据。 |
| `TVM` | `[20]` | 在 S-mode 截获 `satp` 访问和 `SFENCE.VMA`。 |
| `TW` | `[21]` | 限制低特权级执行 `WFI`。 |
| `TSR` | `[22]` | 在 S-mode 截获 `SRET`。 |
| `SD` | `[XLEN-1]` | `FS`、`VS` 或 `XS` 为 Dirty 时置 1，供上下文保存代码快速判断。 |

trap 进入 M-mode 时，硬件执行等效状态更新：`MPIE ← MIE`、`MIE ← 0`、`MPP ← trap 前特权级`。执行 `mret` 时，`MIE ← MPIE`，当前特权级恢复为 `MPP`，并按规范重置返回相关字段。

### `mtvec`、`mepc`、`mcause` 与 `mtval`

| CSR | 关键字段 | 处理含义 |
| --- | --- | --- |
| `mtvec` | `BASE = mtvec[XLEN-1:2]`，`MODE = mtvec[1:0]` | `MODE=0` 时所有 trap 跳到 `BASE`；`MODE=1` 时同步异常跳到 `BASE`，中断跳到 `BASE + 4 × cause`。 |
| `mepc` | 可执行地址 | 保存被中断指令或产生异常指令的 PC。最低不可表示位读为 0。 |
| `mcause` | `Interrupt = mcause[XLEN-1]`，其余位为原因码 | 最高位区分异步中断与同步异常。 |
| `mtval` | 原因相关值 | 地址异常时通常保存错误地址；非法指令时可保存指令位；没有附加信息时为 0。 |

`mepc` 是否需要增加 2 或 4 取决于异常类型和指令长度。中断返回通常使用原 `mepc`；`ecall`、断点或软件已处理的非法指令需要由 handler 按预期处理行为决定后续 PC，不能统一执行固定增量。

### `mie` 与 `mip` 的标准中断位

| 位 | `mie` 名称 | `mip` 名称 | 中断来源 |
| --- | --- | --- | --- |
| 1 | `SSIE` | `SSIP` | S 级软件中断。 |
| 3 | `MSIE` | `MSIP` | M 级软件中断。 |
| 5 | `STIE` | `STIP` | S 级定时器中断。 |
| 7 | `MTIE` | `MTIP` | M 级定时器中断。 |
| 9 | `SEIE` | `SEIP` | S 级外部中断。 |
| 11 | `MEIE` | `MEIP` | M 级外部中断。 |
| 13 | `LCOFIE` | `LCOFIP` | Sscofpmf 本地计数器溢出中断。 |
| 16 及以上 | 平台或扩展定义 | 平台或扩展定义 | 实现和扩展规定的本地中断。 |

中断进入 M-mode 需要同时满足挂起位、使能位、委托设置、全局中断状态和特权级规则。`mip` 某些位由硬件只读驱动，某些位允许软件写入；必须按每个位的规范实现，而不能把整个 CSR 视为普通读写寄存器。

## M-mode trap 的硬件与软件分工

发生未委托给低特权级的 trap 时，硬件完成以下操作：

1. 将当前 PC 写入 `mepc`。
2. 将中断标志和原因码写入 `mcause`。
3. 按原因向 `mtval` 写入附加信息或零。
4. 更新 `mstatus.MPIE`、`MIE` 与 `MPP`。
5. 按 `mtvec.MODE` 计算入口地址并开始取指。

硬件不会自动保存 32 个整数寄存器。软件入口必须先取得可用的临时寄存器和栈，再保存后续处理代码会修改的上下文。`mscratch` 常保存当前 hart 的 trap 栈或控制块指针，入口用 `csrrw` 与某个整数寄存器交换。

```riscv
# RV64 示意：只展示入口结构，不是完整操作系统实现
trap_entry:
  csrrw t0, mscratch, t0
  sd    sp, 0(t0)          # 保存被中断上下文的 sp
  ld    sp, 8(t0)          # 装载该 hart 的 trap 栈

  addi  sp, sp, -32
  sd    ra, 24(sp)
  sd    t1, 16(sp)
  csrr  t1, mcause
  sd    t1, 8(sp)
  csrr  t1, mepc
  sd    t1, 0(sp)

  call  handle_trap

  ld    t1, 0(sp)
  csrw  mepc, t1
  ld    t1, 16(sp)
  ld    ra, 24(sp)
  addi  sp, sp, 32
  mret
```

完整入口还要处理所有被修改的 GPR、嵌套 trap、每 hart 栈、RV32/RV64 宽度、浮点与向量上下文、地址转换状态以及返回前的中断恢复顺序。若 handler 调用遵循 C ABI 的函数，入口必须先把调用者保存寄存器中属于被中断程序的值保存到上下文结构，因为 C 函数可以修改这些寄存器。

## RTL 实现中的关键规则

- CSR 解码同时检查地址是否存在、当前特权级、只读属性和扩展使能状态。
- `CSRRS`/`CSRRC` 的源寄存器为 `x0` 时不产生写访问，这一点会影响只读 CSR 和写副作用判断。
- WARL 字段需要确定合法化函数，并保证相同输入在同一实现上得到确定结果。
- trap 写 CSR、普通 CSR 指令和返回指令可能在同一流水线阶段竞争写口；必须规定优先级并保证精确异常。
- `mepc`、`mtvec.BASE` 与地址对齐受 `IALIGN` 及实现支持的指令长度影响。
- `mie`/`mip` 中每个位的可写属性不同，外部中断输入与软件写操作不能简单合并成普通寄存器写使能。
- `FS`、`VS` 和 `SD` 参与延迟上下文保存；浮点或向量状态发生写入时，应按规范更新 Dirty 状态。

参考：[RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)、[CSR 地址与字段规范](https://docs.riscv.org/reference/isa/priv/priv-csrs.html)、[Machine-Level ISA](https://docs.riscv.org/reference/isa/priv/machine.html)、[Supervisor-Level ISA](https://docs.riscv.org/reference/isa/priv/supervisor.html)。
