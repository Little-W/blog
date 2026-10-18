---
title: DPV：数据路径验证与 C/C++—RTL 事务等价
tags: [形式验证, 数字IC, VC Formal, DPV]
---

# DPV：数据路径验证与 C/C++—RTL 事务等价使用指南

## 1. 解决的问题与 SEQ 的区别

高性能加法器、乘法器、DSP、编码器和浮点运算单元通常先建立不含硬件周期细节的 C/C++ 算法参考模型，后将其实现为多级流水 RTL。DPV 使用 HECTOR 技术对照高层事务模型和硬件实现的结果，目标是证明相同事务输入产生正确的输出结果，即便两边的执行阶段不同。

**SEQ** 一般比较两个顺序设计及其相关状态；**DPV** 强调事务级数据变换的对照，例如参考模型在一个函数中完成计算，RTL 则经过 4 个周期才输出。它并不把两个模型天真地逐拍对齐，而是需要声明输入与输出的**事务阶段关系**。

![DPV 的事务阶段对照](插图/13_DPV阶段.svg)

## 2. 典型应用示例：8 位加法器

参考 C++ 函数计算 `uint8_t y = (uint8_t)(a+b)`；RTL 可能有两拍流水线：第 1 拍接收 `a,b`，第 2 拍计算，第 3 拍向输出寄存器提交。若直接比较参考函数返回值与 RTL 每拍 `out`，即使算法正确也可能失败，因为没有处理有效标志和延迟。

需要定义：哪个事件接受一个输入事务；何时读取参考模型参数；RTL 在哪个 phase 输出结果；是否允许同时在流水线中有多个事务；操作是模 256 加法还是需要保留进位位。输入位宽、C++ 整数提升和有符号规则都必须统一。

## 3. C++ 事务接口的结构

User Guide 第 1067 页示例提到 `Hector::registerInput`、`Hector::registerOutput` 以及 `Hector::beginCapture`、`Hector::endCapture` 用于定义事务输入输出及捕获范围。实际完整 C++ 包装代码需要适配安装提供的 HECTOR 头文件与编译前端；**本教程不会凭空编写一个未经验证的完整 HECTOR API 程序并声称可执行**。下列普通 C++ 函数表达数学规格，可以作为普通 C++ 代码编译，但它不是 HECTOR wrapper：

```cpp
#include <cstdint>
uint8_t add_mod256(uint8_t a, uint8_t b) {
    return static_cast<uint8_t>(a + b);
}
```

编写正式 DPV C++ spec 时还应处理整型符号、移位、未定义行为、数组访问和宿主编译器的优化规则，否则会出现“高层规范自身就不精确”的问题。

### 3.1 完整 C++ 源文件与穷举自测

下面两个文件可以用普通 C++ 编译器构建，用于先确认参考函数的模 256 运算。它们不包含、也不伪装成 HECTOR 的接口包装；运行成功不等同于 DPV 已经证明 C++ 与 RTL 等价。

#### 3.1.1 参考函数完整源码

**保存为 `案例工程/cpp/add_mod256.cc`：**

<!-- source-begin: 案例工程/cpp/add_mod256.cc -->

```cpp
#include <cstdint>

// 普通 C++ 参考函数；此文件没有调用 HECTOR 接口。
std::uint8_t add_mod256(std::uint8_t a, std::uint8_t b) {
    const unsigned sum = static_cast<unsigned>(a)
                       + static_cast<unsigned>(b);
    return static_cast<std::uint8_t>(sum & 0xffu);
}
```

<!-- source-end -->

#### 3.1.2 完整自测程序

枚举 256×256 组输入，遇到不一致返回非零退出状态；检查的是参考函数，不是 RTL。

**保存为 `案例工程/cpp/add_mod256_selftest.cc`：**

<!-- source-begin: 案例工程/cpp/add_mod256_selftest.cc -->

```cpp
#include <cstdint>
#include <iostream>

std::uint8_t add_mod256(std::uint8_t a, std::uint8_t b);

int main() {
    unsigned tested = 0;
    for (unsigned a = 0; a < 256; ++a) {
        for (unsigned b = 0; b < 256; ++b) {
            const auto actual = add_mod256(
                static_cast<std::uint8_t>(a),
                static_cast<std::uint8_t>(b));
            const unsigned expected = (a + b) % 256u;
            if (static_cast<unsigned>(actual) != expected) {
                std::cerr << "Mismatch: a=" << a << " b=" << b << '\n';
                return 1;
            }
            ++tested;
        }
    }
    std::cout << "PASS: " << tested << " C++ input pairs\n";
    return 0;
}
```

