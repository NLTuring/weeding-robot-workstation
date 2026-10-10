# -*- coding: utf-8 -*-
"""生成项目配图：系统总体架构图 + 标准作业流程图（宋体，GO-1 配色）"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import os

plt.rcParams["font.sans-serif"] = ["SimSun"]
plt.rcParams["axes.unicode_minus"] = False

ACCENT = "#D4875A"
ACCENT_D = "#B5703F"
GRAPH = "#1A2330"
SURF = "#F8F0EB"
LINE = "#DDD0C8"
MUT = "#6B7280"

OUT = os.path.dirname(os.path.abspath(__file__))


# ─────────────────────────────────────────────────────────────
# 图 1：系统总体架构图（分层）
# ─────────────────────────────────────────────────────────────
def arch_diagram():
    fig, ax = plt.subplots(figsize=(10.0, 6.7), dpi=200)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")

    layers = [
        ("感知层", ["USB 工业摄像头", "主动补光模块", "车速 / 位移传感器"], "田间信息实时采集"),
        ("计算层", ["RK3576 边缘计算主板", "RKNN 推理引擎", "YOLO 幼苗—杂草检测模型"], "端侧推理，无需联网"),
        ("决策层", ["目标去重与聚类", "像素→地面坐标映射", "作业序列规划", "安全阈值校验"], "从识别结果到作业指令"),
        ("执行层", ["机械除草机构 / 变量喷头", "运动与开关控制", "作业结果记录"], "定点、定量作业"),
        ("交互支撑层", ["触控屏人机界面", "手机 / 云端作业报告", "数据标注与模型迭代平台"], "可视化与持续迭代"),
    ]

    H = 14.0
    GAP = 4.0
    top = 92.0
    name_x = 5.0
    chip_x0 = 27.0
    chip_x1 = 96.0

    for i, (name, chips, note) in enumerate(layers):
        bottom = top - H * (i + 1) - GAP * i

        # 层外框
        ax.add_patch(FancyBboxPatch(
            (3, bottom), 94, H,
            boxstyle="round,pad=0,rounding_size=0.8",
            linewidth=1.0, edgecolor=LINE, facecolor=SURF, zorder=1))
        # 左侧色条
        ax.add_patch(FancyBboxPatch(
            (3, bottom + 1.5), 0.9, H - 3.0,
            boxstyle="round,pad=0,rounding_size=0.3",
            linewidth=0, facecolor=ACCENT, zorder=3))

        # 层名
        ax.text(name_x, bottom + H / 2, name, fontsize=11.5, fontweight="bold",
                color=GRAPH, va="center", ha="left", zorder=4)
        # 分层副注
        ax.text(name_x, bottom + H / 2 - 4.6, note, fontsize=6.8,
                color=MUT, va="center", ha="left", zorder=4)

        # 能力标签
        fs = 8.2
        while True:
            widths = [len(t) * fs * 0.148 + 4.2 for t in chips]
            gap = 1.6
            total = sum(widths) + gap * (len(chips) - 1)
            if total <= (chip_x1 - chip_x0) or fs <= 6.0:
                break
            fs -= 0.2
        avail = chip_x1 - chip_x0
        gap = 1.6 if len(chips) > 1 else 0
        if len(chips) > 1:
            gap = max((avail - sum(widths)) / (len(chips) - 1), 1.2)

        x = chip_x0
        for t, w in zip(chips, widths):
            ax.add_patch(FancyBboxPatch(
                (x, bottom + H / 2 - 2.6), w, 5.2,
                boxstyle="round,pad=0,rounding_size=0.5",
                linewidth=0.9, edgecolor=ACCENT_D, facecolor="#FFFFFF", zorder=4))
            ax.text(x + w / 2, bottom + H / 2, t, fontsize=fs, color=GRAPH,
                    va="center", ha="center", zorder=5)
            x += w + gap

        # 层间箭头
        if i < len(layers) - 1:
            y_from = bottom
            y_to = bottom - GAP
            ax.add_patch(FancyArrowPatch(
                (50, y_from), (50, y_to),
                arrowstyle="-|>", mutation_scale=13,
                linewidth=1.4, color=ACCENT, zorder=4))
            ax.text(51.5, (y_from + y_to) / 2, "数据流", fontsize=6.2,
                    color=MUT, va="center", ha="left", zorder=5)

    fig.savefig(os.path.join(OUT, "fig_arch.png"), bbox_inches="tight",
                pad_inches=0.12, facecolor="white")
    plt.close(fig)
    print("fig_arch.png ok")


# ─────────────────────────────────────────────────────────────
# 图 2：标准作业流程图（横向）
# ─────────────────────────────────────────────────────────────
def flow_diagram():
    fig, ax = plt.subplots(figsize=(11.0, 2.9), dpi=200)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis("off")

    steps = [
        ("图像采集", "摄像头逐帧取像"),
        ("图像预处理", "去噪 / 校正 / 缩放"),
        ("YOLO 端侧推理", "RK3576 NPU 加速"),
        ("幼苗—杂草判别", "分类 + 置信度"),
        ("目标定位聚类", "像素→地面坐标"),
        ("作业序列规划", "生成作业点位"),
        ("定点除草执行", "只作用杂草目标"),
        ("作业记录回传", "生成作业报告"),
    ]

    n = len(steps)
    left, right = 2.0, 98.0
    gap = 2.2
    w = (right - left - gap * (n - 1)) / n
    y0, h = 34.0, 40.0

    for i, (title, sub) in enumerate(steps):
        x = left + i * (w + gap)
        # 最后一步用强调色，突出闭环
        edge = ACCENT if i < n - 1 else ACCENT_D
        fc = "#FFFFFF" if i < n - 1 else SURF
        ax.add_patch(FancyBboxPatch(
            (x, y0), w, h,
            boxstyle="round,pad=0,rounding_size=1.2",
            linewidth=1.3, edgecolor=edge, facecolor=fc, zorder=2))

        # 序号圆点
        ax.add_patch(plt.Circle((x + w / 2, y0 + h - 5.4), 3.0,
                                facecolor=ACCENT if i < n - 1 else ACCENT_D,
                                edgecolor="none", zorder=4))
        ax.text(x + w / 2, y0 + h - 5.4, str(i + 1), fontsize=7.0, color="#FFFFFF",
                fontweight="bold", va="center", ha="center", zorder=5)

        ax.text(x + w / 2, y0 + h / 2 - 2.2, title, fontsize=8.4, fontweight="bold",
                color=GRAPH, va="center", ha="center", zorder=5)
        ax.text(x + w / 2, y0 + h / 2 - 9.4, sub, fontsize=6.4, color=MUT,
                va="center", ha="center", zorder=5)

        if i < n - 1:
            ax.add_patch(FancyArrowPatch(
                (x + w, y0 + h / 2), (x + w + gap, y0 + h / 2),
                arrowstyle="-|>", mutation_scale=10,
                linewidth=1.3, color=ACCENT, zorder=3))

    # 置信度不足的人工复核回路
    y_loop = 18.0
    x_s4 = left + 3 * (w + gap) + w / 2   # 判别
    x_s1 = left + 0 * (w + gap) + w / 2   # 采集
    ax.add_patch(FancyArrowPatch(
        (x_s4, y0), (x_s4, y_loop),
        arrowstyle="-", linewidth=1.1, color=MUT,
        linestyle=(0, (4, 3)), zorder=2))
    ax.add_patch(FancyArrowPatch(
        (x_s4, y_loop), (x_s1, y_loop),
        arrowstyle="-", linewidth=1.1, color=MUT,
        linestyle=(0, (4, 3)), zorder=2))
    ax.add_patch(FancyArrowPatch(
        (x_s1, y_loop), (x_s1, y0),
        arrowstyle="-|>", mutation_scale=10, linewidth=1.1, color=MUT,
        linestyle=(0, (4, 3)), zorder=2))
    ax.text((x_s1 + x_s4) / 2, y_loop + 4.2,
            "置信度低于安全阈值 → 标记复核、暂不作业（保护幼苗）",
            fontsize=6.6, color=MUT, va="bottom", ha="center", zorder=5)

    fig.savefig(os.path.join(OUT, "fig_flow.png"), bbox_inches="tight",
                pad_inches=0.12, facecolor="white")
    plt.close(fig)
    print("fig_flow.png ok")


if __name__ == "__main__":
    arch_diagram()
    flow_diagram()
