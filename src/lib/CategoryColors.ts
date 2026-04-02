export const CATEGORY_COLORS: Record<string, string> = {
    personal: "#4A7FB5", 
    work: "#B5824A",
    health: "#4AB587",
    finance: "#8B4AB5",
    learning: "#B5A44A",
};

export const CATEGORY_BG: Record<string, string> = {
    personal: "rgba(74,127,181,0.08)",
    work: "rgba(181,130,74,0.08)",
    health: "rgba(74,181,135,0.08)",
    finance: "rgba(139,74,181,0.08)",
    learning: "rgba(181,164,74,0.08)",
};

export function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] ?? "#8B8680";
}

export function getCategoryBg(category: string): string {
    return CATEGORY_BG[category] ?? "rgba(139,134,128,0.08)";
}