<!-- source-end -->

**普通 C++ 自测命令（从 `案例工程/` 目录执行）：**

```bash
mkdir -p build
g++ -std=c++11 -Wall -Wextra -Werror \
  cpp/add_mod256.cc cpp/add_mod256_selftest.cc \
  -o build/add_mod256_selftest
./build/add_mod256_selftest
```

## 4. 创建双设计环境

User Guide §25.3 给出基本过程：创建设计、分析源代码、可选展开、编译数据流图。下面分别展示这两个阶段的命令（具体接口及参数仍需按现有工程修改）：

```tcl
set_fml_appmode DPV

proc compile_spec {} {
  create_design -name spec -top hector_wrapper
  cppan model.cc
  compile_design spec
}

proc compile_impl {} {
  create_design -name impl -top alu_pipe -clock clk -reset rst_n -negReset
  vcs -sverilog alu_pipe.sv
  compile_design impl
}

compile_spec
compile_impl
```

`create_design` 将 C++ 包装函数与 RTL 顶层分别定义成可比较的设计。`cppan` 分析 C++，`vcs`/`vlogan`/`vhdlan` 处理 RTL，`compile_design` 构造工具所需的内部结构。不能把 `compile_design` 与普通 FPV 的 `read_file` 混为一谈。

### 4.1 软件版本差异：C++11 前端开关

上传的快速参考稿写了 `set_hector_comp_use_new_flow true`，但 User Guide 第 1069 页给出的 Tcl 示例是：

```tcl
set _hector_comp_use_new_flow true
```

两者不是同一条 Tcl 命令，且 User Guide 指出 C++11 前端可能需要额外许可证。因此本教程以 User Guide 形式提示版本差异，正式脚本应在实际安装环境核验支持的变量及其配置方式，避免照抄未经核实的快速笔记。

### 4.2 原生 DPV 流程模板完整源码

此模板仍需要正式 HECTOR 包装函数和由实际捕获过程确定的阶段关系。不能把普通 `add_mod256` 函数直接重命名为 `hector_wrapper` 后宣称完成对接。

**保存为 `案例工程/templates/dpv_hector.tcl`：**

<!-- source-begin: 案例工程/templates/dpv_hector.tcl -->

```tcl
# DPV：C/C++ 与 RTL 计算结果对照。需要 HECTOR 事务包装与阶段定义。
error "此文件是 DPV 教学模板：补齐真实 HECTOR C++ wrapper 和 spec/impl 阶段定义"
# set_fml_appmode DPV
# set _hector_comp_use_new_flow true
# create_design -name spec -top hector_wrapper
# cppan /project/ref/model.cc
# compile_design spec
# create_design -name impl -top alu_pipe -clock clk -reset rst_n -negReset
# vcs -sverilog -f filelist_impl.f
# compile_design impl
# proc ual {} {
#   map_by_name -inputs -specphase 1 -implphase 1
#   map_by_name -outputs -specphase 1 -implphase 3
# }
# set_user_assumes_lemmas_procedure ual
# compose
# solveNB p
# puts [get_task_runtime p]
```

<!-- source-end -->

## 5. 通过阶段对应建立事务关系

```tcl
proc ual {} {
  map_by_name -inputs  -specphase 1 -implphase 1
  map_by_name -outputs -specphase 1 -implphase 3
}
set_user_assumes_lemmas_procedure "ual"
```

示例将参考模型输入第 1 阶段与 RTL 第 1 阶段相匹配，同时将参考模型输出第 1 阶段与 RTL 第 3 阶段相匹配。两边所使用的相位编号由实际 C++ wrapper/RTL 捕获和阶段定义决定；“第 3 阶段”只是这个例子的合法约定，不能机械用于所有流水线。

`map_by_name` 根据名称批量形成输入假设及输出对照关系；名称不同的信号需要显式指定。处理加法器输出时还要确保 C++ 与 SystemVerilog 的截断规则、运算宽度及溢出处理相同。

