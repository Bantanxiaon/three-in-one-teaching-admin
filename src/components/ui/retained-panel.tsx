"use client";

import { createContext, useContext, type ReactNode } from "react";
const PanelVisibility = createContext(true);
export function usePanelVisibility() { return useContext(PanelVisibility); }
// Next 15 的内置 React 不提供 Activity；使用稳定 DOM 保留输入与筛选。
// 隐藏面板不参加布局、焦点与玻璃渲染；对话框通过相同上下文关闭门户显示。
export function RetainedPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <PanelVisibility.Provider value={active}>
    <div hidden={!active} inert={!active} style={{ display: active ? "contents" : "none" }}>{children}</div>
  </PanelVisibility.Provider>;
}
