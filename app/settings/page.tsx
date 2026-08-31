import Link from "next/link";
import { ChevronRight, CircleHelp, CupSoda, Images, ImagePlus, MoreHorizontal, Music2, Palette } from "lucide-react";
import { SettingsHeader } from "@/components/settings-header";

const settingsSections = [
  { href: "/settings/style", label: "スタイル", description: "明るさとテーマカラーを変更", icon: Palette },
  { href: "/settings/sound", label: "サウンド", description: "BGMと効果音の音量", icon: Music2 },
  { href: "/settings/tea", label: "ミルクティー", description: "思い出の粒・月替わり・演出のプレビュー", icon: CupSoda },
  { href: "/settings/album", label: "アルバム", description: "アルバムの設定", icon: Images },
  { href: "/settings/quiz", label: "クイズ", description: "クイズの設定", icon: CircleHelp },
  { href: "/settings/post", label: "写真の追加", description: "投稿画面の設定", icon: ImagePlus },
  { href: "/settings/more", label: "その他", description: "その他の設定", icon: MoreHorizontal },
] as const;

export default function SettingsPage() {
  return (
    <div className="page-pad">
      <SettingsHeader />

      <section className="pt-8 text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">PREFERENCES</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">設定</h1>
        <p className="mt-2 text-xs leading-6 text-ink/50">変更する項目を選んでください</p>
      </section>

      <nav className="mt-7 overflow-hidden rounded-2xl border border-line bg-ivory shadow-card" aria-label="設定項目">
        {settingsSections.map(({ href, label, description, icon: Icon }, index) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[70px] items-center gap-3.5 px-4 py-3 transition hover:bg-paper ${index < settingsSections.length - 1 ? "border-b border-line" : ""}`}
          >
            <span className="settings-section-icon"><Icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{label}</span>
              <span className="mt-1 block text-[11px] text-ink/48">{description}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-coral" strokeWidth={1.7} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