### 5.1 完整 RTL 与独立的时序检查

以下 RTL 有输入采集、求和、结果提交三个寄存器阶段。由于并发 SVA 在上升沿使用更新前的采样值，本例用接受输入后的第 3 个后继采样沿检查输出。这个 SVA 采样间隔不等于 HECTOR 阶段编号，不能由 `##3` 直接推导 DPV 的 `-implphase`。

#### 5.1.1 完整流水线 RTL

**保存为 `案例工程/rtl/alu_pipe_demo.sv`：**

<!-- source-begin: 案例工程/rtl/alu_pipe_demo.sv -->

```systemverilog
// 三个寄存器阶段：输入采集、求和、结果提交。
// 不含 ready/stall；in_valid=1 的每个上升沿都接受一项输入。
module alu_pipe_demo (
  input  logic       clk, rst_n, in_valid,
  input  logic [7:0] a, b,
  output logic       out_valid,
  output logic [7:0] out
);
  logic [7:0] a_q, b_q, sum_q;
  logic       valid_q, sum_valid;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      a_q       <= 8'd0;
      b_q       <= 8'd0;
      sum_q     <= 8'd0;
      out       <= 8'd0;
      valid_q   <= 1'b0;
      sum_valid <= 1'b0;
      out_valid <= 1'b0;
    end else begin
      valid_q   <= in_valid;
      sum_valid <= valid_q;
      out_valid <= sum_valid;
      if (in_valid) begin
        a_q <= a;
        b_q <= b;
      end
      if (valid_q)   sum_q <= a_q + b_q;
      if (sum_valid) out   <= sum_q;
    end
  end
endmodule
```

<!-- source-end -->

#### 5.1.2 完整 SVA

属性局部变量为每个并发事务保存自己的八位预期值；另一条属性检查有效标志的延迟关系。本例不含停止、反压或冲刷。

**保存为 `案例工程/formal/alu_pipe_demo_props.sv`：**

<!-- source-begin: 案例工程/formal/alu_pipe_demo_props.sv -->

```systemverilog
module alu_pipe_demo_props (
  input logic clk, rst_n, in_valid, out_valid,
  input logic [7:0] a, b, out
);
  // expected 只属于当前这一次属性匹配，连续事务不会共用一个值。
  property p_add_result;
    logic [7:0] expected;
    @(posedge clk) disable iff (!rst_n)
      (in_valid, expected = a + b)
      |-> ##3 (out_valid && out == expected);
  endproperty
  ap_add_result: assert property (p_add_result);

  logic [2:0] history_valid;
  always_ff @(posedge clk or negedge rst_n)
    if (!rst_n) history_valid <= 3'b000;
    else history_valid <= {history_valid[1:0], 1'b1};

  ap_valid_delay: assert property (@(posedge clk) disable iff (!rst_n)
    history_valid[2] |-> out_valid == $past(in_valid, 3));
  cp_consecutive_results: cover property (@(posedge clk) disable iff (!rst_n)
    out_valid ##1 out_valid ##1 out_valid);
endmodule

bind alu_pipe_demo alu_pipe_demo_props u_alu_props (.*);
```

<!-- source-end -->

#### 5.1.3 文件列表

**保存为 `案例工程/filelist_fpv_alu_demo.f`：**

<!-- source-begin: 案例工程/filelist_fpv_alu_demo.f -->

```text
./rtl/alu_pipe_demo.sv
./formal/alu_pipe_demo_props.sv
```

<!-- source-end -->

#### 5.1.4 配套 FPV 脚本

这是检查 RTL 事务行为的独立练习，不会自动构成 C++—RTL 的 DPV 证明。

**保存为 `案例工程/scripts/fpv_alu_demo.tcl`：**

<!-- source-begin: 案例工程/scripts/fpv_alu_demo.tcl -->

```tcl
# 从案例工程目录执行；结果必须以本机 VC Formal 日志为准。
set_fml_appmode FPV
read_file -top alu_pipe_demo -sva -format sverilog -vcs {-f filelist_fpv_alu_demo.f}
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
vcf -f scripts/fpv_alu_demo.tcl -batch 2>&1 | tee logs/fpv_alu_demo.log
```

## 6. 证明与报告

