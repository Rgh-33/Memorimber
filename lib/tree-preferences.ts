export type TreeDisplayMode = "classic" | "expanding";

export const DEFAULT_TREE_DISPLAY_MODE: TreeDisplayMode = "classic";
export const TREE_DISPLAY_MODE_STORAGE_KEY = "memorimber-tree-mode";

export const TREE_DISPLAY_MODES: readonly {
  id: TreeDisplayMode;
  label: string;
  description: string;
}[] = [
  {
    id: "classic",
    label: "12個の木",
    description: "整った1本の木に最大12個の実を表示します。収穫すると待機中の実が空いた枝へ育ちます。",
  },
  {
    id: "expanding",
    label: "無制限の木",
    description: "投稿数に合わせて木全体が成長し、すべての実を表示します。",
  },
] as const;

export function parseTreeDisplayMode(value: string | null): TreeDisplayMode {
  return value === "classic" || value === "expanding" ? value : DEFAULT_TREE_DISPLAY_MODE;
}
