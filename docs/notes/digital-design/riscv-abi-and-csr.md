---
title: RISC-V：整数 ABI、CSR 与 trap 处理
sidebar_position: 6
---

# RISC-V：整数 ABI、CSR 与 trap 处理

RISC-V 的整数寄存器只有 `x0` 到 `x31`，但它们在 ABI 中承担明确角色。特权软件通过 CSR（Control and Status Register）配置中断、异常入口、上下文状态和性能计数器。ABI 约定与 trap 软件入口共同决定寄存器的保存和恢复要求。

## 通用寄存器与调用约定

| 寄存器 | ABI 名称 | 约定 |
| --- | --- | --- |
| `x0` | `zero` | 恒为 0，写入被丢弃 |
| `x1` | `ra` | 返回地址 |
| `x2` | `sp` | 栈指针 |
| `x3` / `x4` | `gp` / `tp` | 全局指针 / 线程指针 |
| `x5`–`x7`、`x28`–`x31` | `t0`–`t6` | 调用者保存的临时寄存器 |
| `x8`–`x9`、`x18`–`x27` | `s0`–`s11` | 被调用者保存；`s0` 也可作 `fp` |
| `x10`–`x17` | `a0`–`a7` | 参数与返回值；`a0` / `a1` 常承载返回值 |

“调用者保存”表示调用前若仍需要该值，调用方必须自己保存；“被调用者保存”表示函数使用它们时，应在返回前恢复。寄存器别名是 ABI 约定而非硬件限制，汇编器也接受 `x10` 这样的物理名称。

一个典型的叶子函数不需要栈帧；只有需要保存 `ra`、`s*` 寄存器或为局部对象分配空间时才调整 `sp`：

```riscv
sum2:
  add a0, a0, a1    # 第一个参数寄存器同时保存返回值
  ret
```

## CSR 指令是原子读改写

CSR 地址为 12 位。实际可用寄存器取决于实现的特权级和扩展；不要把 CSR 地址表当成所有 RV32/RV64 核都必须实现的清单。`Zicsr` 扩展定义了六条基本访问指令：

| 指令 | 效果 | 常见用途 |
| --- | --- | --- |
| `csrrw rd, csr, rs1` | 读旧值到 `rd`，写 `rs1` | 覆盖设置 |
| `csrrs rd, csr, rs1` | 读旧值，按位 OR 写回 | 置位使能 |
| `csrrc rd, csr, rs1` | 读旧值，按位清零写回 | 关闭指定使能 |
| `csrrwi/csrrsi/csrrci` | 上述三种的 5 位立即数版本 | 常量掩码 |

`rs1 = x0` 时，`CSRRS`/`CSRRC` 不会修改 CSR，因此常用作读取伪指令的底层形式。对有副作用的 CSR，读取和写入的精确定义必须以对应规范与实现手册为准。

```riscv
# 读取 mstatus；汇编器通常把它显示为 csrr a0, mstatus
csrrs a0, mstatus, zero

# 设置 mie 中由 t0 指定的位，同时保留其他位
csrrs zero, mie, t0

# 清除同一组位
csrrc zero, mie, t0
```

## 机器模式最常见的 CSR

| CSR | 作用 |
| --- | --- |
| `mstatus` | 全局机器中断开关、此前特权级、浮点/向量上下文状态等 |
| `mie` / `mip` | 各类机器中断的使能位 / 挂起位 |
| `mtvec` | trap 入口基址与 direct/vectored 模式 |
| `mepc` | trap 前的程序计数器 |
| `mcause` | 最高位区分 interrupt 与 exception，其余位给出原因码 |
| `mtval` | 与原因相关的附加值，例如错误地址或非法指令信息 |
| `mscratch` | M-mode trap handler 的临时上下文指针 |

`mstatus.MIE` 是全局门控，`mie` 是类别门控，`mip` 表示待处理的中断请求。某类中断能否被 M-mode 接收，通常需要全局使能、相应 `mie` 位、对应 pending 条件与优先级规则共同满足。

## trap 的最小路径

以 M-mode 异常或中断为例，硬件和软件各自负责不同部分：

```text
发生 trap
  → 硬件写入 mepc / mcause，按原因写入 mtval（若定义）
  → 按 mtvec 的模式进入处理入口，并更新 mstatus 中的返回相关状态
  → 软件保存会使用的上下文，解析 mcause，处理异常或中断
  → 软件恢复上下文，执行 mret
  → 硬件按保存的状态恢复执行点与特权级
```

最小的入口通常先交换 `sp` 与 `mscratch`，使 handler 得到独立栈，再保存调用约定要求保护的寄存器。具体保存集合由异常入口、是否调用 C 函数、是否启用浮点/向量状态以及操作系统 ABI 决定。

```riscv
trap_entry:
  csrrw sp, mscratch, sp
  addi  sp, sp, -16
  sw    ra, 12(sp)
  csrr  a0, mcause
  csrr  a1, mepc
  call  handle_trap
  lw    ra, 12(sp)
  addi  sp, sp, 16
  csrrw sp, mscratch, sp
  mret
```

上例只说明控制流，不能直接当作通用 handler：RV64 的保存宽度、栈对齐、嵌套 trap、防重入和浮点/向量上下文均需按目标系统补充。

## 软件与 RTL 检查项目

- 软件侧：确认 ABI 保存规则、栈对齐和 `mepc` 的推进策略；同步异常通常不能一律返回原 PC。
- RTL 侧：将 CSR 的读写权限、WARL 字段、保留位和复位值按规范分开建模。
- 中断侧：分别验证 `mstatus.MIE`、`mie`、`mip`、委托和优先级，避免只检查其中一个门控。
- 验证侧：为 trap 前后 `mepc`、`mcause`、特权级恢复和禁止中断窗口写断言及覆盖目标。

参考：[RISC-V CSR 规范](https://docs.riscv.org/reference/isa/priv/priv-csrs.html)、[Machine-Level ISA](https://docs.riscv.org/reference/isa/priv/machine.html)。