```tcl
# 在属性已经创建、设计已经编译的前提下运行
check_fv
proofwait
listproofs
listassumes
listlemmas
listcovers
```

对于特定证明对象，DPV 也支持 `solveNB proofName`、`solveNB_init proofName` 等命令；在工程中需要先明确 proof 的名称。调试可以查看对应的反例及 `simcex`，但 C++ 参考模型和 RTL 的相位关系必须正确才能解释差异。

## 7. 完整可验证事务的六个核对项

1. 输入采集的条件是什么，例如 `in_valid && in_ready`。
2. 每个输入事务是否有唯一的 ID 或输出顺序保证。
3. 参考模型与 RTL 对同一个事务使用完全一致的参数。
4. 输出可比较时的有效标志和阶段编号是否正确。
5. 输出整数截断、饱和、舍入和异常处理是否一致。
6. 复位、气泡、停顿、反压、流水线冲刷等情况是否定义在两边的行为中。

若第 1 阶段输入有效但后续遇到 `stall`，事务完成时间可能不是固定三拍，那么应进一步建模阶段条件或使用其他机制，不能持续使用不成立的固定延迟前提。

## 8. 命令语法、参数与用例

| 命令 | 主要作用 |
| --- | --- |
| `create_design` | 创建数据路径参考或实现设计 |
| `cppan` | 分析 C 或 C++ 参考模型 |
| `vcs` | 分析或展开 DPV 的 RTL 实现 |
| `vlogan` | 分析混合语言中的 Verilog 文件 |
| `vhdlan` | 分析混合语言中的 VHDL 文件 |
| `compile_design` | 将已分析设计编译为数据流图 |
| `set_user_assumes_lemmas_procedure` | 注册事务对应与限制的 Tcl 过程 |
| `map_by_name〔DPV〕` | 为 DPV 建立事务阶段对应 |
| `assume` | 在 DPV 中声明输入关系或合法值 |
| `lemma` | 在 DPV 中声明输出等价目标 |
| `compose` | 组合参考和实现及其事务关系 |
| `solveNB` | 启动 DPV 证明 |
| `get_task_runtime` | 查询 DPV 任务运行时间 |
| `proofwait` | 等待已启动的证明计算 |
| `listproofs` | 列出证明结果 |
| `listassumes` | 列出当前假设 |
| `listlemmas` | 列出待证明引理 |
| `listcovers` | 列出覆盖目标 |

本组说明的是 UG 给出的入门工作流程。DPV 的完整前端参数、HECTOR 事务包装和高级证明命令在专用 Data Path Validation User Guide 中另行定义；本次提供的参考文件不包含那份手册，因而不把命令示例补写成没有来源支持的完整参数全集。这里的 C/C++ 编译、设计组合和证明启动属于不同阶段，不能把过程定义成功当作等价证明成功。

### 8.1 `create_design`：创建数据路径参考或实现设计

```text
create_design -name <design_name> -top <top_function_or_module>
              [-clock <clock_port>] [-reset <reset_port>] [-negReset]
```

**参数解释。** `-name` 建立后续编译引用的设计名，通常为 spec、impl；`-top` 对 C++ 是捕获包装函数，对 RTL 是模块。`-clock`、`-reset` 描述 RTL 端口；`-negReset` 表示低有效复位，省略时为高有效。

**用法与结果。** 这是 DPV/HECTOR 设计创建接口，不能用普通 `create_clock`、`create_reset` 的语法替代这些选项。C++ 包装须通过 `Hector::registerInput`、`Hector::registerOutput` 和 capture 区间定义事务；只有普通 C++ 函数而未声明输入输出，不能自动得到正确比较问题。

```tcl
proc compile_spec {} {
  create_design -name spec -top hector_wrapper
  cppan spec.cc
  compile_design spec
}
proc compile_impl {} {
  create_design -name impl -top adder -clock clk -reset rst_n -negReset
  vcs impl.v
  compile_design impl
}
```

来源：User Guide，X-2025.06-SP1，第 1067–1069 页。

### 8.2 `cppan`：分析 C 或 C++ 参考模型

```text
cppan <options> <source_files>
```

**参数解释。** 位置参数是源码文件列表，选项由 DPV 的 C/C++ 前端解释。UG 本章没有逐一列出所有编译开关，因此保留实际展示的最小形式，不把未经核对的编译器参数假定为兼容。

**用法与结果。** 先 `create_design` 再分析，之后用 `compile_design` 转换为数据流图。该基线同时说明旧 C++99 和新 C++11 前端；切换新前端涉及配置与额外许可。不能由本机 g++ 成功编译推断 DPV 前端也接受全部现代 C++ 特性。

```tcl
create_design -name spec -top hector_wrapper
cppan spec.cc
compile_design spec
```

来源：User Guide，X-2025.06-SP1，第 1068–1069 页。

### 8.3 `vcs`：分析或展开 DPV 的 RTL 实现

```text
vcs <options> [<source_files>]
```

**参数解释。** 纯 Verilog 流程可直接提供源码完成分析与展开；混合语言先用 `vlogan` 和 `vhdlan` 分析，再用 `vcs` 展开。这里的调用处在 DPV Tcl 中，而不是在示例脚本内启动普通仿真测试。

**用法与结果。** 语法中的 `<options>` 是前端选项占位，不能原样复制运行。选项和语言支持应以配套 DPV 与前端参考为准；本教程给出的最小调用与 UG 的可见示例一致。

```tcl
create_design -name impl -top adder -clock clk -reset rst_n -negReset
vcs impl.v
compile_design impl
```

来源：User Guide，X-2025.06-SP1，第 1068–1069 页。

### 8.4 `vlogan`：分析混合语言中的 Verilog 文件

```text
vlogan <options> <source_files>
```

**参数解释。** 输入为Verilog/SystemVerilog源码列表，分析选项由相应前端解释。UG 本章只给出这种一般调用形式，没有列出完整开关清单。

**用法与结果。** 混合语言分析完成后仍要展开并生成数据流图。库、编译顺序和顶层绑定必须相容；分析阶段通过不能代替模型建立成功。

```tcl
vlogan impl.v
```

来源：User Guide，X-2025.06-SP1，第 1068 页。

### 8.5 `vhdlan`：分析混合语言中的 VHDL 文件

```text
vhdlan <options> <source_files>
```

**参数解释。** 输入为VHDL源码列表，分析选项由相应前端解释。UG 本章只给出这种一般调用形式，没有列出完整开关清单。

**用法与结果。** 混合语言分析完成后仍要展开并生成数据流图。库、编译顺序和顶层绑定必须相容；分析阶段通过不能代替模型建立成功。

```tcl
vhdlan arith_pkg.vhd arith.vhd
```

来源：User Guide，X-2025.06-SP1，第 1068 页。

### 8.6 `compile_design`：将已分析设计编译为数据流图

```text
compile_design <design_name>
```

**参数解释。** 位置参数必须对应先前 `create_design -name` 建立的名称，例如 spec 或 impl。

**用法与结果。** 此步骤把参考或实现设计编译为后续比较使用的数据流图。它还没有建立两侧输入、输出及事务阶段关系；这些关系由 compose 阶段的用户过程提供。

```tcl
create_design -name spec -top hector_wrapper
cppan spec.cc
compile_design spec
```

来源：User Guide，X-2025.06-SP1，第 1068–1069 页。

### 8.7 `set_user_assumes_lemmas_procedure`：注册事务对应与限制的 Tcl 过程

```text
set_user_assumes_lemmas_procedure <procedure_name>
```

**参数解释。** 参数是用户自行定义的 Tcl 过程名，而不是一条直接进行证明的断言。compose 阶段调用此过程来创建输入假设和输出比较目标。

**用法与结果。** 不要把示例中的 ual、compile_spec、compile_impl 当作工具内置命令；它们是教程或工程定义的过程。普通 Tcl `proc` 的过程体仍需完整写在脚本中。

```tcl
proc ual {} {
  map_by_name -inputs -specphase 1 -implphase 1
  map_by_name -outputs -specphase 1 -implphase 3
  assume legal_opcode = impl.in_opcode(1) == 1'b0
}
set_user_assumes_lemmas_procedure ual
```

来源：User Guide，X-2025.06-SP1，第 1069–1070 页。

### 8.8 `map_by_name〔DPV〕`：为 DPV 建立事务阶段对应

```text
map_by_name -inputs -specphase <phase> -implphase <phase>
map_by_name -outputs -specphase <phase> -implphase <phase>
```

**参数解释。** `-inputs` 为同名输入生成相等假设，`-outputs` 为同名输出生成待证明 lemma。`-specphase`、`-implphase` 分别指定参考和实现的事务阶段，它们不是 SEQ 的 `-spec_latency`、`-impl_latency`。

**用法与结果。** 一个 C++ 事务结果可能对应流水 RTL 第三阶段的输出，因此不能仅按名称直接同拍比较。阶段对应还必须与 valid、使能、复位后起始事务一致；错误阶段常使算术本身正确的设计出现反例。

```tcl
proc ual {} {
  map_by_name -inputs -specphase 1 -implphase 1
  map_by_name -outputs -specphase 1 -implphase 3
}
set_user_assumes_lemmas_procedure ual
```

来源：User Guide，X-2025.06-SP1，第 1070 页。

### 8.9 `assume`：在 DPV 中声明输入关系或合法值

```text
assume <name> = <expression>
```

**参数解释。** 名称标识假设，等号后是 HECTOR 表达式；`impl.in_a(1)` 表示实现设计指定事务阶段的信号，不是普通 SystemVerilog 函数调用。

**用法与结果。** 用于建立两侧输入一致和真实合法输入限制。它与 `fvassume -expr` 属于不同命令接口，不应跨应用混抄。所有假设仍需要规格依据，否则可以把实际不等价的输入排除。

```tcl
proc ual {} {
  assume same_a = spec.in_a(1)[7:0] == impl.in_a(1)[7:0]
  assume legal_op = impl.in_opcode(1) == 1'b0
}
set_user_assumes_lemmas_procedure ual
```

来源：User Guide，X-2025.06-SP1，第 1070 页。

### 8.10 `lemma`：在 DPV 中声明输出等价目标

```text
lemma <name> = <expression>
```

**参数解释。** 名称标识待证明目标；表达式通常比较两侧指定阶段的输出。它不是无条件成立的输入假设。

**用法与结果。** 在输入对应和事务条件已建立后证明 lemma。需要多个输出或多个操作模式时，分别命名，有助于区分位宽、符号扩展、溢出和流水时刻的问题。

```tcl
proc ual {} {
  assume same_a = spec.in_a(1)[7:0] == impl.in_a(1)[7:0]
  assume same_b = spec.in_b(1)[7:0] == impl.in_b(1)[7:0]
  lemma same_sum = spec.out_sum(1) == impl.out_sum(3)
}
set_user_assumes_lemmas_procedure ual
```

来源：User Guide，X-2025.06-SP1，第 1070 页。

### 8.11 `compose`：组合参考和实现及其事务关系

```text
compose
```

**参数解释。** 使用已编译的 spec、impl 设计以及已注册的假设/lemma 过程，构造双设计比较环境；本章介绍的是无参数流程入口。

**用法与结果。** 必须在两侧编译成功之后执行。看到双设计层次不等于输入已经正确对应，仍需检查生成的假设、lemma 和阶段关系。UG 把更详细的 compose 配置交给独立 DPV 手册，本教程不补造未提供的完整语法。

```tcl
compile_spec
compile_impl
compose
```

来源：User Guide，X-2025.06-SP1，第 1071 页。

### 8.12 `solveNB`：启动 DPV 证明

```text
solveNB <proof_name>
```

**参数解释。** 参数为证明任务名称；UG 文字说明用该命令启动 lemma 证明，并可由图形界面查看相应 proof/subproof。

**用法与结果。** 这是非阻塞求解入口。运行后应等待任务实际结束再解释状态或保存最终报告，不能把 Tcl 返回解释为已证明。其完整等待、脚本选择和资源接口应与配套 DPV 参考一起核对，不能套用 `check_fv -block` 的选项。

```tcl
compose
solveNB adder_equivalence
```

来源：User Guide，X-2025.06-SP1，第 1070–1071 页。

### 8.13 `get_task_runtime`：查询 DPV 任务运行时间

```text
get_task_runtime <task_name>
```

**参数解释。** 参数是 GUI Task List 或脚本中建立的任务名，返回总运行时间，格式为 HOURS:MM:SS。

**用法与结果。** 该时间可以用于记录资源实验，但不能单凭时间判定证明状态。比较性能时同时记录硬件、脚本、阶段关系、前端设置以及最终任务结果。

```tcl
get_task_runtime adder_equivalence
```

来源：User Guide，X-2025.06-SP1，第 1071 页。

### 8.14 `proofwait`：等待已启动的证明计算

```text
proofwait
```

**参数解释。** 快速参考给出无参数的等待调用。它用于等待此前已经启动的证明，不负责创建设计、建立对应关系或生成引理。

**用法与结果。** 等待返回之后仍须读取证明状态，不能用“等到结束”代替“已经证明”。UG 第 1071 页另行强调，在 DPV 中不能依赖 `proofwait -nokill` 禁止自动终止无进展任务；应使用该流程规定的 `set_vcf_auto_job_kill` 变量配置。此处不补写未在提供资料中展开的其他等待选项。

```tcl
check_fv
proofwait
listproofs
```

来源：Quick Reference Guide，X-2025.06-SP1，第 30 页。

### 8.15 `listproofs`：列出证明结果

```text
listproofs
```

**参数解释。** 快速参考给出这里的无参数调用形式。命令用于相应的 DPV 证明环境；提供的 UG 未逐项列出其完整可选参数，因此本条不构造额外过滤开关。

**用法与结果。** 检查证明对象是否实际创建、是否有未完成或失败结果。证明列表不是用户引理文本本身，也不保证所有预期事务均已纳入范围。 与其他报告一起保留当前设计版本和阶段对应设置，避免把不同事务模型下的报告混在一起。

```tcl
listproofs
```

来源：Quick Reference Guide，X-2025.06-SP1，第 30 页。

### 8.16 `listassumes`：列出当前假设

```text
listassumes
```

**参数解释。** 快速参考给出这里的无参数调用形式。命令用于相应的 DPV 证明环境；提供的 UG 未逐项列出其完整可选参数，因此本条不构造额外过滤开关。

**用法与结果。** 确认参考设计与实现之间的输入关系，以及用户附加的运行前提。特别检查有没有把要比较的输出直接写成相等假设。 与其他报告一起保留当前设计版本和阶段对应设置，避免把不同事务模型下的报告混在一起。

```tcl
listassumes
```

来源：Quick Reference Guide，X-2025.06-SP1，第 30 页。

### 8.17 `listlemmas`：列出待证明引理

```text
listlemmas
```

**参数解释。** 快速参考给出这里的无参数调用形式。命令用于相应的 DPV 证明环境；提供的 UG 未逐项列出其完整可选参数，因此本条不构造额外过滤开关。

**用法与结果。** 核对每条输出关系的参考阶段、实现阶段和有效条件。列出引理只表示目标存在，不能视为该目标已经证明。 与其他报告一起保留当前设计版本和阶段对应设置，避免把不同事务模型下的报告混在一起。

```tcl
listlemmas
```

来源：Quick Reference Guide，X-2025.06-SP1，第 30 页。

### 8.18 `listcovers`：列出覆盖目标

```text
listcovers
```

**参数解释。** 快速参考给出这里的无参数调用形式。命令用于相应的 DPV 证明环境；提供的 UG 未逐项列出其完整可选参数，因此本条不构造额外过滤开关。

**用法与结果。** 覆盖目标用于查看某个操作码、有效事务或完成条件是否可以发生。覆盖成功只提供存在性证据，不代替所有输入下的事务等价。 与其他报告一起保留当前设计版本和阶段对应设置，避免把不同事务模型下的报告混在一起。

```tcl
listcovers
```

来源：Quick Reference Guide，X-2025.06-SP1，第 30 页。

## 9. 数据路径证明困难时的策略

分清是**规格定义错误**（C++ 的有符号性/未定义行为）、**阶段设置错误**（错误的输入输出相位）、**RTL 功能错误**，还是**求解规模困难**（乘法/除法/浮点运算）。先用较小位宽和少量操作码验证模型，再推广到完整位宽。必要时按指令类别切分证明目标，或利用 DPV 特有的重写与求解脚本；引擎调优应晚于正确的事务接口设置。

## 10. 官方参考

User Guide §25（1066～1080 页）、Quick Reference Guide DPV 部分。更深入的 HECTOR 包装函数、内部 phase、定制求解策略应以单独的 *VC Formal Data Path Validation User Guide* 为准，不能由通用 UG 的十余页简介替代。
